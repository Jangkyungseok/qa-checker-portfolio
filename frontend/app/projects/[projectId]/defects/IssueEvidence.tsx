'use client';
import {useEffect,useState} from 'react';
import {SidebarUser} from '../../../components/AppSidebar';
import {Issue,Request,date,finalState,message} from './issue-model';
import styles from './defects.module.css';
export type EvidencePolicy={maxFiles:number;imageMaxBytes:number;videoMaxBytes:number;mimeTypes:string[]};
export type PendingEvidence={id:string;file:File;done:boolean;error?:string};
type Attachment={id:string;original_filename:string;mime_type:string;size_bytes:number;uploaded_by:string;uploaded_by_name:string;created_at:string};
export function EvidencePicker({items,onChange,policy,disabled=false}:{items:PendingEvidence[];onChange:(items:PendingEvidence[])=>void;policy:EvidencePolicy|null;disabled?:boolean}){
 const [error,setError]=useState('');
 return <section className={styles.evidencePicker}><label>증빙 자료 (선택)<input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.mp4,.mov" disabled={disabled||!policy} onChange={e=>{
   const files=Array.from(e.target.files??[]);e.target.value='';setError('');if(!policy)return;
   if(files.length+items.length>policy.maxFiles){setError(`한 번에 최대 ${policy.maxFiles}개까지 선택해 주세요.`);return;}
   for(const file of files){const video=/\.(mp4|mov)$/i.test(file.name),limit=video?policy.videoMaxBytes:policy.imageMaxBytes;if(!/\.(png|jpe?g|webp|pdf|mp4|mov)$/i.test(file.name)||!file.size||file.size>limit){setError(`${file.name}: 지원 형식과 ${limit/1048576}MB 크기 제한을 확인해 주세요.`);return;}}
   onChange([...items,...files.map(file=>({id:crypto.randomUUID(),file,done:false}))]);
 }}/></label><p className={styles.hint}>{policy?`최대 ${policy.maxFiles}개 · 이미지/PDF ${policy.imageMaxBytes/1048576}MB · MP4/MOV ${policy.videoMaxBytes/1048576}MB 이하`:'첨부 정책을 불러오는 중...'}</p>
 {error&&<p role="alert" className={styles.error}>{error}</p>}
 <ul className={styles.evidenceQueue}>{items.map(item=><li key={item.id}><span>{item.file.name} · {Math.ceil(item.file.size/1024)}KB{item.done?' · 업로드 완료':''}</span>{item.error&&<p role="alert" className={styles.error}>{item.error}</p>}{!item.done&&<button type="button" className="secondary-button" disabled={disabled} onClick={()=>onChange(items.filter(x=>x.id!==item.id))}>선택 제거</button>}</li>)}</ul></section>;
}
export async function uploadEvidence(id:string,items:PendingEvidence[],request:Request,progress:(items:PendingEvidence[])=>void){
 const result=items.map(x=>({...x}));
 for(let i=0;i<result.length;i++){
  if(result[i].done)continue;
  const form=new FormData();form.append('uploadId',result[i].id);form.append('file',result[i].file);
  try{await request(`/defects/${id}/attachments`,{method:'POST',body:form});result[i]={...result[i],done:true,error:undefined};}
  catch(e){result[i]={...result[i],error:result[i].file.name+': '+message(e)};}
  progress([...result]);
 }
 return result;
}
export default function IssueEvidence({issue,user,request,onChanged}:{issue:Issue;user:SidebarUser;request:Request;onChanged:()=>Promise<void>}){
 const [attachments,setAttachments]=useState<Attachment[]>([]),[policy,setPolicy]=useState<EvidencePolicy|null>(null),[items,setItems]=useState<PendingEvidence[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState<string|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();Promise.all([request<Attachment[]>(`/defects/${issue.id}/attachments`,{signal:c.signal}),request<EvidencePolicy>('/defects/attachment-policy',{signal:c.signal})]).then(([a,p])=>{if(!c.signal.aborted){setAttachments(a);setPolicy(p);setError('');}}).catch(e=>{if(!c.signal.aborted)setError(message(e));});return()=>c.abort();},[issue.id,issue.version,request,retry]);
 const canUpload=!finalState(issue.status)&&(user.role!=='USER'||issue.created_by===user.id);
 return <section className={styles.panel}><h2>증빙 자료</h2>{error&&<p className={styles.error} role="alert">{error}<button className="secondary-button" onClick={()=>setRetry(n=>n+1)}>다시 시도</button></p>}
 {!attachments.length&&!error&&<p className={styles.hint}>등록된 증빙 자료가 없습니다.</p>}
 <div className={styles.evidenceList}>{attachments.map(a=><article className={styles.evidenceCard} key={a.id}><strong>{a.original_filename}</strong><p className={styles.hint}>{a.uploaded_by_name} · {date(a.created_at)} · {Math.ceil(Number(a.size_bytes)/1024)}KB</p><EvidencePreview issueId={issue.id} attachment={a}/>
 {!finalState(issue.status)&&(user.role!=='USER'||a.uploaded_by===user.id)&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>setConfirm(a.id)}>증빙 삭제</button>}
 {confirm===a.id&&<div role="group" aria-label="증빙 삭제 확인"><p>이 증빙 자료를 삭제할까요?</p><button type="button" className="secondary-button" disabled={busy} onClick={async()=>{setBusy(true);try{await request(`/defects/${issue.id}/attachments/${a.id}`,{method:'DELETE'});setConfirm(null);await onChanged();}catch(e){setError(message(e));}finally{setBusy(false);}}}>삭제 확인</button><button type="button" className="secondary-button" onClick={()=>setConfirm(null)}>취소</button></div>}
 </article>)}</div>
 {canUpload&&<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);try{const results=await uploadEvidence(issue.id,items,request,setItems);setItems(results.filter(x=>!x.done));await onChanged();}catch(e){setError(message(e));}finally{setBusy(false);}}}><EvidencePicker items={items} onChange={setItems} policy={policy?{...policy,maxFiles:Math.max(0,policy.maxFiles-attachments.length)}:null} disabled={busy}/><button className="secondary-button" disabled={busy||!items.length}>{busy?'업로드 중...':'증빙 업로드'}</button></form>}
 </section>;
}
function EvidencePreview({issueId,attachment:a}:{issueId:string;attachment:Attachment}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[open,setOpen]=useState(a.mime_type.startsWith('image/'));
 useEffect(()=>{if(!open)return;const c=new AbortController();let objectUrl='';setLoading(true);setError('');
 fetch(`${process.env.NEXT_PUBLIC_API_URL??'http://127.0.0.1:3001'}/defects/${issueId}/attachments/${a.id}/file`,{headers:{Authorization:'Bearer '+localStorage.getItem('qa_checker_token')},cache:'no-store',signal:c.signal})
 .then(async r=>{if(!r.ok)throw new Error('증빙 자료를 불러오지 못했습니다. 다시 로그인하거나 새로고침해 주세요.');return r.blob();}).then(blob=>{if(c.signal.aborted)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}).catch(e=>{if(!c.signal.aborted)setError(message(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
 return()=>{c.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[issueId,a.id,open]);
 return <div className={styles.evidencePreview}>{loading&&<p role="status">자료를 불러오는 중...</p>}{error&&<p className={styles.error} role="alert">{error}</p>}
 {url?(a.mime_type.startsWith('image/')?<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={a.original_filename}/></a>:a.mime_type.startsWith('video/')?<video src={url} controls preload="metadata" aria-label={a.original_filename}/>:null):!open&&<button type="button" className="secondary-button" onClick={()=>setOpen(true)}>{a.mime_type.startsWith('video/')?'영상 열기':'파일 열기'}</button>}
 {url&&<a href={url} download={a.original_filename}>다운로드</a>}</div>;
}
