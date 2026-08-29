'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'LEADER' | 'ADMIN';
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [quickSearchText, setQuickSearchText] = useState('');

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

  function handleQuickSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quickSearchText.trim()) {
      window.alert('검색할 TC 번호 또는 검색어를 입력해주세요.');
      return;
    }

    window.alert(
      '빠른 TC 검색 기능은 다음 단계에서 구현합니다.\n\n' +
        '향후 TC-0001 같은 TC 번호나 항목명을 검색하면\n' +
        '해당 테스트 항목의 상세 내용을 바로 확인할 수 있습니다.',
    );
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
        <section
          style={{
            marginBottom: '20px',
            padding: '20px 22px',
            border: '1px solid #e2e7ed',
            borderRadius: '14px',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '20px',
              marginBottom: '14px',
            }}
          >
            <div>
              <span
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  color: '#8799b2',
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '1px',
                }}
              >
                QUICK SEARCH
              </span>

              <h2
                style={{
                  margin: 0,
                  color: '#202733',
                  fontSize: '18px',
                }}
              >
                빠른 TC 검색
              </h2>

              <p
                style={{
                  margin: '6px 0 0',
                  color: '#828c99',
                  fontSize: '10px',
                }}
              >
                TC 번호 또는 테스트 항목명으로 필요한 테스트 기준을
                빠르게 찾습니다.
              </p>
            </div>

            <span
              style={{
                color: '#9aa4b1',
                fontSize: '9px',
              }}
            >
              TC-0001 또는 검색어 입력
            </span>
          </div>

          <form
            onSubmit={handleQuickSearch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
            }}
          >
            <div
              style={{
                minWidth: 0,
                height: '42px',
                flex: 1,
                padding: '0 13px',
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                border: '1px solid #d9e0e7',
                borderRadius: '9px',
                background: '#fbfcfd',
              }}
            >
              <span
                style={{
                  color: '#8390a0',
                  fontSize: '17px',
                }}
              >
                ⌕
              </span>

              <input
                type="text"
                value={quickSearchText}
                onChange={(event) =>
                  setQuickSearchText(event.target.value)
                }
                placeholder="예: TC-0001, 앱 실행, 네트워크"
                style={{
                  minWidth: 0,
                  width: '100%',
                  border: 0,
                  outline: 'none',
                  background: 'transparent',
                  color: '#3b4655',
                  fontFamily: 'inherit',
                  fontSize: '11px',
                }}
              />

              {quickSearchText && (
                <button
                  type="button"
                  onClick={() => setQuickSearchText('')}
                  aria-label="검색어 지우기"
                  style={{
                    width: '24px',
                    height: '24px',
                    border: 0,
                    background: 'transparent',
                    color: '#949eaa',
                    fontSize: '16px',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              )}
            </div>

            <button
              type="submit"
              style={{
                height: '42px',
                padding: '0 19px',
                border: 0,
                borderRadius: '9px',
                background: '#315e99',
                color: '#ffffff',
                fontFamily: 'inherit',
                fontSize: '10px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              검색
            </button>
          </form>
        </section>

        <div className="home-board-layout">
          <section className="home-board-card notice-board">
            <div className="home-board-heading">
              <div>
                <span className="home-board-label">
                  NOTICE
                </span>
                <h2>공지사항</h2>
              </div>
            </div>

            <div className="notice-main-board">
              <span className="notice-date">
                PORTFOLIO GUIDE
              </span>

              <h3>QA Checker 포트폴리오 안내</h3>

              <p>
                QA Checker는 실제 게임 QA 업무 흐름을
                기준으로 프로젝트, 테스트 추가, 테스트 수행,
                결과 판정과 이력 관리를 하나의 흐름으로
                구성한 QA 운영 도구입니다.
              </p>

              <p>
                본 포트폴리오에서는 실제 QA 프로세스가
                처음부터 끝까지 동작하는 MVP를 우선
                구현하며, 실시간 동기화나 복잡한 권한
                관리와 같이 핵심 시연에 직접 필요하지
                않은 기능은 단순화합니다.
              </p>

              <p>
                테스트 항목은 대표적인 모바일 게임 QA
                검수 항목을 중심으로 구성하고 있으며,
                실제 서비스에서는 프로젝트 특성에 맞게
                지속적으로 확장할 수 있는 구조를
                고려했습니다.
              </p>
            </div>

            <div className="role-guide-board">
              <div className="role-guide-heading">
                <span>ACCOUNT ROLE</span>
                <h3>계정 등급 및 역할</h3>
              </div>

              <div className="role-guide-grid">
                <div className="role-guide-item user">
                  <strong>일반</strong>
                  <span>USER</span>
                  <p>
                    등록된 테스트를 수행하고 결과를
                    확인합니다.
                  </p>
                </div>

                <div className="role-guide-item leader">
                  <strong>리더</strong>
                  <span>LEADER</span>
                  <p>
                    일반 기능과 함께 새 테스트를
                    추가하고 QA 업무를 운영합니다.
                  </p>
                </div>

                <div className="role-guide-item admin">
                  <strong>관리자</strong>
                  <span>ADMIN</span>
                  <p>
                    테스트 항목, 프로젝트 및 계정 관리
                    기능까지 담당합니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="home-board-card guide-board">
            <div className="home-board-heading">
              <div>
                <span className="home-board-label">
                  TEST GUIDE
                </span>
                <h2>테스트 가이드</h2>
              </div>
            </div>

            <div className="guide-content">
              <article className="guide-item guide-item-rich">
                <div className="guide-number">01</div>

                <div>
                  <div className="guide-ui-sample">
                    <span>▣</span> 프로젝트
                  </div>

                  <h3>프로젝트 선택</h3>
                  <p>
                    프로젝트 메뉴에서 테스트할 프로젝트를
                    선택합니다.
                  </p>
                </div>
              </article>

              <article className="guide-item guide-item-rich">
                <div className="guide-number">02</div>

                <div>
                  <div className="guide-ui-sample action">
                    + 테스트 추가
                  </div>

                  <h3>테스트 선택 또는 추가</h3>
                  <p>
                    기존 테스트를 열거나 LEADER 이상
                    계정에서 새로운 테스트를 추가합니다.
                  </p>
                </div>
              </article>

              <article className="guide-item guide-item-rich">
                <div className="guide-number">03</div>

                <div>
                  <div className="guide-ui-sample tc">
                    ● TC-0001 앱 실행 및 초기 진입 확인
                  </div>

                  <h3>TC 수행</h3>
                  <p>
                    왼쪽 TC 목록에서 항목을 선택하고
                    체크 내용과 테스트 방법을 확인합니다.
                  </p>
                </div>
              </article>

              <article className="guide-item guide-item-rich">
                <div className="guide-number">04</div>

                <div>
                  <div className="guide-result-sample">
                    <span className="pass">PASS</span>
                    <span className="fail">FAIL</span>
                    <span className="skip">SKIP</span>
                  </div>

                  <h3>결과 저장</h3>
                  <p>
                    결과를 선택하고 필요한 경우 메모를
                    남긴 뒤 다음 항목으로 이동합니다.
                  </p>
                </div>
              </article>

              <article className="guide-item guide-item-rich">
                <div className="guide-number">05</div>

                <div>
                  <div className="guide-ui-sample">
                    결과 보기 →
                  </div>

                  <h3>결과 확인</h3>
                  <p>
                    결과 보고서에서 진행률과 주요
                    FAIL/SKIP 항목을 확인합니다.
                  </p>
                </div>
              </article>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}