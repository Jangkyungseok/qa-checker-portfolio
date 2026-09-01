'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppSidebar, {
  SidebarUser,
} from '../components/AppSidebar';

export default function ToolsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SidebarUser | null>(null);

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

  function comingSoon(name: string) {
    window.alert(`${name} 기능은 향후 개발 계획에 포함되어 있습니다.`);
  }

  if (!user) {
    return <main className="execution-loading">화면을 불러오는 중...</main>;
  }

  return (
    <main className="app-shell">
      <AppSidebar user={user} activeMenu="tools" />

      <section className="app-main workspace-main">
        <div className="workspace-page">
          <section className="workspace-hero compact">
            <div>
              <span className="workspace-eyebrow">QA TOOLS</span>
              <h1>QA 도구</h1>
              <p>
                프로젝트와 무관하게 반복적으로 사용하는 QA 보조 기능을
                모듈 형태로 제공합니다.
              </p>
            </div>
          </section>

          <div className="workspace-tool-grid">
            <button type="button" onClick={() => comingSoon('단말 리스트 / 정보')}>
              <span className="workspace-tool-icon">▤</span>
              <div>
                <h2>단말 리스트 / 정보</h2>
                <p>OS, 해상도, 화면비, 주요 사양과 보유 단말 정보를 검색합니다.</p>
              </div>
              <small>개발 예정 →</small>
            </button>

            <button type="button" onClick={() => comingSoon('밸런스 계산기')}>
              <span className="workspace-tool-icon">∑</span>
              <div>
                <h2>밸런스 계산기</h2>
                <p>확률, 스킬, 수치 검증을 하나의 계산 도구로 묶어 제공합니다.</p>
              </div>
              <small>개발 예정 →</small>
            </button>

            <button type="button" onClick={() => comingSoon('데이터 대조')}>
              <span className="workspace-tool-icon">⇄</span>
              <div>
                <h2>데이터 대조</h2>
                <p>이전/현재 CSV·XLSX를 비교해 추가·삭제·변경 데이터를 찾습니다.</p>
              </div>
              <small>구현 검토 →</small>
            </button>

            <button type="button" onClick={() => comingSoon('AI QA 설계')}>
              <span className="workspace-tool-icon">AI</span>
              <div>
                <h2>AI QA 설계</h2>
                <p>가공된 기획·업데이트 정보를 기반으로 QA 항목 초안을 생성합니다.</p>
              </div>
              <small>개발 예정 →</small>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
