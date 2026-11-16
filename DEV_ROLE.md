# DEV 역할 운영

## 범위와 접근

DEV는 외부 고객/개발사 대응 계정이다. ADMIN이 `/admin/users` 승인 대기 화면에서 USER / LEADER / DEV 중 역할을 선택해 승인한다. 회원가입 자체로 DEV나 ADMIN 권한을 얻을 수 없다. 기존 승인/거절 API를 사용하며 기존 계정의 역할을 일괄 변경하지 않는다.

프로젝트 멤버십은 구현하지 않았다. **승인된 DEV도 모든 프로젝트와 그 이슈/이슈 현황/공개된 QA 결과 리포트를 조회할 수 있다.** **실제 외부 고객 DEV 계정 발급 전 프로젝트 membership/access control 필수.** 현재는 내부 테스트 DEV만 사용한다.

DEV Workspace에는 이슈 관리, 이슈 현황, QA 결과 리포트 카드만 표시한다. 내부 운영 사이드바와 검수/Build History/이슈 이력/관리 화면은 숨기며 직접 URL 접근도 차단한다. Frontend는 보호 화면을 렌더하기 전에 `/auth/me`에서 현재 역할을 확인한다. 최종 권한은 Backend AuthGuard/RolesGuard와 서비스에서 검사한다.

## 권한

| 기능 | DEV |
| --- | --- |
| 프로젝트 조회 | 허용 |
| 이슈 목록/상세/활동 이력 | 허용 |
| 이슈 신규 등록, 원본 필드 수정 | 차단 |
| 코멘트 작성, 본인 코멘트 수정/soft delete | 허용 |
| 타인 코멘트 수정/삭제 | 차단 |
| 이슈 증빙 업로드/조회/다운로드 | 허용 (기존 최종 확인 상태의 업로드 제한 유지) |
| 증빙 삭제 | 차단 |
| 이슈 현황/필터/Excel/CSV | 허용 |
| QA 리포트 목록/상세/PDF 미리보기·다운로드 | PUBLISHED만 허용 |
| QA 리포트 작성/저장/수정/대표 이슈 변경 | 차단 |
| 사용자/TC/카테고리/검수/Build History/이슈 이력 API | 차단 |

QA 리포트는 DRAFT(초안) / PUBLISHED(공개됨)로 구분한다. DEV 목록은 공개된 리포트만 반환하고 초안 상세/candidates/PDF는 404로 차단한다. LEADER/ADMIN만 저장된 초안을 공개할 수 있으며 USER는 기존대로 모든 리포트를 읽고 PDF를 생성할 수 있다. 공개 취소 기능은 없다. 공개 후 편집·저장은 가능하며 변경 내용은 DEV에게 즉시 공개된다. 공개는 리포트/PDF의 불변 스냅샷을 만들지 않는다. PDF의 기존 필수 입력 검증은 유지한다. 리포트 삭제 API는 기존에도 없다.

공개 API: `POST /projects/:projectId/qa-reports/:reportId/publish`, body: `{version}`. 행 잠금과 버전 검사를 사용하고 공개 시 version/수정자를 갱신한다. 원본 저장 DTO로 status를 임의 변경할 수 없다.

DEV 상태 변경은 아래 네 전환만 허용한다. 목록/상세는 Backend의 동일 `allowed_transitions` 응답을 사용한다.

- 요청 → 대응 중
- 재요청 → 대응 중
- 대응 중 → 대응 완료
- SKIP 요청 → 대응 중

QA 판정 상태의 변경은 기존 USER/LEADER/ADMIN 정책을 유지한다. 코멘트/활동 이력은 사용자 이름과 **현재 role**을 JOIN해 표시하며 과거 시점의 역할 스냅샷은 저장하지 않는다.

DEV는 USER/LEADER와 동일하게 복수 세션을 사용한다. ADMIN의 단일 활성 세션과 DB 단일 ADMIN 계정 제약은 유지한다. 개인별 계정을 사용한다.

## Migration / 배포

- 기존 DB: `db/0015_add_dev_role.sql` → `db/0016_add_qa_report_publish_status.sql` 순서로 각각 적용한다. 0016은 status NOT NULL DEFAULT DRAFT와 CHECK를 추가하며 기존 리포트도 모두 초안으로 시작한다. 비멱등이므로 이미 적용했다면 재실행하지 않는다.
- `users.role`이 `public.user_role` enum인지 검증하고 기존 USER/LEADER/ADMIN에 DEV만 추가한다.
- 기존 사용자 데이터 변경, DROP/DELETE/TRUNCATE가 없다. 0015 재실행은 `IF NOT EXISTS`로 안전하게 종료한다.
- COMMIT 후에만 새 enum을 사용한다. 신규 환경용 `db/schema.sql`에도 DEV를 포함했다.
- Production migration은 자동 실행되지 않는다. 백업 및 enum 확인 후 운영자가 Supabase SQL Editor에서 수동 적용해야 한다. 0015/0016의 production 적용 및 검증 완료는 사용자 확인 기준이며, 이 작업에서는 production DB에 직접 접속하거나 변경하지 않았다.
- 코드 롤백 시 기존 코드가 DEV를 안전하게 처리한다고 가정하지 않는다. DEV 계정 사용을 중단하고 권한 호환성을 검토해야 한다. enum 삭제를 위한 파괴적 역 migration은 제공하지 않는다.

## 검증

`backend/test/dev-role.integration.cjs`는 localhost:5433/qa_checker에서만 실행한다. 실제 HTTP/DB로 승인, 로그인, 복수 세션, 64개 상태 전환 조합, 원본 수정 차단, 코멘트, 증빙, 내부 API 차단, CSV/Excel/PDF를 검사한다. 임시 UUID 데이터만 정리하고 기존 업무 데이터 fingerprint를 비교한다. ADMIN 로그인 중복 정책은 기존 관리자 세션을 건드리지 않도록 AuthService 단위 검증을 함께 사용한다.

기존 defects/report/export/QA report 테스트도 함께 실행한다. 프로젝트별 격리는 이번 검증 범위가 아니며 지원하지 않는다.
