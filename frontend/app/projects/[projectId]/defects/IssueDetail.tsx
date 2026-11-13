'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {SidebarUser} from '../../../components/AppSidebar';
import {useLeaveGuard} from '../decisions/LeaveGuard';
import IssueEditor,{Badge} from './IssueEditor';
import IssueStatus from './IssueStatus';
import IssueEvidence from './IssueEvidence';
import {Activity,Comment,Issue,Request,STATES,PRIORITIES,FREQUENCIES,EVENTS,FIELDS,date,display,message,finalState,issueCode} from './issue-model';
import styles from './defects.module.css';
export default function IssueDetail({projectId,issueId,user,request}:{projectId:string;issueId:string;user:SidebarUser;request:Request}){
 const [record,setRecord]=useState<Issue|null>(null),[comments,setComments]=useState<Comment[]>([]),[activities,setActivities]=useState<Activity[]>([]),[editing,setEditing]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[body,setBody]=useState('');const leave=useLeaveGuard();
 const load=useCallback(async()=>{const [d,c,a]=await Promise.all([request<Issue>('/defects/'+issueId),request<Comment[]>('/defects/'+issueId+'/comments'),request<Activity[]>('/defects/'+issueId+'/activities')]);if(d.project_id!==projectId)throw new Error('현재 프로젝트의 이슈가 아닙니다.');setRecord(d);setComments(c);setActivities(a);},[request,issueId,projectId]);
 useEffect(()=>{let active=true;load().catch(e=>{if(active)setError(message(e));});return()=>{active=false;};},[load]);
 async function action(work:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await work();await load();}catch(e){setError(message(e));}finally{setBusy(false);}}
 if(!record)return <section className={styles.panel}>{error?<p role="alert" className={styles.error}>{error}</p>:<p role="status">불러오는 중...</p>}<button onClick={()=>action(load)}>다시 시도</button></section>;
 const breadcrumb=<nav aria-label="뒤로가기"><Link className={styles.backLink} href={"/projects/"+projectId+"/defects"}>← 이슈 목록</Link></nav>;
 if(editing)return <>{breadcrumb}<IssueEditor key={record.version} projectId={projectId} request={request} record={record} onSaved={()=>leave.finish(()=>{void load().then(()=>setEditing(false)).catch(e=>setError(message(e)));})} onCancel={()=>leave.request(()=>setEditing(false))}/></>;
 return <>
 {breadcrumb}
 {error&&<p className={styles.error} role="alert">{error}</p>}
 <section className={styles.panel}><header className={styles.issueHeading}><div><span className={styles.issueCode}>{issueCode(record.defect_code)}</span><h2>{record.title}</h2></div><div className={styles.actions}><Badge status={record.status}/>{!finalState(record.status)&&(user.role!=='USER'||record.created_by===user.id)&&<button className="secondary-button" disabled={busy} onClick={()=>setEditing(true)}>이슈 수정</button>}<button className="secondary-button" disabled={busy} onClick={()=>action(load)}>새로고침</button></div></header>
 <dl className={styles.metadata}><dt>상태</dt><dd><Badge status={record.status}/></dd><dt>우선순위</dt><dd>{display(record.priority,PRIORITIES)}</dd><dt>발생 빈도</dt><dd>{display(record.reproducibility,FREQUENCIES)}</dd><dt>빌드 버전</dt><dd>{record.build_version??'미등록'}</dd><dt>발생 단말 / OS</dt><dd>{record.device_os}</dd><dt>등록자</dt><dd>{record.created_by_name}</dd><dt>등록일</dt><dd>{date(record.created_at)}</dd><dt>최종 수정일</dt><dd>{date(record.updated_at)}</dd><dt>수정자</dt><dd>{record.updated_by_name}</dd></dl>
 <div className={styles.prose}>{([['steps_to_reproduce','재현 절차'],['description','이슈 내용'],['fix_direction','수정 방향']] as const).map(([k,label])=><section key={k}><h3>{label}</h3><p className={styles.body}>{record[k]||'미등록 (기존 기록)'}</p></section>)}<section><h3>연계 이슈</h3>{record.related_defect_id?<Link href={'/projects/'+record.related_project_id+'/defects/'+record.related_defect_id}>{issueCode(record.related_issue_code)} · {record.related_issue_title}</Link>:<span className={styles.muted}>연결 없음</span>}</section></div>
 </section>
 <IssueEvidence issue={record} user={user} request={request} onChanged={load}/>
 <section className={styles.panel}><h2>이슈 상태 변경</h2><IssueStatus issue={record} request={request} onChanged={async()=>load()}/></section>
 <section className={styles.panel+' '+styles.comments}><h2>코멘트</h2>{!comments.length&&<p className={styles.muted}>첫 코멘트를 남겨 주세요.</p>}
 {comments.map(c=><CommentCard key={c.id+':'+c.version} comment={c} user={user} busy={busy} save={text=>action(()=>request('/defects/'+issueId+'/comments/'+c.id,{method:'PATCH',body:JSON.stringify({body:text,version:c.version})}))} remove={()=>action(()=>request('/defects/'+issueId+'/comments/'+c.id,{method:'DELETE'}))}/>)}
 <form className={styles.compose} onSubmit={e=>{e.preventDefault();void action(async()=>{await request('/defects/'+issueId+'/comments',{method:'POST',body:JSON.stringify({body})});setBody('');});}}><label>코멘트 작성<textarea required maxLength={5000} value={body} onChange={e=>setBody(e.target.value)}/></label><div className={styles.actions}><button className="primary-button" disabled={busy||!body.trim()}>코멘트 등록</button></div></form></section>
 <section className={styles.panel}><h2>활동 이력</h2><ol className={styles.timeline}>{activities.map(a=><li key={a.id}><header><time>{date(a.created_at)}</time><strong>{a.actor_name}</strong></header><p>{a.changes.action==='REOPENED'?'확인 후 재요청':EVENTS[a.event_type]??a.event_type}</p><ActivityChange activity={a}/></li>)}</ol></section>
 </>;
}
function CommentCard({comment:c,user,busy,save,remove}:{comment:Comment;user:SidebarUser;busy:boolean;save:(body:string)=>Promise<void>;remove:()=>Promise<void>}) {
  const [editing,setEditing]=useState(false);const [body,setBody]=useState(c.body??'');const [confirm,setConfirm]=useState(false);
  return <article className={styles.comment}><header><strong>{c.author_name}</strong><time>{date(c.created_at)}</time>{c.created_at!==c.updated_at&&<small>수정 {date(c.updated_at)}</small>}</header>
    {c.deleted_at?<p className={styles.muted}>삭제된 코멘트입니다.</p>:<>
      {editing?<form onSubmit={e=>{e.preventDefault();void save(body);}}><label>코멘트 수정<textarea required maxLength={5000} value={body} onChange={e=>setBody(e.target.value)}/></label><div className={styles.actions}><button className="primary-button" disabled={busy||!body.trim()}>코멘트 저장</button><button type="button" className="secondary-button" onClick={()=>{setEditing(false);setBody(c.body??'');}}>취소</button></div></form>:<p className={styles.body}>{c.body}</p>}
      {!editing&&<div className={styles.smallActions}>{c.author_id===user.id&&<button type="button" disabled={busy} onClick={()=>setEditing(true)}>수정</button>}{(c.author_id===user.id||user.role!=='USER')&&<button type="button" disabled={busy} onClick={()=>setConfirm(true)}>삭제</button>}</div>}
      {confirm&&<div role="group" aria-label="코멘트 삭제 확인"><p>코멘트를 삭제할까요?</p><div className={styles.actions}><button className="secondary-button" disabled={busy} onClick={()=>void remove()}>삭제 확인</button><button className="secondary-button" onClick={()=>setConfirm(false)}>취소</button></div></div>}
    </>}
  </article>;
}


function ActivityChange({activity:a}:{activity:Activity}){
 const map=a.event_type==='STATUS_CHANGED'?STATES:a.event_type==='PRIORITY_CHANGED'?PRIORITIES:{};
 if('from' in a.changes)return <small>{display(a.changes.from,map)} → {display(a.changes.to,map)}</small>;
 if(a.event_type==='CONTENT_UPDATED')return <small>{Object.entries(a.changes).map(([k,v])=>k==='reproducibility'?'발생 빈도: '+display((v as {from:unknown}).from,FREQUENCIES)+' → '+display((v as {to:unknown}).to,FREQUENCIES):FIELDS[k]??k).join(', ')}</small>;
 if(a.changes.filename)return <small>{String(a.changes.filename)}</small>;
 return null;
}
