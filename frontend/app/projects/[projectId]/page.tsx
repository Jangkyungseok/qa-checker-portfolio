'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import AppSidebar, {
  SidebarUser,
} from '../../components/AppSidebar';
import UiIcon from '../../components/UiIcon';

function formatDateOnly(value?: string | null) {
  if (!value) return '-';

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return raw;

  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}


const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

interface Project {
  id: string;
  name: string;
  is_active: boolean;
}

interface Inspection {
  id: string;
  project_id: string;
  project_name: string;
  platform: 'IOS' | 'ANDROID';
  version: string;
  inspection_type: 'NEW' | 'RESUBMISSION' | 'DEVELOPMENT_REVIEW';
  test_devices: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  item_count: number;
  tested_count: number;
}

interface BuildHistory {
  id: string;
  project_id: string;
  project_name: string;
  version: string;
  delivered_at: string;
  change_summary: string;
  qa_notes: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

function inspectionTypeLabel(type: Inspection['inspection_type']) {
  if (type === 'NEW') return '신규';
  if (type === 'RESUBMISSION') return '재납품';
  return '개발 검수';
}

function dateInputValue(value: string) {
  const matched = value?.match(/^\d{4}-\d{2}-\d{2}/);
  return matched?.[0] ?? '';
}

function formatBuildDate(value: string) {
  const datePart = dateInputValue(value);
  if (!datePart) return '-';

  const [year, month, day] = datePart.split('-');
  return `${year}. ${Number(month)}. ${Number(day)}.`;
}

export default function ProjectWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = String(params.projectId);
  const view = searchParams.get('view') ?? 'workspace';

