# 이슈 현황 / QA 결과 리포트 기반 (2026-11-13)

## 이번 구현

프로젝트 Workspace의 이슈 현황 → `/projects/[projectId]/issue-report`.
승인된 USER/LEADER/ADMIN 모두 조회 가능하며 변경 액션은 없다.
기존 이슈 관리 상태/색상과 번호·상세 경로를 재사용한다. Chart library와 새 DB 구조는 추가하지 않았다.
후속 구현으로 Backend Excel/CSV Export와 화면 내보내기 선택 메뉴를 제공한다. QA 결과 리포트 작성/PDF는 별도 화면의 로컬 MVP로 구현했다.
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
| 05 QA 대응 고려사항 | 대표/잔여 이슈와 이슈 이력의 판단 맥락 | 출시 차단/출시 전 수정 권고/추후 개선 가능/추가 확인 필요를 리포트 작성 단계에서 직접 판단 |
| 06 QA 리드 최종 의견 | 검수·이슈 사실 데이터 참조 | 출시 가능 여부/핵심 위험/재검수/잔여 리스크 직접 입력; 자동 확정하지 않음 |

Export는 동일 필터와 generatedAt, KPI 정의를 재사용하도록 설계한다.
현재 페이지들을 나중에 다시 조회하면 데이터가 바뀔 수 있으므로 최종 제출본은 서버 측 일관된 snapshot으로 고정해야 한다.
이슈 현황 화면과 별도로 QA 결과 리포트에서 대표 이슈 선택·고려사항·최종 의견 입력 및 PDF를 제공한다. CSV/Excel은 아래 운영 데이터 Export로 구현했다.
Test Debt → Coverage Gap 개발 계획도 그대로 유지한다.

### 보고서의 테스트 기간

운영 화면의 전체/최근 7일/14일/30일 등록일 필터는 유지한다.
향후 QA 결과 리포트는 별도의 테스트 기간을 사용한다. 후보는 테스트 시작일~테스트 종료일,
또는 첫 이슈 등록일~최종 테스트 종료일이며, 실제 테스트 범위와 함께 QA 담당자가 확정한다.
이슈가 없는 프로젝트는 첫 이슈 등록일을 추정하지 않는다.
이슈가 없었던 날짜를 억지로 추이 그래프에 표시하지 않는다. 현재 API의 0건 날짜는 집계용 데이터일 뿐,
향후 보고서의 테스트 수행 여부나 그래프 표시를 자동 결정하는 근거로 사용하지 않는다.

### 내보내기: 운영 데이터 / QA 결과 리포트

**운영 데이터 Export — CSV / Excel**

전체 이슈 목록과 상태, 우선순위, 발생 빈도, 빌드 버전, 발생 단말/OS, 등록일, 최종 수정일을 제공한다.
Excel에는 상태 변경 이력, 재요청, 코멘트, 증빙 메타데이터도 포함한다. 현재 화면의 페이지에 한정하지 않는다.

**QA 결과 리포트 — PDF**

QA 결과 리포트는 아래 정보 구조를 사용한다.

1. 테스트 개요
2. 이슈 요약
3. 이슈 현황
4. 대표 이슈
5. QA 대응 고려사항
6. QA 리드 최종 의견

QA 결과 리포트 작성/PDF 1차 MVP를 로컬에 구현했다. 신규 migration 0013과 상세 동작은 아래 QA 결과 리포트 절을 따른다.

## Excel / CSV Export

`GET /defects/report/export?projectId=<uuid>&period=ALL|7|14|30&buildVersion=<exact string>&format=xlsx|csv`

- 기존 AuthGuard와 승인 USER/LEADER/ADMIN 조회 정책을 유지한다. 프로젝트 접근 격리는 이번에 추가하지 않는다.
- 화면의 기간/빌드 조건을 그대로 전달한다. 기간은 한국시간 등록일 기준이며 화면 pagination은 적용하지 않는다.
- report와 Export는 `report-filter.ts`의 SQL 조건을 공유한다. 읽기 전용 REPEATABLE READ transaction으로
  KPI와 전체 이슈, 활동, 코멘트, 첨부 메타데이터를 같은 snapshot에서 조회한다.
