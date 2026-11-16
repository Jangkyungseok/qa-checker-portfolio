'use client';
import {useEffect,useState} from 'react';
import AppSidebar,{SidebarUser} from '../../components/AppSidebar';
const API=process.env.NEXT_PUBLIC_API_URL??'http://127.0.0.1:3001';
type Pending={id:string;name:string;email:string;created_at:string};
export default function UsersPage(){
 const [user,setUser]=useState<SidebarUser|null>(null),[rows,setRows]=useState<Pending[]>([]),[roles,setRoles]=useState<Record<string,string>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function request(path:string,options:RequestInit={}){const r=await fetch(API+path,{...options,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('qa_checker_token')}});const d=await r.json();if(!r.ok)throw new Error(d.message??'요청을 처리하지 못했습니다.');return d;}
 useEffect(()=>{let active=true;(async()=>{try{const u=await request('/auth/me');if(!active)return;setUser(u);if(u.role!=='ADMIN')return;const data=await request('/users/pending');if(active)setRows(data);}catch(e){if(active)setError(e instanceof Error?e.message:'조회 실패');}})();return()=>{active=false;};},[]);
 async function decide(id:string,approve:boolean){setBusy(true);setError('');try{await request('/users/'+id+(approve?'/approve':'/reject'),{method:'POST',...(approve?{body:JSON.stringify({role:roles[id]??'USER'})}:{})});setRows(await request('/users/pending'));}catch(e){setError(e instanceof Error?e.message:'처리 실패');}finally{setBusy(false);}}
 if(!user)return <main className="execution-loading">{error||'불러오는 중...'}</main>;
 if(user.role!=='ADMIN')return <main className="execution-loading">접근 권한이 없습니다.</main>;
 return <main className="app-shell"><AppSidebar user={user} activeMenu="admin"/><section className="app-main workspace-main"><div className="workspace-page"><header className="workspace-hero compact"><h1>사용자 관리</h1></header><section className="workspace-panel"><h2>승인 대기</h2>{error&&<p role="alert" className="dashboard-error">{error}</p>}{rows.length===0&&<p>승인 대기 중인 사용자가 없습니다.</p>}{rows.map(row=><article key={row.id} className="workspace-build-row"><div><strong>{row.name}</strong><p>{row.email}</p></div><label>승인 역할<select aria-label={row.name+' 승인 역할'} value={roles[row.id]??'USER'} disabled={busy} onChange={e=>setRoles({...roles,[row.id]:e.target.value})}><option value="USER">USER</option><option value="LEADER">LEADER</option><option value="DEV">DEV</option></select></label><button className="primary-button" disabled={busy} onClick={()=>decide(row.id,true)}>승인</button><button className="secondary-button" disabled={busy} onClick={()=>decide(row.id,false)}>거절</button></article>)}</section></div></section></main>;
}