  const [user, setUser] = useState<SidebarUser | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [platform, setPlatform] = useState<'IOS' | 'ANDROID'>('IOS');
  const [version, setVersion] = useState('');
  const [inspectionType, setInspectionType] = useState<
    'NEW' | 'RESUBMISSION' | 'DEVELOPMENT_REVIEW'
  >('NEW');
  const [testDevices, setTestDevices] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [buildHistories, setBuildHistories] = useState<BuildHistory[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState('');
  const [historyDeliveredAt, setHistoryDeliveredAt] = useState('');
  const [historyChangeSummary, setHistoryChangeSummary] = useState('');
  const [historyQaNotes, setHistoryQaNotes] = useState('');
  const [historySaving, setHistorySaving] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyFormInitial, setHistoryFormInitial] = useState('');
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const token = localStorage.getItem('qa_checker_token');
    if (!token) {
      router.replace('/');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const [projectsResponse, inspectionsResponse, historiesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/inspections?projectId=${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/build-histories?projectId=${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const projectsData = await projectsResponse.json();
      const inspectionsData = await inspectionsResponse.json();
      const historiesData = await historiesResponse.json();

      if (!projectsResponse.ok) {
        throw new Error(projectsData?.message ?? '프로젝트 정보를 불러오지 못했습니다.');
      }
      if (!inspectionsResponse.ok) {
        throw new Error(inspectionsData?.message ?? '빌드 목록을 불러오지 못했습니다.');
      }
      if (!historiesResponse.ok) {
        throw new Error(historiesData?.message ?? '빌드 히스토리를 불러오지 못했습니다.');
      }

      setProject(projectsData.find((item: Project) => item.id === projectId) ?? null);
      setInspections(inspectionsData);
      setBuildHistories(historiesData);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '프로젝트 정보를 불러오는 중 오류가 발생했습니다.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    const storedUser = localStorage.getItem('qa_checker_user');
    if (!storedUser) {
      router.replace('/');
      return;
    }
    setUser(JSON.parse(storedUser));
    void loadData();
  }, [loadData, router]);

  const projectName = project?.name ?? inspections[0]?.project_name ?? '프로젝트';
  const canManage = user?.role === 'LEADER' || user?.role === 'ADMIN';

  const filteredReports = useMemo(() => {
    const keyword = reportSearch.trim().toLocaleLowerCase();
    if (!keyword) return inspections;
    return inspections.filter((inspection) =>
      [inspection.version, inspection.platform, inspectionTypeLabel(inspection.inspection_type)]
        .join(' ')
        .toLocaleLowerCase()
        .includes(keyword),
    );
  }, [inspections, reportSearch]);

  const filteredHistories = useMemo(() => {
    const keyword = historySearch.trim().toLocaleLowerCase();
    if (!keyword) return buildHistories;
    return buildHistories.filter((history) =>
      [history.version, history.created_by_name, history.change_summary]
        .join(' ')
        .toLocaleLowerCase()
        .includes(keyword),
    );
  }, [buildHistories, historySearch]);

  const selectedHistoryId = searchParams.get('historyId');
  const selectedHistory =
    buildHistories.find((history) => history.id === selectedHistoryId) ?? null;

  const selectedHistoryIndex = selectedHistory
    ? buildHistories.findIndex((history) => history.id === selectedHistory.id)
    : -1;
  const previousHistory =
    selectedHistoryIndex >= 0 ? buildHistories[selectedHistoryIndex + 1] ?? null : null;
  const nextHistory =
    selectedHistoryIndex > 0 ? buildHistories[selectedHistoryIndex - 1] ?? null : null;

  const currentHistoryFormSnapshot = JSON.stringify({
    version: historyVersion,
    deliveredAt: historyDeliveredAt,
    changeSummary: historyChangeSummary,
    qaNotes: historyQaNotes,
  });
  const historyFormDirty =
    showHistoryForm && historyFormInitial !== '' && currentHistoryFormSnapshot !== historyFormInitial;

  useEffect(() => {
    if (!historyFormDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [historyFormDirty]);

  async function handleCreateBuild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem('qa_checker_token');
    if (!token) {
      router.replace('/');
      return;
    }

    setCreateError('');
    setIsCreating(true);

    try {
      const response = await fetch(`${API_BASE_URL}/inspections`, {
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
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? '빌드를 생성하지 못했습니다.');
      }
      setVersion('');
      setTestDevices('');
      setPlatform('IOS');
      setInspectionType('NEW');
      setShowCreateForm(false);
      await loadData();
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : '빌드 생성 중 오류가 발생했습니다.',
      );
    } finally {
      setIsCreating(false);
    }
  }

  function resetHistoryForm() {
    setEditingHistoryId(null);
    setHistoryVersion('');
    setHistoryDeliveredAt('');
    setHistoryChangeSummary('');
    setHistoryQaNotes('');
    setHistoryError('');
    setHistoryFormInitial('');
    setShowHistoryForm(false);
  }

  function setHistoryFormBaseline(values: {
    version: string;
    deliveredAt: string;
    changeSummary: string;
    qaNotes: string;
  }) {
    setHistoryFormInitial(JSON.stringify(values));
  }

  function startCreateHistory() {
    const deliveredAt = new Date().toISOString().slice(0, 10);
    const values = { version: '', deliveredAt, changeSummary: '', qaNotes: '' };
    setEditingHistoryId(null);
    setHistoryVersion(values.version);
    setHistoryDeliveredAt(values.deliveredAt);
    setHistoryChangeSummary(values.changeSummary);
    setHistoryQaNotes(values.qaNotes);
    setHistoryError('');
    setHistoryFormBaseline(values);
    setShowHistoryForm(true);
  }

  function startEditHistory(history: BuildHistory) {
    const values = {
      version: history.version,
      deliveredAt: dateInputValue(history.delivered_at),
      changeSummary: history.change_summary,
      qaNotes: history.qa_notes ?? '',
    };
    setEditingHistoryId(history.id);
    setHistoryVersion(values.version);
    setHistoryDeliveredAt(values.deliveredAt);
    setHistoryChangeSummary(values.changeSummary);
    setHistoryQaNotes(values.qaNotes);
    setHistoryError('');
    setHistoryFormBaseline(values);
    setShowHistoryForm(true);
  }

  function requestNavigate(href: string) {
    if (historyFormDirty) {
      setPendingNavigation(href);
      return;
    }
    resetHistoryForm();
    router.push(href);
  }

  function requestCloseHistoryForm() {
    if (historyFormDirty) {
      setPendingNavigation(`/projects/${projectId}?view=history${selectedHistory ? `&historyId=${selectedHistory.id}` : ''}`);
      return;
    }
    resetHistoryForm();
  }

  async function saveHistory(): Promise<BuildHistory | null> {
    const token = localStorage.getItem('qa_checker_token');
    if (!token) {
      router.replace('/');
      return null;
    }

    if (!historyVersion.trim() || !historyDeliveredAt || !historyChangeSummary.trim()) {
      setHistoryError('빌드 버전, 전달 일자, 빌드 변경 내역은 필수입니다.');
      return null;
    }

    setHistorySaving(true);
    setHistoryError('');

    try {
      const response = await fetch(
        editingHistoryId
          ? `${API_BASE_URL}/build-histories/${editingHistoryId}`
          : `${API_BASE_URL}/build-histories`,
        {
          method: editingHistoryId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            editingHistoryId
              ? {
                  version: historyVersion,
                  deliveredAt: historyDeliveredAt,
                  changeSummary: historyChangeSummary,
                  qaNotes: historyQaNotes,
                }
              : {
                  projectId,
                  version: historyVersion,
                  deliveredAt: historyDeliveredAt,
                  changeSummary: historyChangeSummary,
                  qaNotes: historyQaNotes,
                },
          ),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? '빌드 히스토리를 저장하지 못했습니다.');
      }

      resetHistoryForm();
      await loadData();
      return data as BuildHistory;
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : '빌드 히스토리 저장 중 오류가 발생했습니다.',
      );
      return null;
    } finally {
      setHistorySaving(false);
    }
  }

