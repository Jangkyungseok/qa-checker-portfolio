// Verifies legacy migration in a disposable schema; always rolls back. Local DB only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');const {Pool}=require('pg');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const config=process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:{host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD};
const url=config.connectionString?new URL(config.connectionString):null;
assert(['127.0.0.1','localhost'].includes(url?.hostname??config.host));assert.equal(Number(url?.port??config.port),5433);assert.equal(url?.pathname??'/'+config.database,'/qa_checker');
(async()=>{const db=new Pool(config),c=await db.connect();try{
  await c.query('BEGIN');const schema='issue_migration_'+randomUUID().replaceAll('-','');await c.query('CREATE SCHEMA '+schema);await c.query('SET LOCAL search_path TO '+schema+',public');
  const run=async name=>c.query(fs.readFileSync(path.join(__dirname,'../../db',name),'utf8').replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,''));
  await run('0009_add_defects.sql');
  const user=(await c.query('SELECT id FROM public.users LIMIT 1')).rows[0].id,project=(await c.query('SELECT id FROM public.projects LIMIT 1')).rows[0].id;
  for(const status of ['OPEN','IN_PROGRESS','READY_FOR_RETEST','CLOSED'])await c.query(`INSERT INTO defects(project_id,title,description,steps_to_reproduce,expected_result,actual_result,severity,priority,status,created_by,updated_by,closed_by,closed_at,resolution) VALUES($1,$2,'existing description','existing steps','existing expectation','existing actual','MAJOR','MEDIUM',$2,$3,$3,CASE WHEN $2::varchar='CLOSED' THEN $3::uuid END,CASE WHEN $2::varchar='CLOSED' THEN now() END,CASE WHEN $2::varchar='CLOSED' THEN 'NOT_REPRODUCIBLE' END)`,[project,status,user]);
  const before=(await c.query('SELECT * FROM defects ORDER BY defect_no')).rows;
  await c.query("INSERT INTO defect_comments(defect_id,author_id,body) VALUES($1,$2,'preserve comment')",[before[0].id,user]);
  await c.query("INSERT INTO defect_activities(defect_id,actor_id,event_type,changes) VALUES($1,$2,'STATUS_CHANGED',$3)",[before[0].id,user,JSON.stringify({from:'OPEN',to:'READY_FOR_RETEST'})]);
  const comments=(await c.query('SELECT * FROM defect_comments')).rows,activities=(await c.query('SELECT * FROM defect_activities')).rows;
  await run('0010_expand_issue_workflow.sql');
  const after=(await c.query('SELECT * FROM defects ORDER BY defect_no')).rows;
  assert.deepEqual(after.map(x=>x.status),['NEW','IN_PROGRESS','RESOLVED','CLOSED']);
  for(let i=0;i<before.length;i++)assert.deepEqual(after[i],{...before[i],status:after[i].status,priority:'NORMAL',resolution:i===3?'UNABLE_TO_REPRODUCE':null,version:2,fix_direction:null,reproducibility:'NOT_TESTED'});
  assert.deepEqual((await c.query('SELECT * FROM defect_comments')).rows,comments);assert.deepEqual((await c.query('SELECT * FROM defect_activities')).rows,activities);
  for(const assignment of ["status='OPEN'","priority='MEDIUM'","severity='UNKNOWN'","reproducibility='UNKNOWN'","resolution='NOT_REPRODUCIBLE'"]){await c.query('SAVEPOINT invalid');await assert.rejects(c.query('UPDATE defects SET '+assignment),e=>e.code==='23514');await c.query('ROLLBACK TO SAVEPOINT invalid');}

  for(const status of ['FEEDBACK','CONFIRMED','ASSIGNED','RETEST'])await c.query("INSERT INTO defects(project_id,title,description,steps_to_reproduce,fix_direction,reproducibility,severity,priority,status,created_by,updated_by) VALUES($1,$2,'body','steps','fix','ALWAYS','MAJOR','URGENT',$2,$3,$3)",[project,status,user]);
  await c.query("INSERT INTO defects(project_id,title,description,steps_to_reproduce,reproducibility,severity,priority,status,created_by,updated_by,closed_by,closed_at,resolution) VALUES($1,'fixed','body','steps','NOT_TESTED','MAJOR','NORMAL','CLOSED',$2,$2,$2,now(),'FIXED')",[project,user]);
  const before11=(await c.query('SELECT * FROM defects ORDER BY defect_no')).rows;
  await run('0011_simplify_issue_management.sql');
  const after11=(await c.query('SELECT * FROM defects ORDER BY defect_no')).rows;
  for(let i=0;i<before11.length;i++){
    const row=before11[i];const mapped=({FEEDBACK:'REQUESTED',CONFIRMED:'REQUESTED',ASSIGNED:'REQUESTED',RESOLVED:'RESPONDED',RETEST:'RESPONDED',CLOSED:row.resolution==='FIXED'?'VERIFIED':'SKIP_CONFIRMED'})[row.status];
    assert.deepEqual(after11[i],{...row,status:mapped??row.status,legacy_status:mapped?row.status:null,version:row.version+(mapped?1:0),build_version:null,device_os:'공통',related_defect_id:null});
  }
  assert.deepEqual((await c.query('SELECT * FROM defect_comments')).rows,comments);assert.deepEqual((await c.query('SELECT * FROM defect_activities')).rows,activities);
  await run('0012_issue_evidence_and_rerequest.sql');
  assert.deepEqual((await c.query('SELECT * FROM defects ORDER BY defect_no')).rows,after11);
  assert.deepEqual((await c.query('SELECT * FROM defect_activities')).rows,activities);
  const fresh=schema+'_fresh';await c.query('CREATE SCHEMA '+fresh);await c.query('SET LOCAL search_path TO '+fresh+',public');
  const schemaSql=fs.readFileSync(path.join(__dirname,'../../db/schema.sql'),'utf8');await c.query(schemaSql.slice(schemaSql.indexOf('-- BTS:')));
  const columns=async name=>(await c.query("SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name,column_name",[name])).rows;
  assert.deepEqual(await columns(fresh),await columns(schema));
  const tables=['defects','defect_comments','defect_activities','defect_attachments'];
  assert.deepEqual((await columns('public')).filter(x=>tables.includes(x.table_name)),await columns(schema),'Local public columns match migrations');
  const constraints=async name=>(await c.query(`SELECT t.relname AS table_name,k.conname,k.contype,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 AND t.relname=ANY($2) ORDER BY t.relname,k.conname`,[name,tables])).rows.map(x=>({...x,definition:x.definition.replaceAll(schema+'.','').replaceAll('public.','')}));
  assert.deepEqual(await constraints('public'),await constraints(schema),'Local public CHECK/FK constraints match migrations');
  const indexes=async name=>(await c.query('SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename=ANY($2) ORDER BY tablename,indexname',[name,tables])).rows.map(x=>({...x,indexdef:x.indexdef.replaceAll(schema+'.','').replaceAll('public.','')}));
  assert.deepEqual(await indexes('public'),await indexes(schema),'Local public indexes match migrations');
  console.log('PASS: local public columns/CHECK/FK/indexes match 0009 through 0012');
  console.log('PASS: 0010 + 0011 + 0012 legacy states, priority/frequency/result, narratives/audit/comments/activities preserved');
}finally{await c.query('ROLLBACK');c.release();await db.end();console.log('CLEANUP: disposable schema rolled back');}})().catch(e=>{console.error(e);process.exitCode=1;});