- 파일은 다운로드 요청 시점의 현재 값이다. 앞서 화면을 열어 둔 이후 다른 사용자가 변경한 값은 반영될 수 있다.
  Excel의 조회 기준일시를 기록하며, 과거 화면 데이터를 복원하는 기능은 아니다.
- 파일명: `QA_Checker_Issue_Report_프로젝트명_YYYYMMDD.xlsx|csv`. 날짜는 한국시간이며 금지 문자/제어문자는 제거한다.
- Content-Disposition의 UTF-8 filename, 정확한 MIME, private/no-store 헤더를 사용한다.
- Excel은 Backend 전용 ExcelJS 4.4.0으로 생성한다. Browser bundle에는 추가하지 않는다.
  ExcelJS 내부 UUID v4 사용은 호환되는 uuid 11.1.1 override로 고정해 구버전 advisory를 피한다.
- 서버 프로세스당 한 번에 1개 생성, 이슈 최대 5,000건, 상태 이력/코멘트/첨부 합계 최대 20,000건,
  선택 데이터 JSON UTF-8 크기 최대 10MiB. 조회당 15초 제한이다. 초과하면 일부만 잘라 제공하지 않고
  명확한 400/503 오류를 반환한다. CSV는 이슈 데이터만 한도를 검사한다.
- 필터/새로고침/내보내기 중복 클릭은 생성 중 비활성화한다. 실패는 화면에 표시한다.

| Excel Sheet | 내용 |
| --- | --- |
| 이슈 현황 | 프로젝트, 기간, 빌드, 한국시간 기준일시, KPI, 처리율, 8개 상태, 재요청 및 SKIP 지표 |
| 전체 이슈 | 조건에 맞는 전체 이슈 14개 컬럼 |
| 잔여 이슈 | VERIFIED/SKIP_CONFIRMED 제외, 전체 이슈와 같은 컬럼 |
| 재요청 이슈 | 현재 재요청 또는 실제 재요청 활동이 있는 이슈, 현재 여부/총 횟수/최초·최근 시각 |
| 상태 변경 이력 | STATUS_CHANGED만, 변경 전후 한글 상태/변경자/변경 일시, 시간순 |
| 코멘트 | 작성자/등록·수정 일시/본문, 시간순. 삭제 본문은 읽어 오지 않고 삭제 안내로 치환 |
| 증빙 자료 | 파일명/MIME/크기(bytes)/등록자/등록일/삭제 여부. 파일·storage_path·다운로드 URL·signed URL 제외 |

전체 이슈 및 CSV 컬럼 순서: 이슈 번호 → 상태 → 우선순위 → 발생 빈도 → 빌드 버전 → 발생 단말 / OS
→ 제목 → 재현 절차 → 이슈 내용 → 수정 방향 → 연계 이슈 → 등록자 → 등록일 → 최종 수정일.
번호는 ISSUE- 형식, enum은 화면의 한글 명칭으로 변환하며 legacy 표시도 유지한다.
현재 재요청이지만 활동이 없으면 횟수 0, 최초/최근 일시는 비워서 사실과 추정을 구분한다.

Excel은 굵은 헤더, 자동 필터, 첫 행 고정, 컬럼 폭, 줄바꿈을 적용한다. 숫자와 비율은 숫자형이며,
일시는 한국시간 벽시계 값의 Excel 날짜형으로 저장하고 `yyyy-mm-dd hh:mm:ss`로 표시한다.
CSV는 전체 이슈만 UTF-8 BOM / CRLF / 따옴표 escape로 제공한다. 수식으로 해석될 수 있는 값에는
앞에 작은따옴표를 붙인다. XLSX 사용자 입력은 수식 객체가 아닌 문자열로 저장한다.
최근 추이는 화면/Excel에 넣지 않으며 기존 API trend 및 테스트는 유지한다.

