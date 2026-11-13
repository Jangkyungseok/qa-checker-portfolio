// Runs with the report suite's isolated local fixtures and cleanup/fingerprint checks.
const assert=require('node:assert/strict'),{Workbook}=require('exceljs');
const {parseString}=require('fast-csv');
const fs=require('node:fs'),path=require('node:path');
module.exports=async({db,base,token,tokens,project,empty,ids,userId,check,api,route})=>{
  const url='/defects/report/export?projectId='+project;
  async function download(query='',format='xlsx',auth=token,status=200){
    const r=await fetch(base+url+'&format='+format+query,{headers:auth?{Authorization:'Bearer '+auth}:{}});
    assert.equal(r.status,status,status===200?await r.clone().text().then(x=>r.ok?'':x):'');
    if(status!==200)return r;
    assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('content-disposition'),/attachment.*filename\*=UTF-8/);
    const b=Buffer.from(await r.arrayBuffer());
    if(format==='csv')return b;
    assert.match(r.headers.get('content-type'),/spreadsheetml/);const w=new Workbook();await w.xlsx.load(b);return {w,b};
  }
  const csv=b=>new Promise((resolve,reject)=>{const rows=[];parseString(b.toString('utf8').replace(/^\uFEFF/,''),{headers:false}).on('data',r=>rows.push(r)).on('error',reject).on('end',()=>resolve(rows));});
  await check('export auth/roles, invalid format/filters and missing project',async()=>{
    await download('','xlsx',null,401);await download('','pdf',token,400);await download('&period=8','csv',token,400);
    for(const t of tokens)await download('&buildVersion=absent','csv',t);
    await api(token,'/defects/report/export?format=xlsx&projectId=00000000-0000-4000-8000-000000000000',404);
  });
  await db.query(`UPDATE defects SET title=$2,description=$3,steps_to_reproduce=$4,related_defect_id=$5 WHERE id=$1`,[ids[0],'한글, "제목"','첫 줄\n두 번째, "내용"','=1+1',ids[1]]);
  await db.query(`INSERT INTO defect_comments(defect_id,author_id,body,deleted_at,deleted_by) VALUES($1,$2,'공개 코멘트',NULL,NULL),($1,$2,'DELETED_PRIVATE_BODY',now(),$2)`,[ids[0],userId]);
  await db.query(`INSERT INTO defect_attachments(id,defect_id,original_filename,storage_path,mime_type,size_bytes,uploaded_by,deleted_at,deleted_by) VALUES(gen_random_uuid(),$1,'증빙.png','PRIVATE_STORAGE_PATH','image/png',123,$2,NULL,NULL),(gen_random_uuid(),$1,'삭제.pdf','PRIVATE_DELETED_PATH','application/pdf',456,$2,now(),$2)`,[ids[0],userId]);
  let sample;
  await check('xlsx seven sheets, Korean labels, dates, numeric values, styles and privacy',async()=>{
    sample=await download('&period=7&buildVersion=1.0');const {w}=sample;
    assert.deepEqual(w.worksheets.map(s=>s.name),['이슈 현황','전체 이슈','잔여 이슈','재요청 이슈','상태 변경 이력','코멘트','증빙 자료']);
    const all=w.getWorksheet('전체 이슈');assert.equal(all.rowCount,9);assert.equal(all.getCell('B2').value,'신규');assert.equal(all.getCell('G2').value,'한글, "제목"');assert.equal(all.getCell('H2').value,'=1+1');assert.equal(all.getCell('H2').type,3);
    assert(all.getCell('M2').value instanceof Date);assert.equal(all.getCell('M2').numFmt,'yyyy-mm-dd hh:mm:ss');assert.match(all.getCell('K2').value,/^ISSUE-/);
    for(const s of w.worksheets){assert.equal(s.views[0].ySplit,1);assert(s.autoFilter);assert(s.getRow(1).font.bold);assert(s.getCell('A2').alignment.wrapText);}
    const overview=w.getWorksheet('이슈 현황');const values={};overview.eachRow((r,n)=>{if(n>1)values[r.getCell(1).value]=r.getCell(2).value;});assert.equal(values['전체 이슈'],8);assert.equal(values['처리율'],0.25);
    const rereq=w.getWorksheet('재요청 이슈');assert.equal(rereq.rowCount,3);assert.equal(rereq.getCell('F2').value,2);assert.equal(rereq.getCell('F3').value,1);
    assert.equal(w.getWorksheet('잔여 이슈').rowCount,7);
    assert.deepEqual(w.getWorksheet('코멘트').getColumn(5).values.slice(2).sort(),['공개 코멘트','삭제된 코멘트입니다.'].sort());
    assert.deepEqual(w.getWorksheet('증빙 자료').getColumn(4).values.slice(2).sort(),[123,456]);
    const content=JSON.stringify(w.model);assert(!content.includes('DELETED_PRIVATE_BODY'));assert(!content.includes('PRIVATE_STORAGE_PATH'));assert(!content.includes('PRIVATE_DELETED_PATH'));
  });
  let sampleCsv;
  await check('csv BOM, fourteen columns, multiline/quotes and formula protection',async()=>{
    sampleCsv=await download('&period=7&buildVersion=1.0','csv');assert.deepEqual([...sampleCsv.subarray(0,3)],[239,187,191]);
    const rows=await csv(sampleCsv);assert.equal(rows.length,9);assert.equal(rows[0].length,14);assert.equal(rows[1][6],'한글, "제목"');assert.equal(rows[1][8],'첫 줄\n두 번째, "내용"');assert.equal(rows[1][7],"'=1+1");
  });
  await check('export same 7/14/30/exact-build cohort as report, ignores pagination',async()=>{
    for(const period of ['ALL','7','14','30']){const q='&period='+period;const report=await api(token,route+q);const rows=await csv(await download(q,'csv'));assert.equal(rows.length-1,report.totals.total);}
    const rows=await csv(await download('&buildVersion=paged&remainingPage=2','csv'));assert.equal(rows.length,24);
    const {w}=await download('&buildVersion=paged');assert.equal(w.getWorksheet('전체 이슈').rowCount,24);assert.equal(w.getWorksheet('재요청 이슈').getCell('F2').value,0);
    const zero=await csv(await download('&buildVersion='+encodeURIComponent("' OR 1=1 --"),'csv'));assert.equal(zero.length,1);
    const r=await fetch(base+'/defects/report/export?projectId='+empty+'&format=xlsx',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);const w0=new Workbook();await w0.xlsx.load(Buffer.from(await r.arrayBuffer()));assert.equal(w0.getWorksheet('전체 이슈').rowCount,1);
  });
  await check('5000 full rows, 5001 rejected, byte limit and concurrent request guard',async()=>{
    await db.query(`INSERT INTO defects(project_id,title,description,steps_to_reproduce,fix_direction,priority,reproducibility,build_version,status,created_by,updated_by) SELECT $1,'대량 '||n,'내용','절차','방향','NORMAL','PERCENT_100','bulk','NEW',$2,$2 FROM generate_series(1,5000) n`,[project,userId]);
    const b=await download('&buildVersion=bulk','csv');assert.equal((await csv(b)).length,5001);
    const [r1,r2]=await Promise.all([1,2].map(()=>fetch(base+url+'&format=xlsx&buildVersion=bulk',{headers:{Authorization:'Bearer '+token}})));
    assert.deepEqual([r1.status,r2.status].sort(),[200,503]);const ok=r1.ok?r1:r2;const w=new Workbook();await w.xlsx.load(Buffer.from(await ok.arrayBuffer()));assert.equal(w.getWorksheet('전체 이슈').rowCount,5001);await (r1.ok?r2:r1).arrayBuffer();
    await download('','csv',token,400);
    await db.query("UPDATE defects SET description=repeat('가',10000) WHERE project_id=$1 AND build_version='bulk'",[project]);await download('&buildVersion=bulk','csv',token,400);
    await db.query("DELETE FROM defects WHERE project_id=$1 AND build_version='bulk'",[project]);
  });
  await check('related-history row limit and safe attachment filename',async()=>{
    await db.query(`INSERT INTO defect_activities(defect_id,actor_id,event_type,changes) SELECT $1,$2,'STATUS_CHANGED','{"from":"NEW","to":"REQUESTED"}'::jsonb FROM generate_series(1,20001)`,[ids[0],userId]);
    await download('&buildVersion=1.0','xlsx',token,400);
    await db.query("DELETE FROM defect_activities WHERE defect_id=$1 AND changes->>'from'='NEW' AND changes->>'to'='REQUESTED'",[ids[0]]);
    await db.query('UPDATE projects SET name=$2 WHERE id=$1',[project,'검증:/\\*?"<>| 프로젝트']);
    const r=await fetch(base+url+'&format=csv&buildVersion=absent',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);
    const filename=decodeURIComponent(r.headers.get('content-disposition').split("UTF-8''")[1]);assert(!/[<>:"/\\|?*\x00-\x1f]/.test(filename));await r.arrayBuffer();
  });
  if(process.env.QA_EXPORT_ARTIFACT_DIR){const dir=path.resolve(process.env.QA_EXPORT_ARTIFACT_DIR);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'issue-export-test.xlsx'),sample.b);fs.writeFileSync(path.join(dir,'issue-export-test.csv'),sampleCsv);console.log('Export test artifacts saved:',dir);}
};
