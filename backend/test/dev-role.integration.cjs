// Real HTTP/PG authorization regression. Local DB only; no shared account sessions are changed.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process'),{randomUUID,randomBytes,createHash}=require('node:crypto');
const {Pool}=require('pg'),bcrypt=require('bcrypt');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const url=process.env.DATABASE_URL?new URL(process.env.DATABASE_URL):null;
assert(['127.0.0.1','localhost'].includes(url?.hostname??process.env.DB_HOST));
assert.equal(Number(url?.port??process.env.DB_PORT),5433);assert.equal(url?.pathname??'/'+process.env.DB_NAME,'/qa_checker');
const db=new Pool(url?{connectionString:url.href}:{host:process.env.DB_HOST,port:5433,database:'qa_checker',user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const base='http://127.0.0.1:3015',users=[],projects=[],root=fs.mkdtempSync(path.join(os.tmpdir(),'qa-dev-test-'));let child,adminSession,passed=0;
async function api(token,method,route,body,status=200){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const type=r.headers.get('content-type')??'';const data=type.includes('json')?await r.json():Buffer.from(await r.arrayBuffer());assert.equal(r.status,status,`${method} ${route}: ${Buffer.isBuffer(data)?type:JSON.stringify(data)}`);return data;}
async function account(role,status='APPROVED'){const id=randomUUID(),email=id+'@example.invalid',password=randomBytes(16).toString('hex');await db.query("INSERT INTO users(id,email,password_hash,name,role,status) VALUES($1,$2,$3,$4,$5,$6)",[id,email,await bcrypt.hash(password,4),'DEV 권한 검증 '+role,role,status]);users.push(id);return {id,email,password};}
const login=async u=>(await api(null,'POST','/auth/login',{email:u.email,password:u.password},201)).token;
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
async function fingerprint(){const result={};for(const t of ['users','projects','defects','defect_comments','defect_activities','defect_attachments','qa_reports','qa_report_issue_links','build_histories','inspections','qa_decision_memories'])result[t]=(await db.query(`SELECT md5(coalesce(string_agg(row_to_json(x)::text,'|' ORDER BY row_to_json(x)::text),'')) hash FROM ${t} x`)).rows[0].hash;return result;}
(async()=>{const before=await fingerprint();try{
  child=spawn(process.execPath,['dist/main.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'3015',NODE_ENV:'test',DEFECT_ATTACHMENTS_LOCAL_DIR:root},stdio:['ignore','ignore','pipe']});let errors='';child.stderr.on('data',x=>errors+=x);let ready=false;for(let i=0;i<400;i++){if(child.exitCode!==null)throw Error(errors);try{if((await fetch(base+'/auth/me')).status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}assert(ready,errors);
  const leader=await account('LEADER'),user=await account('USER'),dev=await account('USER','PENDING');
  const admin=(await db.query("SELECT id FROM users WHERE role='ADMIN' AND status='APPROVED'")).rows[0];assert(admin);
  const ta=randomBytes(32).toString('base64url');adminSession=randomUUID();await db.query("INSERT INTO user_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '15 minutes')",[adminSession,admin.id,createHash('sha256').update(ta).digest('hex')]);
  const tl=await login(leader),tu=await login(user);let td;
  await check('ADMIN approval selects DEV; pending blocked; ADMIN single session retained',async()=>{
    await api(null,'POST','/auth/login',{email:dev.email,password:dev.password},401);
    await api(ta,'POST',`/users/${dev.id}/approve`,{role:'DEV'},201);td=await login(dev);assert.equal((await api(td,'GET','/auth/me')).role,'DEV');
    // DB permits one ADMIN account. Verify the unchanged login policy in isolation without its password/session.
    const {AuthService}=require('../dist/auth/auth.service');let calls=0;const password='local-policy-test';
    const row={id:admin.id,email:'policy@example.invalid',name:'policy',role:'ADMIN',status:'APPROVED',password_hash:await bcrypt.hash(password,4)};
    const service=new AuthService({query:async()=>++calls===1?{rows:[row],rowCount:1}:{rows:[{exists:1}],rowCount:1}});
    await assert.rejects(service.login({email:row.email,password}),e=>e.getStatus()===409);assert.equal(calls,2);
  });
  await check('DEV/USER/LEADER independent concurrent and multiple sessions',async()=>{
    for(const [u,t] of [[dev,td],[user,tu],[leader,tl]]){const second=await login(u);const values=await Promise.all([api(t,'GET','/auth/me'),api(second,'GET','/auth/me')]);assert(values.every(x=>x.id===u.id));}
  });
  const project=await api(tl,'POST','/projects',{name:'DEV local integration '+randomUUID()},201);projects.push(project.id);
  const input={projectId:project.id,title:'DEV 원본 보존',description:'원본',stepsToReproduce:'1. 실행',fixDirection:'확인',reproducibility:'PERCENT_100',priority:'NORMAL',buildVersion:'dev-test'};
  let d=await api(tu,'POST','/defects',input,201);const route='/defects/'+d.id;
  await check('projects/list/detail allowed; DEV creation and original patch denied',async()=>{
    assert((await api(td,'GET','/projects')).some(x=>x.id===project.id));assert((await api(td,'GET','/defects?projectId='+project.id)).items.some(x=>x.id===d.id));
    const before=(await db.query('SELECT * FROM defects WHERE id=$1',[d.id])).rows[0];
    await api(td,'POST','/defects',input,403);await api(td,'PATCH',route,{version:d.version,title:'변조',priority:'HIGH'},403);
    assert.deepEqual((await db.query('SELECT * FROM defects WHERE id=$1',[d.id])).rows[0],before);
  });
  const all=['NEW','REQUESTED','RE_REQUESTED','IN_PROGRESS','RESPONDED','VERIFIED','SKIP_REQUESTED','SKIP_CONFIRMED'];
  const permitted={REQUESTED:['IN_PROGRESS'],RE_REQUESTED:['IN_PROGRESS'],IN_PROGRESS:['RESPONDED'],SKIP_REQUESTED:['IN_PROGRESS']};
  const {TRANSITIONS,allowedTransitions}=require('../dist/defects/defect-workflow');
  await check('all 64 DEV status pairs; list/detail use same policy and rejected writes are atomic',async()=>{
    for(const from of all){assert.deepEqual(allowedTransitions({status:from},{role:'DEV'}),permitted[from]??[]);
      for(const to of all){await db.query(`UPDATE defects SET status=$2::varchar,closed_at=CASE WHEN $2 IN ('VERIFIED','SKIP_CONFIRMED') THEN now() ELSE NULL END,closed_by=CASE WHEN $2 IN ('VERIFIED','SKIP_CONFIRMED') THEN $3::uuid ELSE NULL END WHERE id=$1`,[d.id,from,leader.id]);d=await api(td,'GET',route);
        assert.deepEqual(d.allowed_transitions,permitted[from]??[]);assert.deepEqual((await api(td,'GET','/defects?projectId='+project.id)).items[0].allowed_transitions,d.allowed_transitions);
        const before=(await db.query('SELECT * FROM defects WHERE id=$1',[d.id])).rows[0],activities=(await api(td,'GET',route+'/activities')).length;
        const allowed=(permitted[from]??[]).includes(to);await api(td,'PATCH',route+'/status',{version:d.version,status:to},allowed?200:TRANSITIONS[from].includes(to)?403:400);
        if(!allowed){assert.deepEqual((await db.query('SELECT * FROM defects WHERE id=$1',[d.id])).rows[0],before);assert.equal((await api(td,'GET',route+'/activities')).length,activities);}
      }
    }
    await db.query("UPDATE defects SET status='IN_PROGRESS',closed_at=NULL,closed_by=NULL WHERE id=$1",[d.id]);
  });
  await check('own comments edit/soft-delete; DEV cannot moderate; role joins are current',async()=>{
    const own=await api(td,'POST',route+'/comments',{body:'개발 대응'},201),other=await api(tu,'POST',route+'/comments',{body:'QA 코멘트'},201);
    await api(td,'PATCH',route+'/comments/'+own.id,{body:'개발 수정',version:1});
    await api(td,'PATCH',route+'/comments/'+other.id,{body:'변조',version:1},403);await api(td,'DELETE',route+'/comments/'+other.id,undefined,403);
    assert.equal((await api(td,'GET',route+'/comments')).find(x=>x.id===own.id).author_role,'DEV');
    assert((await api(td,'GET',route+'/activities')).some(x=>x.actor_id===dev.id&&x.actor_role==='DEV'));
    await db.query("UPDATE users SET role='USER' WHERE id=$1",[dev.id]);assert.equal((await api(td,'GET',route+'/comments')).find(x=>x.id===own.id).author_role,'USER');await db.query("UPDATE users SET role='DEV' WHERE id=$1",[dev.id]);
    await api(td,'DELETE',route+'/comments/'+own.id);const deleted=(await api(td,'GET',route+'/comments')).find(x=>x.id===own.id);assert(deleted.deleted_at);assert.equal(deleted.body,null);
    await api(tl,'DELETE',route+'/comments/'+other.id);
  });
  await check('DEV evidence upload/read allowed; delete denied',async()=>{
    const bytes=await require('sharp')({create:{width:8,height:8,channels:3,background:'#fff'}}).png().toBuffer();
    const body=new FormData();body.append('uploadId',randomUUID());body.append('file',new Blob([bytes],{type:'image/png'}),'dev.png');
    const r=await fetch(base+route+'/attachments',{method:'POST',headers:{Authorization:'Bearer '+td},body});const attachment=await r.json();assert.equal(r.status,201,JSON.stringify(attachment));
    assert((await api(td,'GET',route+'/attachments')).some(x=>x.id===attachment.id));assert.deepEqual(await api(td,'GET',route+'/attachments/'+attachment.id+'/file'),bytes);
    await api(td,'DELETE',route+'/attachments/'+attachment.id,undefined,403);
  });
  await check('DEV internal API and nested attachment URL bypass denied',async()=>{
    for(const endpoint of ['/users/pending','/categories','/test-items','/build-histories?projectId='+project.id,'/build-histories/'+randomUUID(),'/qa-decisions?projectId='+project.id,'/qa-decisions/'+randomUUID(),'/inspections?projectId='+project.id,'/inspections/'+randomUUID()+'/items','/reports/inspections/'+randomUUID(),`/inspection-items/${randomUUID()}/attachments/${randomUUID()}/file`])await api(td,'GET',endpoint,undefined,403);
    for(const endpoint of ['/projects','/categories','/test-items','/inspections','/build-histories','/qa-decisions',`/users/${user.id}/approve`])await api(td,'POST',endpoint,{},403);
    await api(td,'PUT',`/inspection-items/${randomUUID()}/result`,{status:'PASS'},403);
  });
  await check('DEV report summaries, CSV and XLSX downloads',async()=>{
    assert.equal((await api(td,'GET','/defects/report?projectId='+project.id)).totals.total,1);
    for(const format of ['csv','xlsx']){const bytes=await api(td,'GET',`/defects/report/export?projectId=${project.id}&format=${format}`);assert(bytes.length>20);if(format==='xlsx')assert.equal(bytes.subarray(0,2).toString(),'PK');}
  });
  await check('QA report read/PDF allowed; draft/create/update denied',async()=>{
    const rr=`/projects/${project.id}/qa-reports`,report=await api(tl,'POST',rr,{title:'DEV 읽기 검증',targetBuild:'test',testStartDate:'2026-11-01',testEndDate:'2026-11-30',testScope:'권한',testEnvironment:'local',testMethod:'검수',leadOpinion:'확인'},201);
    assert.equal(report.status,'DRAFT');
    assert(!(await api(td,'GET',rr)).some(x=>x.id===report.id));
    for(const suffix of ['', '/candidates'])await api(td,'GET',rr+'/'+report.id+suffix,undefined,404);
    await api(td,'POST',rr+'/'+report.id+'/pdf',{version:1},404);
    for(const token of [td,tu])await api(token,'POST',rr+'/'+report.id+'/publish',{version:1},403);
    assert.equal((await api(tu,'GET',rr+'/'+report.id)).status,'DRAFT');
    await api(tl,'POST',rr+'/'+report.id+'/publish',{version:999},409);
    const published=await api(tl,'POST',rr+'/'+report.id+'/publish',{version:1},201);assert.equal(published.status,'PUBLISHED');assert.equal(published.version,2);
    const keptDraft=await api(ta,'POST',rr,{title:'비공개 초안',status:'PUBLISHED'},201);assert.equal(keptDraft.status,'DRAFT');
    assert.deepEqual((await api(td,'GET',rr)).map(x=>x.id),[report.id]);
    assert.equal((await api(td,'GET',rr+'/'+report.id)).status,'PUBLISHED');await api(td,'GET',rr+'/'+report.id+'/candidates');
    const adminPublished=await api(ta,'POST',rr+'/'+keptDraft.id+'/publish',{version:1},201);assert.equal(adminPublished.status,'PUBLISHED');
    const edited=await api(tl,'PATCH',rr+'/'+keptDraft.id,{title:'공개 후 편집',version:2,status:'DRAFT'});assert.equal(edited.status,'PUBLISHED');assert.equal(edited.version,3);
    assert.equal((await api(td,'GET',rr+'/'+keptDraft.id)).title,'공개 후 편집');
    assert.equal((await api(tu,'GET',rr)).length,2);
    const pdf=await api(td,'POST',rr+'/'+report.id+'/pdf',{version:2},201);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
    await api(td,'POST',rr,{},403);await api(td,'PATCH',rr+'/'+report.id,{version:1,title:'변조'},403);
    await api(tu,'POST',rr,{},403);await api(tu,'PATCH',route,{version:(await api(tu,'GET',route)).version,title:'QA 수정'});
    await api(ta,'GET','/users/pending');await api(tu,'GET','/categories');await api(tl,'GET','/test-items');
  });
  console.log(`PASSED ${passed} DEV integration groups`);
}finally{
  if(child){child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));}
  const c=await db.connect();try{await c.query('BEGIN');if(projects.length){await c.query('DELETE FROM qa_reports WHERE project_id=ANY($1::uuid[])',[projects]);for(const t of ['defect_activities','defect_comments','defect_attachments'])await c.query(`DELETE FROM ${t} WHERE defect_id IN(SELECT id FROM defects WHERE project_id=ANY($1::uuid[]))`,[projects]);await c.query('DELETE FROM defects WHERE project_id=ANY($1::uuid[])',[projects]);await c.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);}if(adminSession)await c.query('DELETE FROM user_sessions WHERE id=$1',[adminSession]);await c.query('DELETE FROM user_sessions WHERE user_id=ANY($1::uuid[])',[users]);await c.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  assert.deepEqual(await fingerprint(),before);await db.end();assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'qa-dev-test-'));fs.rmSync(root,{recursive:true,force:true});console.log('CLEANUP PASS: existing business data unchanged');
}})().catch(e=>{console.error(e);process.exitCode=1;});