Export 검증은 report integration suite가 `defects-export.checks.cjs`를 함께 실행한다.
로컬 전용 fixture로 파일 재파싱, BOM/CSV escape/수식 방지, 7개 시트, 날짜/숫자/스타일,
한글·legacy·기간/빌드·0건·재요청·삭제 본문 비노출·첨부 metadata·5,000건·한도 초과·동시 요청을 검사한다.
`QA_EXPORT_ARTIFACT_DIR`을 지정하면 검증 파일을 저장소 밖에 보관할 수 있다.
브라우저에서 실제 Excel/CSV 다운로드, 기간/빌드 반영, 진행 중 비활성화, 인증 만료 오류를 확인했다.
검증 PC에 Microsoft Excel 설치가 확인되지 않아 Excel 앱 직접 열기/시각 검수는 후속 수동 확인이 필요하다.

## 검증 및 운영

- 이슈 현황/Excel/CSV는 신규 migration 없이 기존 데이터를 사용한다. QA 결과 리포트의 0013은 로컬에만 적용하며 기존 데이터 변환은 없다.
- Backend/Frontend build 및 TypeScript, git diff --check 실행.
- `node backend/test/defects-report.integration.cjs`: 실제 HTTP/PG report 7개 + Export 6개 그룹.
  역할/검증, KPI/legacy, 재요청/추이, 한국시간 날짜 경계, 기간+빌드, 0건, 페이지별 집계 일관성.
  Export는 실제 XLSX/CSV 재파싱과 형식/메타데이터/대량·동시 요청·한도 검증을 포함한다.
- `node backend/test/defects.integration.cjs`: 기존 기능 18개 그룹 회귀.
- 임시 사용자/프로젝트/이슈/활동만 생성 후 제거하고 기존 데이터 fingerprint 비교.
  ADMIN 계정은 새로 만들거나 기존 세션을 철회하지 않고 검증용 세션만 생성/제거한다.
- 브라우저: Workspace 진입, 10건/처리율20%, 7일+빌드1.0=8건/25%,
  legacy 빈도, 재요청 1건/2건/3회, 상태 색상, 잔여/재요청 상세 이동, 0건/0%, 콘솔 오류 없음 확인.
- 로컬 구현/검증 과정에서 production DB/Storage는 변경하지 않았다.

## QA 결과 리포트 — 구현 상태

### 저장/API/권한

`0013_add_qa_reports.sql`은 신규 `qa_reports`, `qa_report_issue_links`와 CHECK/FK/INDEX만 생성한다. BEGIN/COMMIT으로 묶이며 중복 실행용이 아니다. 로컬 적용 완료, production 미적용이다.

API 기본 경로는 `/projects/:projectId/qa-reports`다.
- GET 목록, GET `/:id` 상세: 승인 USER/LEADER/ADMIN.
- POST 생성, PATCH `/:id` 수정: LEADER/ADMIN. USER 직접 호출은 403.
- GET `/:id/candidates`: 저장된 테스트 기간/집계 빌드 기준 후보와 요약, 30개 페이지 및 검색.
- POST `/:id/pdf`: 승인 역할 모두. 저장 version 확인, PDF 필수 입력 및 연결 이미지 재검증.

초안은 빈 값 저장을 지원한다. 재접속 시 저장 값을 복원한다. PATCH는 version을 증가시키며 오래된 version은 409다. 시작일이 종료일보다 늦으면 거절한다. 저장 전 변경사항은 기존 LeaveGuard로 이탈 확인하며 저장 후 해제한다.

### 집계와 6개 영역

1. 테스트 개요: 제목, 대상 빌드, 시작/종료일, 범위, 환경, 방식.
2. 이슈 요약: 전체/미처리/대응 중/대응 완료/수정 확인/SKIP/처리율.
3. 이슈 현황: 상태/우선순위/빈도, 재요청, SKIP. 기존 report 집계 재사용.
4. 대표 이슈: 최대 5개, 선택 순서, 재현 절차/내용과 이미지. 이슈 0건 또는 대표 0건도 허용.
5. QA 대응 고려사항: 필수 대응 고려/우선 대응 고려/추후 개선 고려/추가 확인 필요. 각 수동 서술과 관련 이슈를 표로 표시하며 동일 이슈를 여러 분류에 연결할 수 있다. 자동 위험 평가 기능은 아니다.
6. QA 리드 최종 의견: 최대 10,000자, 긴 한글과 페이지 나눔 지원.

