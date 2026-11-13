'use client';
import {useState} from 'react';
import {Issue,Request,STATES,finalState,message,issueCode} from './issue-model';
import {Options,Badge} from './IssueEditor';
import styles from './defects.module.css';
export default function IssueStatus({issue,request,onChanged,compact=false}:{issue:Issue;request:Request;onChanged:(row:Issue)=>void|Promise<void>;compact?:boolean}){
 const [target,setTarget]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form className={compact?styles.rowStatus:styles.transition} onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onSubmit={async e=>{e.preventDefault();if(!target||busy)return;setBusy(true);setError('');try{const row=await request<Issue>(`/defects/${issue.id}/status`,{method:'PATCH',body:JSON.stringify({version:issue.version,status:target})});setTarget('');await onChanged(row);}catch(e){setError(message(e));}finally{setBusy(false);}}}>
  {!compact&&<p>현재 상태: <Badge status={issue.status}/></p>}
  {issue.allowed_transitions.length>0?<div className={styles.actions}><select aria-label={`${issueCode(issue.defect_code)} 상태 변경`} value={target} disabled={busy} onChange={e=>setTarget(e.target.value)}><option value="">다음 상태</option><Options values={Object.fromEntries(issue.allowed_transitions.map(s=>[s,STATES[s]]))}/></select><button className="secondary-button" disabled={busy||!target}>{busy?'변경 중...':'적용'}</button></div>:!compact&&<p className={styles.hint}>최종 확인과 확인 후 재요청은 LEADER/ADMIN이 처리합니다.</p>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
 </form>;
}
