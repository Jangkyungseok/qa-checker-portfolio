// Real local PostgreSQL + Nest HTTP tests. Own fixtures only; no production access.
const assert=require('node:assert/strict'),path=require('node:path');
const {randomUUID,randomBytes,createHash}=require('node:crypto'),{spawn}=require('node:child_process');
const {Pool}=require('pg'),bcrypt=require('bcrypt');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const url=process.env.DATABASE_URL?new URL(process.env.DATABASE_URL):null;
assert(['localhost','127.0.0.1'].includes(url?.hostname??process.env.DB_HOST));
assert.equal(Number(url?.port??process.env.DB_PORT),5433);
assert.equal(url?.pathname??'/'+process.env.DB_NAME,'/qa_checker');
const db=new Pool(url?{connectionString:url.href}:{host:process.env.DB_HOST,port:5433,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const users=[],projects=[],port=3012,base=`http://127.0.0.1:${port}`;let child,adminSession,passed=0;
async function api(token,route,status=200){const r=await fetch(base+route,{headers:token?{Authorization:'Bearer '+token}:{}});const body=await r.json();assert.equal(r.status,status,JSON.stringify(body));return body;}
async function user(role,status='APPROVED'){
  const id=randomUUID(),email=`report-${id}@example.invalid`,password=randomBytes(16).toString('hex');
  await db.query('INSERT INTO users(id,email,password_hash,name,role,status) VALUES($1,$2,$3,$4,$5,$6)',[id,email,await bcrypt.hash(password,4),'Report test',role,status]);users.push(id);
  const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const body=await r.json();assert.equal(r.status,status==='APPROVED'?201:401);return {id,token:body.token};
}
async function fingerprint(){const result={};for(const t of ['projects','users','defects','defect_comments','defect_activities','defect_attachments','build_histories','inspections','qa_decision_memories'])result[t]=(await db.query(`SELECT md5(coalesce(string_agg(row_to_json(t)::text,'|' ORDER BY id),'')) hash FROM ${t} t`)).rows[0].hash;return result;}
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
async function main(){const before=await fingerprint();try{
  child=spawn(process.execPath,['dist/main.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port)},stdio:['ignore','ignore','pipe']});let logs='';child.stderr.on('data',d=>logs+=d);
  let ready=false;for(let n=0;n<100;n++){if(child.exitCode!==null)throw Error(logs);try{if((await fetch(base+'/auth/me')).status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}assert(ready);
  const a=await user('USER'),leader=await user('LEADER');await user('USER','PENDING');
  // Existing single ADMIN account is untouched; only this temporary test session is removed.
  const admin={token:randomBytes(32).toString('hex')};
  const adminId=(await db.query("SELECT id FROM users WHERE role='ADMIN' AND status='APPROVED'")).rows[0].id;
  adminSession=randomUUID();await db.query("INSERT INTO user_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",[adminSession,adminId,createHash('sha256').update(admin.token).digest('hex')]);
  for(let i=0;i<3;i++){const p=(await db.query('INSERT INTO projects(name,created_by) VALUES($1,$2) RETURNING id',[`Report-${randomUUID()}`,a.id])).rows[0];projects.push(p.id);}
  const [project,empty,other]=projects;
  const today=(await db.query("SELECT ((now() AT TIME ZONE 'Asia/Seoul')::date::timestamp AT TIME ZONE 'Asia/Seoul') AS t")).rows[0].t;
  const days=n=>new Date(today.getTime()-n*86400000),recent=new Date(today.getTime()+1000);
  async function issue(status,priority='NORMAL',frequency='PERCENT_100',build='1.0',created=recent,pid=project){
    return (await db.query(`INSERT INTO defects(project_id,title,description,steps_to_reproduce,fix_direction,priority,reproducibility,build_version,status,created_by,updated_by,created_at,closed_by,closed_at)
      VALUES($1,$2,'body','steps','fix',$3,$4,$5,$6,$7,$7,$8,CASE WHEN $6::varchar IN ('VERIFIED','SKIP_CONFIRMED') THEN $7::uuid END,CASE WHEN $6::varchar IN ('VERIFIED','SKIP_CONFIRMED') THEN $8::timestamptz END) RETURNING id`,[pid,'Report fixture '+status,priority,frequency,build,status,a.id,created])).rows[0].id;
  }
  async function event(id,to,at=recent,type='STATUS_CHANGED') {await db.query('INSERT INTO defect_activities(defect_id,actor_id,event_type,changes,created_at) VALUES($1,$2,$3,$4,$5)',[id,a.id,type,JSON.stringify({from:'RESPONDED',to}),at]);}
  const states=['NEW','REQUESTED','RE_REQUESTED','IN_PROGRESS','RESPONDED','VERIFIED','SKIP_REQUESTED','SKIP_CONFIRMED'];
  const priorities=['IMMEDIATE','HIGH','NORMAL','LOW'],frequencies=['PERCENT_100','PERCENT_70','PERCENT_50','PERCENT_30','PERCENT_1'];
  const ids=[];for(let i=0;i<states.length;i++)ids.push(await issue(states[i],priorities[i%4],frequencies[i%5],'1.0',i===3?days(2):recent));
  await event(ids[2],'RE_REQUESTED');await event(ids[2],'RE_REQUESTED');await event(ids[3],'RE_REQUESTED');
  await event(ids[0],'RE_REQUESTED',recent,'CONTENT_UPDATED'); // Must not count unrelated JSON.
  await event(ids[5],'VERIFIED');await event(ids[5],'VERIFIED'); // Same issue/day counts once in trend.
  await event(ids[3],'VERIFIED',days(1)); // Reopened issue still belongs to actual confirmation day.
  const old=await issue('NEW','URGENT','ALWAYS','legacy',days(40));await event(old,'RE_REQUESTED',days(20));
  const boundary=await issue('NEW','LOW','PERCENT_1','boundary',days(6));
  await issue('NEW','LOW','PERCENT_1','outside',new Date(days(6).getTime()-1));
  await issue('NEW','LOW','PERCENT_1','14day',days(13));await issue('NEW','LOW','PERCENT_1','30day',days(29));
  const foreign=await issue('RE_REQUESTED','HIGH','PERCENT_70','foreign',recent,other);await event(foreign,'RE_REQUESTED');
  const route='/defects/report?projectId='+project;
  await check('auth, roles, project isolation and validation',async()=>{
    await api(null,route,401);for(const u of [a,leader,admin])assert.equal((await api(u.token,route)).totals.total,13);
    await api(a.token,'/defects/report?projectId=bad',400);await api(a.token,route+'&period=8',400);await api(a.token,route+'&remainingPage=0',400);
    await api(a.token,route+'&buildVersion='+encodeURIComponent('x'.repeat(201)),400);await api(a.token,'/defects/report?projectId='+randomUUID(),404);
  });
  await check('KPI/status/completion/legacy priority and frequency totals',async()=>{
    const d=await api(a.token,route);assert.deepEqual(d.totals,{total:13,pending:8,inProgress:1,responded:1,verified:1,skip:2});
    assert.deepEqual(d.completion,{completed:2,total:13,rate:15.4});assert.equal(d.byStatus.NEW,6);
    assert.equal(Object.values(d.byStatus).reduce((a,b)=>a+b,0),13);assert.equal(Object.values(d.byPriority).reduce((a,b)=>a+b,0),13);assert.equal(Object.values(d.byFrequency).reduce((a,b)=>a+b,0),13);
    assert.equal(d.byPriority.URGENT,1);assert.equal(d.byFrequency.ALWAYS,1);assert.deepEqual(d.skip,{requested:1,confirmed:1,rate:7.7});
    assert.equal(d.remainingIssues.length,11);assert(d.remainingIssues.every(x=>!['VERIFIED','SKIP_CONFIRMED'].includes(x.status)&&x.issue_code.startsWith('ISSUE-')));
  });
  await check('rerequest current/distinct/events, trend historical confirmations',async()=>{
    const d=await api(a.token,route);assert.deepEqual(d.rerequest,{current:1,affectedIssues:3,totalTransitions:4});assert.equal(d.rerequestIssues[0].id,ids[2]);
    assert.equal(d.trend.length,7);assert.equal(d.trend.at(-1).created,7);assert.equal(d.trend.at(-1).verified,1);assert.equal(d.trend.at(-2).verified,1);
  });
  await check('KST inclusive date boundary and 7/14/30 filters across all sections',async()=>{
    for(const [period,total] of [['7',9],['14',11],['30',12]]){
      const d=await api(a.token,route+'&period='+period);assert.equal(d.totals.total,total);assert.equal(d.trend.length,Number(period));assert.equal(d.filters.timezone,'Asia/Seoul');
      assert.equal(d.pagination.remaining.total,total-2);assert.equal(Object.values(d.byPriority).reduce((a,b)=>a+b,0),total);assert.equal(Object.values(d.byFrequency).reduce((a,b)=>a+b,0),total);
      assert.deepEqual(d.rerequest,{current:1,affectedIssues:2,totalTransitions:3});assert(d.remainingIssues.some(x=>x.id===boundary));assert(!d.remainingIssues.some(x=>x.id===old));
    }
  });
  await check('exact build filter combined with period; options remain project-wide',async()=>{
    const d=await api(a.token,route+'&buildVersion=1.0&period=7');assert.equal(d.totals.total,8);assert.equal(d.completion.rate,25);assert.equal(d.skip.rate,12.5);
    assert.deepEqual(d.byPriority,{IMMEDIATE:2,HIGH:2,NORMAL:2,LOW:2});assert(d.buildVersions.includes('legacy'));assert(!d.buildVersions.includes('foreign'));
    assert.equal((await api(a.token,route+'&buildVersion=legacy&period=7')).totals.total,0);
    assert.equal((await api(a.token,route+'&buildVersion='+encodeURIComponent("' OR 1=1 --"))).totals.total,0);
  });
  await check('empty project/filter returns zeroes and full zero trend',async()=>{
    const d=await api(a.token,'/defects/report?projectId='+empty);assert.equal(d.totals.total,0);assert.equal(d.completion.rate,0);assert.equal(d.skip.rate,0);
    assert.deepEqual(d.rerequest,{current:0,affectedIssues:0,totalTransitions:0});assert.deepEqual(d.remainingIssues,[]);assert.deepEqual(d.rerequestIssues,[]);assert(d.trend.every(x=>x.created===0&&x.verified===0));
  });
  await check('bounded deterministic pagination; aggregates independent of page',async()=>{
    for(let i=0;i<23;i++)await issue('RE_REQUESTED','HIGH','PERCENT_50','paged');
    const first=await api(a.token,route+'&buildVersion=paged'),second=await api(a.token,route+'&buildVersion=paged&remainingPage=2&rerequestPage=2');
    assert.equal(first.remainingIssues.length,20);assert.equal(second.remainingIssues.length,3);assert.equal(second.rerequestIssues.length,3);assert.deepEqual(first.totals,second.totals);
    assert.equal(new Set([...first.remainingIssues,...second.remainingIssues].map(x=>x.id)).size,23);
  });
  console.log('PASSED '+passed+' report integration groups');
  await require('./defects-export.checks.cjs')({db,base,token:a.token,tokens:[a.token,leader.token,admin.token],project,empty,ids,userId:a.id,check,api,route});
  console.log('PASSED '+passed+' report/export integration groups');
}finally{
  if(child){child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));}
  if(projects.length){for(const table of ['defect_activities','defect_comments','defect_attachments'])await db.query(`DELETE FROM ${table} WHERE defect_id IN (SELECT id FROM defects WHERE project_id=ANY($1::uuid[]))`,[projects]);await db.query('DELETE FROM defects WHERE project_id=ANY($1::uuid[])',[projects]);await db.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);}
  if(users.length){await db.query('DELETE FROM user_sessions WHERE user_id=ANY($1::uuid[])',[users]);await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);}
  if(adminSession)await db.query('DELETE FROM user_sessions WHERE id=$1',[adminSession]);
  assert.deepEqual(await fingerprint(),before);console.log('CLEANUP PASS: own fixtures removed, existing data unchanged');await db.end();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
