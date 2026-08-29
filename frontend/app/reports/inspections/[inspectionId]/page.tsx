'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type ResultStatus = 'PASS' | 'FAIL' | 'SKIP' | null;

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
}

interface Summary {
  total_count: number;
  tested_count: number;
  untested_count: number;
  pass_count: number;
  fail_count: number;
  skip_count: number;
  is_completed: boolean;
}

interface ReportItem {
  inspection_item_id: string;
  source_test_item_id: string;
  category_name: string;
  category_sort_order: number;
  item_title: string;
  check_content: string;
  test_method: string;
  reference_note: string;
  item_sort_order: number;
  status: ResultStatus;
  memo: string | null;
  tested_by: string | null;
  tested_by_name: string | null;
  tested_at: string | null;
  result_updated_at: string | null;
}

interface ReportData {
  inspection: Inspection;
  summary: Summary;
  priority_items: ReportItem[];
  all_results: ReportItem[];
}

function getInspectionTypeLabel(
  type: Inspection['inspection_type'],
) {
  if (type === 'NEW') return '신규';
  if (type === 'RESUBMISSION') return '재납품';
  if (type === 'DEVELOPMENT_REVIEW') return '개발 검수';

  return type;
}

function getPlatformLabel(
  platform: Inspection['platform'],
) {
  return platform === 'IOS' ? 'iOS' : 'Android';
}

