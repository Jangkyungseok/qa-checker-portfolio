'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppSidebar, { SidebarUser } from '../../../components/AppSidebar';
import UiIcon from '../../../components/UiIcon';
import styles from './decisions.module.css';
import LeaveGuard, { useLeaveGuard } from './LeaveGuard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';
const NEW_TYPES = {
  DELIVERY_ISSUE: '납품 이슈', REMAINING_ISSUE: '잔여 이슈', REMAINING_TEST: '잔여 테스트',
  LIVE_ISSUE_RESPONSE: '라이브 이슈 대응', OTHER: '기타',
} as const;
const TYPES = {
  ...NEW_TYPES,
  RELEASE: '릴리즈', RISK_ACCEPTANCE: '리스크 수용', TEST_SCOPE: '테스트 범위',
  REGRESSION: '회귀 테스트', DEFECT_DISPOSITION: '결함 처리', OTHER: '기타',
} as const;
const RISKS = { CRITICAL: '즉시', HIGH: '높음', MEDIUM: '보통', LOW: '낮음' } as const;
const STATUSES = { OPEN: '처리 중', RESOLVED: '대응 완료' } as const;
type DecisionType = keyof typeof TYPES;
type Risk = keyof typeof RISKS | 'UNASSESSED';
type Status = keyof typeof STATUSES;
type Project = { id: string; name: string };
type LinkedRecord = { id: string; project_id: string; version: string; platform?: string };
type Decision = {
  id: string; project_id: string; decision_type: DecisionType; risk_level: Risk | null;
  related_url: string | null;
  decision: string; reason: string; conditions: string | null; status: Status; result: string | null;
  build_history_id: string | null; build_history_version: string | null; build_version_snapshot: string | null;
  inspection_id: string | null; inspection_version: string | null; inspection_version_snapshot: string | null;
  created_by: string; created_by_name: string; created_at: string;
  updated_by: string; updated_by_name: string; updated_at: string;
  resolved_by: string | null; resolved_by_name: string | null; resolved_at: string | null;
};
type DecisionInput = {
  decisionType: DecisionType; riskLevel: Risk | null; decision: string; reason: string;
  conditions: string | null; buildHistoryId: string | null; relatedUrl: string | null;
};
type Request = <T>(path: string, options?: RequestInit) => Promise<T>;

function errorText(error: unknown) {
  if (error instanceof TypeError) return '서버에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
}

function dateText(value: string | null, short = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return short ? date.toLocaleDateString('ko-KR') : date.toLocaleString('ko-KR');
}

function Options({ values }: { values: Record<string, string> }) {
  return <>{Object.entries(values).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</>;
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`${styles.badge} ${status === 'RESOLVED' ? styles.resolved : styles.open}`}>{STATUSES[status]}</span>;
}

function RiskBadge({ risk }: { risk: Risk | null }) {
  return <span className={`${styles.badge} ${risk === 'HIGH' || risk === 'CRITICAL' ? styles.highRisk : styles.neutral}`}>{risk === 'UNASSESSED' ? '미평가' : RISKS[risk] ?? '미지정'}</span>;
}

export default function DecisionScreen({ projectId, decisionId }: { projectId: string; decisionId?: string }) {
  return <LeaveGuard><Screen projectId={projectId} decisionId={decisionId} /></LeaveGuard>;
}

function RelatedLink({ url }: { url: string | null }) {
  if (!url) return <span>연결 없음</span>;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return <span>유효하지 않은 링크</span>;
  } catch { return <span>유효하지 않은 링크</span>; }
  return <a href={url} target="_blank" rel="noopener noreferrer">{url}<span className={styles.srOnly}> (새 탭)</span></a>;
}

