'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { SidebarUser } from './AppSidebar';
const API=process.env.NEXT_PUBLIC_API_URL??'http://127.0.0.1:3001';
export function devRouteAllowed(path:string,view:string|null) {
  if(path==='/projects')return true;
  if(/^\/projects\/[^/]+$/.test(path))return !view||view==='workspace';
  if(/^\/projects\/[^/]+\/(defects|qa-report)$/.test(path))return true;
  if(/^\/projects\/[^/]+\/issue-report$/.test(path))return true;
  return /^\/projects\/[^/]+\/(defects|qa-report)\/[0-9a-f-]{36}$/i.test(path);
}
export default function DevRouteGuard({children}:{children:React.ReactNode}) {
  const path=usePathname(),search=useSearchParams(),router=useRouter();
  const key=path+'?'+search.toString();
  const publicPage=path==='/'||path==='/portfolio';
  const [state,setState]=useState<{key:string;user:SidebarUser|null;error:string}>({key:'',user:null,error:''});
  useEffect(()=>{
    if(publicPage)return;
    const c=new AbortController(),token=localStorage.getItem('qa_checker_token');
    if(!token){router.replace('/');return;}
    fetch(API+'/auth/me',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:c.signal})
      .then(async r=>{if(!r.ok){if(r.status===401)router.replace('/');throw new Error('사용자 권한을 확인하지 못했습니다.');}return r.json();})
      .then((user:SidebarUser)=>{if(c.signal.aborted)return;localStorage.setItem('qa_checker_user',JSON.stringify(user));setState({key,user,error:''});if(user.role==='DEV'&&path==='/dashboard')router.replace('/projects');})
      .catch(e=>{if(!c.signal.aborted)setState({key,user:null,error:e instanceof TypeError?'서버에 연결하지 못했습니다.':e.message});});
    return()=>c.abort();
  },[key,path,publicPage,router]);
  if(publicPage)return children;
  if(state.key!==key)return <main className="execution-loading">권한 확인 중...</main>;
  if(state.error)return <main className="execution-loading"><p role="alert">{state.error}</p><Link href="/">로그인으로</Link></main>;
  if(!state.user)return null;
  if(state.user.role==='DEV'&&!devRouteAllowed(path,search.get('view')))return <main className="execution-loading"><div><h1>접근 권한이 없습니다.</h1><Link href="/projects">프로젝트로 이동</Link></div></main>;
  return children;
}
