'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams, useRouter } from 'next/navigation';

type ResultStatus = 'PASS' | 'FAIL' | 'SKIP';

interface HistoryItem {
  id: string;
  inspection_item_id: string;
  status: ResultStatus;
  memo: string | null;
  changed_by: string;
  changed_by_name: string;
  changed_at: string;
}

interface InspectionAttachment {
  id: string;
  inspection_item_id: string;
  original_name: string;
  mime_type: string;
  file_size: string | number;
  created_at: string;
}

interface InspectionItem {
  id: string;
  inspection_id: string;
  source_test_item_id: string | null;
  tc_no: string | null;
  tc_code: string | null;
  category_name: string;
  category_sort_order: number;
  item_title: string;
  check_content: string;
  test_method: string;
  reference_note: string | null;
  item_sort_order: number;
  status: ResultStatus | null;
  memo: string | null;
  tested_by: string | null;
  tested_by_name: string | null;
  tested_at: string | null;
  result_updated_at: string | null;
  attachments: InspectionAttachment[];
  recent_history: HistoryItem[];
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
  created_at: string;
  updated_at: string;
}

interface Progress {
  total_count: number;
  tested_count: number;
  untested_count: number;
  pass_count: number;
  fail_count: number;
  skip_count: number;
  is_completed: boolean;
}

interface QaResponse {
  inspection: Inspection;
  progress: Progress;
  items: InspectionItem[];
}

interface RecentActivity {
  id: string;
  itemTitle: string;
  status: ResultStatus;
  changedByName: string;
  changedAt: string;
}

