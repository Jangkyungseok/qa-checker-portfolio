'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppSidebar, { SidebarUser } from '../../../components/AppSidebar';
import { STATES, PRIORITIES, FREQUENCIES, display, message } from '../defects/issue-model';
import issueStyles from '../defects/defects.module.css';
import styles from './issue-report.module.css';
import { IssueReport, ReportIssue } from './report-model';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';
const number = (n: number) => n.toLocaleString('ko-KR');
const timestamp = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

export default function IssueReportScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [user, setUser] = useState<SidebarUser | null>(null);
  const [data, setData] = useState<IssueReport | null>(null);
  const [period, setPeriod] = useState('ALL'), [build, setBuild] = useState('');
  const [builds, setBuilds] = useState<string[]>([]);
  const [remainingPage, setRemainingPage] = useState(1), [rerequestPage, setRerequestPage] = useState(1);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    setLoading(true); setError('');
    const token = localStorage.getItem('qa_checker_token');
    if (!token) { router.replace('/'); return () => control.abort(); }
    async function get<T,>(path: string): Promise<T> {
      const res = await fetch(API + path, { cache: 'no-store', signal: control.signal, headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json();
      if (res.status === 401) { router.replace('/'); throw new Error('다시 로그인해 주세요.'); }
      if (!res.ok) throw new Error(res.status >= 500 ? '이슈 현황을 불러오지 못했습니다. 다시 시도해 주세요.' : Array.isArray(body.message) ? body.message.join(' / ') : body.message ?? '조회에 실패했습니다.');
      return body;
    }
    const query = new URLSearchParams({ projectId, period, remainingPage: String(remainingPage), rerequestPage: String(rerequestPage) });
    if (build) query.set('buildVersion', build);
    Promise.all([get<SidebarUser>('/auth/me'), get<IssueReport>('/defects/report?' + query)])
      .then(([u, report]) => { if (!control.signal.aborted) { setUser(u); setData(report); setBuilds(report.buildVersions); } })
      .catch(e => { if (!control.signal.aborted) setError(message(e)); })
      .finally(() => { if (!control.signal.aborted) setLoading(false); });
    return () => control.abort();
  }, [projectId, period, build, remainingPage, rerequestPage, refresh, router]);

  const resetPages = () => { setRemainingPage(1); setRerequestPage(1); };
  return <main className="app-shell">
    {user && <AppSidebar user={user} activeMenu="project" currentProjectId={projectId} />}
    <section className="app-main workspace-main"><div className={`workspace-page ${styles.page}`}>
      <header className="workspace-hero project"><div className="workspace-hero-copy"><span className="workspace-eyebrow">{data?.project.name ?? 'QA WORKSPACE'}</span><h1>이슈 현황</h1><p>등록된 이슈의 진행 상태와 처리 현황을 확인합니다.</p></div></header>
      <nav><Link className={issueStyles.backLink} href={`/projects/${projectId}`}>← 프로젝트로</Link></nav>
      <section className={`${issueStyles.panel} ${styles.filters}`} aria-label="현황 필터">
        <label>기간<select value={period} onChange={e => { setPeriod(e.target.value); resetPages(); }}><option value="ALL">전체</option><option value="7">최근 7일</option><option value="14">최근 14일</option><option value="30">최근 30일</option></select></label>
        <label>빌드 버전<select value={build} onChange={e => { setBuild(e.target.value); resetPages(); }}><option value="">전체 빌드</option>{builds.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
        <button className="secondary-button" disabled={loading} onClick={() => setRefresh(n => n + 1)}>새로고침</button>
        <p className={issueStyles.hint}>등록일 기준 · 한국시간 · 최근 기간은 오늘 포함<br />선택한 기간에 등록된 이슈의 현재 상태와 활동 이력을 집계합니다.</p>
      </section>
      {loading ? <p role="status">이슈 현황을 불러오는 중...</p> : error ? <p className={issueStyles.error} role="alert">{error}</p> : data && <>
        <p className={issueStyles.hint}>조회 기준: {timestamp(data.generatedAt)}{data.filters.from && ` · 등록 시작: ${timestamp(data.filters.from)}`}</p>
        {data.totals.total === 0 && <p className={styles.empty} role="status">선택한 조건에 등록된 이슈가 없습니다.</p>}
        <section className={styles.kpis} aria-label="핵심 지표">
          {([['전체 이슈', data.totals.total], ['미처리', data.totals.pending], ['대응 중', data.totals.inProgress], ['대응 완료', data.totals.responded], ['수정 확인', data.totals.verified], ['SKIP', data.totals.skip]] as const).map(([label, value]) => <div key={label} className={styles.kpi}><span>{label}</span><strong>{number(value)}<small>건</small></strong></div>)}
        </section>
        <section className={issueStyles.panel} aria-label="처리 현황"><div className={styles.heading}><h2>처리 현황</h2><strong>{data.completion.rate}%</strong></div>
          <p>{number(data.completion.completed)} / {number(data.completion.total)}건 <span className={issueStyles.hint}>· 수정 확인 + SKIP 확인</span></p>
          <progress aria-label="처리율" value={data.completion.rate} max={100} className={styles.progress} />
        </section>
        <section className={issueStyles.panel}><h2>상태별 현황</h2><div className={styles.states}>{Object.entries(STATES).map(([key, label]) => <div key={key} className={`${styles.state} ${issueStyles[key]}`}><span className={`${issueStyles.badge} ${issueStyles[key]}`}>{label}</span><strong>{number(data.byStatus[key as keyof typeof STATES])}건</strong></div>)}</div></section>
        <div className={styles.columns}><Distribution title="우선순위별 현황" labels={PRIORITIES} values={data.byPriority} /><Distribution title="발생 빈도별 현황" labels={FREQUENCIES} values={data.byFrequency} /></div>
        <div className={styles.columns}>
          <section className={issueStyles.panel}><h2>재요청 현황</h2><dl className={styles.metrics}><div><dt>현재 재요청</dt><dd>{number(data.rerequest.current)}건</dd></div><div><dt>재요청 발생 이슈</dt><dd>{number(data.rerequest.affectedIssues)}건</dd></div><div><dt>총 재요청 횟수</dt><dd>{number(data.rerequest.totalTransitions)}회</dd></div></dl><p className={issueStyles.hint}>발생 이슈·횟수는 선택한 이슈의 실제 재요청 전환 이력 기준입니다.</p></section>
          <section className={issueStyles.panel}><h2>SKIP 현황</h2><dl className={styles.metrics}><div><dt>SKIP 요청</dt><dd>{number(data.skip.requested)}건</dd></div><div><dt>SKIP 확인</dt><dd>{number(data.skip.confirmed)}건</dd></div><div><dt>SKIP 비율</dt><dd>{data.skip.rate}%</dd></div></dl><p className={issueStyles.hint}>SKIP 확인 ÷ 전체 이슈</p></section>
        </div>
        <IssueTable title="잔여 이슈" rows={data.remainingIssues} empty="선택한 조건에 잔여 이슈가 없습니다." pagination={data.pagination.remaining} pageSize={data.pagination.pageSize} onPage={setRemainingPage} />
        <IssueTable title="재요청 이슈" rows={data.rerequestIssues} empty="현재 재요청 상태의 이슈가 없습니다." pagination={data.pagination.rerequest} pageSize={data.pagination.pageSize} onPage={setRerequestPage} />
      </>}
    </div></section>
  </main>;
}

