'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppSidebar, { SidebarUser } from '../components/AppSidebar';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

interface Project {
  id: string;
  name: string;
  is_active: boolean;
  updated_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SidebarUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('qa_checker_token');
      const storedUser = localStorage.getItem('qa_checker_user');

      if (!token || !storedUser) {
        router.replace('/');
        return;
      }

      try {
        setUser(JSON.parse(storedUser) as SidebarUser);
        const response = await fetch(`${API_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) setProjects(data);
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [router]);

  const recentProjects = useMemo(
    () =>
      [...projects]
        .filter((project) => project.is_active !== false)
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        .slice(0, 4),
    [projects],
  );

  if (!user) {
    return <main className="execution-loading">화면을 불러오는 중...</main>;
  }

  return (
    <main className="app-shell">
      <AppSidebar user={user} activeMenu="dashboard" />

      <section className="app-main workspace-main">
        <div className="workspace-page dashboard-v3">
          <section className="workspace-hero dashboard-hero-v3">
            <div>
              <span className="workspace-eyebrow">QA WORKSPACE</span>
              <h1>대시보드</h1>
              <p>
                왼쪽 프로젝트 메뉴에서 작업할 프로젝트를 선택하세요. 프로젝트를 선택하면
                빌드 검수, QA 관리, 일정과 이슈 정보를 한 곳에서 확인할 수 있습니다.
              </p>
            </div>
            <div className="dashboard-hero-art" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </section>

          <div className="dashboard-overview-grid">
            <section className="workspace-panel dashboard-projects-panel">
              <div className="workspace-panel-heading dashboard-heading-clean">
                <h2>최근 프로젝트</h2>
                <button type="button" onClick={() => router.push('/projects')}>
                  전체 보기 ›
                </button>
              </div>

              {isLoading ? (
                <div className="workspace-panel-empty">프로젝트를 불러오는 중...</div>
              ) : recentProjects.length === 0 ? (
                <div className="workspace-panel-empty">접근 가능한 프로젝트가 없습니다.</div>
              ) : (
                <div className="dashboard-project-list">
                  {recentProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      <div className="dashboard-project-symbol" aria-hidden="true">□</div>
                      <div className="dashboard-project-copy">
                        <strong>{project.name}</strong>
                        <span>
                          업데이트 {new Date(project.updated_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <span className="dashboard-project-open">열기 ›</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="workspace-panel dashboard-status-panel">
              <div className="workspace-panel-heading dashboard-heading-clean">
                <h2>상태 요약</h2>
              </div>
              <div className="dashboard-status-list">
                <div><span>진행 중 빌드</span><strong>0</strong></div>
                <div><span>진행 중 QA</span><strong>0</strong></div>
                <div><span>열린 이슈</span><strong>0</strong></div>
                <div><span>다가오는 일정</span><strong>0</strong></div>
              </div>
              <p className="dashboard-status-note">현황 데이터 연동은 다음 단계에서 구현합니다.</p>
            </section>
          </div>

          <section className="workspace-panel dashboard-notice-panel">
            <div className="workspace-panel-heading dashboard-heading-clean">
              <h2>공지사항</h2>
              <button type="button" onClick={() => router.push('/notices')}>
                전체 보기 ›
              </button>
            </div>
            <div className="dashboard-notice-rows">
              <button type="button" onClick={() => router.push('/notices')}>
                <span>QA Checker 프로젝트 Workspace 개편 안내</span><time>2026.09.01</time>
              </button>
              <button type="button" onClick={() => router.push('/notices')}>
                <span>포트폴리오 데모 기능 개선 안내</span><time>2026.08.31</time>
              </button>
              <button type="button" onClick={() => router.push('/notices')}>
                <span>QA Checker 고도화 진행 안내</span><time>2026.08.30</time>
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
