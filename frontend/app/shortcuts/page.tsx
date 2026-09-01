'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppSidebar, { SidebarUser } from '../components/AppSidebar';

export default function ShortcutsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SidebarUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('qa_checker_token');
    const storedUser = localStorage.getItem('qa_checker_user');
    if (!token || !storedUser) {
      router.replace('/');
      return;
    }
    setUser(JSON.parse(storedUser));
  }, [router]);

  function pending(name: string) {
    window.alert(`${name} 링크/연동 정보는 프로젝트 환경에 맞춰 설정할 예정입니다.`);
  }

  if (!user) {
    return <main className="execution-loading">화면을 불러오는 중...</main>;
  }

  return (
    <main className="app-shell">
      <AppSidebar user={user} activeMenu="shortcuts" />
      <section className="app-main workspace-main">
        <div className="workspace-page">
          <section className="workspace-hero compact">
            <div>
              <span className="workspace-eyebrow">WORK LINKS</span>
              <h1>업무 바로가기</h1>
              <p>현재는 빠른 이동 중심으로 제공하고, 이후 API 연동 시 현황 조회로 확장합니다.</p>
            </div>
          </section>

          <div className="workspace-tool-grid shortcuts">
            {['Jira', 'Google Drive', 'Google Calendar', 'Confluence', 'Slack'].map((name) => (
              <button key={name} type="button" onClick={() => pending(name)}>
                <span className="workspace-tool-icon">↗</span>
                <div>
                  <h2>{name}</h2>
                  <p>조직에서 사용하는 실제 주소 또는 연동 계정을 연결합니다.</p>
                </div>
                <small>연동 전 →</small>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
