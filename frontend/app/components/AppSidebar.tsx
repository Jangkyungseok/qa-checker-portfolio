'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import UiIcon from './UiIcon';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

export interface SidebarUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'LEADER' | 'ADMIN';
}

interface Project {
  id: string;
  name: string;
  is_active: boolean;
}

type ActiveMenu =
  | 'dashboard'
  | 'project'
  | 'tools'
  | 'shortcuts'
  | 'notices'
  | 'admin';

export default function AppSidebar({
  user,
  activeMenu,
  currentProjectId,
  onNavigate,
}: {
  user: SidebarUser;
  activeMenu: ActiveMenu;
  currentProjectId?: string;
  onNavigate?: (href: string) => void;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const navigate = (href: string) => {
    if (onNavigate) {
      onNavigate(href);
      return;
    }
    router.push(href);
  };

  const [projectsOpen, setProjectsOpen] = useState(
    activeMenu === 'project' || Boolean(currentProjectId),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      const token = localStorage.getItem('qa_checker_token');
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || cancelled) return;
        setProjects(data);
      } catch {
        // 사이드바 프로젝트 조회 실패는 현재 화면 이용을 막지 않습니다.
      }
    }

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleProjects = useMemo(
    () =>
      projects
        .filter((project) => project.is_active !== false)
        .sort((a, b) =>
          a.name.localeCompare(b.name, 'ko-KR', {
            numeric: true,
            sensitivity: 'base',
          }),
        ),
    [projects],
  );

  async function handleLogout() {
    const token = localStorage.getItem('qa_checker_token');

    try {
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
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

  return (
    <aside className="app-sidebar workspace-sidebar">
      <button
        type="button"
        className="sidebar-brand brand-home-button"
        onClick={() => navigate('/dashboard')}
        aria-label="대시보드로 이동"
      >
        <div className="brand-mark">Q</div>
        <div>
          <strong>QA Checker</strong>
          <span>Quality Assurance</span>
        </div>
      </button>

      <div className="workspace-sidebar-user">
        <div className="sidebar-user">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
          <small>{user.role}</small>
        </div>
      </div>

      <nav className="sidebar-menu workspace-menu">
        <div className="workspace-menu-section">
          <button
            type="button"
            className={`sidebar-menu-item workspace-menu-item ${
              activeMenu === 'project' ? 'active' : ''
            }`}
            onClick={() => setProjectsOpen((current) => !current)}
          >
            <span className="workspace-menu-icon"><UiIcon name="project" size={19} /></span>
            <span className="workspace-menu-label">프로젝트</span>
            <span className="workspace-menu-arrow">{projectsOpen ? '⌃' : '⌄'}</span>
          </button>

          {projectsOpen && (
            <div className="workspace-project-list">
              {visibleProjects.length === 0 ? (
                <span className="workspace-project-empty">프로젝트 없음</span>
              ) : (
                visibleProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className={`workspace-project-item ${
                      project.id === currentProjectId ? 'active' : ''
                    }`}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    title={project.name}
                  >
                    <span className="workspace-project-dot" />
                    <span>{project.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="workspace-menu-section">
          <button
            type="button"
            className={`sidebar-menu-item workspace-menu-item ${activeMenu === 'tools' ? 'active' : ''}`}
            onClick={() => navigate('/tools')}
          >
            <span className="workspace-menu-icon"><UiIcon name="tools" size={19} /></span>
            <span className="workspace-menu-label">QA 도구</span>
          </button>
        </div>

        <div className="workspace-menu-section">
          <button
            type="button"
            className={`sidebar-menu-item workspace-menu-item ${activeMenu === 'shortcuts' ? 'active' : ''}`}
            onClick={() => navigate('/shortcuts')}
          >
            <span className="workspace-menu-icon"><UiIcon name="shortcuts" size={19} /></span>
            <span className="workspace-menu-label">업무 바로가기</span>
          </button>
        </div>

        <div className="workspace-menu-section">
          <button
            type="button"
            className={`sidebar-menu-item workspace-menu-item ${activeMenu === 'notices' ? 'active' : ''}`}
            onClick={() => navigate('/notices')}
          >
            <span className="workspace-menu-icon"><UiIcon name="notices" size={19} /></span>
            <span className="workspace-menu-label">공지사항</span>
          </button>
        </div>

        {user.role === 'ADMIN' && (
          <div className="workspace-menu-section">
            <button
              type="button"
              className={`sidebar-menu-item workspace-menu-item ${activeMenu === 'admin' ? 'active' : ''}`}
              onClick={() => navigate('/admin/test-items')}
            >
              <span className="workspace-menu-icon"><UiIcon name="admin" size={19} /></span>
              <span className="workspace-menu-label">관리</span>
              <span className="workspace-admin-badge">ADMIN</span>
            </button>
          </div>
        )}
      </nav>

      <div className="sidebar-account">
        <button type="button" className="sidebar-logout-button" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </aside>
  );
}
