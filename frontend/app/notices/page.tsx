'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppSidebar, { SidebarUser } from '../components/AppSidebar';

export default function NoticesPage() {
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

  if (!user) {
    return <main className="execution-loading">화면을 불러오는 중...</main>;
  }

  return (
    <main className="app-shell">
      <AppSidebar user={user} activeMenu="notices" />
      <section className="app-main workspace-main">
        <div className="workspace-page">
          <section className="workspace-hero compact">
            <div>
              <span className="workspace-eyebrow">NOTICE</span>
              <h1>공지사항</h1>
              <p>포트폴리오 버전에서는 공통 공지로 제공하며, 실제 운영 시 프로젝트별 공지로 확장할 수 있습니다.</p>
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-notice-list full">
              <article>
                <strong>QA Checker 프로젝트 Workspace 고도화</strong>
                <p>빌드 검수 중심 MVP에서 프로젝트별 QA 현황·일정·문서·이슈를 통합하는 Workspace 구조로 확장 중입니다.</p>
                <span>2026.09.01 · Portfolio Demo</span>
              </article>
              <article>
                <strong>빌드 검수 실행 화면 UX 개선</strong>
                <p>실무자 피드백을 반영해 3열 구조와 sticky 판정 카드, 저장 상태 구분을 적용했습니다.</p>
                <span>2026.08.31 · Portfolio Demo</span>
              </article>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