function formatDate(date: string | null) {
  if (!date) return '-';

  return new Date(date).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InspectionReportPage() {
  const router = useRouter();
  const params = useParams();

  const inspectionId = Array.isArray(params.inspectionId)
    ? params.inspectionId[0]
    : params.inspectionId;

  const [report, setReport] =
    useState<ReportData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const loadReport = useCallback(
    async (refresh = false) => {
      if (!inspectionId) return;

      const token =
        localStorage.getItem('qa_checker_token');

      if (!token) {
        router.replace('/');
        return;
      }

      const refreshStartedAt = refresh
        ? Date.now()
        : 0;

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage('');

      try {
        const response = await fetch(
          `http://127.0.0.1:3001/reports/inspections/${inspectionId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          },
        );

        const data = await response.json();

        if (response.status === 401) {
          localStorage.removeItem(
            'qa_checker_token',
          );

          localStorage.removeItem(
            'qa_checker_user',
          );

          router.replace('/');
          return;
        }

        if (!response.ok) {
          throw new Error(
            data?.message ??
              '결과 보고서를 불러오지 못했습니다.',
          );
        }

        setReport(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : '결과 보고서를 불러오는 중 오류가 발생했습니다.',
        );
      } finally {
        setIsLoading(false);

        if (refresh) {
          const elapsed =
            Date.now() - refreshStartedAt;
          const remaining =
            Math.max(0, 650 - elapsed);

          if (remaining > 0) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, remaining),
            );
          }
        }

        setIsRefreshing(false);
      }
    },
    [inspectionId, router],
  );

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const progressPercent = useMemo(() => {
    if (
      !report ||
      report.summary.total_count === 0
    ) {
      return 0;
    }

    return Math.round(
      (report.summary.tested_count /
        report.summary.total_count) *
        100,
    );
  }, [report]);

  const testerNames = useMemo(() => {
    if (!report) return '-';

    const names = Array.from(
      new Set(
        report.all_results
          .map(
            (item) =>
              item.tested_by_name,
          )
          .filter(
            (
              name,
            ): name is string =>
              typeof name === 'string' &&
              name.trim().length > 0,
          ),
      ),
    );

    return names.length > 0
      ? names.join(' · ')
      : '-';
  }, [report]);

  if (isLoading) {
    return (
      <main className="report-loading">
        결과 보고서를 불러오는 중...
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (errorMessage || !report) {
    return (
      <main className="report-loading">
        {errorMessage ||
          '보고서 데이터가 없습니다.'}
        <style jsx>{styles}</style>
      </main>
    );
  }

  const {
    inspection,
    summary,
    priority_items,
  } = report;

  const visiblePriorityItems =
    priority_items.slice(0, 3);

  return (
    <main className="report-page">
      <header className="execution-header">
        <button
          type="button"
          className="execution-brand brand-home-button"
          onClick={() =>
            router.push('/dashboard')
          }
          aria-label="메인 화면으로 이동"
        >
          <div className="brand-mark">
            Q
          </div>

          <div>
            <h1>QA Checker</h1>
            <p>QA 테스트 결과</p>
          </div>
        </button>

        <div className="execution-header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push(
                `/inspections/${inspection.id}`,
              )
            }
          >
            ↩ 이전
          </button>
        </div>
      </header>

      <section className="report-container">
        <section className="report-title-row">
          <div>
            <span className="eyebrow">
              TEST REPORT
            </span>

            <h1>
              {inspection.project_name}
            </h1>

            <p>
              테스트 결과와 주요 확인 항목을
              한 화면에서 확인합니다.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              className={
                summary.is_completed
                  ? 'completion-badge completed'
                  : 'completion-badge'
              }
            >
              {summary.is_completed
                ? '테스트 완료'
                : '테스트 진행 중'}
            </span>

            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => loadReport(true)}
              aria-label="결과 새로고침"
              title="새로고침"
              className={`refresh-icon-button ${
                isRefreshing ? 'spinning' : ''
              }`}
            >
              ↻
            </button>
          </div>
        </section>

        <section className="inspection-info-grid">
          <InfoItem
            label="프로젝트"
            value={
              inspection.project_name
            }
          />

          <InfoItem
            label="버전"
            value={inspection.version}
          />

          <InfoItem
            label="플랫폼"
            value={getPlatformLabel(
              inspection.platform,
            )}
          />

          <InfoItem
            label="테스트 유형"
            value={getInspectionTypeLabel(
              inspection.inspection_type,
            )}
          />

          <InfoItem
            label="테스트 기종"
            value={
              inspection.test_devices ||
              '-'
            }
          />

          <InfoItem
            label="검수자"
            value={testerNames}
          />
        </section>

        <section className="summary-heading">
          <span className="eyebrow">
            RESULT SUMMARY
          </span>

          <h2>전체 테스트 결과</h2>
        </section>

        <section className="summary-section">
          <div className="progress-card">
            <div
              className="progress-circle"
              style={{
                background: `conic-gradient(
                  #637c9f 0% ${progressPercent}%,
                  #e9edf2 ${progressPercent}% 100%
                )`,
              }}
            >
              <div className="progress-circle-inner">
                <strong>
                  {progressPercent}%
                </strong>
              </div>
            </div>

            <div className="progress-copy">
              <span className="eyebrow">
                TOTAL PROGRESS
              </span>

              <h2>전체 진행률</h2>

              <p>
                전체 {summary.total_count}개
                항목 중{' '}
                {summary.tested_count}개
                항목의 테스트가
                완료되었습니다.
              </p>

              <button
                type="button"
                className="text-link"
                onClick={() =>
                  router.push(
                    `/reports/inspections/${inspection.id}/all`,
                  )
                }
              >
                전체 항목 결과 보기 →
              </button>
            </div>
          </div>

          <div className="result-summary-grid">
            <SummaryCard
              label="전체"
              value={
                summary.total_count
              }
              className="total"
            />

            <SummaryCard
              label="PASS"
              value={
                summary.pass_count
              }
              className="pass"
            />

            <SummaryCard
              label="FAIL"
              value={
                summary.fail_count
              }
              className="fail"
            />

            <SummaryCard
              label="SKIP"
              value={
                summary.skip_count
              }
              className="skip"
            />

            <SummaryCard
              label="미실행"
              value={
                summary.untested_count
              }
              className="untested"
            />
          </div>
        </section>

        <section className="report-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                FAIL / SKIP
              </span>

              <h2>
                FAIL / SKIP 항목
              </h2>

              <p>
                확인이 필요한 항목을
                최대 3건까지 표시합니다.
              </p>
            </div>

            <span className="section-count">
              {priority_items.length}건
            </span>
          </div>

          {visiblePriorityItems.length ===
          0 ? (
            <div className="empty-priority">
              <strong>
                확인이 필요한 항목이
                없습니다.
              </strong>

              <span>
                현재 FAIL 또는 SKIP으로
                판정된 항목이 없습니다.
              </span>
            </div>
          ) : (
            <div className="priority-list">
              {visiblePriorityItems.map(
                (item) => (
                  <PriorityItem
                    key={
                      item.inspection_item_id
                    }
                    item={item}
                  />
                ),
              )}
            </div>
          )}

          {priority_items.length > 0 && (
            <div className="priority-footer">
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  router.push(
                    `/reports/inspections/${inspection.id}/priority`,
                  )
                }
              >
                FAIL / SKIP 전체 보기 →
              </button>
            </div>
          )}
        </section>

        <footer className="report-footer">
          <span>
            테스트 생성일{' '}
            {formatDate(
              inspection.created_at,
            )}
          </span>

          <span>
            QA Checker · Current Result
            Report
          </span>
        </footer>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="inspection-info-item">
      <span>{label}</span>
      <strong>{value}</strong>
      <style jsx>{styles}</style>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div
      className={`summary-card ${className}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <style jsx>{styles}</style>
    </div>
  );
}

function PriorityItem({
  item,
}: {
  item: ReportItem;
}) {
  return (
    <article className="priority-item">
      <div>
        <span className="priority-category">
          {item.category_name}
        </span>

        <h3>{item.item_title}</h3>
      </div>

      <span
        className={`status ${
          item.status?.toLowerCase() ??
          'untested'
        }`}
      >
        {item.status ?? '미실행'}
      </span>

      <style jsx>{styles}</style>
    </article>
  );
}

const styles = `
* {
  box-sizing: border-box;
}

.report-page,
.report-loading {
  min-height: 100vh;
  background: #f5f7fa;
  color: #202733;
}

.report-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.primary-button {
  border: 1px solid #293545;
  background: #293545;
  color: #ffffff;
}

.report-container {
  width: min(
    1280px,
    calc(100% - 56px)
  );
  margin: auto;
  padding: 42px 0 60px;
}

.report-title-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 26px;
}

.eyebrow {
  display: block;
  margin-bottom: 7px;
  color: #8799b2;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
}

.report-title-row h1 {
  margin: 0;
  font-size: 28px;
}

.report-title-row p,
.section-heading p,
.progress-copy p {
  color: #7b8491;
  font-size: 11px;
}

.completion-badge {
  height: fit-content;
  padding: 7px 12px;
  border-radius: 999px;
  background: #f0f2f5;
  font-size: 10px;
  font-weight: 800;
}

.completion-badge.completed {
  background: #edf4f0;
  color: #587061;
}

.refresh-icon-button {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d9e0e8;
  border-radius: 8px;
  background: #ffffff;
  color: #6f7f92;
  font-size: 17px;
  cursor: pointer;
}

.refresh-icon-button:disabled {
  opacity: 0.65;
  cursor: wait;
}

.refresh-icon-button.spinning {
  animation: report-refresh-spin 0.65s linear infinite;
}

@keyframes report-refresh-spin {
  to {
    transform: rotate(360deg);
  }
}

.inspection-info-grid {
  display: grid;
  grid-template-columns:
    1.2fr
    .7fr
    .7fr
    .8fr
    1.6fr
    1fr;
  margin-bottom: 32px;
  overflow: hidden;
  border: 1px solid #dfe4ea;
  border-radius: 14px;
  background: #ffffff;
}

.inspection-info-item {
  padding: 17px 18px;
  border-right: 1px solid #e7ebef;
}

.inspection-info-item:last-child {
  border-right: 0;
}

.inspection-info-item span {
  display: block;
  margin-bottom: 7px;
  color: #939da9;
  font-size: 9px;
}

.inspection-info-item strong {
  font-size: 12px;
}

.summary-heading {
  margin-bottom: 16px;
}

.summary-heading h2 {
  margin: 0;
  font-size: 21px;
}

.summary-section {
  display: grid;
  grid-template-columns:
    1.3fr
    2fr;
  gap: 16px;
}

.progress-card {
  min-height: 200px;
  padding: 26px;
  display: flex;
  align-items: center;
  gap: 25px;
  border: 1px solid #dfe4ea;
  border-radius: 14px;
  background: #ffffff;
}

.progress-circle {
  width: 118px;
  height: 118px;
  flex: 0 0 auto;
  padding: 10px;
  border-radius: 50%;
}

.progress-circle-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #ffffff;
}

.progress-circle-inner strong {
  display: block;
  margin: 0;
  line-height: 1;
  color: #34445c;
  font-size: 25px;
  font-weight: 800;
}

.progress-copy h2 {
  margin: 0;
  font-size: 18px;
}

.text-link {
  margin-top: 13px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #416fae;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.text-link:hover {
  text-decoration: underline;
}

.result-summary-grid {
  display: grid;
  grid-template-columns:
    repeat(5, 1fr);
  gap: 10px;
}

.summary-card {
  min-height: 200px;
  padding: 22px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid #dfe4ea;
  border-radius: 14px;
  background: #ffffff;
}

.summary-card span {
  color: #838d9a;
  font-size: 10px;
  font-weight: 800;
}

.summary-card strong {
  font-size: 30px;
}

.summary-card.pass {
  background: #f3f7f5;
}

.summary-card.fail {
  background: #faf4f4;
}

.summary-card.skip {
  background: #faf7ef;
}

.summary-card.untested {
  background: #f5f6f8;
}

.report-section {
  margin-top: 28px;
  padding: 26px;
  border: 1px solid #dfe4ea;
  border-radius: 14px;
  background: #ffffff;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 18px;
}

.section-heading h2 {
  margin: 0;
  font-size: 19px;
}

.section-count {
  height: fit-content;
  padding: 6px 10px;
  border-radius: 999px;
  background: #f0f2f5;
  font-size: 10px;
  font-weight: 800;
}

.priority-list {
  display: grid;
  gap: 8px;
}

.priority-item {
  min-height: 78px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border: 1px solid #e1e6eb;
  border-radius: 11px;
  background: #fcfcfd;
}

.priority-category {
  display: block;
  margin-bottom: 7px;
  color: #8995a5;
  font-size: 9px;
  font-weight: 800;
}

.priority-item h3 {
  margin: 0;
  font-size: 14px;
}

.status {
  flex: 0 0 auto;
  padding: 6px 9px;
  border-radius: 7px;
  font-size: 9px;
  font-weight: 800;
}

.status.fail {
  background: #f9eeee;
  color: #8a5151;
}

.status.skip {
  background: #f8f3e7;
  color: #806b3c;
}

.status.untested {
  background: #f0f2f5;
  color: #808a96;
}

.priority-footer {
  display: flex;
  justify-content: flex-end;
  min-height: 34px;
}

.empty-priority {
  padding: 30px;
  text-align: center;
  color: #7d8794;
}

.empty-priority span {
  display: block;
  margin-top: 6px;
  font-size: 10px;
}

.report-footer {
  padding: 22px 2px 0;
  display: flex;
  justify-content: space-between;
  color: #9aa3ae;
  font-size: 9px;
}
`;