function Screen({ projectId, decisionId }: { projectId: string; decisionId?: string }) {
  const router = useRouter();
  const leave = useLeaveGuard();
  const [user, setUser] = useState<SidebarUser | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const listHref = `/projects/${projectId}/decisions`;

  const request: Request = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const token = localStorage.getItem('qa_checker_token');
    if (!token) {
      router.replace('/');
      throw new Error('로그인이 필요합니다.');
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
      cache: 'no-store',
    });
    const data = await response.json();
    if (response.status === 401) {
      router.replace('/');
      throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.');
    }
    if (!response.ok) {
      throw new Error(Array.isArray(data.message) ? data.message.join(' / ') : data.message ?? '요청을 처리하지 못했습니다.');
    }
    return data as T;
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      request<SidebarUser>('/auth/me', { signal: controller.signal }),
      request<Project[]>('/projects', { signal: controller.signal }),
    ]).then(([currentUser, projects]) => {
      if (controller.signal.aborted) return;
      const currentProject = projects.find(item => item.id === projectId);
      if (!currentProject) throw new Error('프로젝트를 찾을 수 없습니다.');
      setUser(currentUser);
      setProject(currentProject);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(errorText(cause));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [projectId, request, retry]);

  if (loading) return <main className="execution-loading" role="status">기록을 불러오는 중...</main>;
  if (error || !user || !project) return <main className={styles.standalone}>
    <p role="alert">{error || '화면을 불러오지 못했습니다.'}</p>
    <button className="secondary-button" onClick={() => setRetry(value => value + 1)}>다시 시도</button>
    <Link href={`/projects/${projectId}`}>Workspace로 돌아가기</Link>
  </main>;

  const canManage = user.role === 'LEADER' || user.role === 'ADMIN';
  return <main className="app-shell">
    <AppSidebar user={user} activeMenu="project" currentProjectId={projectId} guardAction={leave.request} />
    <section className="app-main workspace-main">
      <div className={`workspace-page ${styles.page}`}>
        <header className="workspace-hero project workspace-hero-with-back">
          <Link className="workspace-back-circle" href={decisionId ? listHref : `/projects/${projectId}`} aria-label={decisionId ? '기록 목록으로 돌아가기' : 'Workspace로 돌아가기'}>
            <UiIcon name="back" size={22} />
          </Link>
          <div className="workspace-hero-copy">
            <span className="workspace-eyebrow">{project.name}</span>
            <h1>이슈 이력</h1>
            <p>주요 이슈와 대응 사유, 결과를 남기고 확인합니다.</p>
          </div>
        </header>
        <nav className={styles.breadcrumb} aria-label="현재 위치">
          <Link href={`/projects/${projectId}`}>{project.name} Workspace</Link><span>/</span>
          {decisionId ? <><Link href={listHref}>기록</Link><span>/</span><span>상세</span></> : <span>기록</span>}
        </nav>
        {decisionId
          ? <DecisionDetail projectId={projectId} decisionId={decisionId} canManage={canManage} request={request} />
          : <DecisionList projectId={projectId} canManage={canManage} request={request} />}
      </div>
    </section>
  </main>;
}

