'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useParams, useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'LEADER' | 'ADMIN';
}

interface Inspection {
  id: string;
  project_id: string;
  project_name: string;
  platform: 'IOS' | 'ANDROID';
  version: string;
  inspection_type:
    | 'NEW'
    | 'RESUBMISSION'
    | 'DEVELOPMENT_REVIEW';
  test_devices: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  item_count: number;
  tested_count: number;
}

function inspectionTypeLabel(
  type: Inspection['inspection_type'],
) {
  if (type === 'NEW') {
    return '신규';
  }

  if (type === 'RESUBMISSION') {
    return '재납품';
  }

  return '개발 검수';
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();

  const projectId = String(params.projectId);

  const [user, setUser] = useState<User | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>(
    [],
  );

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [platform, setPlatform] = useState<
    'IOS' | 'ANDROID'
  >('IOS');

  const [version, setVersion] = useState('');

  const [inspectionType, setInspectionType] =
    useState<
      'NEW' | 'RESUBMISSION' | 'DEVELOPMENT_REVIEW'
    >('NEW');

  const [testDevices, setTestDevices] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [deleteTarget, setDeleteTarget] =
    useState<Inspection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadInspections = useCallback(async () => {
    const token = localStorage.getItem('qa_checker_token');

    if (!token) {
      router.replace('/');
      return;
    }

    try {
      setErrorMessage('');

      const response = await fetch(
        `http://127.0.0.1:3001/inspections?projectId=${projectId}`,
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
            '테스트 목록을 불러오지 못했습니다.',
        );
      }

      setInspections(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '테스트 목록을 불러오는 중 오류가 발생했습니다.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    const storedUser = localStorage.getItem(
      'qa_checker_user',
    );

    if (!storedUser) {
      router.replace('/');
      return;
    }

    setUser(JSON.parse(storedUser));

    loadInspections();
  }, [loadInspections, router]);

  async function handleCreateInspection(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const token = localStorage.getItem('qa_checker_token');

    if (!token) {
      router.replace('/');
      return;
    }

    setCreateError('');
    setIsCreating(true);

    try {
      const response = await fetch(
        'http://127.0.0.1:3001/inspections',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            projectId,
            platform,
            version,
            inspectionType,
            testDevices,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ??
            '테스트를 추가하지 못했습니다.',
        );
      }

      setVersion('');
      setTestDevices('');
      setPlatform('IOS');
      setInspectionType('NEW');
      setShowCreateForm(false);

      await loadInspections();
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : '테스트 추가 중 오류가 발생했습니다.',
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteInspection() {
    if (!deleteTarget || isDeleting) {
      return;
    }

    const token = localStorage.getItem('qa_checker_token');

    if (!token) {
      router.replace('/');
      return;
    }

    setDeleteError('');
    setIsDeleting(true);

    try {
      const response = await fetch(
        `http://127.0.0.1:3001/inspections/${deleteTarget.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ??
            '테스트를 삭제하지 못했습니다.',
        );
      }

      setDeleteTarget(null);
      await loadInspections();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : '테스트 삭제 중 오류가 발생했습니다.',
      );
    } finally {
      setIsDeleting(false);
    }
  }

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

  const projectName =
    inspections[0]?.project_name ?? '프로젝트';

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
        <div className="dashboard-content">
        <div className="project-detail-heading">
          <div>
            <h2>{projectName}</h2>

            <p>
              테스트 이력을 확인하거나 새로운 테스트를
              생성할 수 있습니다.
            </p>
          </div>

          {(user?.role === 'LEADER' ||
            user?.role === 'ADMIN') && (
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                setShowCreateForm((current) => !current)
              }
            >
              {showCreateForm
                ? '테스트 추가 닫기'
                : '+ 테스트 추가'}
            </button>
          )}
        </div>

        {showCreateForm && (
          <section className="inspection-create-card">
            <div className="section-heading">
              <h3>테스트 추가</h3>

              <p>
                테스트 한 건에는 하나의 플랫폼만
                선택합니다.
              </p>
            </div>

            <form
              className="inspection-form"
              onSubmit={handleCreateInspection}
            >
              <div className="inspection-form-grid">
                <label>
                  플랫폼
                  <select
                    value={platform}
                    onChange={(event) =>
                      setPlatform(
                        event.target.value as
                          | 'IOS'
                          | 'ANDROID',
                      )
                    }
                  >
                    <option value="IOS">
                      iOS
                    </option>

                    <option value="ANDROID">
                      Android
                    </option>
                  </select>
                </label>

                <label>
                  버전
                  <input
                    value={version}
                    onChange={(event) =>
                      setVersion(event.target.value)
                    }
                    placeholder="예: 1.0.0"
                    maxLength={150}
                    required
                  />
                </label>

                <label>
                  테스트 유형
                  <select
                    value={inspectionType}
                    onChange={(event) =>
                      setInspectionType(
                        event.target.value as
                          | 'NEW'
                          | 'RESUBMISSION'
                          | 'DEVELOPMENT_REVIEW',
                      )
                    }
                  >
                    <option value="NEW">
                      신규
                    </option>

                    <option value="RESUBMISSION">
                      재납품
                    </option>

                    <option value="DEVELOPMENT_REVIEW">
                      개발 검수
                    </option>
                  </select>
                </label>

                <label className="device-field">
                  테스트 기기 / 환경
                  <input
                    value={testDevices}
                    onChange={(event) =>
                      setTestDevices(
                        event.target.value,
                      )
                    }
                    placeholder="예: iPhone 15 / iOS 19 / Wi-Fi"
                    maxLength={500}
                    required
                  />
                </label>
              </div>

              {createError && (
                <div className="login-error">
                  {createError}
                </div>
              )}

              <div className="inspection-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setShowCreateForm(false)
                  }
                >
                  취소
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={isCreating}
                >
                  {isCreating
                    ? '생성 중...'
                    : '테스트 추가'}
                </button>
              </div>
            </form>
          </section>
        )}

        <div className="section-heading inspection-history-heading">
          <h3>테스트 이력</h3>

          <p>
            생성된 검사와 현재 진행 상태를 확인합니다.
          </p>
        </div>

        {isLoading && (
          <div className="dashboard-message">
            테스트 목록을 불러오는 중...
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="dashboard-error">
            {errorMessage}
          </div>
        )}

        {!isLoading &&
          !errorMessage &&
          inspections.length === 0 && (
            <div className="empty-state">
              <h3>아직 추가된 테스트가 없습니다.</h3>

              <p>
                새 검사를 생성하면 이곳에 테스트 이력이
                표시됩니다.
              </p>
            </div>
          )}

        {!isLoading &&
          !errorMessage &&
          inspections.length > 0 && (
            <div className="inspection-list">
              {inspections.map((inspection) => {
                const total = inspection.item_count;
                const tested = inspection.tested_count;

                const isCompleted =
                  total > 0 && tested === total;

                return (
                  <article
                    key={inspection.id}
                    className="inspection-row"
                  >
                    <div className="inspection-main">
                      <div className="inspection-version">
                        <strong>
                          v{inspection.version}
                        </strong>

                        <span
                          className={
                            inspection.platform === 'IOS'
                              ? 'platform-badge ios'
                              : 'platform-badge android'
                          }
                        >
                          {inspection.platform === 'IOS'
                            ? 'iOS'
                            : 'Android'}
                        </span>

                        <span className="inspection-type-badge">
                          {inspectionTypeLabel(
                            inspection.inspection_type,
                          )}
                        </span>
                      </div>

                      <p>
                        {inspection.test_devices}
                      </p>
                    </div>

                    <div className="inspection-progress">
                      <strong>
                        {tested} / {total}
                      </strong>

                      <span>
                        {isCompleted
                          ? '테스트 완료'
                          : '진행 중'}
                      </span>
                    </div>

                    <div className="inspection-date">
                      {new Date(
                        inspection.created_at,
                      ).toLocaleDateString('ko-KR')}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {user?.role === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError('');
                            setDeleteTarget(inspection);
                          }}
                          style={{
                            height: '34px',
                            padding: '0 12px',
                            border: '1px solid #e2b8b8',
                            borderRadius: '8px',
                            background: '#fff7f7',
                            color: '#a45b5b',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          삭제
                        </button>
                      )}

                      <button
                        type="button"
                        className="inspection-open-button"
                        onClick={() =>
                          router.push(
                            `/inspections/${inspection.id}`,
                          )
                        }
                      >
                        열기 ↪
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {deleteTarget && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteTarget(null);
              setDeleteError('');
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'rgba(15, 23, 42, 0.38)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-inspection-title"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              background: '#ffffff',
              boxShadow:
                '0 24px 60px rgba(15, 23, 42, 0.18)',
            }}
          >
            <div style={{ marginBottom: '18px' }}>
              <span
                style={{
                  display: 'inline-block',
                  marginBottom: '8px',
                  color: '#b45353',
                  fontSize: '10px',
                  fontWeight: 900,
                  letterSpacing: '0.6px',
                }}
              >
                ADMIN ONLY
              </span>

              <h3
                id="delete-inspection-title"
                style={{
                  margin: 0,
                  color: '#202733',
                  fontSize: '20px',
                }}
              >
                이 테스트를 삭제할까요?
              </h3>

              <p
                style={{
                  margin: '8px 0 0',
                  color: '#6b7280',
                  fontSize: '12px',
                  lineHeight: 1.6,
                }}
              >
                테스트 결과, 결과 이력, TC 스냅샷과 첨부
                스냅샷이 함께 삭제됩니다. 프로젝트와 마스터
                TC에는 영향이 없습니다.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '10px',
                padding: '15px',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '12px' }}>
                <span style={{ color: '#94a3b8' }}>프로젝트</span>
                <strong style={{ color: '#334155' }}>
                  {deleteTarget.project_name}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '12px' }}>
                <span style={{ color: '#94a3b8' }}>버전</span>
                <strong style={{ color: '#334155' }}>
                  v{deleteTarget.version}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '12px' }}>
                <span style={{ color: '#94a3b8' }}>플랫폼</span>
                <strong style={{ color: '#334155' }}>
                  {deleteTarget.platform === 'IOS' ? 'iOS' : 'Android'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '12px' }}>
                <span style={{ color: '#94a3b8' }}>테스트 유형</span>
                <strong style={{ color: '#334155' }}>
                  {inspectionTypeLabel(deleteTarget.inspection_type)}
                </strong>
              </div>
            </div>

            {deleteError && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '10px 12px',
                  border: '1px solid #f0cccc',
                  borderRadius: '8px',
                  background: '#fff7f7',
                  color: '#a14f4f',
                  fontSize: '11px',
                }}
              >
                {deleteError}
              </div>
            )}

            <div
              style={{
                marginTop: '20px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                type="button"
                className="secondary-button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
              >
                취소
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteInspection}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  border: '1px solid #b85d5d',
                  borderRadius: '8px',
                  background: '#b85d5d',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: isDeleting ? 'default' : 'pointer',
                  opacity: isDeleting ? 0.55 : 1,
                }}
              >
                {isDeleting ? '삭제 중...' : '테스트 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}