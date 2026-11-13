# 이슈 현황 / QA 결과 리포트 기반 (2026-11-13)

## 이번 구현

프로젝트 Workspace의 이슈 현황 → `/projects/[projectId]/issue-report`.
승인된 USER/LEADER/ADMIN 모두 조회 가능하며 변경 액션은 없다.
기존 이슈 관리 상태/색상과 번호·상세 경로를 재사용한다. Chart library, 새 DB 구조, export는 추가하지 않았다.
기존 검수 Reports 모듈은 검수 항목별 PASS/FAIL/SKIP 보고서이며 이 기능과 구분하여 유지한다.

## API 계약과 기준

`GET /defects/report?projectId=<uuid>&period=ALL|7|14|30&buildVersion=<exact string>&remainingPage=1&rerequestPage=1`

- AuthGuard로 승인·활성 세션 검사. 프로젝트가 없으면 404, 잘못된 필터는 400.
- 현재 프로젝트 접근 정책 유지: 승인 계정은 전체 프로젝트에 접근 가능. 고객별 격리는 아직 미구현.
- `schemaVersion: 1`, project, generatedAt, filters, buildVersions, totals, completion, byStatus,
  byPriority, byFrequency, rerequest, skip, trend, remainingIssues, rerequestIssues, pagination을 반환한다.
- 모든 집계/목록은 PostgreSQL 한 statement snapshot이다. Frontend가 전체 defects를 받아 집계하지 않는다.
- `filters.dateBasis=CREATED_AT`, `timezone=Asia/Seoul`.
- 기간은 한국시간 오늘 포함 N일의 자정부터 generatedAt까지 **등록된 이슈**를 선택한다.
  ALL은 등록일 하한 없음. 상한은 generatedAt. 기존 이슈의 최근 수정일 기준이 아니다.
- 선택한 이슈의 **현재 상태/현재 우선순위/현재 빌드**를 집계한다. 과거 날짜의 상태 snapshot 보고서가 아니다.
- 빌드 필터는 defects.build_version의 정확한 문자열 비교다. 별도 Build History FK나 Inspection을 추측해 연결하지 않는다.
- buildVersions는 기간과 무관하게 해당 프로젝트 전체 distinct 비어 있지 않은 버전을 제공한다.
  NULL/빈 빌드의 기존 행도 전체 빌드 집계에는 포함한다.
- remainingIssues와 rerequestIssues는 각각 updated_at DESC, id 순서의 20건 페이지다.
  pagination에 전체 건수/현재 페이지/pageSize가 있으며 집계는 페이지와 무관하다.
  상세 이동용 issue_code는 ISSUE- 형식, DB defect_no 및 기존 defects API의 BUG- 호환은 유지한다.

## 지표 정의

| 지표 | 정의 |
| --- | --- |
| 전체 | 필터에 해당하는 defects 수 |
| 미처리 | NEW + REQUESTED + RE_REQUESTED |
| 대응 중 / 대응 완료 / 수정 확인 | 각각 IN_PROGRESS / RESPONDED / VERIFIED |
| SKIP | SKIP_REQUESTED + SKIP_CONFIRMED |
| 처리율 | (VERIFIED + SKIP_CONFIRMED) / 전체 × 100 |
| 현재 재요청 | 현재 RE_REQUESTED 행 수 |
| 재요청 발생 이슈 | 선택한 이슈의 STATUS_CHANGED, changes.to=RE_REQUESTED인 distinct defect_id 수 |
| 총 재요청 횟수 | 같은 조건의 활동 행 수 |
| SKIP 비율 | 현재 SKIP_CONFIRMED / 전체 × 100 |
| 잔여 | VERIFIED와 SKIP_CONFIRMED를 제외한 6개 상태 |

비율은 소수점 한 자리, 분모 0이면 0%. 재요청 활동은 generatedAt 이전 이력만 센다.
다른 event_type의 changes.to, 다른 프로젝트 이슈의 활동은 포함하지 않는다.
현재 재요청이더라도 과거 활동이 없다면 발생 이슈/전환 수를 임의 생성하지 않는다.
상태 8종은 항상 반환하고 우선순위 4종/빈도 5종은 0건도 표시한다.
legacy 우선순위/빈도는 별도 key와 기존 한글 표시로 남기며 자동 변환하지 않는다.
우선순위를 Critical/Major 등 심각도나 출시 리스크로 변환하지 않는다.

## 일자별 추이

현재 운영용 이슈 현황 화면에서는 최근 이슈 추이를 표시하지 않는다.
Backend 집계, report API의 trend 응답, 관련 테스트는 유지하여 향후 QA 결과 리포트/Export에서 재사용한다.
화면 구성은 기간/빌드 필터 → 핵심 KPI → 처리율 → 상태별 → 우선순위별/발생 빈도별 → 재요청/SKIP → 잔여 이슈 → 재요청 이슈다.

ALL은 최근 7일, 나머지는 선택한 N일. 한국시간 날짜별 0건을 채운다.
신규는 cohort의 defects.created_at 기준, 수정 확인은 같은 cohort의 실제 STATUS_CHANGED→VERIFIED 기준이다.
수정 확인은 동일 이슈/동일 날짜 내 여러 전환을 1건으로 센다. 다른 날 다시 확인되면 해당 날짜에도 센다.
현재 다시 열렸어도 과거 실제 수정 확인 이벤트는 추이에 남는다.
활동 없는 과거 데이터는 closed_at/updated_at으로 이벤트를 만들어 채우지 않는다.
따라서 일별 수정 확인 합계와 현재 VERIFIED 수는 같을 필요가 없다.

