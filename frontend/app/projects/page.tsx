'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'LEADER' | 'ADMIN';
}

interface Project {
  id: string;
  name: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
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

        const response = await fetch(
          `${API_BASE_URL}/projects`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ??
              '프로젝트 목록을 불러오지 못했습니다.',
          );
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

    loadProjects();
  }, [router]);

  const filteredProjects = useMemo(() => {
    const keyword = searchText.trim().toLocaleLowerCase();

    return projects
      .filter((project) => {
        if (!keyword) {
          return true;
        }

        return project.name
          .toLocaleLowerCase()
          .includes(keyword);
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'ko-KR', {
          numeric: true,
          sensitivity: 'base',
        }),
      );
  }, [projects, searchText]);

  async function handleLogout() {
    const token = localStorage.getItem('qa_checker_token');

    try {
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // 브라우저 로그인 정보는 항상 정리합니다.
    } finally {
      localStorage.removeItem('qa_checker_token');
      localStorage.removeItem('qa_checker_user');
      router.replace('/');
    }
  }

  function handleComingSoon(featureName: string) {
    window.alert(`${featureName} 화면은 다음 단계에서 구현합니다.`);
  }

  if (!user) {
    return (
      <main className="execution-loading">
        화면을 불러오는 중...
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <button
          type="button"
          className="sidebar-brand brand-home-button"
          onClick={() => router.push('/dashboard')}
          aria-label="홈으로 이동"
        >
          <div className="brand-mark">Q</div>

          <div>
            <strong>QA Checker</strong>
            <span>Quality Assurance</span>
          </div>
        </button>

        <div
          style={{
            padding: '18px 16px 20px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div className="sidebar-user">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <small>{user.role}</small>
          </div>
        </div>

        <nav
          className="sidebar-menu"
          style={{ paddingTop: '20px' }}
        >
          <button
            type="button"
            className="sidebar-menu-item active"
            onClick={() => router.push('/projects')}
          >
            <span className="sidebar-menu-icon">▣</span>
            <span>프로젝트</span>
          </button>

          <button
            type="button"
            className="sidebar-menu-item"
            onClick={() => handleComingSoon('최근 작업')}
          >
            <span className="sidebar-menu-icon">◷</span>
            <span>최근 작업</span>
          </button>

          <button
            type="button"
            className="sidebar-menu-item"
            onClick={() => router.push('/tools')}
          >
            <span className="sidebar-menu-icon">⌘</span>
            <span>QA 도구</span>
          </button>

          <div className="sidebar-menu-divider" />

          {user.role === 'ADMIN' && (
            <button
              type="button"
              className="sidebar-menu-item"
              onClick={() => router.push('/admin/test-items')}
            >
              <span className="sidebar-menu-icon">☷</span>
              <span>테스트 항목 관리</span>
            </button>
          )}

          <button
            type="button"
            className="sidebar-menu-item"
            onClick={() => handleComingSoon('계정 관리')}
          >
            <span className="sidebar-menu-icon">♙</span>
            <span>계정 관리</span>
          </button>
        </nav>

        <div className="sidebar-account">
          <button
            type="button"
            className="sidebar-logout-button"
            onClick={handleLogout}
          >
            로그아웃
          </button>
        </div>
      </aside>

      <section className="app-main">
        <div className="projects-page-content">
          <div className="projects-page-heading">
            <h1>프로젝트</h1>

            <p>
              참여 중인 프로젝트를 선택하여 테스트
              이력과 QA 작업을 확인합니다.
            </p>
          </div>

          <div className="project-search-area">
            <div className="project-search-box">
              <span>⌕</span>

              <input
                type="text"
                value={searchText}
                onChange={(event) =>
                  setSearchText(event.target.value)
                }
                placeholder="프로젝트명 검색"
              />

              {searchText && (
                <button
                  type="button"
                  className="project-search-clear"
                  onClick={() => setSearchText('')}
                >
                  ×
                </button>
              )}
            </div>

            <span className="project-count">
              {filteredProjects.length}개 프로젝트
            </span>
          </div>

          {isLoading && (
            <div className="dashboard-message">
              프로젝트를 불러오는 중...
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="dashboard-error">
              {errorMessage}
            </div>
          )}

          {!isLoading &&
            !errorMessage &&
            filteredProjects.length === 0 && (
              <div className="empty-state">
                <h3>
                  {searchText
                    ? '검색 결과가 없습니다.'
                    : '등록된 프로젝트가 없습니다.'}
                </h3>
              </div>
            )}

          {!isLoading &&
            !errorMessage &&
            filteredProjects.length > 0 && (
              <div className="project-grid">
                {filteredProjects.map((project) => (
                  <article
                    key={project.id}
                    className="project-card"
                  >
                    <div className="project-card-top">
                      <div>
                        <span className="project-label">
                          PROJECT
                        </span>
                        <h3>{project.name}</h3>
                      </div>

                      <span className="active-badge">
                        활성
                      </span>
                    </div>

                    <div className="project-card-bottom">
                      <span>
                        마지막 수정{' '}
                        {new Date(
                          project.updated_at,
                        ).toLocaleDateString('ko-KR')}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/projects/${project.id}`,
                          )
                        }
                      >
                        열기 ↪
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
        </div>
      </section>
    </main>
  );
}
