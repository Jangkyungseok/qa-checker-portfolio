# QA Checker Architecture

기준일: 2026-09-14. 개발자 인수인계 및 새 ChatGPT/Codex 대화의 작업 재개용 체크포인트다. 운영 설정과 production migration 완료 상태는 사용자 확인 내용을 기준으로 기록했다.

## 1. 저장소와 운영 위치

- GitHub repo: `Jangkyungseok/qa-checker-portfolio`
- Repository: https://github.com/Jangkyungseok/qa-checker-portfolio
- Local path: `C:\Users\Kyungseok\Documents\Codex\qa-checker-mvp-v0.2`
- Frontend: Next.js / TypeScript / Vercel
- Frontend URL: https://qa-checker-portfolio.vercel.app/
- Backend: NestJS / TypeScript / Render
- Backend URL: https://qa-checker-api.onrender.com
- Production DB: Supabase PostgreSQL
- Local DB: Docker PostgreSQL 16, `127.0.0.1:5433/qa_checker`
- 첨부파일 저장: Supabase Storage

요청 흐름: 브라우저 → Vercel Frontend → Render Backend → Supabase PostgreSQL / Storage.
Backend는 ORM 대신 `pg` Pool과 직접 SQL을 사용한다. `DbService`가 쿼리와 BEGIN/COMMIT/ROLLBACK 트랜잭션을 제공한다.
Supabase SDK는 Storage 파일 처리에 사용하며 앱 인증은 자체 사용자/세션 구조다.

## 2. 주요 폴더 구조

아래 경로는 프로젝트 루트 기준이다.

| 경로 | 역할 |
| --- | --- |
| `frontend/app/` | Next.js App Router 화면 |
| `frontend/app/components/` | Sidebar 등 공통 UI |
| `frontend/app/projects/[projectId]/page.tsx` | 프로젝트 Workspace, 빌드 검수 목록 |
| `frontend/app/projects/[projectId]/decisions/` | 이슈 이력 화면 및 LeaveGuard |
| `frontend/app/inspections/`, `frontend/app/admin/` | 검수, 관리자 화면 |
| `backend/src/auth/`, `backend/src/common/` | 인증, AuthGuard, RolesGuard |
| `backend/src/db/`, `backend/src/storage/` | 직접 SQL 접근, Storage 연동 |
| `backend/src/build-histories/` | Build History API |
| `backend/src/qa-decisions/` | 이슈 이력 API |
| `backend/src/inspections/`, `backend/src/qa-execution/` | 검수 및 실행 결과 |
| `backend/src/projects/`, `backend/src/categories/`, `backend/src/test-items/` | 프로젝트, 분류, TC |
| `backend/src/reports/`, `backend/src/users/` | 보고서, 사용자 관리 |
| `db/` | 통합 스키마, migration, 데이터 관리 SQL |
| `docker-compose.yml` | 로컬 PostgreSQL 및 영속 볼륨 |

## 3. 인증과 권한

- `users` / `user_sessions` 기반 opaque Bearer 세션 인증이며 DB에는 토큰 해시를 저장한다.
- AuthGuard는 세션 만료/철회와 사용자 승인 상태를 검사하고 DB의 현재 role을 읽는다.
- RolesGuard는 API의 `@Roles(...)`와 USER / LEADER / ADMIN을 비교한다. 최종 권한 통제는 Backend가 담당한다.
- USER: 일반 조회 및 허용된 검수 업무. 이슈 이력은 조회 전용이다.
- LEADER: Build History와 이슈 이력 생성/수정/전용 상태 변경 등 관리 업무가 가능하다.
- ADMIN: 사용자 관리와 ADMIN 전용 API를 사용한다. 빌드 검수 목록 삭제는 ADMIN 전용이다. 모든 메뉴에 삭제 API가 존재하는 것은 아니다.
- ADMIN single active session: 동일 ADMIN 사용자에게 철회되지 않고 만료되지 않은 세션이 있으면 신규 로그인을 HTTP 409로 차단한다. 기존 환경에서 정상 로그아웃 후 재로그인하는 것을 우선한다. 비정상적으로 활성 세션이 남은 경우 production DB의 `user_sessions`에서 해당 ADMIN의 활성 세션을 확인한 후, 해당 세션의 `revoked_at`을 현재 시각으로 갱신한다.
- 현재 사용자 API는 `GET /auth/me`다. 권한 표시 문제는 해당 응답, DB role, Frontend 캐시를 함께 확인한다.

## 4. Render 배포 명령

다음 명령은 Backend 디렉터리 기준이다.

