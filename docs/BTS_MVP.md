# BTS 이슈 관리 — 외부 QA 대응용 MVP (2026-11-13)

이슈 현황 화면/API의 후속 구현과 QA 결과 리포트 확장 설계는 [ISSUE_REPORT.md](ISSUE_REPORT.md)를 참고한다.
2026-11-13 사용자 확인으로 production 0009~0012 적용/Storage 설정 및 기능 commit push가 완료됐다.
아래 migration 적용 당시의 기록과 구분하며, 이슈 현황 작업에서는 production 변경을 하지 않는다.

## 범위

사용자 메뉴는 **이슈 관리**, 내부 모듈/테이블/API는 `defects`다. 기존 **이슈 이력**
(`/qa-decisions`)은 주요 QA 판단을 기록하는 별도 기능으로 유지한다.
이슈 목록 / 등록 / 상세를 중심으로 운영하며 담당자 할당·조직·프로젝트별 권한은 제외한다.

현재 승인 계정은 모든 프로젝트에 접근한다. USER/LEADER는 개인 계정으로 동시 접속하며
ADMIN single active session 정책은 유지한다. **외부 고객 실데이터 운영 전 프로젝트 접근 통제가 필수다.**

## 입력과 표시

입력 순서는 제목 → 발생 빈도/우선순위/빌드 버전/발생 단말·OS/연계 이슈 → 재현 절차 → 이슈 내용 → 수정 방향 → 증빙 자료다.
이슈 내용은 큰 textarea, 재현 절차/수정 방향은 약 절반 높이로 제공한다.

| 필드 | 정책 |
| --- | --- |
| 제목 | 필수, 1~200자 |
| 재현 절차 / 이슈 내용 / 수정 방향 | 각각 필수, 1~10000자 |
| 발생 빈도 | 필수, 100% / 70% / 50% / 30% / 1% |
| 우선순위 | 필수, IMMEDIATE 즉시 / HIGH 높음 / NORMAL 중간 / LOW 낮음 |
| 빌드 버전 | 직접 입력 필수, 1~200자 |
| 발생 단말 / OS | 기본 공통, 최대 500자; UI 빈 입력은 공통으로 저장 |
| 연계 이슈 | 선택, ISSUE- 접두사 옆에 숫자만 입력; 존재 여부/자기 자신 검증, 프로젝트 간 연결 허용 |

발생 빈도는 기존 reproducibility 컬럼에 PERCENT_100/70/50/30/1 코드로 저장한다.
빈 select를 자동 선택하지 않는다. 누락·빈값·공백·NULL 및 길이를 Frontend/Backend에서 검증한다.
과거 재현성 값을 임의 확률로 바꾸지 않는다. 기존 값은 조회에서 `(기존)`으로 표시하고
전체 수정 폼 저장 시 새 발생 빈도와 누락된 빌드 버전을 입력한다. 과거 URGENT도 조회는 유지하고
신규 생성/수정 선택지에서는 제외한다. 영향도/담당자/빌드·검수 연결/기대·실제 결과는 새 UI/API 입력에서 제외한다.

## 상태와 권한

기본 흐름: NEW 신규 → REQUESTED 요청 → IN_PROGRESS 대응 중 → RESPONDED 대응 완료
→ VERIFIED 수정 확인.

NEW / REQUESTED / RE_REQUESTED / IN_PROGRESS → SKIP_REQUESTED SKIP 요청 → SKIP_CONFIRMED SKIP 확인.
SKIP 요청 철회는 IN_PROGRESS로 복귀한다. RESPONDED → RE_REQUESTED 재요청을 허용한다.
VERIFIED와 SKIP_CONFIRMED는 RE_REQUESTED로만 복귀하며 IN_PROGRESS 직접 전환은 금지한다.
RE_REQUESTED → IN_PROGRESS로 대응을 재개한다. 목록과 상세는 동일한 Backend workflow를 사용한다.

- 승인 사용자 모두 조회/등록/코멘트/일반 진행 상태 변경 가능. 담당자 할당은 필요 없다.
- USER는 본인 등록 이슈의 본문만 수정할 수 있다. LEADER/ADMIN은 전체 이슈 수정 가능.
- 최종 수정 확인, SKIP 확인, 재오픈은 LEADER/ADMIN만 가능하다.
- VERIFIED/SKIP_CONFIRMED에서는 일반 수정 API를 409로 차단하고 UI 수정 버튼을 숨긴다.
- Backend가 허용 전환과 role을 검증한다. 상세·목록의 allowed_transitions로 UI 선택지를 구성한다.
- 목록 행에서 상태 변경 가능. 성공 후 badge/행/건수를 갱신하고 상태 필터에서 벗어나면 제거한다.
- 본인 코멘트만 수정 가능. 본인 또는 LEADER/ADMIN은 soft delete 가능. 타인 대필 수정은 불가.
- 상태·본문·코멘트 변경과 활동 저장은 동일 DB transaction. version으로 동시 수정 충돌을 409 처리한다.
- 과거 resolution은 컬럼/값을 보존하지만 새 흐름은 처리 결과 선택을 요구하거나 표시하지 않는다.

