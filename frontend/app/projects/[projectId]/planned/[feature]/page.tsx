'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppSidebar, { SidebarUser } from '../../../../components/AppSidebar';
import UiIcon from '../../../../components/UiIcon';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

interface Project {
  id: string;
  name: string;
  is_active: boolean;
}

type PlannedFeature = {
  eyebrow: string;
  title: string;
  description: string;
  icon: 'issue' | 'test' | 'calendar' | 'files';
  purpose: string;
  directions: string[];
  preview: { title: string; description: string }[];
  integrations: string[];
};

const FEATURES: Record<string, PlannedFeature> = {
  issues: {
    eyebrow: 'ISSUE OVERVIEW',
    title: '이슈 현황',
    description:
      'Jira를 대체하지 않고, 프로젝트에서 발생한 주요 이슈와 상태를 QA 관점에서 한 화면에 요약하는 기능입니다.',
    icon: 'issue',
    purpose:
      '여러 이슈가 외부 도구에 흩어져 있을 때 QA 리더와 구성원이 현재 위험 요소와 대응 우선순위를 빠르게 파악할 수 있도록 합니다.',
    directions: [
      'Jira 이슈 상태와 우선순위 요약',
      'OPEN / IN PROGRESS / RESOLVED 등 주요 상태 집계',
      '빌드·QA 일정에 영향을 주는 핵심 이슈 강조',
      '최근 변경 이슈 및 담당 상태 표시',
      '원본 Jira 이슈로 바로 이동',
    ],
    preview: [
      { title: '상태 요약', description: '열린 이슈, 진행 중 이슈, 해결 이슈를 프로젝트 기준으로 요약' },
      { title: '주요 이슈', description: 'QA 일정과 출시 위험에 영향을 주는 핵심 이슈 우선 노출' },
      { title: '최근 업데이트', description: '상태·우선순위·담당 변경 등 최근 변동 정보 확인' },
    ],
    integrations: ['Jira', '외부 이슈 트래커'],
  },
  'test-management': {
    eyebrow: 'TEST MANAGEMENT',
    title: '테스트 관리',
    description:
      '기능 테스트, 회귀 테스트, 마켓 검수 등 프로젝트에서 진행되는 QA 업무를 외부 도구와 연결해 한 화면에서 확인하는 기능입니다.',
    icon: 'test',
    purpose:
      'TC 자체를 다시 작성하는 도구가 아니라, 여러 문서와 시스템에서 진행되는 테스트의 전체 진행 상태를 QA 리더 관점에서 통합해 보여주는 것을 목표로 합니다.',
    directions: [
      'Google Sheets 기반 테스트 진행표 연동',
      'Jira의 테스트·검증 관련 이슈 상태 연동',
      '테스트별 진행률 및 PASS / FAIL 요약',
      '기능 QA / 회귀 QA / 마켓 검수 등 업무 단위 구분',
      '최근 변경 내역 및 외부 원본 바로가기',
    ],
    preview: [
      { title: '진행 중 테스트', description: '현재 수행 중인 테스트 종류와 진행률, 상태를 한 화면에서 확인' },
      { title: '최근 업데이트', description: 'FAIL 증가, 완료율 변경 등 QA 진행 변화를 빠르게 확인' },
      { title: '외부 도구 연결', description: '연결된 Sheet·Jira 원본으로 바로 이동' },
    ],
    integrations: ['Google Sheets', 'Jira'],
  },
  'schedule-management': {
    eyebrow: 'SCHEDULE MANAGEMENT',
    title: '일정 관리',
    description:
      'QA 시작, 빌드 전달, 납품, 마켓 제출, 출시 등 프로젝트의 주요 QA 일정을 한 화면에서 관리하는 기능입니다.',
    icon: 'calendar',
    purpose:
      'QA 일정이 캘린더·시트·메신저 등에 흩어지는 문제를 줄이고, 현재 프로젝트에서 무엇이 언제 예정되어 있는지 빠르게 판단할 수 있도록 합니다.',
    directions: [
      'Google Calendar 또는 일정 Sheet 연동',
      'QA 시작 / 빌드 전달 / 납품 / 마켓 제출 / 출시 일정 표시',
      'D-Day 기준으로 임박 일정 강조',
      '일정 변경 내역 및 최근 업데이트 표시',
      '관련 빌드·테스트 정보와 연결',
    ],
    preview: [
      { title: '주요 마일스톤', description: 'QA와 출시 과정의 핵심 일정을 시간순으로 확인' },
      { title: '다가오는 일정', description: 'D-Day 기준으로 임박한 일정 우선 노출' },
      { title: '일정 변경', description: '일정 이동이나 신규 일정 등 최근 변동 사항 확인' },
    ],
    integrations: ['Google Calendar', 'Google Sheets'],
  },
  resources: {
    eyebrow: 'PROJECT RESOURCES',
    title: '제반 자료 관리',
    description:
      '프로젝트 문서, 기획서, 정책, QA 참고 자료 등 흩어진 업무 자료를 연결해 필요한 정보를 빠르게 찾는 기능입니다.',
    icon: 'files',
    purpose:
      '문서를 QA Checker 안에 다시 작성하는 것이 아니라 기존 문서 시스템을 유지하면서, QA 업무에 필요한 자료의 위치와 용도를 프로젝트 단위로 정리합니다.',
    directions: [
      'Google Drive / Docs 문서 연결',
      'Confluence·Notion 등 외부 문서 바로가기',
      '기획 / 정책 / QA 참고 / 운영 자료 등 유형별 분류',
      'QA 리더가 구성원에게 필요한 자료를 선별해 노출',
      '최근 추가·변경 자료 표시',
    ],
    preview: [
      { title: '주요 자료', description: '현재 QA 수행에 필요한 핵심 문서와 참고 자료 우선 노출' },
      { title: '자료 분류', description: '기획·정책·QA 참고·운영 문서를 목적별로 구분' },
      { title: '외부 원본', description: '권한이 있는 사용자가 원본 문서로 바로 이동' },
    ],
    integrations: ['Google Drive', 'Google Docs', 'Confluence', 'Notion'],
  },
};