  async function handleSaveHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await saveHistory();
    if (saved) {
      router.push(`/projects/${projectId}?view=history&historyId=${saved.id}`);
    }
  }

  async function saveAndLeaveHistoryForm() {
    const target = pendingNavigation;
    const saved = await saveHistory();
    if (!saved || !target) return;
    setPendingNavigation(null);
    router.push(target);
  }

  function discardAndLeaveHistoryForm() {
    const target = pendingNavigation;
    setPendingNavigation(null);
    resetHistoryForm();
    if (target) router.push(target);
  }


  function goWorkspace() {
    requestNavigate(`/projects/${projectId}`);
  }

  if (!user) {
    return <main className="execution-loading">화면을 불러오는 중...</main>;
  }

  return (
    <main className="app-shell">
      <AppSidebar
        user={user}
        activeMenu="project"
        currentProjectId={projectId}
        onNavigate={requestNavigate}
      />

      <section className="app-main workspace-main">
        <div className="workspace-page">
          <section className="workspace-hero project workspace-hero-with-back">
            <button
              type="button"
              className="workspace-back-circle"
              onClick={() => {
                if (view === 'workspace') {
                  requestNavigate('/dashboard');
                  return;
                }
                goWorkspace();
              }}
              aria-label="이전 화면으로 이동"
              title="이전 화면"
            >
              <UiIcon name="back" size={22} strokeWidth={2.2} />
            </button>

            <div className="workspace-hero-copy">
              <span className="workspace-eyebrow">PROJECT WORKSPACE</span>
              <h1>{projectName}</h1>
              <p>
                프로젝트의 빌드 검수와 QA 관리 정보를 한 곳에서 연결합니다.
              </p>
            </div>
          </section>

          {isLoading && (
            <div className="workspace-panel-empty">프로젝트 정보를 불러오는 중...</div>
          )}
          {!isLoading && errorMessage && (
            <div className="dashboard-error">{errorMessage}</div>
          )}

          {!isLoading && !errorMessage && view === 'workspace' && (
            <div className="workspace-category-stack">
              <section className="workspace-category-block">
                <div className="workspace-category-heading">
                  <span>QA 실행</span>
                  <p>빌드 검수부터 변경 이력, 결과와 이슈까지 실제 QA 수행에 필요한 기능입니다.</p>
                </div>

                <div className="workspace-card-grid four">
                  <button
                    type="button"
                    className="workspace-module-card live"
                    onClick={() => router.push(`/projects/${projectId}?view=builds`)}
                  >
                    <span className="workspace-module-icon execution-icon"><UiIcon name="build" size={19} /></span>
                    <div>
                      <h2>빌드 검수</h2>
                      <p>빌드별 검수 항목을 실행하고 진행 결과를 기록합니다.</p>
                    </div>
                    <small className="workspace-status live-status">사용 가능</small>
                  </button>

                  <button
                    type="button"
                    className="workspace-module-card live"
                    onClick={() => router.push(`/projects/${projectId}?view=history`)}
                  >
                    <span className="workspace-module-icon execution-icon"><UiIcon name="history" size={19} /></span>
                    <div>
                      <h2>빌드 히스토리</h2>
                      <p>전달받은 빌드 버전과 변경 내역을 누적해 이력으로 관리합니다.</p>
                    </div>
                    <small className="workspace-status live-status">사용 가능</small>
                  </button>

                  <button
                    type="button"
                    className="workspace-module-card live"
                    onClick={() => router.push(`/projects/${projectId}?view=reports`)}
                  >
                    <span className="workspace-module-icon execution-icon"><UiIcon name="report" size={19} /></span>
                    <div>
                      <h2>결과 보기</h2>
                      <p>프로젝트와 빌드 기준으로 검수 결과와 리포트를 확인합니다.</p>
                    </div>
                    <small className="workspace-status live-status">사용 가능</small>
                  </button>

                  <button
                    type="button"
                    className="workspace-module-card planned"
                    onClick={() =>
                      requestNavigate(`/projects/${projectId}/planned/issues`)
                    }
                  >
                    <span className="workspace-module-icon issue-icon"><UiIcon name="issue" size={19} /></span>
                    <div>
                      <h2>이슈 현황</h2>
                      <p>프로젝트에서 발생한 이슈와 상태를 한 곳에서 확인합니다.</p>
                    </div>
                    <small className="workspace-status planned-status">구현 예정</small>
                  </button>
                </div>
              </section>

              {canManage && (
                <section className="workspace-category-block leader">
                  <div className="workspace-category-heading">
                    <span>QA 관리</span>
                    <p>LEADER 이상이 프로젝트의 QA 운영 전반을 관리하는 영역입니다.</p>
                  </div>

                  <div className="workspace-card-grid three">
                    <button
                      type="button"
                      className="workspace-module-card leader planned"
                      onClick={() =>
                        requestNavigate(`/projects/${projectId}/planned/test-management`)
                      }
                    >
                      <span className="workspace-module-icon management-icon"><UiIcon name="test" size={19} /></span>
                      <div>
                        <h2>테스트 관리</h2>
                        <p>전체 QA 테스트 진행률과 주요 상태를 관리합니다.</p>
                      </div>
                      <small className="workspace-status planned-status">구현 예정</small>
                    </button>

                    <button
                      type="button"
                      className="workspace-module-card leader planned"
                      onClick={() =>
                        requestNavigate(`/projects/${projectId}/planned/schedule-management`)
                      }
                    >
                      <span className="workspace-module-icon management-icon"><UiIcon name="calendar" size={19} /></span>
                      <div>
                        <h2>일정 관리</h2>
                        <p>QA 시작, 납품, 마켓 제출, 출시 등 주요 일정을 관리합니다.</p>
                      </div>
                      <small className="workspace-status planned-status">구현 예정</small>
                    </button>

                    <button
                      type="button"
                      className="workspace-module-card leader planned"
                      onClick={() =>
                        requestNavigate(`/projects/${projectId}/planned/resources`)
                      }
                    >
                      <span className="workspace-module-icon management-icon"><UiIcon name="files" size={19} /></span>
                      <div>
                        <h2>제반 자료 관리</h2>
                        <p>프로젝트 문서, 기획서, 정책 및 QA 참고 자료를 관리합니다.</p>
                      </div>
                      <small className="workspace-status planned-status">구현 예정</small>
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}

          {!isLoading && !errorMessage && view === 'history' && (
            <section className="workspace-panel build-history-panel">
              <div className="workspace-panel-heading build-heading">
                <div>
                  <span>BUILD HISTORY</span>
                  <h2>{selectedHistory ? `Build v${selectedHistory.version}` : '빌드 히스토리'}</h2>
                  <p>
                    {selectedHistory
                      ? '전달받은 빌드의 변경 내역과 QA 참고사항을 확인합니다.'
                      : '개발팀에서 전달받은 빌드 버전과 변경 내역을 프로젝트별로 누적 관리합니다.'}
                  </p>
                </div>
                <div className="build-history-heading-actions">
                  {selectedHistory && !showHistoryForm && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => requestNavigate(`/projects/${projectId}?view=history`)}
                    >
                      ← 목록으로
                    </button>
                  )}
                  {canManage && !showHistoryForm && (
                    <button
                      type="button"
                      className={selectedHistory ? 'secondary-button' : 'primary-button'}
                      onClick={() => selectedHistory ? startEditHistory(selectedHistory) : startCreateHistory()}
                    >
                      {selectedHistory ? '수정' : '+ 빌드 히스토리 추가'}
                    </button>
                  )}
                  {showHistoryForm && (
                    <button type="button" className="secondary-button" onClick={requestCloseHistoryForm}>
                      닫기
                    </button>
                  )}
                </div>
              </div>

              {showHistoryForm && canManage ? (
                <form className="build-history-form build-history-form-standalone" onSubmit={handleSaveHistory}>
                  <div className="build-history-form-grid">
                    <label>
                      <span>빌드 버전</span>
                      <input value={historyVersion} onChange={(event) => setHistoryVersion(event.target.value)} placeholder="예: 1.2.7" maxLength={150} required />
                    </label>
                    <label>
                      <span>빌드 전달 일자</span>
                      <input type="date" value={historyDeliveredAt} onChange={(event) => setHistoryDeliveredAt(event.target.value)} required />
                    </label>
                    <label className="wide">
                      <span>빌드 변경 내역</span>
                      <textarea value={historyChangeSummary} onChange={(event) => setHistoryChangeSummary(event.target.value)} placeholder={`예)\n- 신규 캐릭터 추가\n- 결제 UI 수정\n- 길드전 매칭 로직 변경`} rows={7} required />
                    </label>
                    <label className="wide">
                      <span>QA 참고사항 <small>선택</small></span>
                      <textarea value={historyQaNotes} onChange={(event) => setHistoryQaNotes(event.target.value)} placeholder={`예)\n- 기존 계정 업데이트 검증 필요\n- 결제 회귀 테스트 필요`} rows={4} />
                    </label>
                  </div>
                  {historyError && <div className="dashboard-error">{historyError}</div>}
                  <div className="build-history-form-actions">
                    <button type="button" className="secondary-button" onClick={requestCloseHistoryForm}>취소</button>
                    <button type="submit" className="primary-button" disabled={historySaving}>
                      {historySaving ? '저장 중...' : editingHistoryId ? '수정 저장' : '등록'}
                    </button>
                  </div>
                </form>
              ) : selectedHistory ? (
                <div className="build-history-detail-page">
                  <dl className="build-history-meta build-history-meta-detail">
                    <div><dt>전달 일자</dt><dd>{formatBuildDate(selectedHistory.delivered_at)}</dd></div>
                    <div><dt>작성자</dt><dd>{selectedHistory.created_by_name}</dd></div>
                    <div><dt>최근 수정</dt><dd>{selectedHistory.updated_by_name} · {new Date(selectedHistory.updated_at).toLocaleString('ko-KR')}</dd></div>
                  </dl>

                  <section className="build-history-text-section">
                    <h4>빌드 변경 내역</h4>
                    <div>{selectedHistory.change_summary}</div>
                  </section>
                  <section className="build-history-text-section">
                    <h4>QA 참고사항</h4>
                    <div className={!selectedHistory.qa_notes ? 'empty' : ''}>{selectedHistory.qa_notes || '등록된 QA 참고사항이 없습니다.'}</div>
                  </section>

                  <div className="build-history-adjacent">
                    <div className="build-history-adjacent-slot">
                      <span className="build-history-adjacent-label">↳ 이전 히스토리 내역</span>
                      {previousHistory ? (
                        <button type="button" onClick={() => requestNavigate(`/projects/${projectId}?view=history&historyId=${previousHistory.id}`)}>
                          <strong>Build v{previousHistory.version}</strong>
                          <small>{formatBuildDate(previousHistory.delivered_at)} · {previousHistory.created_by_name}</small>
                        </button>
                      ) : <div className="build-history-adjacent-empty">이전 히스토리가 없습니다.</div>}
                    </div>
                    <div className="build-history-adjacent-slot next">
                      <span className="build-history-adjacent-label">다음 히스토리 내역 ↲</span>
                      {nextHistory ? (
                        <button type="button" onClick={() => requestNavigate(`/projects/${projectId}?view=history&historyId=${nextHistory.id}`)}>
                          <strong>Build v{nextHistory.version}</strong>
                          <small>{formatBuildDate(nextHistory.delivered_at)} · {nextHistory.created_by_name}</small>
                        </button>
                      ) : <div className="build-history-adjacent-empty">다음 히스토리가 없습니다.</div>}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="workspace-project-search build-history-search">
                    <input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="빌드 버전 / 작성자 / 변경 내역 검색" />
                    <span>총 {filteredHistories.length}건</span>
                  </div>

                  <div className="build-history-list-wrap build-history-list-only">
                    <div className="build-history-list-head">
                      <span>빌드 버전</span><span>전달 일자</span><span>작성자</span>
                    </div>
                    <div className="build-history-list six-row-scroll">
                      {filteredHistories.length === 0 ? (
                        <div className="workspace-panel-empty">등록된 빌드 히스토리가 없습니다.</div>
                      ) : filteredHistories.map((history) => (
                        <button
                          key={history.id}
                          type="button"
                          className="build-history-row"
                          onClick={() => requestNavigate(`/projects/${projectId}?view=history&historyId=${history.id}`)}
                        >
                          <strong>Build v{history.version}</strong>
                          <span>{formatBuildDate(history.delivered_at)}</span>
                          <span>{history.created_by_name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {!isLoading && !errorMessage && view === 'builds' && (
            <section className="workspace-panel build-view-panel">
              <div className="workspace-panel-heading build-heading">
                <div>
                  <span>BUILD</span>
                  <h2>빌드 검수</h2>
                  <p>빌드별 검수를 생성하고 실행합니다.</p>
                </div>
                {canManage && (
                  <button type="button" className="primary-button" onClick={() => setShowCreateForm((current) => !current)}>
                    {showCreateForm ? '닫기' : '+ 빌드 생성'}
                  </button>
                )}
              </div>

              {showCreateForm && (
                <form className="workspace-build-form" onSubmit={handleCreateBuild}>
                  <label>플랫폼<select value={platform} onChange={(e) => setPlatform(e.target.value as 'IOS' | 'ANDROID')}><option value="IOS">iOS</option><option value="ANDROID">Android</option></select></label>
                  <label>빌드 버전<input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="예: 1.2.0" required /></label>
                  <label>검수 유형<select value={inspectionType} onChange={(e) => setInspectionType(e.target.value as typeof inspectionType)}><option value="NEW">신규</option><option value="RESUBMISSION">재납품</option><option value="DEVELOPMENT_REVIEW">개발 검수</option></select></label>
                  <label className="wide">테스트 기종<input value={testDevices} onChange={(e) => setTestDevices(e.target.value)} placeholder="예: iPhone 15 / Galaxy S24" /></label>
                  {createError && <div className="dashboard-error wide">{createError}</div>}
                  <div className="workspace-build-form-actions wide"><button type="submit" className="primary-button" disabled={isCreating}>{isCreating ? '생성 중...' : '빌드 생성'}</button></div>
                </form>
              )}

              <div className="workspace-build-list">
                {inspections.length === 0 ? (
                  <div className="workspace-panel-empty">아직 생성된 빌드가 없습니다.</div>
                ) : inspections.map((inspection) => {
                  const total = inspection.item_count;
                  const tested = inspection.tested_count;
                  const percent = total > 0 ? Math.round((tested / total) * 100) : 0;
                  return (
                    <article key={inspection.id} className="workspace-build-row">
                      <div><strong>Build v{inspection.version}</strong><span>{inspection.platform === 'IOS' ? 'iOS' : 'Android'} · {inspectionTypeLabel(inspection.inspection_type)}</span></div>
                      <div className="workspace-build-progress"><strong>{tested}/{total}</strong><span>{percent}%</span></div>
                      <span>{formatDateOnly(inspection.created_at)}</span>
                      <button type="button" onClick={() => router.push(`/inspections/${inspection.id}`)}>검수 실행 →</button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {!isLoading && !errorMessage && view === 'reports' && (
            <section className="workspace-panel report-view-panel">
              <div className="workspace-panel-heading build-heading">
                <div>
                  <span>REPORT</span>
                  <h2>결과 / 리포트</h2>
                  <p>빌드를 검색한 뒤 기존 결과 화면으로 바로 이동합니다.</p>
                </div>
              </div>

              <div className="workspace-project-search">
                <input value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} placeholder="빌드 버전 / 플랫폼 / 검수 유형 검색" />
                <span>{filteredReports.length}건</span>
              </div>

              <div className="workspace-build-list">
                {filteredReports.map((inspection) => (
                  <article key={inspection.id} className="workspace-build-row report">
                    <div><strong>Build v{inspection.version}</strong><span>{inspection.platform === 'IOS' ? 'iOS' : 'Android'} · {inspectionTypeLabel(inspection.inspection_type)}</span></div>
                    <div className="workspace-build-progress"><strong>{inspection.tested_count}/{inspection.item_count}</strong><span>수행</span></div>
                    <span>{formatDateOnly(inspection.created_at)}</span>
                    <button type="button" onClick={() => router.push(`/reports/inspections/${inspection.id}`)}>결과 보기 →</button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>

      {pendingNavigation && (
        <div className="unsaved-modal-backdrop" role="presentation">
          <section className="unsaved-modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-history-title">
            <span className="unsaved-modal-kicker">UNSAVED CHANGES</span>
            <h2 id="unsaved-history-title">작성 중인 내용이 있습니다.</h2>
            <p>이동하기 전에 작성 내용을 저장할지 선택해주세요.</p>
            {historyError && <div className="dashboard-error">{historyError}</div>}
            <div className="unsaved-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setPendingNavigation(null)} disabled={historySaving}>계속 작성</button>
              <button type="button" className="danger-ghost-button" onClick={discardAndLeaveHistoryForm} disabled={historySaving}>저장하지 않고 나가기</button>
              <button type="button" className="primary-button" onClick={() => void saveAndLeaveHistoryForm()} disabled={historySaving}>{historySaving ? '저장 중...' : '저장 후 나가기'}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