function DecisionList({ projectId, canManage, request }: { projectId: string; canManage: boolean; request: Request }) {
  const router = useRouter();
  const leave = useLeaveGuard();
  const [rows, setRows] = useState<Decision[]>([]);
  const [status, setStatus] = useState('');
  const [risk, setRisk] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ projectId });
    if (status) query.set('status', status);
    if (risk) query.set('riskLevel', risk);
    if (type) query.set('decisionType', type);
    setLoading(true);
    setError('');
    request<Decision[]>(`/qa-decisions?${query}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setRows(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, status, risk, type, request, retry]);

  return <section className={`workspace-panel ${styles.panel}`}>
    {!creating && <div className={styles.heading}>
      <div><h2>이력 목록</h2><p>주요 이슈와 대응 사유, 결과를 남기고 확인합니다.</p></div>
      {canManage ? <button className="primary-button" disabled={creating} onClick={() => setCreating(true)}>기록 생성</button> : <span className={styles.readOnly}>조회 전용</span>}
    </div>}
    {creating && canManage && <DecisionForm projectId={projectId} request={request} onCancel={() => setCreating(false)} onSave={async input => {
      const record = await request<Decision>('/qa-decisions', { method: 'POST', body: JSON.stringify({ projectId, ...input }) });
      leave.finish(() => router.push(`/projects/${projectId}/decisions/${record.id}`));
    }} />}
    {!creating && <><div className={styles.filters}>
      <label>상태<select value={status} onChange={event => setStatus(event.target.value)}><option value="">전체 상태</option><Options values={STATUSES} /></select></label>
      <label>위험도<select value={risk} onChange={event => setRisk(event.target.value)}><option value="">전체 위험도</option><Options values={RISKS} /></select></label>
      <label>이슈 유형<select value={type} onChange={event => setType(event.target.value)}><option value="">전체 유형</option><Options values={NEW_TYPES} /></select></label>
      <button className="secondary-button" onClick={() => { setStatus(''); setRisk(''); setType(''); }}>필터 초기화</button>
    </div>
    {loading ? <p className={styles.empty} role="status">목록을 불러오는 중...</p>
      : error ? <div className={styles.error} role="alert">{error} <button className="secondary-button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></div>
        : rows.length === 0 ? <div className={styles.empty}><h3>{status || risk || type ? '조건에 맞는 기록이 없습니다.' : '아직 기록이 없습니다.'}</h3><p>{status || risk || type ? '필터를 변경해 다른 기록을 확인해 보세요.' : 'QA 주요 기록과 대응 사유를 남겨 보세요.'}</p></div>
          : <><p className={styles.count} aria-live="polite">총 {rows.length}건</p><div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>QA 기록 목록</caption>
              <thead><tr>{['이슈 유형', '위험도', '이슈 내용', '상태', '연결 빌드 / 연관 링크', '작성자', '작성일'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
              <tbody>{rows.map(row => <tr key={row.id} className={styles.clickableRow} onClick={event => {
                if ((event.target as HTMLElement).closest('a, button, input, select, textarea')) return;
                router.push(`/projects/${projectId}/decisions/${row.id}`);
              }}>
                <td>{TYPES[row.decision_type]}</td><td><RiskBadge risk={row.risk_level} /></td>
                <td><Link className={styles.summary} href={`/projects/${projectId}/decisions/${row.id}`} title={row.decision}>{row.decision}</Link></td>
                <td><StatusBadge status={row.status} /></td>
                <td className={styles.linkedCell}>
                  {row.build_history_id || row.build_version_snapshot ? <span>빌드: {row.build_history_version ?? row.build_version_snapshot}{!row.build_history_id && ' (연결 해제)'}</span> : null}
                  {row.related_url && <RelatedLink url={row.related_url} />}
                  {!row.build_history_id && !row.build_version_snapshot && !row.related_url && '연결 없음'}
                </td>
                <td>{row.created_by_name}</td><td><time dateTime={row.created_at}>{dateText(row.created_at, true)}</time></td>
              </tr>)}</tbody>
            </table>
          </div></>}</>}
  </section>;
}

function DecisionForm({ projectId, record, request, onSave, onCancel }: {
  projectId: string; record?: Decision; request: Request; onSave: (input: DecisionInput) => Promise<void>; onCancel: () => void;
}) {
  const leave = useLeaveGuard();
  const [type, setType] = useState<keyof typeof NEW_TYPES | ''>(record ? (record.decision_type in NEW_TYPES ? record.decision_type as keyof typeof NEW_TYPES : '') : 'DELIVERY_ISSUE');
  const [risk, setRisk] = useState<keyof typeof RISKS | ''>(record?.risk_level && record.risk_level !== 'UNASSESSED' ? record.risk_level : '');
  const [riskChanged, setRiskChanged] = useState(false);
  const [decision, setDecision] = useState(record?.decision ?? '');
  const [reason, setReason] = useState(record?.reason ?? '');
  const [conditions, setConditions] = useState(record?.conditions ?? '');
  const [buildId, setBuildId] = useState(record?.build_history_id ?? '');
  const [relatedUrl, setRelatedUrl] = useState(record?.related_url ?? '');
  const [builds, setBuilds] = useState<LinkedRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savedRisk = risk || (!riskChanged && record?.risk_level === 'UNASSESSED' ? 'UNASSESSED' : null);
  const currentValues = JSON.stringify({ type, risk: savedRisk, decision, reason, conditions, buildId, relatedUrl });
  const initialValues = useRef(currentValues);
  const dirty = currentValues !== initialValues.current;
  useLayoutEffect(() => { leave.setDirty(dirty); }, [dirty, leave.setDirty]);
  useLayoutEffect(() => () => leave.setDirty(false), [leave.setDirty]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    request<LinkedRecord[]>(`/build-histories?projectId=${encodeURIComponent(projectId)}`, { signal: controller.signal }).then(histories => {
      if (controller.signal.aborted) return;
      setBuilds(histories.filter(item => item.project_id === projectId));

    }).catch(cause => { if (!controller.signal.aborted) setLoadError(errorText(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, request, retry]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading || loadError) return;
    if (!decision.trim() || !reason.trim()) { setError('이슈 내용과 대응 사유를 입력해 주세요.'); return; }
    if (relatedUrl.trim()) {
      try {
        const parsed = new URL(relatedUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
      } catch { setError('연관 링크는 HTTP/HTTPS URL로 입력해 주세요.'); return; }
    }
    setError('');
    setSaving(true);
    try {
      await onSave({ decisionType: type || record.decision_type, riskLevel: savedRisk, decision: decision.trim(), reason: reason.trim(), conditions: conditions.trim() || null, buildHistoryId: buildId || null, relatedUrl: relatedUrl.trim() || null });
    } catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  }

  return <form className={styles.form} onSubmit={submit} aria-label={record ? '기록 수정' : '기록 생성'}>
    <h3>{record ? '기록 수정' : '기록 생성'}</h3>
    <p className={styles.hint}>이슈 유형, 이슈 내용, 대응 사유는 필수입니다. 연결 대상은 현재 프로젝트에서 선택합니다.</p>
    {loadError && <div className={styles.error} role="alert">{loadError} <button type="button" className="secondary-button" onClick={() => setRetry(value => value + 1)}>연결 목록 다시 불러오기</button></div>}
    {loading && <p role="status" className={styles.hint}>연결 가능한 빌드를 불러오는 중...</p>}
    <fieldset disabled={saving} className={styles.formGrid}>
      <label>이슈 유형 <select value={type} onChange={event => setType(event.target.value as keyof typeof NEW_TYPES)}>{!type && <option value="" disabled hidden>기존 유형 유지</option>}<Options values={NEW_TYPES} /></select>{record && !(record.decision_type in NEW_TYPES) && <small>기존 유형: {TYPES[record.decision_type]}</small>}</label>
      <label>위험도<select value={risk} onChange={event => { setRisk(event.target.value as keyof typeof RISKS | ''); setRiskChanged(true); }}><option value="">선택 안 함</option><Options values={RISKS} /></select>{record?.risk_level === 'UNASSESSED' && !riskChanged && <small>기존 값: 미평가</small>}</label>
      <label className={styles.wide}>이슈 내용 <textarea required maxLength={10000} rows={4} value={decision} onChange={event => setDecision(event.target.value)} placeholder="주요 이슈 내용을 작성해 주세요." /></label>
      <label className={styles.wide}>대응 사유 <textarea required maxLength={10000} rows={4} value={reason} onChange={event => setReason(event.target.value)} placeholder="해당 대응을 선택한 사유를 작성해 주세요." /></label>
      <label className={styles.wide}>대응 방향 (선택)<textarea maxLength={10000} rows={3} value={conditions} onChange={event => setConditions(event.target.value)} placeholder="향후 대응 방법이나 확인이 필요한 내용을 작성해 주세요." /></label>
      <label>Build History (선택)<select disabled={loading || !!loadError} value={buildId} onChange={event => setBuildId(event.target.value)}>
        <option value="">연결 없음</option>
        {buildId && !builds.some(item => item.id === buildId) && <option value={buildId}>{record?.build_history_version ?? record?.build_version_snapshot ?? '기존 연결'} (현재 연결)</option>}
        {builds.map(item => <option key={item.id} value={item.id}>{item.version}</option>)}
      </select></label>
      <label>연관 링크 (선택)<input type="url" maxLength={2048} value={relatedUrl} onChange={event => setRelatedUrl(event.target.value)} placeholder="https://" /></label>
    </fieldset>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>
      <button type="button" className="secondary-button" disabled={saving} onClick={() => leave.request(onCancel)}>취소</button>
      <button type="submit" className="primary-button" disabled={saving || loading || !!loadError}>{saving ? '저장 중...' : record ? '변경 저장' : '기록 저장'}</button>
    </div>
  </form>;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.detailSection}><h3>{title}</h3>{children}</section>;
}

function StatusDialog({ resolved, result, setResult, saving, error, onConfirm, onClose }: {
  resolved: boolean; result: string; setResult: (value: string) => void; saving: boolean;
  error: string; onConfirm: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="record-status-title" onCancel={event => {
    event.preventDefault();
    if (!saving) onClose();
  }}>
    <form className={styles.form} onSubmit={event => { event.preventDefault(); onConfirm(); }}>
      <h3 id="record-status-title" className={styles.dialogTitle}>상태를 <strong>{resolved ? '대응 완료' : '처리 중'}</strong>{resolved ? '로' : '으로'} 변경할까요?</h3>
      {resolved
        ? <label className={styles.resultLabel}>대응 결과 (필수)<textarea autoFocus required maxLength={10000} rows={4} value={result} disabled={saving} onChange={event => setResult(event.target.value)} /></label>
        : <p className={styles.hint}>등록된 대응 결과는 초기화됩니다.</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="button" className="secondary-button" disabled={saving} onClick={onClose}>취소</button>
        <button type="submit" className="primary-button" disabled={saving}>{saving ? '변경 중...' : '변경'}</button>
      </div>
    </form>
  </dialog>;
}

function DecisionDetail({ projectId, decisionId, canManage, request }: { projectId: string; decisionId: string; canManage: boolean; request: Request }) {
  const leave = useLeaveGuard();
  const [record, setRecord] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const path = `/qa-decisions/${encodeURIComponent(decisionId)}`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    request<Decision>(path, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      if (data.project_id !== projectId) throw new Error('현재 프로젝트의 기록이 아닙니다.');
      setRecord(data);
    }).catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, projectId, request, retry]);

  async function resolve(resolved: boolean) {
    if (!canManage || saving) return;
    if (resolved && !result.trim()) { setActionError('대응 결과를 입력해 주세요.'); return; }
    setSaving(true);
    setActionError('');
    try {
      const updated = await request<Decision>(`${path}/resolve`, { method: 'PATCH', body: JSON.stringify(resolved ? { resolved: true, result: result.trim() } : { resolved: false }) });
      setRecord(updated);
      setResolving(false);
      setResult('');
    } catch (cause) { setActionError(errorText(cause)); }
    finally { setSaving(false); }
  }

  if (loading) return <p className={styles.empty} role="status">기록을 불러오는 중...</p>;
  if (error || !record) return <div className={styles.error} role="alert">{error || '기록을 찾을 수 없습니다.'} <button className="secondary-button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></div>;

  return <section className={`workspace-panel ${styles.panel}`}>
    <div className={styles.heading}>
      <div><h2>기록 상세</h2><p>{TYPES[record.decision_type]} · {dateText(record.created_at, true)}</p></div>
      {canManage ? <div className={styles.actions}>
        {record.status === 'OPEN' && <button className="secondary-button" disabled={editing || resolving || saving} onClick={() => { setEditing(true); setActionError(''); }}>수정</button>}
        <button className={record.status === 'OPEN' ? 'primary-button' : 'secondary-button'} disabled={editing || resolving || saving} onClick={() => { setResolving(true); setActionError(''); }}>
          {record.status === 'OPEN' ? '대응 완료로 변경' : '처리 중으로 변경'}
        </button>
      </div> : <span className={styles.readOnly}>조회 전용</span>}
    </div>
    {editing && canManage && record.status === 'OPEN' && <DecisionForm projectId={projectId} record={record} request={request} onCancel={() => setEditing(false)} onSave={async input => {
      if (!canManage || record.status !== 'OPEN') return;
      const { buildHistoryId, ...fields } = input;
      const updated = await request<Decision>(path, { method: 'PATCH', body: JSON.stringify({
        ...fields,
        ...(buildHistoryId !== record.build_history_id ? { buildHistoryId } : {}),

      }) });
      setRecord(updated);
      leave.finish(() => setEditing(false));
    }} />}
    {resolving && canManage && <StatusDialog resolved={record.status === 'OPEN'} result={result} setResult={setResult} saving={saving} error={actionError}
      onConfirm={() => { void resolve(record.status === 'OPEN'); }}
      onClose={() => { setResolving(false); setResult(''); setActionError(''); }} />}
    {!editing && <div className={styles.detailGrid}>
      <div>
        <DetailSection title="이슈 내용"><div className={styles.tags}><span className={styles.badge}>{TYPES[record.decision_type]}</span><RiskBadge risk={record.risk_level} /></div><p className={styles.prose}>{record.decision}</p></DetailSection>
        <DetailSection title="대응 사유"><p className={styles.prose}>{record.reason}</p></DetailSection>
        <DetailSection title="대응 방향"><p className={styles.prose}>{record.conditions || '등록된 대응 방향이 없습니다.'}</p></DetailSection>
        <DetailSection title="대응 결과"><p className={styles.prose}>{record.result || '아직 대응 결과가 없습니다.'}</p></DetailSection>
      </div>
      <div>
        <DetailSection title="상태"><StatusBadge status={record.status} /></DetailSection>
        <DetailSection title="연결 빌드 / 연관 링크">
          <div className={styles.connection}><h4>Build History</h4>
            {record.build_history_id ? <Link href={`/projects/${projectId}?view=history&historyId=${record.build_history_id}`}>현재 버전: {record.build_history_version ?? '버전 정보 없음'} ↗</Link> : <p>연결 없음</p>}
            <p>저장 당시 버전 (snapshot): <strong>{record.build_version_snapshot ?? '—'}</strong></p>
          </div>
          <div className={styles.connection}><h4>연관 링크</h4><RelatedLink url={record.related_url} /></div>
        </DetailSection>
        <DetailSection title="작성 / 수정 / 대응 감사 정보"><dl className={styles.audit}>
          <div><dt>작성자</dt><dd>{record.created_by_name}</dd><dt>작성일</dt><dd>{dateText(record.created_at)}</dd></div>
          <div><dt>수정자</dt><dd>{record.updated_by_name}</dd><dt>수정일</dt><dd>{dateText(record.updated_at)}</dd></div>
          <div><dt>대응 완료자</dt><dd>{record.resolved_by_name ?? '—'}</dd><dt>대응 완료일</dt><dd>{dateText(record.resolved_at)}</dd></div>
        </dl></DetailSection>
      </div>
    </div>}
  </section>;
}
