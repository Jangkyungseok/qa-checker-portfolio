'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'LEADER' | 'ADMIN';
}

export default function ToolsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('qa_checker_token');
    const storedUser = localStorage.getItem('qa_checker_user');

    if (!token || !storedUser) {
      router.replace('/');
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
    } catch {
      localStorage.removeItem('qa_checker_token');
      localStorage.removeItem('qa_checker_user');
      router.replace('/');
    }
  }, [router]);

  async function handleLogout() {
    const token = localStorage.getItem('qa_checker_token');

    try {
      if (token) {
        await fetch('http://127.0.0.1:3001/auth/logout', {
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
            className="sidebar-menu-item"
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
            className="sidebar-menu-item active"
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
              <span>검사 항목 관리</span>
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
        <div className="tools-page-content">
          <div className="projects-page-heading">
            <h1>QA 도구</h1>

            <p>
              실제 테스트 업무에서 반복적으로 사용하는
              계산과 검증 작업을 빠르게 수행할 수 있는
              보조 도구입니다.
            </p>
          </div>

          <div className="tools-grid">
            <button
              type="button"
              className="tool-card"
              onClick={() =>
                handleComingSoon('밸런스 계산기')
              }
            >
              <div className="tool-card-icon">∑</div>

              <div>
                <h2>밸런스 계산기</h2>
                <p>
                  입력한 수치를 기준으로 성장값과
                  밸런스 데이터를 계산합니다.
                </p>
              </div>

              <span>준비 중 →</span>
            </button>

            <button
              type="button"
              className="tool-card"
              onClick={() =>
                handleComingSoon('스킬 계산기')
              }
            >
              <div className="tool-card-icon">ƒ</div>

              <div>
                <h2>스킬 계산기</h2>
                <p>
                  스킬 계수와 관련 수치를 입력하여 예상
                  결과를 빠르게 확인합니다.
                </p>
              </div>

              <span>준비 중 →</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
