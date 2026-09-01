'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppSidebar, {
  SidebarUser,
} from '../components/AppSidebar';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

interface Project {
  id: string;
  name: string;
  is_active: boolean;
  updated_at: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SidebarUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadProjects() {
      const token = localStorage.getItem('qa_checker_token');
      const storedUser = localStorage.getItem('qa_checker_user');

      if (!token || !storedUser) {
        router.replace('/');
        return;
      }

      try {
        setUser(JSON.parse(storedUser));
        const response = await fetch(`${API_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message ?? '프로젝트 목록을 불러오지 못했습니다.');
        }
        setProjects(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : '프로젝트 목록을 불러오는 중 오류가 발생했습니다.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadProjects();
  }, [router]);

  const filteredProjects = useMemo(() => {
    const keyword = searchText.trim().toLocaleLowerCase();
    return projects
      .filter((project) => project.is_active !== false)
      .filter((project) =>
        keyword
          ? project.name.toLocaleLowerCase().includes(keyword)
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
  }, [projects, searchText]);

  if (!user) {
    return <main className="execution-loading">화면을 불러오는 중...</main>;
  }

  return (
    <main className="app-shell">
      <AppSidebar user={user} activeMenu="project" />

      <section className="app-main workspace-main">
        <div className="workspace-page">
          <section className="workspace-hero compact">
            <div>
              <span className="workspace-eyebrow">PROJECT</span>
              <h1>프로젝트 선택</h1>
              <p>
                접근 권한이 있는 프로젝트만 표시됩니다. 프로젝트를
                선택하면 해당 프로젝트 Workspace로 이동합니다.
              </p>
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-project-search">
              <input
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="프로젝트명 검색"
              />
              <span>{filteredProjects.length}개 프로젝트</span>
            </div>

            {isLoading && (
              <div className="workspace-panel-empty">프로젝트를 불러오는 중...</div>
            )}

            {!isLoading && errorMessage && (
              <div className="dashboard-error">{errorMessage}</div>
            )}

            {!isLoading && !errorMessage && (
              <div className="workspace-project-list-page">
                {filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <span className="workspace-project-card-icon">▣</span>
                    <div>
                      <strong>{project.name}</strong>
                      <span>
                        최근 업데이트{' '}
                        {new Date(project.updated_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <span>Workspace 열기 →</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
