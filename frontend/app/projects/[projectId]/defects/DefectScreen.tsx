'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppSidebar, { SidebarUser } from '../../../components/AppSidebar';
import LeaveGuard, { useLeaveGuard } from '../decisions/LeaveGuard';
import styles from './defects.module.css';
import IssueEditor, { Badge, Options } from './IssueEditor';
import IssueDetail from './IssueDetail';
import { STATES, FREQUENCIES, PRIORITIES, Issue, Request, date, display, message, issueCode } from './issue-model';
import IssueStatus from './IssueStatus';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';
type Props = {projectId:string;defectId?:string;create?:boolean};
export default function DefectScreen(props:Props) { return <LeaveGuard><Screen {...props} /></LeaveGuard>; }
function Screen({projectId,defectId,create}:Props) {
  const router=useRouter(); const leave=useLeaveGuard();
  const [user,setUser]=useState<SidebarUser|null>(null); const [project,setProject]=useState<{id:string;name:string}|null>(null);
  const [error,setError]=useState(''); const [retry,setRetry]=useState(0);
  const request:Request=useCallback(async <T,>(path:string,options:RequestInit={}):Promise<T>=>{
    const token=localStorage.getItem('qa_checker_token');
    if (!token) {router.replace('/');throw new Error('로그인이 필요합니다.');}
    const response=await fetch(`${API}${path}`,{...options,cache:'no-store',headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),Authorization:`Bearer ${token}`,...options.headers}});
    const data=await response.json();
    if (response.status===401) {router.replace('/');throw new Error('다시 로그인해 주세요.');}
    if (!response.ok) throw new Error(response.status===500?'서버 오류로 요청을 완료하지 못했습니다. 다시 시도해 주세요.':Array.isArray(data.message)?data.message.join(' / '):data.message??'요청에 실패했습니다.');
    return data as T;
  },[router]);
  useEffect(()=>{
    const control=new AbortController(); setError('');
    Promise.all([request<SidebarUser>('/auth/me',{signal:control.signal}),request<{id:string;name:string}[]>('/projects?includeInactive=true',{signal:control.signal})])
      .then(([u,projects])=>{if(control.signal.aborted)return; const found=projects.find(p=>p.id===projectId);if(!found)throw new Error('프로젝트를 찾을 수 없습니다.');setUser(u);setProject(found);})
      .catch(e=>{if(!control.signal.aborted)setError(message(e));});
    return ()=>control.abort();
  },[request,projectId,retry]);
  if(error)return <main className={styles.panel}><p role="alert" className={styles.error}>{error}</p><button onClick={()=>setRetry(x=>x+1)}>다시 시도</button><Link href={`/projects/${projectId}`}>Workspace</Link></main>;
  if(!user||!project)return <main className="execution-loading" role="status">불러오는 중...</main>;
  const base=`/projects/${projectId}/defects`;
  return <main className="app-shell"><AppSidebar user={user} activeMenu="project" currentProjectId={projectId} guardAction={leave.request}/>
    <section className="app-main workspace-main"><div className={`workspace-page ${styles.page}`}>
      <header className="workspace-hero project"><div className="workspace-hero-copy"><span className="workspace-eyebrow">{project.name}</span><h1>{create?'이슈 등록':defectId?'이슈 상세':'이슈 관리'}</h1><p>{create?'발견한 이슈와 발생 환경을 등록합니다.':'발견된 이슈와 대응 진행 상황을 관리합니다.'}</p></div></header>
      {!defectId&&<nav aria-label="뒤로가기"><Link className={styles.backLink} href={create?base:`/projects/${projectId}`}>{create?'← 이슈 목록':'← 프로젝트로'}</Link></nav>}
      {create?<IssueEditor projectId={projectId} request={request} onSaved={row=>leave.finish(()=>router.push(`${base}/${row.id}`))} onCancel={()=>leave.request(()=>router.push(base))}/>
        :defectId?<IssueDetail projectId={projectId} issueId={defectId} user={user} request={request}/>
        :<DefectList projectId={projectId} request={request}/>}
    </div></section></main>;
}