function Distribution({ title, labels, values }: { title: string; labels: Record<string, string>; values: Record<string, number> }) {
  const legacy = Object.entries(values).filter(([key]) => !(key in labels));
  return <section className={issueStyles.panel}><h2>{title}</h2><dl className={styles.distribution}>{Object.entries(labels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{number(values[key] ?? 0)}건</dd></div>)}{legacy.map(([key, value]) => <div key={key}><dt>{display(key, {})}</dt><dd>{number(value)}건</dd></div>)}</dl></section>;
}

function IssueTable({ title, rows, empty, pagination, pageSize, onPage }: { title: string; rows: ReportIssue[]; empty: string; pagination: { page: number; total: number }; pageSize: number; onPage: (page: number) => void }) {
  const router = useRouter();
  return <section className={issueStyles.panel}><div className={styles.heading}><h2>{title}</h2><span>{number(pagination.total)}건</span></div>
    <div className={issueStyles.tableScroll}><table className={issueStyles.issueTable}><caption className={styles.srOnly}>{title}</caption><thead><tr><th>이슈 번호</th><th>상태</th><th>우선순위</th><th>발생 빈도</th><th>빌드 버전</th><th>발생 단말 / OS</th><th>제목</th><th>최종 수정일</th></tr></thead><tbody>{rows.map(row => {
      const href = `/projects/${row.project_id}/defects/${row.id}`;
      return <tr key={row.id} className={issueStyles[row.status]} tabIndex={0} aria-label={`${row.issue_code} ${row.title}`} onClick={e => { if (!(e.target as HTMLElement).closest('a')) router.push(href); }} onKeyDown={e => { if (e.target === e.currentTarget && e.key === 'Enter') { e.preventDefault(); router.push(href); } }}><td><Link href={href}>{row.issue_code}</Link></td><td><span className={`${issueStyles.badge} ${issueStyles[row.status]}`}>{STATES[row.status]}</span></td><td>{display(row.priority, PRIORITIES)}</td><td>{display(row.reproducibility, FREQUENCIES)}</td><td>{row.build_version ?? '미등록'}</td><td>{row.device_os}</td><td className={issueStyles.titleCell}><Link href={href}>{row.title}</Link></td><td>{timestamp(row.updated_at)}</td></tr>;
    })}</tbody></table></div>
    {!rows.length && <p>{pagination.total ? '이 페이지에 이슈가 없습니다. 이전 페이지를 확인해 주세요.' : empty}</p>}
    {pagination.total > pageSize && <nav className={styles.paging} aria-label={`${title} 페이지`}><button className="secondary-button" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>이전</button><span>{pagination.page} / {Math.ceil(pagination.total / pageSize)}</span><button className="secondary-button" disabled={pagination.page * pageSize >= pagination.total} onClick={() => onPage(pagination.page + 1)}>다음</button></nav>}
  </section>;
}