| 항목 | 설정 |
| --- | --- |
| Build Command | `npm install && npm run build` |
| Pre-Deploy Command | 없음 |
| Start Command | `npm run start:prod` |

`start:prod`는 `node dist/main.js`를 실행한다.
Frontend production build는 `frontend`에서 `npm run build`다.
Backend 로컬 개발은 `backend`에서 `npm run start:dev`이며 기본 포트는 3001이다.

## 5. DB migration 운영

Production migration은 자동 실행되지 않는다. Git push, Vercel 배포, Render build/start만으로 SQL이 적용되지 않는다.
Production migration은 Supabase SQL Editor에서 대상 프로젝트와 현재 스키마를 확인한 후 수동 적용한다.

| 파일 | 내용 | Production 상태 |
| --- | --- | --- |
| `db/schema.sql` | 신규 환경용 통합 스키마 | 기존 production에 통째로 재실행하지 않음 |
| `db/0003_add_test_item_attachments.sql` | TC 첨부 메타데이터 | 이 문서에서 별도 확인하지 않음 |
| `db/0004_add_inspection_item_attachments.sql` | 검수 첨부 스냅샷 | 이 문서에서 별도 확인하지 않음 |
| `db/0005_add_build_histories.sql` | Build History 기본 테이블 | 기본 테이블 존재 확인, 실행 이력은 별도 미확인 |
| `db/0006_expand_build_histories.sql` | 출처/위험도/리뷰/영향 범위/검수 연결 확장 | 적용 확인 완료 |
| `db/0007_add_qa_decision_memories.sql` | 이슈 이력 테이블, FK/CHECK/INDEX | 적용 확인 완료 |
| `db/0008_expand_issue_history.sql` | 이슈 유형 확장, nullable 연관 URL 추가 | 적용 확인 완료 |

0006/0007/0008 완료는 사용자 확인 기준이며 이번 문서 작업에서 production DB를 직접 변경하지 않았다.
이번 작업 중 production에서 직접 확인한 migration은 `0006`, `0007`, `0008`이다. 그 이전 migration의 적용 이력은 별도 검증 대상이며, 기존 테이블 존재만으로 실행 이력을 단정하지 않는다.
저장소에는 별도 0001/0002 파일이 없다. 초기 구조는 `schema.sql`을 참고한다.
후속 migration은 백업 확보 → 스키마와 적용 여부 확인 → 미적용 파일만 순서대로 실행 → 컬럼/제약/인덱스 및 API 검증 순으로 진행한다.
0006/0007/0008은 각각 BEGIN/COMMIT을 포함하며 중복 실행을 허용하지 않는다. 오류 시 다음 파일을 실행하지 않는다.
`reset.sql`, seed, cleanup SQL은 migration이 아니므로 production에 일괄 실행하지 않는다.
로컬 Docker의 `schema.sql` 자동 실행은 빈 DB 볼륨 최초 초기화 시에만 발생한다. 기존 볼륨은 재시작으로 migration되지 않는다.

## 6. 현재 구현 상태

### Build History / 빌드 검수

Build History 목록/상세/생성/수정, 전달 버전, 변경 내용, 위험도, 영향 범위, 검수 연결, 리뷰 상태 및 감사 정보를 구현했다.
빌드 검수 목록에는 ADMIN 전용 삭제 버튼과 삭제 API 연결이 구현되어 있다. Build History와 검수는 별개 데이터다.
0006의 검수 연결 FK는 ON DELETE RESTRICT이므로 연결된 검수 삭제는 제약에 의해 제한될 수 있다.

### 이슈 이력

