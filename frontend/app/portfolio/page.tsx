import type { Metadata } from 'next';
import styles from './portfolio.module.css';

export const metadata: Metadata = {
  title: '장경석 | Game QA Leader',
  description: '장경석의 Game QA 포트폴리오와 이력서, QA Checker 프로젝트를 소개합니다.',
};

const documents = [
  { title: 'Portfolio', label: '포트폴리오', description: '게임 QA 경험과 프로젝트를 소개합니다.', file: 'portfolio-jang-kyungseok.pdf', number: '01' },
  { title: 'Resume', label: '이력서', description: '경력과 주요 업무 경험을 확인하세요.', file: 'resume-jang-kyungseok.pdf', number: '02' },
];

export default function PortfolioPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.brand}>JK<span> / </span>PORTFOLIO</span>
          <span className={styles.headerNote}>GAME QUALITY ASSURANCE</span>
        </header>
        <section className={styles.hero} aria-labelledby="intro-title">
          <p className={styles.eyebrow}>GAME QA · PEOPLE · PROCESS</p>
          <h1 id="intro-title">장경석 <span>| Game QA Leader</span></h1>
          <div className={styles.rule} />
          <p className={styles.intro}>게임의 품질을 함께 만들어가는 QA 리더, 장경석입니다.</p>
          <p className={styles.description}>QA 리더십, 조직 운영, 라이브 서비스 품질에 대한 경험을 소개합니다.<br />포트폴리오와 이력서에서 자세한 내용을 확인하실 수 있습니다.</p>
        </section>
        <section className={styles.documents} aria-label="포트폴리오 및 이력서">
          {documents.map((document) => (
            <article className={styles.card} key={document.file}>
              <div className={styles.cardTop}><span>{document.number} / {document.label}</span><span className={styles.badge}>PDF</span></div>
              <h2>{document.title}</h2>
              <p>{document.description}</p>
              <div className={styles.actions}>
                <a className={styles.primary} href={`/documents/${document.file}`} target="_blank" rel="noopener noreferrer" aria-label={`${document.title} PDF 보기 (새 탭)`}>{document.title} PDF 보기 <span aria-hidden="true">↗</span></a>
                <a className={styles.secondary} href={`/documents/${document.file}`} download={document.file}>{document.title} PDF 다운로드 <span aria-hidden="true">↓</span></a>
              </div>
            </article>
          ))}
        </section>
        <section className={styles.demo} aria-labelledby="demo-title">
          <div><p className={styles.eyebrow}>PERSONAL PROJECT</p><h2 id="demo-title">QA Checker</h2><p>게임 QA 프로세스와 검사 관리를 위한 프로젝트</p><small>기존 로그인 화면으로 이동합니다. 서비스 이용에는 로그인이 필요합니다.</small></div>
          <a className={styles.demoLink} href="/">QA Checker Demo로 이동 <span aria-hidden="true">→</span></a>
        </section>
        <footer className={styles.footer}><span>장경석 · Game QA Leader</span><span>PDF 보기는 새 탭에서 열립니다.</span></footer>
      </div>
    </main>
  );
}