function DefectList({projectId,request}:{projectId:string;request:Request}){
 const router=useRouter();const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState(''),[priority,setPriority]=useState(''),[frequency,setFrequency]=useState(''),[page,setPage]=useState(1),[retry,setRetry]=useState(0);
 const [data,setData]=useState<{items:Issue[];total:number}>({items:[],total:0}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');const q=new URLSearchParams({projectId,page:String(page)});if(query)q.set('search',query);if(status)q.set('status',status);if(priority)q.set('priority',priority);if(frequency)q.set('reproducibility',frequency);
 request<{items:Issue[];total:number}>('/defects?'+q,{signal:c.signal}).then(result=>{if(!c.signal.aborted){setData(result);if(page>1&&!result.items.length)setPage(p=>p-1);}}).catch(e=>{if(!c.signal.aborted)setError(message(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[request,projectId,query,status,priority,frequency,page,retry]);
 function changed(row:Issue){setData(d=>{const remove=!!status&&row.status!==status;return {items:remove?d.items.filter(x=>x.id!==row.id):d.items.map(x=>x.id===row.id?row:x),total:Math.max(0,d.total-(remove?1:0))};});setRetry(n=>n+1);}
 return <section className={styles.panel}><div className={styles.heading}><h2>이슈 목록</h2><Link className="primary-button" href={'/projects/'+projectId+'/defects/new'}>이슈 등록</Link></div>
 <form className={styles.filters} onSubmit={e=>{e.preventDefault();setPage(1);setQuery(search);}}><label>검색<input placeholder="이슈 번호 또는 제목" maxLength={200} value={search} onChange={e=>setSearch(e.target.value)}/></label>
 <label>상태<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">전체</option><Options values={STATES}/></select></label>
 <label>우선순위<select value={priority} onChange={e=>{setPriority(e.target.value);setPage(1);}}><option value="">전체</option><Options values={PRIORITIES}/></select></label>
 <label>발생 빈도<select value={frequency} onChange={e=>{setFrequency(e.target.value);setPage(1);}}><option value="">전체</option><Options values={FREQUENCIES}/></select></label>
 <div className={styles.actions}><button className="secondary-button">검색</button><button type="button" className="secondary-button" onClick={()=>{setSearch('');setQuery('');setStatus('');setPriority('');setFrequency('');setPage(1);}}>초기화</button><button type="button" className="secondary-button" onClick={()=>setRetry(n=>n+1)}>새로고침</button></div></form>
 {error&&<p className={styles.error} role="alert">{error}</p>}<p className={styles.hint} aria-live="polite">총 {data.total}건{loading?' · 불러오는 중...':''}</p>
 <div className={styles.tableScroll}><table className={styles.issueTable}><thead><tr><th>이슈 번호</th><th>상태</th><th>우선순위</th><th>발생 빈도</th><th>빌드 버전</th><th>발생 단말 / OS</th><th>제목</th><th>최종 수정일</th><th>상태 변경</th></tr></thead><tbody>{data.items.map(d=>{
 const url='/projects/'+projectId+'/defects/'+d.id;
 return <tr key={d.id} className={styles[d.status]} tabIndex={0} aria-label={issueCode(d.defect_code)+' '+d.title} onClick={e=>{if(!(e.target as HTMLElement).closest('a,button,select,input,form'))router.push(url);}} onKeyDown={e=>{if(e.target===e.currentTarget&&e.key==='Enter'){e.preventDefault();router.push(url);}}}>
 <td><Link href={url}>{issueCode(d.defect_code)}</Link></td><td><Badge status={d.status}/></td><td>{display(d.priority,PRIORITIES)}</td><td>{display(d.reproducibility,FREQUENCIES)}</td><td>{d.build_version??'미등록'}</td><td>{d.device_os}</td><td className={styles.titleCell}><Link href={url}>{d.title}</Link></td><td><time>{date(d.updated_at)}</time></td><td><IssueStatus key={d.id+':'+d.version} issue={d} request={request} onChanged={changed} compact/></td></tr>;
 })}</tbody></table></div>
 {!loading&&!error&&!data.items.length&&<p>등록된 이슈가 없습니다.</p>}<div className={styles.actions}><button className="secondary-button" disabled={page===1||loading} onClick={()=>setPage(p=>p-1)}>이전</button><span>{page} 페이지</span><button className="secondary-button" disabled={page*30>=data.total||loading} onClick={()=>setPage(p=>p+1)}>다음</button></div>
 </section>;
}