## 시간 기반 지표: 이번에는 미구현

최초 요청 지연은 생성 시각과 최초 REQUESTED 이벤트가 모두 있을 때 계산 가능하다.
요청→대응 시작/완료, 대응 완료→수정 확인은 REQUESTED/RE_REQUESTED를 cycle 시작으로 묶고
이벤트 created_at, id 순서로 다음 대응/완료/확인을 연결해야 한다.
SKIP 진입/철회, 누락 이벤트, 재요청 반복, 근무시간 여부, 아직 열린 cycle의 처리 기준을 먼저 확정한다.
단순 created_at 또는 서로 다른 cycle의 MIN 시각을 빼서 평균을 만들지 않는다.

## 향후 QA 결과 리포트

| 보고서 영역 | 재사용할 데이터 | 직접 입력/선택 또는 후속 설계 |
| --- | --- | --- |
| 01 테스트 개요 | projects.name; build_histories.version/delivered_at/change_summary; inspections.platform/version/inspection_type/test_devices; inspection_items/test_results | 대상 Build/Inspection 명시 선택, 합의된 테스트 범위/기간/방법. 이슈 등록 기간을 테스트 기간으로 간주하지 않음 |
| 02 이슈 요약 | report totals/status/priority/frequency 및 처리율 | 우선순위와 심각도 구분. Critical/Major 자동 매핑 금지 |
| 03 이슈 현황 | 현재 API의 재요청/SKIP/추이/잔여 목록 | 제출 시점 snapshot 고정 및 보고서 버전 관리 |
| 04 대표 이슈 예시 | defects의 내용/재현 절차/단말, defect_attachments의 인증 이미지 | QA 리드가 3~5개 직접 선택. 비공개 원본 접근 권한과 제출 허용 범위 확인 |
| 05 출시 리스크 평가 | 대표/잔여 이슈와 이슈 이력의 판단 맥락 | 출시 차단/출시 전 수정 권고/추후 개선 가능/추가 확인 필요를 리포트 작성 단계에서 직접 판단 |
| 06 QA 리드 최종 의견 | 검수·이슈 사실 데이터 참조 | 출시 가능 여부/핵심 위험/재검수/잔여 리스크 직접 입력; 자동 확정하지 않음 |

Export는 동일 필터와 generatedAt, KPI 정의를 재사용하도록 설계한다.
현재 페이지들을 나중에 다시 조회하면 데이터가 바뀔 수 있으므로 최종 제출본은 서버 측 일관된 snapshot으로 고정해야 한다.
CSV/Excel/PDF, 대표 이슈 선택, 리스크·최종 의견 입력 UI는 이번 범위가 아니다.
Test Debt → Coverage Gap 개발 계획도 그대로 유지한다.

### 보고서의 테스트 기간

운영 화면의 전체/최근 7일/14일/30일 등록일 필터는 유지한다.
향후 QA 결과 리포트는 별도의 테스트 기간을 사용한다. 후보는 테스트 시작일~테스트 종료일,
또는 첫 이슈 등록일~최종 테스트 종료일이며, 실제 테스트 범위와 함께 QA 담당자가 확정한다.
이슈가 없는 프로젝트는 첫 이슈 등록일을 추정하지 않는다.
이슈가 없었던 날짜를 억지로 추이 그래프에 표시하지 않는다. 현재 API의 0건 날짜는 집계용 데이터일 뿐,
향후 보고서의 테스트 수행 여부나 그래프 표시를 자동 결정하는 근거로 사용하지 않는다.

### 내보내기: 후속 기능

**운영 데이터 Export — CSV / Excel**

전체 이슈 목록과 상태, 우선순위, 발생 빈도, 빌드 버전, 발생 단말/OS, 등록일, 최종 수정일,
상태 변경 이력, 재요청 관련 데이터를 제공하는 방향이다. 현재 화면의 페이지에 한정하지 않는다.

**QA 결과 리포트 — PDF**

크몽 QA 결과 리포트 샘플과 같은 정보 구조를 지원하는 방향이다.

1. 테스트 개요
2. 이슈 요약
3. 이슈 현황
4. 대표 이슈
5. 출시 리스크 평가
6. QA 리드 최종 의견

이번에는 방향만 문서화하며 CSV/Excel/PDF 생성 및 신규 DB migration은 구현하지 않는다.

## 검증 및 운영

- 로컬 Docker DB만 사용. 신규 migration 없음. 기존 데이터 변환 없음.
- Backend/Frontend build 및 TypeScript, git diff --check 실행.
- `node backend/test/defects-report.integration.cjs`: 실제 HTTP/PG 7개 그룹.
  역할/검증, KPI/legacy, 재요청/추이, 한국시간 날짜 경계, 기간+빌드, 0건, 페이지별 집계 일관성.
- `node backend/test/defects.integration.cjs`: 기존 기능 18개 그룹 회귀.
- 임시 사용자/프로젝트/이슈/활동만 생성 후 제거하고 기존 데이터 fingerprint 비교.
  ADMIN 계정은 새로 만들거나 기존 세션을 철회하지 않고 검증용 세션만 생성/제거한다.
- 브라우저: Workspace 진입, 10건/처리율20%, 7일+빌드1.0=8건/25%,
  legacy 빈도, 재요청 1건/2건/3회, 상태 색상, 잔여/재요청 상세 이동, 0건/0%, 콘솔 오류 없음 확인.
- 이번 기능은 production DB/Storage를 수정하지 않으며 commit/push하지 않는다.
