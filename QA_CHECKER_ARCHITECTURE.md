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
자동 생성 파일, 테스트 데이터, 작업 보조 파일은 기능 commit에 섞이지 않도록 확인한다. Architecture 문서는 현재 작성만 하고 commit하지 않는다.
