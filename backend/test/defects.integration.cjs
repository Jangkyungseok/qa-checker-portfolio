// Local-only real HTTP/PG integration test. Requires `npm run build` and migrations 0009 through 0012.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const path = require('node:path');
const fs=require('node:fs'),os=require('node:os');
const evidenceDir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-evidence-test-'));

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.join(__dirname,'../.env'), quiet:true });

const config = process.env.DATABASE_URL ? { connectionString:process.env.DATABASE_URL } : {
  host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,
};
const parsed = config.connectionString ? new URL(config.connectionString) : null;
assert(['127.0.0.1','localhost'].includes(parsed?.hostname ?? config.host),'Local DB only');
assert.equal(Number(parsed?.port ?? config.port),5433);
assert.equal(parsed?.pathname ?? '/'+config.database,'/qa_checker');
const db = new Pool(config);
const port = 3011;
const base = `http://127.0.0.1:${port}`;
const prefix = 'bts-test-'+randomUUID();
const users=[]; const projects=[]; let adminSession; let child; let passed=0;
const check = (name,fn) => Promise.resolve().then(fn).then(()=>{passed++;console.log('PASS '+name);});
async function api(token,method,url,body,expected=200) {
  const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await res.json();assert.equal(res.status,expected,`${method} ${url}: ${JSON.stringify(data)}`);return data;
}
async function fixtureUser(role,status='APPROVED') {
  const id=randomUUID(),email=`${prefix}-${users.length}@example.invalid`,password=randomBytes(20).toString('hex');
  await db.query('INSERT INTO users(id,email,password_hash,name,role,status) VALUES($1,$2,$3,$4,$5,$6)',[id,email,await bcrypt.hash(password,4),'BTS 검증 '+users.length,role,status]);users.push(id);
  return {id,email,password};
}
async function fingerprint() {
  const tables=['projects','users','build_histories','inspections','inspection_items','test_results','test_result_history','qa_decision_memories','defects','defect_comments','defect_activities','defect_attachments'];
  const result={};for(const t of tables) result[t]=(await db.query(`SELECT md5(coalesce(string_agg(row_to_json(t)::text,'|' ORDER BY id),'')) AS hash FROM ${t} t`)).rows[0].hash;
  return result;
}
async function main() {
  const before=await fingerprint();
  try {
    child=spawn(process.execPath,['dist/main.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),NODE_ENV:'test',DEFECT_ATTACHMENTS_LOCAL_DIR:evidenceDir},stdio:['ignore','ignore','pipe']});
    let serverError='';child.stderr.on('data',d=>{serverError+=d.toString();console.error(d.toString());});
    let ready=false;for(let n=0;n<100;n++){if(child.exitCode!==null)throw new Error(serverError);try{const r=await fetch(base+'/auth/me');if(r.status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready,'Backend ready');
    const a=await fixtureUser('USER'), b=await fixtureUser('USER'), l=await fixtureUser('LEADER'), pending=await fixtureUser('USER','PENDING');
    const login=async u=>(await api(null,'POST','/auth/login',{email:u.email,password:u.password},201)).token;
    const [ta,tb,tl]=await Promise.all([login(a),login(b),login(l)]);
    const admin=(await db.query("SELECT id FROM users WHERE role='ADMIN' LIMIT 1")).rows[0];assert(admin,'Existing local admin required');
    // Authenticate ADMIN without logging out or modifying any existing ADMIN session.
    const tadmin=randomBytes(32).toString('base64url');adminSession=randomUUID();
    await db.query("INSERT INTO user_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '15 minutes')",[adminSession,admin.id,createHash('sha256').update(tadmin).digest('hex')]);
    const p=await api(tl,'POST','/projects',{name:prefix},201);projects.push(p.id);
    const p2=await api(tl,'POST','/projects',{name:prefix+'-other'},201);projects.push(p2.id);
    const bh=await api(tl,'POST','/build-histories',{projectId:p.id,version:'bts-1',deliveredAt:'2026-11-12',changeSummary:'검증'},201);
    const foreign=await api(tl,'POST','/build-histories',{projectId:p2.id,version:'bts-other',deliveredAt:'2026-11-12',changeSummary:'검증'},201);
    const inspection=(await db.query("INSERT INTO inspections(project_id,platform,version,inspection_type,test_devices,created_by) VALUES($1,'IOS','bts-1','NEW','test',$2) RETURNING id",[p.id,l.id])).rows[0];
    const inspection2=(await db.query("INSERT INTO inspections(project_id,platform,version,inspection_type,test_devices,created_by) VALUES($1,'IOS','bts-2','NEW','test',$2) RETURNING id",[p2.id,l.id])).rows[0];
    const item=(await db.query("INSERT INTO inspection_items(inspection_id,category_name,item_title,check_content,test_method) VALUES($1,'검증','테스트','확인','실행') RETURNING id",[inspection.id])).rows[0];
    const attachment=(await db.query("INSERT INTO inspection_item_attachments(inspection_item_id,original_name,mime_type,file_size,file_path) VALUES($1,'test.png','image/png',1,$2) RETURNING id",[item.id,prefix])).rows[0];
    let d;const input={projectId:p.id,title:'화면 멈춤',description:'내용',stepsToReproduce:'1. 실행',fixDirection:'오류 처리 보완',reproducibility:'PERCENT_70',priority:'NORMAL',buildVersion:'1.2.35.1042'};
    await check('anonymous and pending denied',async()=>{await api(null,'GET','/defects?projectId='+p.id,undefined,401);await api(null,'POST','/auth/login',{email:pending.email,password:pending.password},401);});
    await check('individual concurrent sessions and USER multi-session',async()=>{const ta2=await login(a);const [x,y,z]=await Promise.all([api(ta,'GET','/auth/me'),api(tb,'GET','/auth/me'),api(ta2,'GET','/auth/me')]);assert.equal(x.id,a.id);assert.equal(y.id,b.id);assert.equal(z.id,a.id);});
    await check('existing cross-project approved access retained',async()=>{const list=await api(tb,'GET','/projects');assert(list.some(x=>x.id===p.id));assert(list.some(x=>x.id===p2.id));});
    await check('create direct build/device, no retired field assignment',async()=>{
      d=await api(ta,'POST','/defects',{...input,severity:'CRITICAL',assigneeId:b.id,buildHistoryId:bh.id,inspectionId:inspection.id},201);
      assert.equal(d.status,'NEW');assert.equal(d.device_os,'공통');assert.equal(d.build_version,input.buildVersion);assert.equal(d.assignee_id,null);assert.equal(d.severity,null);assert.equal(d.build_history_id,null);assert.equal(d.inspection_id,null);
    });
    await check('required values omitted, blank, whitespace, null and lengths',async()=>{
      for(const field of ['title','description','stepsToReproduce','fixDirection','reproducibility','priority','buildVersion']){
        const omitted={...input};delete omitted[field];await api(ta,'POST','/defects',omitted,400);
        for(const value of ['',null,'   '])await api(ta,'POST','/defects',{...input,[field]:value},400);
        await api(ta,'PATCH','/defects/'+d.id,{version:d.version,[field]:null},400);
      }
      for(const bad of [{buildVersion:'x'.repeat(201)},{deviceOs:'x'.repeat(501)},{priority:'URGENT'},{reproducibility:'ALWAYS'},{deviceOs:null}])await api(ta,'POST','/defects',{...input,...bad},400);
    });
    await check('cross-project related issue, unknown and self rejected',async()=>{
      const other=await api(tb,'POST','/defects',{...input,projectId:p2.id,title:'연계 대상'},201);
      await api(ta,'PATCH','/defects/'+d.id,{version:d.version,relatedIssueCode:d.defect_code},400);
      await api(ta,'POST','/defects',{...input,relatedIssueCode:'BUG-999999999999'},400);
      await api(ta,'POST','/defects',{...input,relatedIssueCode:'not-a-code'},400);
      d=await api(ta,'PATCH','/defects/'+d.id,{version:d.version,relatedIssueCode:other.defect_code.replace('BUG-','ISSUE-')});assert.equal(d.related_defect_id,other.id);assert.equal(d.related_project_id,p2.id);
      const created=await api(ta,'POST','/defects',{...input,relatedIssueCode:other.defect_code},201);assert.equal(created.related_defect_id,other.id);
      d=await api(ta,'PATCH','/defects/'+d.id,{version:d.version,relatedIssueCode:''});assert.equal(d.related_defect_id,null);
    });
    await check('non-owner reads/progress allowed; content ownership retained',async()=>{
      await api(tb,'GET','/defects/'+d.id);await api(tb,'PATCH','/defects/'+d.id,{version:d.version,title:'타인 본문'},403);
      d=await api(ta,'PATCH','/defects/'+d.id,{version:d.version,title:'수정 제목',deviceOs:'Galaxy S25 / Android 16',priority:'HIGH'});
      assert.equal(d.device_os,'Galaxy S25 / Android 16');
    });
    await check('optimistic concurrent edits',async()=>{
      const v=d.version;const responses=await Promise.all(['동시 A','동시 B'].map(title=>fetch(base+'/defects/'+d.id,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tl},body:JSON.stringify({version:v,title})})));
      assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);d=await api(ta,'GET','/defects/'+d.id);assert.equal(d.version,v+1);
    });
    await check('list filters and transitions returned; filtered count changes',async()=>{
      let q='/defects?projectId='+p.id+'&status=NEW&priority=HIGH&reproducibility=PERCENT_70&search='+d.defect_code;
      assert.equal((await api(tb,'GET',q)).total,1);assert.deepEqual((await api(tb,'GET',q)).items[0].allowed_transitions,['REQUESTED','SKIP_REQUESTED']);
      await api(tl,'PATCH','/defects/'+d.id+'/status',{version:d.version,status:'VERIFIED'},400);
      d=await api(tb,'PATCH','/defects/'+d.id+'/status',{version:d.version,status:'REQUESTED'});
      assert.equal((await api(tb,'GET',q)).total,0);
    });
    await check('normal workflow and manager confirmation/reopen',async()=>{
      const move=async(token,status)=>{d=await api(token,'PATCH','/defects/'+d.id+'/status',{version:d.version,status});};
      await move(tb,'IN_PROGRESS');await move(tb,'RESPONDED');await api(tb,'PATCH','/defects/'+d.id+'/status',{version:d.version,status:'VERIFIED'},403);
      await move(tl,'RE_REQUESTED');await move(tb,'IN_PROGRESS');await move(tb,'RESPONDED');await move(tl,'VERIFIED');assert(d.closed_at);
      await api(ta,'PATCH','/defects/'+d.id,{version:d.version,title:'확인 후 변경'},409);
      await api(tb,'PATCH','/defects/'+d.id+'/status',{version:d.version,status:'IN_PROGRESS'},400);
      await api(tb,'PATCH','/defects/'+d.id+'/status',{version:d.version,status:'RE_REQUESTED'},403);
      await api(tadmin,'PATCH','/defects/'+d.id+'/status',{version:d.version,status:'IN_PROGRESS'},400);
      assert.deepEqual(d.allowed_transitions,['RE_REQUESTED']);
      assert.deepEqual((await api(tl,'GET','/defects?projectId='+p.id+'&status=VERIFIED')).items.find(x=>x.id===d.id).allowed_transitions,['RE_REQUESTED']);
      await move(tadmin,'RE_REQUESTED');
      assert((await api(tl,'GET','/defects/'+d.id+'/activities')).some(x=>x.event_type==='STATUS_CHANGED'&&x.changes.from==='VERIFIED'&&x.changes.to==='RE_REQUESTED'));
      assert(!(await api(tl,'GET','/defects?projectId='+p.id+'&status=VERIFIED')).items.some(x=>x.id===d.id));
      assert((await api(tl,'GET','/defects?projectId='+p.id+'&status=RE_REQUESTED')).items.some(x=>x.id===d.id));
      await move(tb,'IN_PROGRESS');assert.equal(d.closed_at,null);
    });
    await check('SKIP request from all three states; decline/confirm/reopen',async()=>{
      for(const start of ['NEW','REQUESTED','IN_PROGRESS']){
        let row=await api(ta,'POST','/defects',input,201);
        for(const state of start==='NEW'?[]:start==='REQUESTED'?['REQUESTED']:['REQUESTED','IN_PROGRESS'])row=await api(tb,'PATCH','/defects/'+row.id+'/status',{version:row.version,status:state});
        row=await api(tb,'PATCH','/defects/'+row.id+'/status',{version:row.version,status:'SKIP_REQUESTED'});
        await api(tb,'PATCH','/defects/'+row.id+'/status',{version:row.version,status:'SKIP_CONFIRMED'},403);
        row=await api(tl,'PATCH','/defects/'+row.id+'/status',{version:row.version,status:'IN_PROGRESS'});
        row=await api(tb,'PATCH','/defects/'+row.id+'/status',{version:row.version,status:'SKIP_REQUESTED'});
        row=await api(tl,'PATCH','/defects/'+row.id+'/status',{version:row.version,status:'SKIP_CONFIRMED'});
        assert.deepEqual(row.allowed_transitions,['RE_REQUESTED']);
        assert.deepEqual((await api(tl,'GET','/defects/'+row.id)).allowed_transitions,['RE_REQUESTED']);
        await api(tl,'PATCH','/defects/'+row.id,{version:row.version,title:'잠금'},409);
        await api(tadmin,'PATCH','/defects/'+row.id+'/status',{version:row.version,status:'IN_PROGRESS'},400);
        row=await api(tadmin,'PATCH','/defects/'+row.id+'/status',{version:row.version,status:'RE_REQUESTED'});assert.equal(row.closed_by,null);
        assert((await api(tl,'GET','/defects/'+row.id+'/activities')).some(x=>x.event_type==='STATUS_CHANGED'&&x.changes.from==='SKIP_CONFIRMED'&&x.changes.to==='RE_REQUESTED'));
        row=await api(tb,'PATCH','/defects/'+row.id+'/status',{version:row.version,status:'IN_PROGRESS'});
      }
    });
    await check('all frequencies/priorities and list exclusion',async()=>{
      for(const reproducibility of ['PERCENT_100','PERCENT_70','PERCENT_50','PERCENT_30','PERCENT_1']){
        const row=await api(ta,'POST','/defects',{...input,reproducibility},201);const list=await api(ta,'GET','/defects?projectId='+p.id+'&reproducibility='+reproducibility);assert(list.items.some(r=>r.id===row.id));assert(list.items.every(r=>r.reproducibility===reproducibility));
      }
      for(const priority of ['IMMEDIATE','HIGH','NORMAL','LOW'])assert.equal((await api(ta,'POST','/defects',{...input,priority},201)).priority,priority);
    });
    await check('comment authorship, owner edit, moderation soft delete',async()=>{
      const c=await api(ta,'POST',`/defects/${d.id}/comments`,{body:'개인 A'},201);await api(tb,'POST',`/defects/${d.id}/comments`,{body:'개인 B'},201);
      await api(tb,'PATCH',`/defects/${d.id}/comments/${c.id}`,{body:'타인 수정',version:1},403);await api(tl,'PATCH',`/defects/${d.id}/comments/${c.id}`,{body:'리더 대필',version:1},403);
      await api(tb,'DELETE',`/defects/${d.id}/comments/${c.id}`,undefined,403);
      await api(ta,'PATCH',`/defects/${d.id}/comments/${c.id}`,{body:'본인 수정',version:1});
      await api(ta,'PATCH',`/defects/${d.id}/comments/${c.id}`,{body:'오래된 수정',version:1},409);
      await api(tl,'DELETE',`/defects/${d.id}/comments/${c.id}`);const comments=await api(ta,'GET',`/defects/${d.id}/comments`);
      assert.equal(comments[0].author_id,a.id);assert.equal(comments[1].author_id,b.id);assert.equal(comments[0].body,null);assert(comments[0].deleted_at);
      assert.equal((await db.query('SELECT body FROM defect_comments WHERE id=$1',[c.id])).rows[0].body,'본인 수정');
      await api(tb,'DELETE',`/defects/${d.id}/comments/${comments[1].id}`);
      await api(ta,'PATCH',`/defects/${d.id}/comments/${c.id}`,{body:'삭제 후 변경',version:3},409);
    });
    await check('all activity types, actors, no mutation endpoints',async()=>{const acts=await api(ta,'GET',`/defects/${d.id}/activities`);for(const type of ['CREATED','STATUS_CHANGED','PRIORITY_CHANGED','CONTENT_UPDATED','COMMENT_CREATED','COMMENT_UPDATED','COMMENT_DELETED'])assert(acts.some(x=>x.event_type===type),type);assert(acts.some(x=>x.actor_id===a.id));assert(acts.some(x=>x.actor_id===b.id));await api(tadmin,'DELETE',`/defects/${d.id}/activities/${acts[0].id}`,undefined,404);});
    await check('rejected updates leave no activity',async()=>{const count=(await api(ta,'GET',`/defects/${d.id}/activities`)).length;await api(tl,'PATCH',`/defects/${d.id}`,{version:d.version,priority:'LOW',relatedIssueCode:'BUG-999999999999'},400);assert.equal((await api(ta,'GET',`/defects/${d.id}/activities`)).length,count);});

    await check('ISSUE display search/API alias and report activity source',async()=>{
      assert.equal((await api(ta,'GET','/defects?projectId='+p.id+'&search='+d.defect_code.replace('BUG-','ISSUE-'))).items[0].id,d.id);
      const acts=await api(ta,'GET','/defects/'+d.id+'/activities');const created=acts.find(x=>x.event_type==='CREATED');assert.equal(created.changes.build_version,input.buildVersion);assert.equal(created.changes.priority,input.priority);
      assert(acts.some(x=>x.changes.to==='RE_REQUESTED'));assert(acts.every(x=>x.created_at&&x.actor_id));
    });
    await check('evidence upload/list/download/soft delete/permissions/idempotency',async()=>{
      const issue=await api(ta,'POST','/defects',input,201);
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=','base64');
      const upload=async(token,id,bytes=png,mime='image/png',name='증빙.png',expected=201)=>{
        const form=new FormData();form.append('uploadId',id);form.append('file',new Blob([bytes],{type:mime}),name);
        const r=await fetch(base+'/defects/'+issue.id+'/attachments',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));return data;
      };
      await upload(tb,randomUUID(),png,'image/png','other.png',403);
      await upload(ta,randomUUID(),Buffer.from('<html>spoof</html>'),'image/png','fake.png',400);
      await upload(ta,randomUUID(),png,'image/png','fake.pdf',400);
      const tooBig=Buffer.alloc(5*1024*1024+1);png.copy(tooBig);await upload(ta,randomUUID(),tooBig,'image/png','large.png',400);
      const uid=randomUUID();const a=await upload(ta,uid);assert.equal(a.original_filename,'증빙.png');assert.equal((await upload(ta,uid)).id,a.id);
      const acts=await api(ta,'GET','/defects/'+issue.id+'/activities');assert.equal(acts.filter(x=>x.event_type==='ATTACHMENT_ADDED').length,1);
      const bytes=await fetch(base+'/defects/'+issue.id+'/attachments/'+a.id+'/file',{headers:{Authorization:'Bearer '+tb}});assert.equal(bytes.status,200);assert.equal(bytes.headers.get('x-content-type-options'),'nosniff');assert(Buffer.from(await bytes.arrayBuffer()).equals(png));
      await api(ta,'GET','/defects/'+d.id+'/attachments/'+a.id+'/file',undefined,404);await api(null,'GET','/defects/'+issue.id+'/attachments/'+a.id+'/file',undefined,401);
      const video=Buffer.alloc(24);video.writeUInt32BE(24,0);video.write('ftyp',4);video.write('isom',8);await upload(ta,randomUUID(),video,'video/mp4','repro.mp4');
      const mov=Buffer.from(video);mov.write('qt  ',8);await upload(ta,randomUUID(),mov,'video/quicktime','repro.mov');
      await upload(ta,randomUUID(),Buffer.from('%PDF-1.4\n%%EOF'),'application/pdf','notes.pdf');await upload(ta,randomUUID());await upload(ta,randomUUID(),png,'image/png','sixth.png',400);
      assert.equal((await api(tb,'GET','/defects/'+issue.id+'/attachments')).length,5);
      await api(tb,'DELETE','/defects/'+issue.id+'/attachments/'+a.id,undefined,403);
      await api(tl,'DELETE','/defects/'+issue.id+'/attachments/'+a.id);await api(ta,'GET','/defects/'+issue.id+'/attachments/'+a.id+'/file',undefined,404);
      assert.equal((await api(ta,'GET','/defects/'+issue.id+'/attachments')).length,4);assert((await db.query('SELECT deleted_at FROM defect_attachments WHERE id=$1',[a.id])).rows[0].deleted_at);
      const retryId=randomUUID(),dest=path.join(evidenceDir,'defects',issue.id,retryId+'.png');assert(path.resolve(dest).startsWith(path.resolve(evidenceDir)+path.sep));fs.writeFileSync(dest,'occupied');
      await upload(ta,retryId,png,'image/png','retry.png',500);assert.equal((await db.query('SELECT count(*)::int n FROM defect_attachments WHERE id=$1',[retryId])).rows[0].n,0);fs.unlinkSync(dest);await upload(ta,retryId,png,'image/png','retry.png');
      let locked=await api(ta,'GET','/defects/'+issue.id);for(const status of ['REQUESTED','IN_PROGRESS','RESPONDED','VERIFIED'])locked=await api(tl,'PATCH','/defects/'+issue.id+'/status',{version:locked.version,status});
      await api(tl,'DELETE','/defects/'+issue.id+'/attachments/'+retryId,undefined,409);await upload(tl,randomUUID(),png,'image/png','locked.png',409);
      assert((await api(ta,'GET','/defects/'+issue.id+'/activities')).some(x=>x.event_type==='ATTACHMENT_REMOVED'));
    });
    await check('existing Build History, QA Decision and inspection regression',async()=>{
      await api(ta,'GET','/build-histories/'+bh.id);await api(ta,'GET','/build-histories?projectId='+p.id);
      const q=await api(tl,'POST','/qa-decisions',{projectId:p.id,decisionType:'OTHER',decision:'검증 기록',reason:'검증',buildHistoryId:bh.id},201);
      await api(ta,'GET','/qa-decisions/'+q.id);await api(ta,'GET','/qa-decisions?projectId='+p.id);await api(ta,'PATCH','/qa-decisions/'+q.id,{reason:'불가'},403);
      await api(tl,'PATCH',`/qa-decisions/${q.id}/resolve`,{resolved:true,result:'완료'});await api(tl,'PATCH',`/qa-decisions/${q.id}/resolve`,{resolved:false});
      await api(ta,'GET','/inspections?projectId='+p.id);await api(ta,'GET',`/inspections/${inspection.id}/items`);
      await api(ta,'PUT',`/inspection-items/${item.id}/result`,{status:'PASS',memo:'검증'});await api(ta,'GET',`/reports/inspections/${inspection.id}`);
      // Existing authenticated attachment route still checks item/file ownership, no Storage call for mismatch.
      await api(ta,'GET',`/inspection-items/${randomUUID()}/attachments/${attachment.id}/file`,undefined,404);
    });
    console.log(`PASSED ${passed} integration groups`);
  } finally {
    // Only UUIDs created by this run are deleted. Existing ADMIN account/sessions are never altered.
    const client=await db.connect();try{await client.query('BEGIN');
      await client.query('DELETE FROM defect_activities WHERE defect_id IN(SELECT id FROM defects WHERE project_id=ANY($1::uuid[]))',[projects]);
      await client.query('DELETE FROM defect_comments WHERE defect_id IN(SELECT id FROM defects WHERE project_id=ANY($1::uuid[]))',[projects]);
      await client.query('DELETE FROM defect_attachments WHERE defect_id IN(SELECT id FROM defects WHERE project_id=ANY($1::uuid[]))',[projects]);
      await client.query('DELETE FROM defects WHERE project_id=ANY($1::uuid[])',[projects]);
      await client.query('DELETE FROM qa_decision_memories WHERE project_id=ANY($1::uuid[])',[projects]);
      await client.query('DELETE FROM build_histories WHERE project_id=ANY($1::uuid[])',[projects]);
      await client.query('DELETE FROM inspections WHERE project_id=ANY($1::uuid[])',[projects]);
      await client.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
      if(adminSession)await client.query('DELETE FROM user_sessions WHERE id=$1',[adminSession]);
      await client.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();if(child)child.kill();}
    assert.deepEqual(await fingerprint(),before,'Existing business data unchanged');
    console.log('CLEANUP PASS: fixtures removed, existing data fingerprints unchanged');await db.end();
    assert(path.resolve(evidenceDir).startsWith(path.resolve(os.tmpdir())+path.sep+'qa-evidence-test-'));fs.rmSync(evidenceDir,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