## 화면

- `/projects/[projectId]/defects`: 번호/제목 검색, 상태/우선순위/발생 빈도 필터.
  번호·상태·우선순위·빈도·빌드·단말·제목·수정일·상태 변경을 표로 표시한다.
  제목에 가장 넓은 공간을 두고 전체 행 클릭/Enter를 지원한다. 내부 select/버튼은 행 이동과 분리한다.
- `/projects/[projectId]/defects/new`: 입력 순서와 필드 오류를 명확히 표시한다.
- `/projects/[projectId]/defects/[defectId]`: 밀도 높은 메타/본문, 연계 이슈 링크, 상태 변경,
  연한 배경 코멘트 카드, 별도 활동 타임라인.
- 상단 이동은 목록에서 `← 프로젝트로`, 등록/상세에서 `← 이슈 목록` 단일 보조 링크다.
- 신규 흰색 / 요청 연한 붉은색 / 재요청 더 진한 붉은색 / 대응 중 연한 노랑 / 대응 완료 연한 초록 / 수정 확인 연한 회색 /
  SKIP 요청 황금색 / SKIP 확인 연한 회색의 연한 행 배경과 텍스트 badge를 함께 사용한다.
- 기존 LeaveGuard로 작성/수정 이탈 경고를 유지한다.

## API

- GET /defects?projectId=...&search=...&status=...&priority=...&reproducibility=...&page=...
- POST /defects, GET/PATCH /defects/:id
- PATCH /defects/:id/status: version, status
- GET/POST /defects/:id/comments, PATCH/DELETE /defects/:id/comments/:commentId
- GET /defects/:id/activities
- GET /defects/attachment-policy
- GET/POST /defects/:id/attachments
- GET /defects/:id/attachments/:attachmentId/file
- DELETE /defects/:id/attachments/:attachmentId

create/update 입력은 title, stepsToReproduce, description, fixDirection, reproducibility,
priority, buildVersion, deviceOs, relatedIssueCode다. 생성은 projectId, 수정은 version이 필요하다.
사용자 표시는 ISSUE-000123 형식이다. 내부 defect_no와 API defect_code의 BUG- 형식은 유지한다.
검색/연결 API는 ISSUE-/BUG-를 모두 허용하고 대문자 정규화하며 null/빈 문자열은 연결 해제로 처리한다.
담당자 후보 API는 제거했다. 제거된 입력은 Nest whitelist에 의해 저장 대상에서 제외된다.

## DB와 안전한 전환

0009/0010/0011 이후 **0012_issue_evidence_and_rerequest.sql**을 추가했다.
0012는 상태 CHECK에 RE_REQUESTED를 추가하고 defect_attachments 및 첨부 활동 이벤트/인덱스를 추가한다. 기존 행은 변경하지 않는다.
로컬 Docker 127.0.0.1:5433/qa_checker에서 전체 백업 후 적용했다. Production에는 미적용이다.

- build_version varchar(200) NULL, device_os varchar(500) NOT NULL DEFAULT 공통 추가.
- related_defect_id self FK 추가. 삭제된 대상은 NULL, 자기 자신 연결은 CHECK로 금지.
- legacy_status 컬럼에 변환 전 상태를 보존한다.
- FEEDBACK/CONFIRMED/ASSIGNED → REQUESTED, RESOLVED/RETEST → RESPONDED.
- CLOSED+FIXED → VERIFIED, 나머지 CLOSED → SKIP_CONFIRMED.
- NEW/IN_PROGRESS 및 과거 priority/reproducibility/resolution 값은 그대로 유지한다.
- 변환된 상태의 version만 증가. 기존 작성자/시간/본문/관계/코멘트/활동은 보존한다.
- severity는 nullable로 바꾸며 기존 값/assignee/FK/expected/actual 컬럼을 DROP하지 않는다.
- 새 프로젝트·빈도 및 연계 이슈 인덱스와 상태/FK/CHECK를 추가한다.
- schema.sql은 신규 설치용 최종 구조다. 기존 DB에 재실행하지 않는다.

Production migration은 자동 실행되지 않는다. 운영자가 백업/스키마를 확인하고 Supabase SQL Editor에서
미적용 0009 → 0010 → 0011 → 0012 순으로 수동 적용해야 한다. 새 API와 구 UI는 호환되지 않으므로
구버전 쓰기를 중지하고 Backend/Frontend를 함께 전환한다. 재실행하지 않는다.
역변환은 새 상태를 잃을 수 있으므로 이전 앱으로 단순 복귀하지 말고 별도 복구 계획을 수립한다.