테스트 기간은 한국시간 등록일 기준이며 종료일을 포함한다. 대상 빌드 표시와 집계 빌드는 별도다. 통계는 현재 상태이고 과거 snapshot이 아니다. 대표/고려사항 이슈는 같은 프로젝트 및 저장된 기간/빌드 조건에 속해야 한다. 기간 변경 시 기존 선택이 범위를 벗어나면 저장을 거절하므로 먼저 선택 해제한다.

### PDF/이미지/미리보기

Backend PDFKit + sharp로 A4 가로 Executive Summary PDF를 만든다. 첫 페이지에 01~03 전체와 KPI 7개를 배치하고, 집계 기준은 하단 주석으로 표시한다. 우선순위는 즉시 → 높음 → 중간 → 낮음 순서다. 연결 이슈가 0건인 고려사항은 입력 문구와 관계없이 PDF에서 관련 ISSUE `없음`, 주요 내용 `해당 없음`으로 표시한다. Noto Sans CJK KR Regular/Bold OTF와 OFL 라이선스를 포함하며 build assets로 복사한다. 한글 wrap, Page X / Y, 긴 표의 반복 헤더를 지원한다.
대표 이슈마다 첫 번째 활성 이미지 또는 사용자가 선택한 활성 이미지를 1개 출력한다. PNG/JPEG/WEBP는 sharp로 변환하고 방향/비율을 보존한다. 이미지당 5MiB 및 2천만 픽셀 제한, 최대 1400×1100 리사이즈를 적용한다. 원본 파일은 바꾸지 않는다. 영상은 `영상 증빙 있음`만 표시하고 PDF에 임베드하지 않는다.
다른 이슈의 이미지, 삭제된 선택 이미지는 거절한다. 이미지가 없는 경우 안내를 출력한다. 기존 Backend 첨부 접근과 private Storage를 재사용하며 별도 공개 URL/새 bucket을 만들지 않는다.

미리보기와 다운로드는 동일 POST PDF 응답의 Blob/Object URL을 공유한다. 같은 화면의 반복 미리보기는 생성 파일을 재사용한다. 입력 변경/저장 시 이전 URL 해제, 화면 종료 시 URL 해제 및 진행 중 요청 취소를 수행한다. 오류를 표시하고 생성 중 중복 클릭을 막는다. 서버는 프로세스당 1개 PDF만 생성한다.

수동 화면 검수: 로컬 Workspace → QA 결과 리포트 → 리포트 작성 → 필수 개요/리드 의견 입력 → 초안 저장 → 대표 이슈/고려사항 선택 → 초안 저장 → 미리보기 → PDF 내보내기.
Chrome 자동 제어는 재시도하지 않았다. 최종 브라우저 내 PDF 렌더링은 미확인이다. 대신 실제 API의 PDF를 이미지로 렌더링해 0건/1건 무이미지/최대5건/PNG·JPEG·WEBP/긴 한글/고려사항4종을 검수한다.

### 운영 한계

제출본 snapshot, 승인 workflow, 최종 제출본 영구 보관은 미구현이다. PDF는 생성 시점 자료이며 DB에 PDF 파일을 저장하지 않는다. 후보/입력 저장 이후 이슈가 변경되면 재생성 값도 달라질 수 있다. 프로젝트 멤버십 격리는 기존과 동일하게 미구현이다.
Production 적용 전 백업/0013 미적용 확인 및 FK 대상 확인, 수동 migration 적용, DB 직접 접근 권한/RLS 점검, Render Node/sharp 및 폰트 asset 배포 확인이 필요하다. 기존 다중 lockfile 경고는 기능 실패와 구분한다.


최종 자동 검증: Backend build/TypeScript, Frontend production build/TypeScript, QA 리포트 7개 그룹, report/Export 13개 그룹, defects 회귀 18개 그룹, git diff --check 통과. 동일 로컬 DB fixture의 간섭을 피하도록 integration suite는 순차 실행한다. 각 suite의 기존 데이터 fingerprint 및 정리 검사까지 통과했다. 기존 브라우저 검증용 사용자 2개/리포트 1개/연결 2개/세션 2개도 정확한 ID와 소유자를 확인해 정리했다.