- 메뉴: `이슈 이력`. 설명: `주요 이슈와 대응 사유, 결과를 남기고 확인합니다.`
- 목록 제목: `이력 목록`. 생성 버튼: `기록 생성`.
- 필드: 이슈 유형 / 이슈 내용 / 대응 사유 / 대응 방향 / 대응 결과 / 연관 링크 (선택).
- 경로: `/projects/[projectId]/decisions`, `/projects/[projectId]/decisions/[decisionId]`.
- 내부 API `/qa-decisions`와 DB 테이블 `qa_decision_memories` 이름을 유지한다.
- 목록/필터/생성/상세/수정/상태 변경, 전체 행 클릭과 키보드 접근을 구현했다.
- 생성/수정 및 목록 유형 필터는 신규 5종만 제공한다: DELIVERY_ISSUE 납품 이슈, REMAINING_ISSUE 잔여 이슈, REMAINING_TEST 잔여 테스트, LIVE_ISSUE_RESPONSE 라이브 이슈 대응, OTHER 기타. 필터의 전체 유형 옵션은 유지한다.
- Legacy 유형은 자동 변환/삭제하지 않는다. Backend enum/DB CHECK와 기존 기록의 한글 표시를 유지한다. 전체 유형 조회 및 상세에서 확인할 수 있다.
- 위험도는 CRITICAL 즉시 → HIGH 높음 → MEDIUM 보통 → LOW 낮음 순서다. UNASSESSED는 신규 선택에서 제외하고 기존 값 조회를 유지한다.
- 연관 링크는 HTTP/HTTPS URL 한 개다. API `relatedUrl`, DB `related_url`로 저장하고 새 탭으로 연다. 라벨은 `연관 링크 (선택)`, placeholder는 `https://`다.
- Inspection 선택 UI는 제거했지만 기존 관계 데이터는 보존한다. Build History 연결과 버전 스냅샷을 지원한다.
- OPEN은 처리 중, RESOLVED는 대응 완료다. 완료에는 대응 결과가 필요하고 처리 중 복귀 시 결과와 해소 감사 정보가 초기화된다.
- 대응 완료 상태의 일반 수정은 UI와 Backend에서 차단한다. 전용 상태 변경 API로 처리 중 복귀 후 수정한다.
- 작성/수정 중 변경사항이 있으면 내부 이동 및 브라우저 뒤로가기에 이탈 확인을 표시한다. 새로고침/탭 닫기는 beforeunload를 사용한다.
- 작성자/수정자/해소 감사 정보를 표시한다. 이슈 이력 삭제 API/UI는 아직 없다.

코드상 버전 원본은 최대 150자, 이슈 이력 snapshot 컬럼은 최대 100자여서 긴 버전 연결은 후속 확인이 필요하다.

## 7. 다음 개발 및 작업 재개

다음 개발 순서는 **Test Debt → Coverage Gap**이다. 두 기능은 현재 구현 완료 범위가 아니다.
작업 재개 시 `git status`, 최신 변경사항, 실제 배포 상태, migration 적용 상태를 먼저 확인한다.
코드 변경 후 Backend/Frontend build, TypeScript, `git diff --check`와 변경 범위에 맞는 실제 API/브라우저 검증을 수행한다.

## 8. 비밀값 및 변경 관리

`.env`, `.env.local`, 비밀번호, DATABASE_URL의 실제 값, 세션 토큰, Supabase secret key 등 비밀값은 문서나 Git에 기록하지 않는다.
실제 환경 설정 값은 승인된 로컬/배포 서비스 설정에서 관리한다.
자동 생성 파일, 테스트 데이터, 작업 보조 파일은 기능 commit에 섞이지 않도록 확인한다. 문서 변경은 해당 기능 구현과 함께 검토한다.

## 9. BTS 1차 MVP 추가 체크포인트 (2026-11-13)

별도 `defects` 모듈의 이슈 관리·발생 환경·연계 이슈·코멘트·활동 이력을 추가했다. 담당자 할당은 제외했다. 상세 범위와 배포 절차는
`docs/BTS_MVP.md`를 참고한다. 신규 migration은 `db/0009_add_defects.sql`과
`db/0010_expand_issue_workflow.sql`, `db/0011_simplify_issue_management.sql`,
`db/0012_issue_evidence_and_rerequest.sql`이며 로컬에 적용했다. 2026-11-13 사용자 확인으로 production 0009~0012 적용과 Storage 사전 설정 완료를 기록한다. 이번 이슈 현황 작업에서 production을 직접 변경하지 않았다. 기존 이슈 이력과 0006/0007/0008은 유지한다.
프로젝트 멤버십은 사용자 결정으로 후속 단계에 보류했다. 승인된 계정은 현재 모든 프로젝트에
접근할 수 있으며 내부/외부 테스트 계정을 구분하는 것만으로 데이터가 격리되지 않는다.
실제 외부 고객 데이터 운영 전에는 프로젝트 멤버십과 Backend 접근 통제가 필수다.

이슈 증빙 첨부는 별도 defect_attachments와 비공개 Supabase Storage를 사용한다. 로컬 파일 저장 모드도 제공하며 production에서는 사용할 수 없다.
최종 확인 상태(수정 확인/SKIP 확인)는 재요청을 거쳐 대응 중으로 돌아간다. 상세 운영 조건과 Storage 배포 전 확인 항목은 BTS 문서를 따른다.

## 10. 이슈 현황 (2026-11-13)