## 증빙 첨부

별도 defect_attachments를 사용하며 TC/검수 첨부 테이블과 혼합하지 않는다.
PNG/JPEG/WEBP/PDF/MP4/MOV를 허용하고 확장자/MIME/파일 헤더/크기를 검사한다.
이슈당 활성 파일 5개, 이미지/PDF 5MB, 영상 기본 25MB다.
DEFECT_VIDEO_MAX_MB로 영상 한도를 1~100MB에서 설정한다. DB 크기 상한은 100MB다.
등록자 또는 LEADER/ADMIN이 업로드하고, 업로더 또는 LEADER/ADMIN이 삭제한다.
최종 확인 상태에서는 업로드/삭제를 금지한다. 다운로드는 승인 사용자 인증을 요구한다.
삭제는 메타데이터 soft delete이며 비공개 원본은 보존한다. 원본 보존 기간/물리 정리는 후속 운영 정책이다.
첨부 추가/삭제 활동과 메타데이터 변경은 같은 transaction이며, DB 실패 후 업로드 파일을 보상 삭제한다.
본문 저장 후 파일 실패를 명시하고 동일 uploadId로 재시도하여 이슈/첨부 중복 생성을 방지한다.
이미지는 미리보기, 영상은 인증 다운로드 후 player, PDF는 열기/다운로드를 제공한다.

운영 환경은 기존 Supabase Storage 서비스의 비공개 버킷을 사용한다. 공개 버킷이면 증빙 업로드/다운로드를 거부한다.
배포 전 버킷 접근 권한, 허용 MIME, 용량 한도(영상 포함)를 별도 확인해야 한다.
이번 로컬 테스트는 실제 파일 IO 기반 로컬 저장소를 사용했으며 production Storage 업로드 검증은 하지 않았다.
DEFECT_ATTACHMENTS_LOCAL_DIR는 절대 경로이며 development/test + localhost:5433에서만 허용한다.
운영에는 이 변수를 설정하지 않는다. 기존 TC/검수 Storage 동작은 변경하지 않는다.

## 향후 이슈 현황/리포트

현재 CREATED 활동의 초기 상태/우선순위/빈도/빌드/단말 snapshot과 STATUS_CHANGED의 from/to/actor/created_at을 이용할 수 있다.
현재 잔여 건수는 상태별 현재 행, 재요청 횟수는 to=RE_REQUESTED 이벤트, SKIP 확인은 to=SKIP_CONFIRMED 이벤트로 집계한다.
첫 요청/대응/완료 시각 및 반복 대응 시간은 상태 이벤트 순서를 연결하여 산출한다.
과거 데이터에 이벤트나 snapshot이 없으면 알 수 없음으로 분리하며 최초 시각이나 0시간을 임의 생성하지 않는다.
전체 이슈 대비 재요청 이슈 비율과 재요청 이벤트 수는 서로 다른 지표로 정의해야 한다.
향후 메뉴는 이슈 현황/리포트이며 KPI/추이/분포와 CSV/PDF 내보내기는 미구현이다.

## 검증

Backend build 후 로컬에서 실행:

- node test/defects.integration.cjs: 18개 그룹. 인증·동시 접속·소유권/상태 권한·필수값·길이·
  연계 이슈(프로젝트 간/미존재/자기 자신/해제)·모든 빈도/우선순위·정상/SKIP/재요청·최종 상태 직접 대응 차단·동시 수정·
  코멘트·활동 원자성·증빙 업로드/조회/다운로드/삭제/권한/재시도·기존 빌드/검수/이슈 이력/보고서 회귀.
- node test/defects-migration.integration.cjs: 임시 스키마에서 0009→0010→0011→0012 상태/데이터 보존을
  확인하고 전체 ROLLBACK. 기존 업무 데이터는 수정하지 않는다.

테스트는 localhost:5433/qa_checker만 허용하고 API 테스트는 3011 포트를 사용한다.
기존 ADMIN 세션은 건드리지 않으며 검증용 ADMIN 세션만 생성/제거한다.
검증 계정·프로젝트·이슈는 생성 UUID에 한해 정리하고 기존 데이터 해시를 비교한다.
테스트로 identity sequence 번호에 공백이 생길 수 있지만 재사용/초기화하지 않는다.

브라우저에서 등록/누락 차단/상세/수정/연계 링크/목록 상태 변경과 필터 제외/정상 흐름/
SKIP/재오픈/코멘트 CRUD/활동/검색·필터/기존 기록 표시/상태 색상을 검증한다.

참고: [MantisBT 관리자 가이드](https://mantisbt.org/docs/master/en-US/Admin_Guide/Admin_Guide.pdf).
Mantis와 실제 연동하지 않으며 간결한 등록·목록·상세 정보 구성만 참고한다.