function isUuid(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

const OPERATION_STEPS_MARKER = '\n\n[조작 순서]\n';

function splitTestMethod(value: string) {
  const markerIndex = value.indexOf(OPERATION_STEPS_MARKER);

  if (markerIndex < 0) {
    return {
      description: value,
      operationSteps: '',
    };
  }

  return {
    description: value.slice(0, markerIndex),
    operationSteps: value.slice(
      markerIndex + OPERATION_STEPS_MARKER.length,
    ),
  };
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

function statusLabel(status: ResultStatus | null) {
  if (status === 'PASS') {
    return 'PASS';
  }

  if (status === 'FAIL') {
    return 'FAIL';
  }

  if (status === 'SKIP') {
    return 'SKIP';
  }

  return '미실행';
}

function formatHistoryTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatActivityTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}


function ReferenceAttachments({
  item,
  onError,
}: {
  item: InspectionItem;
  onError: (message: string) => void;
}) {
  const [imageUrls, setImageUrls] =
    useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadImages() {
      const token = localStorage.getItem(
        'qa_checker_token',
      );

      if (!token) {
        return;
      }

      const imageAttachments =
        item.attachments.filter(
          (attachment) =>
            attachment.mime_type.startsWith(
              'image/',
            ),
        );

      const nextUrls: Record<string, string> = {};

      for (const attachment of imageAttachments) {
        try {
          const response = await fetch(
            `http://127.0.0.1:3001/inspection-items/${item.id}/attachments/${attachment.id}/file`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          if (!response.ok) {
            throw new Error();
          }

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          createdUrls.push(url);
          nextUrls[attachment.id] = url;
        } catch {
          if (!cancelled) {
            onError(
              `${attachment.original_name} 이미지를 불러오지 못했습니다.`,
            );
          }
        }
      }

      if (!cancelled) {
        setImageUrls(nextUrls);
      }
    }

    void loadImages();

    return () => {
      cancelled = true;

      for (const url of createdUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [item.id]);

  async function openAttachment(
    attachment: InspectionAttachment,
  ) {
    const token = localStorage.getItem(
      'qa_checker_token',
    );

    if (!token) {
      onError(
        '로그인 정보가 없습니다. 다시 로그인해주세요.',
      );
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:3001/inspection-items/${item.id}/attachments/${attachment.id}/file`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          '참고 자료를 열지 못했습니다.',
        );
      }

      const blob = await response.blob();
      const objectUrl =
        URL.createObjectURL(blob);

      window.open(
        objectUrl,
        '_blank',
        'noopener,noreferrer',
      );

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60_000);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '참고 자료를 열지 못했습니다.',
      );
    }
  }

  function formatFileSize(
    value: string | number,
  ) {
    const bytes = Number(value);

    if (!Number.isFinite(bytes)) {
      return '-';
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  const images = item.attachments.filter(
    (attachment) =>
      attachment.mime_type.startsWith('image/'),
  );

  const documents = item.attachments.filter(
    (attachment) =>
      !attachment.mime_type.startsWith('image/'),
  );

  return (
    <div
      className="tc-content-block"
      style={{
        padding: '18px',
        border: '1px solid #cfdceb',
        borderRadius: '12px',
        background: '#f3f7fb',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '9px',
        }}
      >
        <h3 style={{ margin: 0 }}>
          참고 자료
        </h3>

        <span
          style={{
            color: '#7d8da1',
            fontSize: '9px',
          }}
        >
          테스트 수행 시 확인할 이미지 및 문서
        </span>
      </div>

      {images.length > 0 && (
        <div
          style={{
            marginTop: '13px',
            display: 'grid',
            gridTemplateColumns:
              images.length > 1
                ? 'repeat(2, minmax(0, 1fr))'
                : 'minmax(0, 1fr)',
            gap: '10px',
          }}
        >
          {images.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() =>
                openAttachment(attachment)
              }
              title="클릭하면 원본 이미지를 새 탭에서 엽니다."
              style={{
                minWidth: 0,
                padding: '9px',
                border: '1px solid #d7e1ec',
                borderRadius: '10px',
                background: '#ffffff',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '100%',
                  display: 'block',
                  overflow: 'hidden',
                  borderRadius: '7px',
                  background: '#eef2f6',
                }}
              >
                {imageUrls[attachment.id] ? (
                  <img
                    src={imageUrls[attachment.id]}
                    alt={attachment.original_name}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 'auto',
                      maxHeight: '330px',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      color: '#8b98a8',
                      fontSize: '10px',
                    }}
                  >
                    이미지 불러오는 중...
                  </span>
                )}
              </div>

              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    color: '#41536a',
                    fontSize: '10px',
                    fontWeight: 800,
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {attachment.original_name}
                </span>

                <small
                  style={{
                    flex: '0 0 auto',
                    color: '#8b98a8',
                    fontSize: '8px',
                  }}
                >
                  {formatFileSize(
                    attachment.file_size,
                  )} · 크게 보기 ↗
                </small>
              </div>
            </button>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <div
          style={{
            marginTop: images.length > 0
              ? '11px'
              : '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {documents.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() =>
                openAttachment(attachment)
              }
              title="새 탭에서 열기"
              style={{
                width: '100%',
                minHeight: '56px',
                padding: '9px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '11px',
                border: '1px solid #d6e0eb',
                borderRadius: '9px',
                background: '#ffffff',
                color: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: '40px',
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 auto',
                  borderRadius: '7px',
                  background: '#e6edf6',
                  color: '#45658d',
                  fontSize: '8px',
                  fontWeight: 900,
                  letterSpacing: '0.4px',
                }}
              >
                PDF
              </span>

              <span
                style={{
                  minWidth: 0,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <strong
                  style={{
                    overflow: 'hidden',
                    color: '#354a64',
                    fontSize: '11px',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {attachment.original_name}
                </strong>

                <small
                  style={{
                    marginTop: '3px',
                    color: '#8493a5',
                    fontSize: '9px',
                  }}
                >
                  {formatFileSize(
                    attachment.file_size,
                  )}
                </small>
              </span>

              <span
                style={{
                  flex: '0 0 auto',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  background: '#edf3f9',
                  color: '#3f6797',
                  fontSize: '9px',
                  fontWeight: 900,
                }}
              >
                열기 ↗
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InspectionExecutionPage() {
  const router = useRouter();
  const params = useParams();

  const inspectionId = isUuid(params?.inspectionId)
    ? params.inspectionId
    : null;

  const [qa, setQa] = useState<QaResponse | null>(null);

  const [selectedItemId, setSelectedItemId] =
    useState<string | null>(null);

  const [draftStatus, setDraftStatus] =
    useState<ResultStatus | null>(null);

  const [draftMemo, setDraftMemo] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [isProgressOpen, setIsProgressOpen] =
    useState(false);

  const [collapsedCategories, setCollapsedCategories] =
    useState<Record<string, boolean>>({});

  const progressOverlayRef =
    useRef<HTMLDivElement | null>(null);

  const progressButtonRef =
    useRef<HTMLButtonElement | null>(null);

  const progressCloseTimerRef =
    useRef<number | null>(null);

  const executionDetailRef =
    useRef<HTMLElement | null>(null);

  async function fetchInspection(
    targetInspectionId: string,
    keepSelectedItemId?: string | null,
    refreshing = false,
  ) {
    if (!isUuid(targetInspectionId)) {
      return false;
    }

    const token = localStorage.getItem(
      'qa_checker_token',
    );

    if (!token) {
      router.replace('/');
      return false;
    }

    if (refreshing) {
      setIsRefreshing(true);
    }

    try {
      setErrorMessage('');

      const response = await fetch(
        `http://127.0.0.1:3001/inspections/${targetInspectionId}/items`,
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
            '테스트 정보를 불러오지 못했습니다.',
        );
      }

      const qaData = data as QaResponse;

      setQa(qaData);

      const nextSelectedId =
        keepSelectedItemId &&
        qaData.items.some(
          (item) => item.id === keepSelectedItemId,
        )
          ? keepSelectedItemId
          : qaData.items[0]?.id ?? null;

      setSelectedItemId(nextSelectedId);

      const selected = qaData.items.find(
        (item) => item.id === nextSelectedId,
      );

      setDraftStatus(selected?.status ?? null);
      setDraftMemo(selected?.memo ?? '');
      setIsDirty(false);

      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '테스트를 불러오는 중 오류가 발생했습니다.',
      );

      return false;
    } finally {
      setIsLoading(false);

      if (refreshing) {
        window.setTimeout(() => {
          setIsRefreshing(false);
        }, 350);
      }
    }
  }

  useEffect(() => {
    if (!inspectionId) {
      return;
    }

    let cancelled = false;

    async function load() {
      if (cancelled) {
        return;
      }

      await fetchInspection(inspectionId);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [inspectionId]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!isProgressOpen) {
        return;
      }

      const target = event.target as Node;

      if (
        progressOverlayRef.current?.contains(target) ||
        progressButtonRef.current?.contains(target)
      ) {
        return;
      }

      setIsProgressOpen(false);
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      );
    };
  }, [isProgressOpen]);

  useEffect(() => {
    return () => {
      if (progressCloseTimerRef.current) {
        window.clearTimeout(
          progressCloseTimerRef.current,
        );
      }
    };
  }, []);

  const selectedItem = useMemo(() => {
    if (!qa || !selectedItemId) {
      return null;
    }

    return (
      qa.items.find(
        (item) => item.id === selectedItemId,
      ) ?? null
    );
  }, [qa, selectedItemId]);

  const selectedIndex = useMemo(() => {
    if (!qa || !selectedItemId) {
      return -1;
    }

    return qa.items.findIndex(
      (item) => item.id === selectedItemId,
    );
  }, [qa, selectedItemId]);

  const categories = useMemo(() => {
    if (!qa) {
      return [];
    }

    const map = new Map<string, InspectionItem[]>();

    for (const item of qa.items) {
      const existing =
        map.get(item.category_name) ?? [];

      existing.push(item);
      map.set(item.category_name, existing);
    }

    return Array.from(map.entries()).map(
      ([name, items]) => ({
        name,
        items,
      }),
    );
  }, [qa]);

  const recentActivity = useMemo<RecentActivity[]>(() => {
    if (!qa) {
      return [];
    }

    const activity: RecentActivity[] = [];

    for (const item of qa.items) {
      for (const history of item.recent_history) {
        activity.push({
          id: history.id,
          itemTitle: item.item_title,
          status: history.status,
          changedByName: history.changed_by_name,
          changedAt: history.changed_at,
        });
      }
    }

    activity.sort(
      (a, b) =>
        new Date(b.changedAt).getTime() -
        new Date(a.changedAt).getTime(),
    );

    return activity.slice(0, 5);
  }, [qa]);

  const progressPercent = useMemo(() => {
    if (!qa || qa.progress.total_count === 0) {
      return 0;
    }

    return Math.round(
      (qa.progress.tested_count /
        qa.progress.total_count) *
        100,
    );
  }, [qa]);

  function clearProgressCloseTimer() {
    if (progressCloseTimerRef.current) {
      window.clearTimeout(
        progressCloseTimerRef.current,
      );

      progressCloseTimerRef.current = null;
    }
  }

  function startProgressCloseTimer() {
    clearProgressCloseTimer();

    progressCloseTimerRef.current =
      window.setTimeout(() => {
        setIsProgressOpen(false);
      }, 7000);
  }

  function toggleProgressOverlay() {
    if (isProgressOpen) {
      clearProgressCloseTimer();
      setIsProgressOpen(false);
      return;
    }

    setIsProgressOpen(true);
    startProgressCloseTimer();
  }

  function toggleCategory(categoryName: string) {
    setCollapsedCategories((current) => ({
      ...current,
      [categoryName]: !current[categoryName],
    }));
  }

  async function saveCurrentResult() {
    if (
      !selectedItem ||
      !draftStatus ||
      !isDirty
    ) {
      return true;
    }

    const token = localStorage.getItem(
      'qa_checker_token',
    );

    if (!token) {
      router.replace('/');
      return false;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const response = await fetch(
        `http://127.0.0.1:3001/inspection-items/${selectedItem.id}/result`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: draftStatus,
            memo: draftMemo,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ??
            '테스트 결과를 저장하지 못했습니다.',
        );
      }

      if (inspectionId) {
        await fetchInspection(
          inspectionId,
          selectedItem.id,
        );
      }

      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '테스트 결과 저장 중 오류가 발생했습니다.',
      );

      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function setItemDraft(item: InspectionItem) {
    setSelectedItemId(item.id);
    setDraftStatus(item.status);
    setDraftMemo(item.memo ?? '');
    setIsDirty(false);

    window.requestAnimationFrame(() => {
      const detail = executionDetailRef.current;

      if (!detail) {
        return;
      }

      const top =
        detail.getBoundingClientRect().top +
        window.scrollY -
        88;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: 'auto',
      });
    });
  }

  async function moveToItem(item: InspectionItem) {
    if (item.id === selectedItemId) {
      return;
    }

    const saved = await saveCurrentResult();

    if (!saved) {
      return;
    }

    setItemDraft(item);
  }

  async function handlePrevious() {
    if (!qa || selectedIndex <= 0) {
      return;
    }

    const saved = await saveCurrentResult();

    if (!saved) {
      return;
    }

    setItemDraft(
      qa.items[selectedIndex - 1],
    );
  }

  async function handleNext() {
    if (!qa || selectedIndex < 0) {
      return;
    }

    const saved = await saveCurrentResult();

    if (!saved) {
      return;
    }

    if (
      selectedIndex <
      qa.items.length - 1
    ) {
      setItemDraft(
        qa.items[selectedIndex + 1],
      );
    }
  }

  async function handleRefresh() {
    if (!inspectionId) {
      return;
    }

    const saved = await saveCurrentResult();

    if (!saved) {
      return;
    }

    await fetchInspection(
      inspectionId,
      selectedItemId,
      true,
    );
  }

  async function handleNavigate(path: string) {
    if (isLeaving) {
      return;
    }

    const saved = await saveCurrentResult();

    if (!saved) {
      return;
    }

    setIsLeaving(true);
    router.push(path);
  }

  function selectStatus(status: ResultStatus) {
    setDraftStatus(status);
    setIsDirty(true);
  }

  if (!inspectionId) {
    return (
      <main className="execution-loading">
        잘못된 테스트 주소입니다.
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="execution-loading">
        테스트 정보를 불러오는 중...
      </main>
    );
  }

  if (errorMessage && !qa) {
    return (
      <main className="execution-loading">
        <div className="dashboard-error">
          {errorMessage}
        </div>
      </main>
    );
  }

  if (!qa) {
    return null;
  }

  return (
    <main className="execution-page">
      <header className="execution-header">
        <button
          type="button"
          className="execution-brand brand-home-button"
          onClick={() =>
            handleNavigate('/dashboard')
          }
          disabled={isLeaving}
          aria-label="메인 화면으로 이동"
        >
          <div className="brand-mark">
            Q
          </div>

          <div>
            <h1>QA Checker</h1>
            <p>QA 실행</p>
          </div>
        </button>

        <div className="execution-header-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={isLeaving}
            onClick={() =>
              handleNavigate(
                `/projects/${qa.inspection.project_id}`,
              )
            }
          >
            ↩ 이전
          </button>
        </div>
      </header>

      <section className="inspection-info-bar">
        <div className="inspection-info-item">
          <span className="inspection-info-label">
            프로젝트
          </span>

          <strong>
            {qa.inspection.project_name}
          </strong>
        </div>

        <div className="inspection-info-item">
          <span className="inspection-info-label">
            버전
          </span>

          <strong>
            {qa.inspection.version}
          </strong>
        </div>

        <div className="inspection-info-item">
          <span className="inspection-info-label">
            플랫폼
          </span>

          <strong>
            {qa.inspection.platform === 'IOS'
              ? 'iOS'
              : 'Android'}
          </strong>
        </div>

        <div className="inspection-info-item">
          <span className="inspection-info-label">
            테스트 유형
          </span>

          <strong>
            {inspectionTypeLabel(
              qa.inspection.inspection_type,
            )}
          </strong>
        </div>

        <div className="inspection-info-item inspection-device-info">
          <span className="inspection-info-label">
            테스트 기종
          </span>

          <strong>
            {qa.inspection.test_devices || '-'}
          </strong>
        </div>

        <div className="inspection-progress-block">
          <div className="inspection-progress-content">
            <span className="inspection-info-label">
              진행률
            </span>

            <strong className="inspection-progress-value">
              {qa.progress.tested_count} /{' '}
              {qa.progress.total_count}{' '}
              <span>
                ({progressPercent}%)
              </span>
            </strong>

            <div className="inspection-progress-track">
              <div
                className="inspection-progress-fill"
                style={{
                  width: `${progressPercent}%`,
                }}
              />
            </div>
          </div>

          <div className="progress-overlay-anchor">
            <button
              ref={progressButtonRef}
              type="button"
              className={`progress-chart-button ${
                isProgressOpen ? 'active' : ''
              }`}
              onClick={toggleProgressOverlay}
              aria-label="진행 현황 보기"
              title="진행 현황"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M12 3a9 9 0 1 0 9 9h-9V3Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d="M15 3.6A9 9 0 0 1 20.4 9H15V3.6Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {isProgressOpen && (
              <div
                ref={progressOverlayRef}
                className="progress-overlay"
                onMouseEnter={clearProgressCloseTimer}
                onMouseLeave={startProgressCloseTimer}
                onMouseMove={clearProgressCloseTimer}
              >
                <div className="progress-overlay-section">
                  <div
                    className="progress-circle"
                    style={{
                      background: `conic-gradient(
                        #5f7f6d 0% ${progressPercent}%,
                        #e5e7eb ${progressPercent}% 100%
                      )`,
                    }}
                  >
                    <div className="progress-circle-inner">
                      <strong>
                        {progressPercent}%
                      </strong>

                      <span>진행률</span>
                    </div>
                  </div>
                </div>

                <div className="progress-activity-section">
                  <h3>최근 활동</h3>

                  {recentActivity.length === 0 ? (
                    <div className="activity-empty">
                      아직 저장된 활동이 없습니다.
                    </div>
                  ) : (
                    <div className="activity-list">
                      {recentActivity.map(
                        (activity) => (
                          <div
                            key={activity.id}
                            className="activity-item"
                          >
                            <span
                              className={`activity-status ${activity.status.toLowerCase()}`}
                            >
                              {activity.status}
                            </span>

                            <div className="activity-copy">
                              <strong>
                                {activity.itemTitle}
                              </strong>

                              <span>
                                {
                                  activity.changedByName
                                }{' '}
                                ·{' '}
                                {formatActivityTime(
                                  activity.changedAt,
                                )}
                              </span>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isLeaving || isSaving}
            onClick={() =>
              handleNavigate(
                `/reports/inspections/${qa.inspection.id}`,
              )
            }
            style={{
              minWidth: '126px',
              height: '40px',
              padding: '0 16px',
              border: '1px solid #9fc5e8',
              borderRadius: '9px',
              background: '#dceeff',
              color: '#285f92',
              fontSize: '12px',
              fontWeight: 800,
              cursor:
                isLeaving || isSaving
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                isLeaving || isSaving
                  ? 0.6
                  : 1,
              whiteSpace: 'nowrap',
            }}
          >
            결과 보기
          </button>
        </div>
      </section>

      {qa.items.length === 0 ? (
        <section className="execution-empty">
          <h2>
            이 테스트에는 TC가 없습니다.
          </h2>

          <p>
            TC가 등록되기 전에 추가된 테스트입니다.
          </p>
        </section>
      ) : (
        <section className="execution-layout">
          <aside className="execution-sidebar">
            <div className="sidebar-title">
              <div>
                <strong>테스트 항목</strong>

                <span>
                  {qa.progress.tested_count}/
                  {qa.progress.total_count}
                </span>
              </div>

              <button
                type="button"
                className={`sidebar-refresh-button ${
                  isRefreshing
                    ? 'refreshing'
                    : ''
                }`}
                disabled={
                  isRefreshing ||
                  isSaving ||
                  isLeaving
                }
                onClick={handleRefresh}
                aria-label="테스트 항목 새로고침"
                title="새로고침"
              >
                <svg
                  className="sidebar-refresh-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M20 11a8 8 0 1 0-2.34 5.66"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />

                  <path
                    d="M20 4v7h-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className="category-tree">
              {categories.map((category) => {
                const isCollapsed =
                  collapsedCategories[
                    category.name
                  ] ?? false;

                return (
                  <section
                    key={category.name}
                    className="tree-category"
                  >
                    <button
                      type="button"
                      className="tree-category-title"
                      onClick={() =>
                        toggleCategory(
                          category.name,
                        )
                      }
                    >
                      <span
                        className={`tree-category-arrow ${
                          isCollapsed
                            ? 'collapsed'
                            : ''
                        }`}
                      >
                        ▾
                      </span>

                      <span>
                        {category.name}
                      </span>

                      <span className="tree-category-count">
                        {
                          category.items.filter(
                            (item) =>
                              item.status !== null,
                          ).length
                        }
                        /
                        {category.items.length}
                      </span>
                    </button>

                    {!isCollapsed &&
                      category.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`tree-item ${
                            item.id === selectedItemId
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            moveToItem(item)
                          }
                        >
                          <span
                            className={`tree-status ${
                              item.status
                                ? item.status.toLowerCase()
                                : 'untested'
                            }`}
                          />

                          <span>
                            {item.item_title}
                          </span>
                        </button>
                      ))}
                  </section>
                );
              })}
            </div>
          </aside>

          {selectedItem && (
            <section
              ref={executionDetailRef}
              className="execution-detail"
            >
              {selectedItem.status && (
                <div
                  className={`saved-result-panel ${selectedItem.status.toLowerCase()}`}
                >
                  <div>
                    <span>현재 결과</span>

                    <strong>
                      {statusLabel(
                        selectedItem.status,
                      )}
                    </strong>
                  </div>

                  <div className="saved-result-history">
                    {selectedItem.recent_history.length >
                    0 ? (
                      selectedItem.recent_history
                        .slice(0, 2)
                        .map((history) => (
                          <span key={history.id}>
                            {history.changed_by_name}{' '}
                            {formatHistoryTime(
                              history.changed_at,
                            )}
                          </span>
                        ))
                    ) : (
                      <span>
                        저장된 이력 없음
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="tc-heading">
                <span>
                  {selectedItem.tc_code ?? 'TC-----'} ·{' '}
                  {selectedIndex + 1} / {qa.items.length}
                </span>

                <h2>
                  {selectedItem.item_title}
                </h2>
              </div>

              <div className="tc-content-block">
                <h3>확인 내용</h3>

                {selectedItem.category_name ===
                  'iOS 검수' && (
                  <div
                    style={{
                      margin: '0 0 10px',
                      padding: '9px 11px',
                      border: '1px solid #efc1c1',
                      borderRadius: '7px',
                      background: '#fff5f5',
                      color: '#b33f3f',
                      fontSize: '10px',
                      fontWeight: 900,
                      lineHeight: 1.5,
                    }}
                  >
                    #마켓 검수 사항으로 필수 대응 필요#
                  </div>
                )}

                <p>
                  {selectedItem.check_content}
                </p>
              </div>

              <div className="tc-content-block">
                <h3>테스트 방법</h3>

                <div className="test-method-text">
                  {
                    splitTestMethod(
                      selectedItem.test_method,
                    ).description
                  }
                </div>
              </div>

              {splitTestMethod(
                selectedItem.test_method,
              ).operationSteps && (
                <div className="tc-content-block">
                  <h3>조작 순서</h3>

                  <div
                    style={{
                      marginTop: '8px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: '#f3f7fb',
                      color: '#3f648c',
                      fontWeight: 700,
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {
                      splitTestMethod(
                        selectedItem.test_method,
                      ).operationSteps
                    }
                  </div>
                </div>
              )}

              {selectedItem.attachments?.length > 0 && (
                <ReferenceAttachments
                  item={selectedItem}
                  onError={setErrorMessage}
                />
              )}


              {selectedItem.reference_note && (
                <div className="tc-content-block reference">
                  <h3>
                    참고 / 판단 기준
                  </h3>

                  <p>
                    {selectedItem.reference_note}
                  </p>
                </div>
              )}

              <div className="result-editor">
                <div>
                  <h3>테스트 결과</h3>

                  <p>
                    결과를 선택한 뒤 다음 항목으로
                    이동하면 저장됩니다.
                  </p>
                </div>

                <div className="result-buttons">
                  <button
                    type="button"
                    className={`result-button pass ${
                      draftStatus === 'PASS'
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      selectStatus('PASS')
                    }
                  >
                    PASS
                  </button>

                  <button
                    type="button"
                    className={`result-button fail ${
                      draftStatus === 'FAIL'
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      selectStatus('FAIL')
                    }
                  >
                    FAIL
                  </button>

                  <button
                    type="button"
                    className={`result-button skip ${
                      draftStatus === 'SKIP'
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      selectStatus('SKIP')
                    }
                  >
                    SKIP
                  </button>
                </div>

                <label className="result-memo">
                  메모

                  <textarea
                    value={draftMemo}
                    onChange={(event) => {
                      setDraftMemo(
                        event.target.value,
                      );

                      setIsDirty(true);
                    }}
                    maxLength={500}
                    placeholder="필요한 경우 메모를 입력하세요."
                  />
                </label>
              </div>

              {errorMessage && (
                <div className="login-error execution-error">
                  {errorMessage}
                </div>
              )}

              <div className="execution-navigation">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    selectedIndex <= 0 ||
                    isSaving
                  }
                  onClick={handlePrevious}
                >
                  ← 이전
                </button>

                <span>
                  {isSaving
                    ? '저장 중...'
                    : isDirty
                      ? '변경사항 있음'
                      : '저장됨'}
                </span>

                <button
                  type="button"
                  className="primary-button"
                  disabled={isSaving}
                  onClick={handleNext}
                >
                  {selectedIndex ===
                  qa.items.length - 1
                    ? '저장'
                    : '다음 →'}
                </button>
              </div>
            </section>
          )}
        </section>
      )}
    </main>
  );
}