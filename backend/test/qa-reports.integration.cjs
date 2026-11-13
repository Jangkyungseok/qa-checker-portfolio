const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process'),{randomUUID,randomBytes,createHash}=require('node:crypto');
const {Pool}=require('pg'),bcrypt=require('bcrypt'),sharp=require('sharp');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const u=process.env.DATABASE_URL?new URL(process.env.DATABASE_URL):null;assert(['localhost','127.0.0.1'].includes(u?.hostname??process.env.DB_HOST));assert.equal(Number(u?.port??process.env.DB_PORT),5433);assert.equal(u?.pathname??'/'+process.env.DB_NAME,'/qa_checker');
const db=new Pool(u?{connectionString:u.href}:{host:process.env.DB_HOST,port:5433,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const base='http://127.0.0.1:3013',users=[],projects=[],reports=[],root=fs.mkdtempSync(path.join(os.tmpdir(),'qa-pdf-')),out=path.join(process.env.LOCALAPPDATA,'QA-Checker/pdf-verification');let child,session,passed=0;
async function api(t,method,url,body,status=200){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});if(r.headers.get('content-type')?.includes('application/pdf')){assert.equal(r.status,status);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.subarray(0,5).toString(),'%PDF-');return b;}const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
async function account(role){const id=randomUUID(),email=id+'@example.invalid',password=randomBytes(16).toString('hex');await db.query("INSERT INTO users(id,email,password_hash,name,role,status) VALUES($1,$2,$3,'QA 리포트 테스트',$4,'APPROVED')",[id,email,await bcrypt.hash(password,4),role]);users.push(id);return {id,token:(await api(null,'POST','/auth/login',{email,password},201)).token};}
async function check(name,fn){await fn();console.log('PASS '+name);passed++;}
async function fingerprint(){const result={};for(const t of ['projects','users','defects','defect_activities','defect_attachments','build_histories','inspections','qa_decision_memories','qa_reports','qa_report_issue_links'])result[t]=(await db.query(`SELECT md5(coalesce(string_agg(row_to_json(x)::text,'|' ORDER BY row_to_json(x)::text),'')) hash FROM ${t} x`)).rows[0].hash;return result;}
(async()=>{const before=await fingerprint();try{
  child=spawn(process.execPath,['dist/main.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'3013',NODE_ENV:'test',DEFECT_ATTACHMENTS_LOCAL_DIR:root},stdio:['ignore','ignore','pipe']});let logs='';child.stderr.on('data',x=>logs+=x);let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/auth/me')).status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}assert(ready,logs);
  const leader=await account('LEADER'),user=await account('USER');
  const adminId=(await db.query("SELECT id FROM users WHERE role='ADMIN' AND status='APPROVED'")).rows[0].id,admin=randomBytes(24).toString('hex');session=randomUUID();await db.query("INSERT INTO user_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '15 minutes')",[session,adminId,createHash('sha256').update(admin).digest('hex')]);
  for(let i=0;i<2;i++)projects.push((await db.query('INSERT INTO projects(name,created_by) VALUES($1,$2) RETURNING id',['PDF QA '+randomUUID(),leader.id])).rows[0].id);
  const [project,other]=projects,route=`/projects/${project}/qa-reports`;
  const ids=[];for(let i=0;i<6;i++)ids.push((await db.query(`INSERT INTO defects(project_id,title,description,steps_to_reproduce,fix_direction,priority,reproducibility,build_version,status,created_by,updated_by,created_at) VALUES($1,$2,$3,$4,'수정 방향','NORMAL','PERCENT_100','1.0','NEW',$5,$5,'2026-09-01 00:00:00+09') RETURNING id`,[project,'대표 이슈 '+i,i===0?'긴 한글 원문 보존 및 줄바꿈 검증입니다. '.repeat(150):'결제 완료 후 아이템이 지급되지 않습니다.',i===0?'재현 절차를 생략하지 않고 확인합니다.\n'.repeat(70):'1. 로그인\n2. 결제\n3. 아이템 확인',leader.id])).rows[0].id);
  const foreign=(await db.query(`INSERT INTO defects(project_id,title,description,steps_to_reproduce,fix_direction,priority,reproducibility,status,created_by,updated_by) VALUES($1,'다른 프로젝트','내용','절차','방향','NORMAL','PERCENT_100','NEW',$2,$2) RETURNING id`,[other,leader.id])).rows[0].id;
  for(const time of ['2026-08-31 23:59:59+09','2026-09-30 23:59:59+09','2026-10-01 00:00:00+09'])await db.query(`INSERT INTO defects(project_id,title,description,steps_to_reproduce,fix_direction,priority,reproducibility,build_version,status,created_by,updated_by,created_at) VALUES($1,'경계','내용','절차','방향','NORMAL','PERCENT_100','1.0','NEW',$2,$2,$3)`,[project,leader.id,time]);
  const attachments=[];for(let i=0;i<3;i++){const format=['png','jpeg','webp'][i],mime='image/'+format,id=randomUUID(),key=id+'.'+format;const svg=Buffer.from(`<svg width="800" height="400"><rect width="800" height="400" fill="#e8f2ff"/><rect x="80" y="70" width="640" height="260" fill="#20344d"/><circle cx="400" cy="200" r="65" fill="#90c5e8"/></svg>`);const bytes=await sharp(svg)[format]().toBuffer();fs.writeFileSync(path.join(root,key),bytes);await db.query('INSERT INTO defect_attachments(id,defect_id,original_filename,storage_path,mime_type,size_bytes,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,ids[i],'증빙.'+format,key,mime,bytes.length,leader.id]);attachments.push(id);}
  await db.query("INSERT INTO defect_attachments(id,defect_id,original_filename,storage_path,mime_type,size_bytes,uploaded_by) VALUES(gen_random_uuid(),$1,'영상.mp4','not-downloaded.mp4','video/mp4',20,$2)",[ids[3],leader.id]);
  let draft;
  await check('auth, roles, empty draft and multiple reports',async()=>{
    await api(null,'GET',route,undefined,401);await api(user.token,'POST',route,{},403);
    draft=await api(leader.token,'POST',route,{},201);reports.push(draft.id);const second=await api(admin,'POST',route,{title:'두 번째'},201);reports.push(second.id);assert.equal((await api(user.token,'GET',route)).length,2);
    await api(user.token,'PATCH',route+'/'+draft.id,{version:1},403);await api(user.token,'POST',route+'/'+draft.id+'/pdf',{version:1},400);
    await api(leader.token,'GET',`/projects/${other}/qa-reports/${draft.id}`,undefined,404);
  });
  const input={title:'1차 QA 결과',targetBuild:'배포 빌드 1.0',filterBuildVersion:'1.0',testStartDate:'2026-09-01',testEndDate:'2026-09-30',testScope:'결제, 이벤트, 안정성',testEnvironment:'Android / iOS\nWi-Fi / LTE',testMethod:'기능 테스트, 회귀 테스트',considerations:{REQUIRED_CONSIDERATION:'결제 후 아이템 미지급 확인. '.repeat(40),PRIORITY_CONSIDERATION:'재검수 필요'},leadOpinion:'전체 품질과 잔여 위험을 확인했습니다.\n'.repeat(100),links:ids.slice(0,5).map((defectId,i)=>({defectId,purpose:'FEATURED',...(i===1?{attachmentId:attachments[1]}:{})}))};input.links.push({defectId:ids[0],purpose:'REQUIRED_CONSIDERATION'},{defectId:ids[0],purpose:'PRIORITY_CONSIDERATION'});
  await check('draft update, optimistic conflict, invalid dates and nested values',async()=>{
    draft=await api(leader.token,'PATCH',route+'/'+draft.id,{...input,version:1});assert.equal(draft.version,2);
    await api(leader.token,'PATCH',route+'/'+draft.id,{...input,version:1},409);
    await api(leader.token,'PATCH',route+'/'+draft.id,{...input,version:2,testStartDate:'2026-02-30'},400);
    await api(leader.token,'PATCH',route+'/'+draft.id,{...input,version:2,testStartDate:'2026-10-01'},400);
    const restored=await api(user.token,'GET',route+'/'+draft.id);assert.equal(restored.title,input.title);assert.equal(restored.lead_opinion,input.leadOpinion);assert.equal(restored.version,2);
    await api(leader.token,'PATCH',route+'/'+draft.id,{...input,version:2,considerations:{OTHER:'invalid'}},400);
  });
  await check('project, max five and active image ownership validation',async()=>{
    const patch=links=>api(leader.token,'PATCH',route+'/'+draft.id,{...input,version:2,links},400);
    await patch([{defectId:foreign,purpose:'FEATURED'}]);await patch(ids.map(defectId=>({defectId,purpose:'FEATURED'})));
    await patch([{defectId:ids[0],purpose:'FEATURED',attachmentId:attachments[1]}]);await patch([{defectId:ids[0],purpose:'FEATURED'},{defectId:ids[0],purpose:'FEATURED'}]);
    assert.equal((await api(user.token,'GET',route+'/'+draft.id)).links.length,7);
  });
  await check('candidate filters, KST inclusive bounds and shared report aggregation',async()=>{
    const d=await api(user.token,'GET',route+'/'+draft.id+'/candidates');assert.equal(d.total,7);assert.equal(d.summary.totals.total,7);assert.equal(d.items.length,7);assert(d.builds.includes('1.0'));
    const x=await api(user.token,'GET',route+'/'+draft.id+'/candidates?search='+encodeURIComponent('대표 이슈 0'));assert.equal(x.total,1);assert.equal(x.items[0].images.length,1);
  });
  fs.mkdirSync(out,{recursive:true});
  await check('single featured without image and four consideration categories',async()=>{
    const single=await api(admin,'POST',route,{...input,title:'대표 이슈 1건 / 이미지 없음',leadOpinion:'재검수 결과를 확인해 주세요.',considerations:{REQUIRED_CONSIDERATION:'필수 대응 내용',PRIORITY_CONSIDERATION:'우선 대응 내용',FUTURE_CONSIDERATION:'추후 개선 내용',NEEDS_REVIEW:'추가 확인 내용'},links:[{defectId:ids[4],purpose:'FEATURED'}]},201);reports.push(single.id);
    const updated=await api(admin,'PATCH',route+'/'+single.id,{...input,title:single.title,leadOpinion:'재검수 결과를 확인해 주세요.',considerations:single.considerations,links:[{defectId:ids[4],purpose:'FEATURED'}],version:1});assert.equal(updated.version,2);
    fs.writeFileSync(path.join(out,'qa-report-single.pdf'),await api(user.token,'POST',route+'/'+single.id+'/pdf',{version:2},201));
  });
  await check('PDF Korean, five featured, PNG/JPEG/WEBP, long text, USER download',async()=>{
    const pdf=await api(user.token,'POST',route+'/'+draft.id+'/pdf',{version:2},201);fs.writeFileSync(path.join(out,'qa-report-long.pdf'),pdf);assert(pdf.length>10000);
    await api(user.token,'POST',route+'/'+draft.id+'/pdf',{version:1},409);
  });
  await check('deleted selected image blocks generation; zero issues/featured supported',async()=>{
    await db.query('UPDATE defect_attachments SET deleted_at=now(),deleted_by=$2 WHERE id=$1',[attachments[1],leader.id]);await api(leader.token,'POST',route+'/'+draft.id+'/pdf',{version:2},409);
    await api(leader.token,'PATCH',route+'/'+draft.id,{...input,version:2},400);
    const empty=await api(leader.token,'POST',route,{...input,title:'이슈 0건 QA 결과',filterBuildVersion:'no-matching-build',links:[],considerations:{},leadOpinion:'이번 테스트 범위에서 등록된 이슈가 없습니다.'},201);reports.push(empty.id);
    const pdf=await api(user.token,'POST',route+'/'+empty.id+'/pdf',{version:1},201);fs.writeFileSync(path.join(out,'qa-report-empty.pdf'),pdf);
  });
  console.log('PASSED '+passed+' QA report groups; PDFs: '+out);
}finally{
  if(child){child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));}
  if(projects.length){await db.query('DELETE FROM qa_reports WHERE project_id=ANY($1::uuid[])',[projects]);for(const t of ['defect_activities','defect_comments','defect_attachments'])await db.query(`DELETE FROM ${t} WHERE defect_id IN (SELECT id FROM defects WHERE project_id=ANY($1::uuid[]))`,[projects]);await db.query('DELETE FROM defects WHERE project_id=ANY($1::uuid[])',[projects]);await db.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);}
  if(users.length){await db.query('DELETE FROM user_sessions WHERE user_id=ANY($1::uuid[])',[users]);await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);}if(session)await db.query('DELETE FROM user_sessions WHERE id=$1',[session]);
  assert.deepEqual(await fingerprint(),before);await db.end();fs.rmSync(root,{recursive:true,force:true});console.log('CLEANUP PASS existing data unchanged');
}})().catch(e=>{console.error(e);process.exitCode=1;});