export default function PlannedFeaturePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.projectId);
  const featureKey = String(params.feature);

  const [user, setUser] = useState<SidebarUser | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const feature = useMemo(() => FEATURES[featureKey] ?? null, [featureKey]);

  useEffect(() => {
    const storedUser = localStorage.getItem('qa_checker_user');
    const token = localStorage.getItem('qa_checker_token');

    if (!storedUser || !token) {
      router.replace('/');
      return;
    }

    setUser(JSON.parse(storedUser));

    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          setProject(data.find((item: Project) => item.id === projectId) ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, router]);

  if (!feature) {
    return (
      <main className="execution-loading">
        존재하지 않는 기능 안내 페이지입니다.
      </main>
    );
  }

  if (!user || loading) {
    return <main className="execution-loading">화면을 불러오는 중...</main>;
  }

  return (
    <main className="app-shell">
      <AppSidebar
        user={user}
        activeMenu="project"
        currentProjectId={projectId}
        onNavigate={(path) => router.push(path)}
      />

      <section className="app-main workspace-main">
        <div className="workspace-page planned-feature-page">
          <section className="workspace-hero project workspace-hero-with-back">
            <button
              type="button"
              className="workspace-back-circle"
              onClick={() => router.push(`/projects/${projectId}`)}
              aria-label="Project Workspace로 돌아가기"
              title="Project Workspace"
            >
              <UiIcon name="back" size={22} strokeWidth={2.2} />
            </button>

            <div className="workspace-hero-copy">
              <span className="workspace-eyebrow">{feature.eyebrow}</span>
              <div className="planned-title-row">
                <span className="planned-title-icon">
                  <UiIcon name={feature.icon} size={21} />
                </span>
                <h1>{feature.title}</h1>
                <span className="planned-page-badge">구현 예정</span>
              </div>
              <p>{project?.name ?? '프로젝트'} · {feature.description}</p>
            </div>
          </section>

          <section className="planned-intro-card">
            <span className="planned-section-kicker">WHY</span>
            <h2>이 기능이 필요한 이유</h2>
            <p>{feature.purpose}</p>
          </section>

          <div className="planned-feature-grid">
            <section className="planned-direction-card">
              <span className="planned-section-kicker">IMPLEMENTATION DIRECTION</span>
              <h2>구현 방향</h2>
              <div className="planned-direction-list">
                {feature.directions.map((item, index) => (
                  <div className="planned-direction-item" key={item}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="planned-integration-card">
              <span className="planned-section-kicker">INTEGRATION</span>
              <h2>연동 대상</h2>
              <div className="planned-integration-tags">
                {feature.integrations.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <p>
                기존 업무 도구를 대체하기보다 필요한 정보를 연결해 QA Workspace에서
                빠르게 확인하는 방향으로 설계합니다.
              </p>
            </section>
          </div>

          <section className="planned-preview-card">
            <div className="planned-preview-heading">
              <div>
                <span className="planned-section-kicker">EXPECTED VIEW</span>
                <h2>예상 화면 구성</h2>
              </div>
              <span>Concept</span>
            </div>

            <div className="planned-preview-grid">
              {feature.preview.map((item) => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <button
            type="button"
            className="planned-return-button"
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            <UiIcon name="back" size={16} />
            Project Workspace로 돌아가기
          </button>
        </div>
      </section>
    </main>
  );
}