프로젝트 Workspace의 이슈 현황은 `/projects/[projectId]/issue-report`이며 승인된 모든 역할이 조회한다.
`GET /defects/report`가 등록일/빌드 기준 KPI, 처리율, 상태/우선순위/빈도, 재요청/SKIP,
일별 추이 및 페이지별 잔여/재요청 목록을 집계한다. 한국시간 오늘 포함 기간이며 현재 상태를 보여준다.
기존 defects/defect_activities만 사용하고 신규 migration은 없다. 기존 검수 Reports 모듈은 유지한다.
정확한 기준과 향후 QA 결과 리포트 6개 영역의 데이터 재사용/수동 입력 구분은 `docs/ISSUE_REPORT.md`를 참고한다.
`GET /defects/report/export`로 동일 기간/빌드 조건의 Excel(7개 Sheet)/CSV를 Backend에서 생성한다.
공유 cohort 필터와 읽기 전용 snapshot을 사용하며 ExcelJS는 Backend에만 추가했다.
화면 pagination과 무관하게 전체 결과를 내보내며 건수/데이터 크기/동시 생성 제한이 있다.
삭제 코멘트 본문과 비공개 Storage 경로/URL은 출력하지 않는다. 신규 migration은 없다.
시간 평균은 미구현이다. QA 결과 리포트 작성/PDF는 아래 11절의 로컬 구현 상태를 따른다.

## 11. QA 결과 리포트 1차 MVP (로컬 구현)

- Workspace → `/projects/[projectId]/qa-report`에서 목록, `/new`에서 작성, `/[reportId]`에서 수정/조회한다.
- `db/0013_add_qa_reports.sql`은 로컬 Docker DB에만 적용했다. Production 미적용이며 배포 전에 Supabase SQL Editor에서 별도 검토·수동 적용해야 한다. 자동 migration은 없다.
- `qa_reports`는 개요, 테스트 기간, 집계 빌드, 고려사항, 리드 의견, 작성/수정자와 version을 저장한다. `qa_report_issue_links`는 대표/고려사항별 이슈와 선택 이미지를 연결한다.
- 승인 USER는 목록/상세/PDF 조회, LEADER/ADMIN은 생성/수정도 가능하다. Backend guard가 직접 API 호출을 통제한다. 현재 승인 계정의 전체 프로젝트 접근 제약은 그대로다.
- 초안은 미입력 상태로 저장할 수 있다. PDF 생성 시 필수 입력을 검사하고, 수정은 version 충돌 시 409를 반환한다. 저장된 링크와 이미지를 PDF 요청 시 다시 검사한다.
- 한국시간 테스트 시작일~종료일에 등록된 이슈의 현재 상태를 기존 report 집계로 계산한다. 과거 시점 상태나 기간 전 이슈의 기간 내 활동을 복원하지 않는다.
- 대표 이슈는 최대 5개, 이슈별 활성 이미지 1개를 출력한다. QA 대응 고려사항은 필수 대응 고려/우선 대응 고려/추후 개선 고려/추가 확인 필요의 수동 선택·서술이며 상태/우선순위와 자동 분류하지 않는다.
- A4 가로 Executive Summary이며 첫 페이지에 01~03 전체를 배치한다. 연결 이슈 0건인 고려사항은 PDF에서 `없음 / 해당 없음`으로 표시한다.
- PDF 6개 영역: 테스트 개요 → 이슈 요약 → 이슈 현황 → 대표 이슈 → QA 대응 고려사항 → QA 리드 최종 의견.
- Backend PDFKit 0.20.2 + sharp 0.35.5, Noto Sans CJK KR Regular/Bold(OFL)를 사용한다. 폰트는 `backend/src/qa-reports/fonts`에 포함하며 Nest build가 dist로 복사한다. Render Node는 sharp 요구 버전(Node >=20.9)을 만족해야 한다.
- 미리보기와 다운로드는 같은 PDF API/Blob을 사용한다. 입력 변경/화면 종료 시 Object URL을 해제하고, 화면 종료 시 진행 중 PDF 요청을 취소한다. 생성 중 중복 요청을 막는다.
- PDF는 요청 시 메모리에서 생성하며 영구 저장하지 않는다. 대표 이미지당 5MiB, 2천만 픽셀 제한 및 프로세스당 PDF 1개 생성 제한이 있다. 영상은 존재 여부만 표시한다.
- 제출본 snapshot, 승인 workflow, 최종 제출본 영구 보관은 미구현이다. Chrome PDF 미리보기의 최종 시각 확인은 수동 검수 대상으로 남긴다.
- 자동 검증: `node backend/test/qa-reports.integration.cjs`. 실제 로컬 API로 PDF를 생성하고 저장소 밖에서 렌더링 검수한다. 테스트 fixture는 종료 후 제거하며 기존 데이터 fingerprint를 비교한다.
