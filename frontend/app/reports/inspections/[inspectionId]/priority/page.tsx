'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface ReportItem {
  inspection_item_id: string;
  category_name: string;
  item_title: string;
  check_content: string;
  test_method: string;
  reference_note: string;
  status: 'FAIL' | 'SKIP';
  memo: string | null;
  tested_by_name: string | null;
  tested_at: string | null;
}

interface ReportData {
  inspection: {
    project_name: string;
    platform: 'IOS' | 'ANDROID';
    version: string;
  };
  priority_items: ReportItem[];
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

export default function PriorityResultsPage() {
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
            <span>FAIL / SKIP RESULTS</span>

            <h1>FAIL / SKIP 전체 항목</h1>

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

        <div className="count">
          총 {report.priority_items.length}건
        </div>

        {report.priority_items.length === 0 ? (
          <div className="empty">
            FAIL 또는 SKIP 항목이 없습니다.
          </div>
        ) : (
          <div className="list">
            {report.priority_items.map((item) => (
              <article
                key={item.inspection_item_id}
                className="item compact-item"
              >
                <div className="heading">
                  <div>
                    <span>{item.category_name}</span>
                    <h2>{item.item_title}</h2>
                  </div>

                  <strong
                    className={`status ${item.status.toLowerCase()}`}
                  >
                    {item.status}
                  </strong>
                </div>

                <div className="memo compact-memo">
                  <strong>결과 메모</strong>
                  <p>{item.memo || '메모 없음'}</p>
                </div>

                <div className="meta">
                  <span>
                    {item.tested_by_name || '-'} · {formatDate(item.tested_at)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
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
  width: min(1120px, calc(100% - 56px));
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

.count {
  margin: 26px 0 14px;
  color: #727d89;
  font-size: 11px;
  font-weight: 800;
}

.list {
  display: grid;
  gap: 14px;
}

.compact-item {
  padding: 20px 22px;
}

.compact-memo {
  margin-top: 14px;
}

.item {
  padding: 24px;
  border: 1px solid #dfe4ea;
  border-radius: 14px;
  background: white;
}

.heading {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.heading span {
  color: #8995a5;
  font-size: 9px;
  font-weight: 800;
}

.heading h2 {
  margin: 7px 0 0;
  font-size: 16px;
}

.status {
  height: fit-content;
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

.empty {
  padding: 45px;
  border: 1px dashed #d7dde5;
  border-radius: 14px;
  background: white;
  color: #7d8794;
  text-align: center;
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

  .item {
    break-inside: avoid;
  }
}
`;