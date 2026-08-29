'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type ResultStatus = 'PASS' | 'FAIL' | 'SKIP' | null;

interface ReportItem {
  inspection_item_id: string;
  category_name: string;
  category_sort_order: number;
  item_title: string;
  check_content: string;
  test_method: string;
  reference_note: string;
  item_sort_order: number;
  status: ResultStatus;
  memo: string | null;
  tested_by_name: string | null;
  tested_at: string | null;
}

interface ReportData {
  inspection: {
    id: string;
    project_name: string;
    platform: 'IOS' | 'ANDROID';
    version: string;
    inspection_type: string;
    test_devices: string;
  };
  summary: {
    total_count: number;
  };
  all_results: ReportItem[];
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

export default function AllResultsPage() {
  const router = useRouter();
  const params = useParams();

  const inspectionId = Array.isArray(params.inspectionId)
    ? params.inspectionId[0]
    : params.inspectionId;

  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadReport = useCallback(async () => {
    if (!inspectionId) return;

    const token = localStorage.getItem('qa_checker_token');

    if (!token) {
      router.replace('/');
      return;
    }

    const response = await fetch(
      `http://127.0.0.1:3001/reports/inspections/${inspectionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      },
    );

    if (response.status === 401) {
      localStorage.removeItem('qa_checker_token');
      localStorage.removeItem('qa_checker_user');
      router.replace('/');
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      setIsLoading(false);
      return;
    }

    setReport(data);
    setIsLoading(false);
  }, [inspectionId, router]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const groups = useMemo(() => {
    if (!report) return [];

    const map = new Map<string, ReportItem[]>();

    report.all_results.forEach((item) => {
      const items = map.get(item.category_name) ?? [];
      items.push(item);
      map.set(item.category_name, items);
    });

    return Array.from(map.entries()).map(
      ([categoryName, items]) => ({
        categoryName,
        items,
      }),
    );
  }, [report]);

  if (isLoading || !report) {
    return <main className="loading">불러오는 중...</main>;
  }

  return (
    <main className="page">
      <header className="execution-header no-print">
        <button
          type="button"
          className="execution-brand brand-home-button"
          onClick={() => router.push('/dashboard')}
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
              router.push(`/reports/inspections/${inspectionId}`)
            }
          >
            ↩ 이전
          </button>
        </div>
      </header>

      <section className="container">
        <div className="title-row">
          <div className="title">
            <span>ALL RESULTS</span>
            <h1>전체 항목 결과</h1>

            <p>
            {report.inspection.project_name} ·{' '}
            {report.inspection.platform === 'IOS'
              ? 'iOS'
              : 'Android'}{' '}
            · {report.inspection.version}
            </p>
          </div>

          <button
            type="button"
            className="pdf"
            onClick={() => window.print()}
          >
            PDF 저장
          </button>
        </div>

        <div className="summary">
          전체 {report.summary.total_count}개 항목
        </div>

        {groups.map((group) => (
          <section
            key={group.categoryName}
            className="category"
          >
            <div className="category-title">
              <strong>{group.categoryName}</strong>
              <span>{group.items.length}개 항목</span>
            </div>

            <div className="result-list">
              {group.items.map((item) => (
                <div
                  key={item.inspection_item_id}
                  className="result-row"
                >
                  <div className="result-main">
                    <strong>{item.item_title}</strong>

                    <div className="result-meta">
                      <span>
                        {item.tested_by_name || '-'} · {formatDate(item.tested_at)}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`status ${
                      item.status?.toLowerCase() ?? 'untested'
                    }`}
                  >
                    {item.status ?? '미실행'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
* {
  box-sizing: border-box;
}

.page,
.loading {
  min-height: 100vh;
  background: #f5f7fa;
  color: #202733;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.pdf {
  height: 38px;
  padding: 0 17px;
  border: 0;
  border-radius: 8px;
  background: #293545;
  color: white;
  font-weight: 800;
  cursor: pointer;
}

.container {
  width: min(1180px, calc(100% - 56px));
  margin: auto;
  padding: 38px 0 60px;
}

.title span {
  color: #8799b2;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
}

.title h1 {
  margin: 7px 0;
  font-size: 27px;
}

.title p {
  margin: 0;
  color: #7b8491;
  font-size: 11px;
}

.summary {
  margin: 26px 0 14px;
  color: #707b89;
  font-size: 11px;
  font-weight: 800;
}

.category {
  margin-bottom: 22px;
  overflow: hidden;
  border: 1px solid #dfe4ea;
  border-radius: 14px;
  background: white;
}

.category-title {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  background: #f7f8fa;
}

.category-title strong {
  font-size: 13px;
}

.category-title span {
  color: #939da9;
  font-size: 9px;
}

.result-list {
  border-top: 1px solid #e6eaee;
}

.result-row {
  min-height: 72px;
  padding: 15px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #edf0f3;
}

.result-row:last-child {
  border-bottom: 0;
}

.result-main {
  min-width: 0;
  flex: 1;
}

.result-main > strong {
  display: block;
  color: #2d3745;
  font-size: 13px;
}

.result-meta {
  margin-top: 7px;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  color: #8c95a2;
  font-size: 9px;
}

.item {
  padding: 22px;
  border-top: 1px solid #e6eaee;
}

.item-heading {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.item-heading h2 {
  margin: 0;
  font-size: 15px;
}

.status {
  height: fit-content;
  padding: 6px 9px;
  border-radius: 7px;
  font-size: 9px;
  font-weight: 800;
}

.status.pass {
  background: #edf5f0;
  color: #56705e;
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

.block {
  margin-top: 18px;
}

.block strong,
.memo strong {
  color: #8d97a5;
  font-size: 9px;
}

.block p,
.memo p {
  margin: 7px 0 0;
  color: #586371;
  font-size: 11px;
  line-height: 1.75;
  white-space: pre-line;
}

.memo {
  margin-top: 18px;
  padding: 13px;
  border-radius: 8px;
  background: #f4f6f8;
}

.meta {
  margin-top: 18px;
  padding-top: 13px;
  display: flex;
  gap: 24px;
  border-top: 1px solid #eceff2;
  color: #8c95a2;
  font-size: 9px;
}

@media print {
  .no-print {
    display: none !important;
  }

  .page {
    background: white;
  }

  .container {
    width: 100%;
    padding: 0;
  }

  .category,
  .item {
    break-inside: avoid;
  }
}
`;