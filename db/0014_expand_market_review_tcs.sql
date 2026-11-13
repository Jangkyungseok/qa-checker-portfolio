-- 0014: 검증된 production 마스터 TC 63개를 91개로 확장합니다.
-- 실행 승인 전 local/production 어디에서도 실행하지 않습니다. 기존 seed를 재실행하지 않습니다.
-- 비멱등 migration: 이미 적용되었거나 부분/다른 상태이면 사전 검증에서 중단합니다.
-- SQL Editor에서는 BEGIN부터 COMMIT까지 전체 파일을 한 번에 실행합니다.
-- 오류 시 다음 문장을 개별 실행하지 말고 세션의 실패 transaction을 ROLLBACK한 후 원인을 확인합니다.
-- 테이블 변경은 원자적입니다. PostgreSQL sequence nextval 소비는 rollback되지 않아 실패 시 번호 공백이 남을 수 있습니다.
-- 기존 inspection snapshot/결과/첨부는 조회·변경하지 않습니다. 신규 검수만 새 마스터를 snapshot합니다.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- 동시 마스터 변경/동시 migration을 막고 일반 SELECT는 허용합니다.
LOCK TABLE public.categories, public.test_items IN SHARE ROW EXCLUSIVE MODE;

DO $migration$
DECLARE
  v_new constant jsonb := $new_data$
[
  {
    "code": "G01",
    "title": "제출 빌드 Target API 요구사항 충족 확인",
    "priority": "P0",
    "development": true,
    "tc_no": null,
    "check_content": "실제 제출 AAB의 targetSdkVersion이 제출일·기기 유형별 요구사항을 충족한다. 확인일 기준 일반 휴대폰/태블릿 신규·업데이트 제출은 API 36 이상이며 minSdkVersion과 구분한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\nGoogle Play 제출 빌드에 수행한다. 지원 기기 유형별 기준을 구분하며 단순 기능 미사용으로 SKIP하지 않는다. 공식 제외 배포에 해당하는 경우에만 근거와 함께 SKIP한다.\n\n[조작/확인 순서]\n1. 공식 페이지의 제출일 기준 요구사항·예외 확인\n2. 제출 AAB와 Console App Bundle Explorer의 target SDK 확인\n3. 일반 모바일/Wear OS/TV/Automotive/XR별 기준 대조\n4. 기존 앱 노출 기준과 신규·업데이트 제출 기준을 구분하여 결과 기록\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://developer.android.com/google/play/requirements/target-sdk\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\nGoogle Play 제출 빌드에 수행한다. 지원 기기 유형별 기준을 구분하며 단순 기능 미사용으로 SKIP하지 않는다. 공식 제외 배포에 해당하는 경우에만 근거와 함께 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G01"
  },
  {
    "code": "G02",
    "title": "16KB 페이지 크기 호환성 확인",
    "priority": "P0",
    "development": true,
    "tc_no": null,
    "check_content": "앱과 포함 SDK의 네이티브 라이브러리 ELF·패키지 정렬 및 16KB 환경 핵심 동작이 정상이다. 확인일 공식 문서는 API 35 이상 대상 앱의 지원과 2027-02-01 미지원 업데이트 출시 차단을 안내한다. 적용일을 구분해 판정한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n64비트 Android 제출 앱의 16KB 지원을 확인한다. Java/Kotlin 전용이며 모든 SDK에도 네이티브 코드가 없으면 ELF 정렬 단계만 비해당 처리하고 16KB 실행 확인은 수행한다.\n\n[조작/확인 순서]\n1. 공식 일정과 해당 빌드 적용 대상 확인\n2. APK Analyzer로 모든 ABI와 SDK의 .so 포함 여부 확인\n3. 네이티브 ELF와 생성 APK ZIP 정렬 확인\n4. 16KB 에뮬레이터/기기의 실제 페이지 크기 확인\n5. 설치·실행·로그인·핵심 기능·결제 해당 기능 확인\n6. 호환 모드 의존 여부와 크래시 로그 기록\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://developer.android.com/guide/practices/page-sizes\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n64비트 Android 제출 앱의 16KB 지원을 확인한다. Java/Kotlin 전용이며 모든 SDK에도 네이티브 코드가 없으면 ELF 정렬 단계만 비해당 처리하고 16KB 실행 확인은 수행한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G02"
  },
  {
    "code": "G03",
    "title": "App access 및 심사용 접근 정보 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "Console App access 선언이 실제 접근 제한과 일치하고 심사자가 역할·유료 기능을 포함한 제출 기능에 접근할 수 있다. 제한 계정은 재사용 가능하고 심사 기간 동안 유효하다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 제출 앱에 수행한다. 로그인·유료 접근 제한이 없어도 Console의 제한 없음 선언을 확인하며 전체 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. Console App access 열기\n2. 비로그인 상태에서 전체 주요 기능 접근 확인\n3. 제한이 있으면 역할별/유료 접근 계정과 OTP·2FA 처리 안내 확인\n4. 새 기기와 필요한 지역 조건에서 제공 계정으로 접속\n5. 계정 만료·서버 접근·추가 인증으로 심사 차단이 없는지 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/15748846?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 제출 앱에 수행한다. 로그인·유료 접근 제한이 없어도 Console의 제한 없음 선언을 확인하며 전체 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G03"
  },
  {
    "code": "G04",
    "title": "Data Safety와 실제 데이터 처리 일치 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "Console의 수집·공유·목적·보안·삭제 답변이 앱·서버·제3자 SDK의 실제 데이터 처리와 일치한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\nData Safety 작성 대상 제출에 수행한다. 데이터 미수집 앱도 미수집 선언 및 실제 앱·SDK 처리를 확인하며 기능 없음만으로 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. 앱·서버·SDK 버전별 데이터 목록 확보\n2. 최초 실행/동의 전후/로그인/주요 기능에서 전송과 서버 처리 확인\n3. 수집과 공유 정의·정책상 예외 대조\n4. Console 각 응답과 처리 목록 비교\n5. 불일치 항목·변경 SDK의 신고 반영 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/10787469?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\nData Safety 작성 대상 제출에 수행한다. 데이터 미수집 앱도 미수집 선언 및 실제 앱·SDK 처리를 확인하며 기능 없음만으로 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G04"
  },
  {
    "code": "G05",
    "title": "개인정보처리방침 및 데이터 처리 고지 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "Console 및 앱의 개인정보처리방침이 공개 접근 가능하고 앱·서버·SDK의 처리·보존·삭제와 일치한다. 예상하기 어려운 민감정보 처리는 시작 전 명확한 별도 고지와 동의를 제공한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 제출 앱에 수행한다. 개인정보 미수집 선언이 있어도 방침 URL·운영 주체·실제 SDK 처리를 확인하고 전체 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. Console/앱의 방침 링크를 비로그인 브라우저에서 열기\n2. 운영 주체·연락처·처리 항목·목적·공유·보존·삭제 확인\n3. SDK 포함 실제 처리 목록과 대조\n4. 예상 밖 수집이 있으면 고지·동의 전후 네트워크와 거부 동작 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/10144311?hl=en\nhttps://support.google.com/googleplay/android-developer/answer/11150561?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 제출 앱에 수행한다. 개인정보 미수집 선언이 있어도 방침 URL·운영 주체·실제 SDK 처리를 확인하고 전체 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G05"
  },
  {
    "code": "G06",
    "title": "계정 및 관련 데이터 삭제 경로 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "앱 내 삭제 요청과 Console 등록 외부 웹 경로가 동작하고 계정 및 관련 데이터 삭제가 처리된다. 단순 정지로 대체하지 않으며 정당한 보존 항목·기간·이유를 안내한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n앱에서 계정 생성 기능을 제공하는 경우 수행한다. 제공하지 않으면 계정 생성 경로 부재를 확인하고 SKIP한다.\n\n[조작/확인 순서]\n1. 테스트 계정 생성 및 관련 데이터 저장\n2. 앱 내 계정 삭제 진입\n3. 외부 웹 삭제 URL을 앱 재설치 없이 열어 요청\n4. 요청 접수·처리 완료 확인\n5. 서버/관련 SDK 데이터 삭제와 재로그인 상태 확인\n6. 보존 예외 안내 대조\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/13327111?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n앱에서 계정 생성 기능을 제공하는 경우 수행한다. 제공하지 않으면 계정 생성 경로 부재를 확인하고 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G06"
  },
  {
    "code": "G07",
    "title": "광고 포함 선언과 실제 광고 일치 확인",
    "priority": "P1",
    "development": false,
    "tc_no": null,
    "check_content": "Console의 광고 포함 여부가 실제 앱·SDK의 광고 노출과 일치한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 제출 앱에 수행한다. 광고가 없어도 Console의 광고 없음 선언과 앱·SDK 구성을 확인하며 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. Console 광고 선언 확인\n2. 광고 SDK와 원격 설정 목록 확인\n3. 최초 실행·주요 화면·보상형·전면·배너 등 실제 경로 점검\n4. 광고 유무와 선언 대조\n5. 광고 없음이면 SDK/설정과 실제 화면 근거 기록\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/9859455?hl=en\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 제출 앱에 수행한다. 광고가 없어도 Console의 광고 없음 선언과 앱·SDK 구성을 확인하며 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G07"
  },
  {
    "code": "G08",
    "title": "광고 콘텐츠 및 표시 방식 적정성 확인",
    "priority": "P1",
    "development": false,
    "tc_no": null,
    "check_content": "광고 콘텐츠가 앱 대상 연령에 적합하고 닫기·건너뛰기 동작이 명확하다. 오인 클릭 유도나 정책상 금지되는 예기치 않은 방해 광고가 없다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n앱 내 광고가 있으면 수행하며 광고와 광고 SDK/원격 활성화 경로가 없으면 SKIP한다.\n\n[조작/확인 순서]\n1. 광고 형식별 진입 경로 확인\n2. 실제 광고와 연령 필터 설정 확인\n3. 닫기/뒤로가기/건너뛰기 조작\n4. 핵심 기능 수행 도중 예상 밖 전면 광고 확인\n5. 광고와 앱 UI 혼동·강제 클릭 여부 기록\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/9857753?hl=en\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n앱 내 광고가 있으면 수행하며 광고와 광고 SDK/원격 활성화 경로가 없으면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G08"
  },
  {
    "code": "G09",
    "title": "타깃 연령 및 콘텐츠 선언 일치 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "Console Target audience and content의 연령대가 앱 콘텐츠·디자인·홍보 대상과 일치하고 아동 포함 여부가 올바르다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 제출 앱에 수행한다. 아동 비대상 앱도 실제 디자인·홍보·기능과 대상 연령 선언을 비교하며 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. Console 대상 연령 확인\n2. 스토어 이미지·설명·앱 콘텐츠·마케팅 대상 확인\n3. 아동을 실제로 대상으로 하는지 비교\n4. 혼합 연령이면 연령 분기와 Families 적용 여부 확인\n5. IARC 콘텐츠 등급 답변과 혼동 없이 기록\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/9859455?hl=en\nhttps://support.google.com/googleplay/android-developer/answer/9893335?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 제출 앱에 수행한다. 아동 비대상 앱도 실제 디자인·홍보·기능과 대상 연령 선언을 비교하며 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G09"
  },
  {
    "code": "G10",
    "title": "Families 적용 및 아동 대상 처리 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "아동·연령 미확인 사용자의 데이터·광고 처리와 연령 분기가 정책에 맞다. 해당 광고 SDK 및 사용 버전이 인증 대상이며 금지된 개인화 광고·수집이 없다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n아동을 대상에 포함하거나 Families 정책 적용 대상이면 수행한다. 비대상 근거가 확인되면 SKIP한다.\n\n[조작/확인 순서]\n1. 대상 연령과 실제 콘텐츠 확인\n2. 혼합 연령이면 중립적 연령 확인 및 아동/미확인 경로 테스트\n3. 각 경로의 데이터 수집·식별자·광고 확인\n4. 광고 SDK 이름·버전을 공식 인증 목록과 비교\n5. 구매·외부 이동 등 적용 보호조치 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/9893335?hl=en\nhttps://support.google.com/googleplay/android-developer/answer/12918983?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n아동을 대상에 포함하거나 Families 정책 적용 대상이면 수행한다. 비대상 근거가 확인되면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G10"
  },
  {
    "code": "G11",
    "title": "콘텐츠 등급 설문과 실제 콘텐츠 일치 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "IARC 설문과 등급이 실제 콘텐츠·온라인 상호작용·관련 기능 및 제출 버전에 일치한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n콘텐츠 등급 대상 제출 앱에 수행한다. 콘텐츠가 단순하거나 이슈가 없다는 이유로 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. Console 현재 등급 설문 확인\n2. 폭력·성적 표현·도박 유사 요소·UGC·상호작용 등 실제 제공 범위 대조\n3. 지역별 등급 결과 확인\n4. 신규 콘텐츠와 원격 제공 콘텐츠의 설문 반영 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/9859655?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n콘텐츠 등급 대상 제출 앱에 수행한다. 콘텐츠가 단순하거나 이슈가 없다는 이유로 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G11"
  },
  {
    "code": "G12",
    "title": "Google Play Billing 적용 및 제출 적격성 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "해당 디지털 구매에 Play Billing 또는 승인된 예외 경로를 사용하며 제출 가능한 Billing 버전·상품 구성을 갖춘다. 확인일 기준 Billing 7 제출 유예가 종료되어 8 이상 기준을 재확인한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n디지털 상품/서비스 구매를 제공할 때 수행한다. 해당 구매가 없으면 SKIP하며 예외 결제는 공식 자격 근거를 확인한다.\n\n[조작/확인 순서]\n1. 디지털/실물 상품과 예외 구분\n2. 릴리스 의존성과 병합 manifest에서 Billing 버전 확인\n3. Console 상품 상태·판매 지역·가격 확인\n4. 라이선스 테스트 계정으로 상품 조회·결제 화면 진입\n5. 표시 가격과 Play 가격·결제 경로 확인; 지급/취소/복구는 기존 결제 TC와 연결\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/9858738?hl=en\nhttps://developer.android.com/google/play/billing/deprecation-faq\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n디지털 상품/서비스 구매를 제공할 때 수행한다. 해당 구매가 없으면 SKIP하며 예외 결제는 공식 자격 근거를 확인한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G12"
  },
  {
    "code": "G13",
    "title": "구독 조건 및 해지 경로 확인",
    "priority": "P1",
    "development": false,
    "tc_no": null,
    "check_content": "구매 전 가격·청구 주기·자동 갱신·체험 종료 후 가격이 명확하고 앱에서 구독 관리/해지 경로에 접근할 수 있다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n구독 상품이 있으면 수행하며 구독 미제공이면 SKIP한다.\n\n[조작/확인 순서]\n1. 신규/체험/기존 구독 계정으로 구매 화면 열기\n2. 가격·총 청구 금액·기간·체험 전환 조건 확인\n3. 앱 내 구독 관리에서 해지 경로 진입\n4. 테스트 구독 해지 후 만료 전 권한·만료 후 처리 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/12154973?hl=en\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n구독 상품이 있으면 수행하며 구독 미제공이면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G13"
  },
  {
    "code": "G14",
    "title": "확률형 유료 상품 확률 표시 확인",
    "priority": "P1",
    "development": false,
    "tc_no": null,
    "check_content": "구매 전 가까운 위치에서 보상 확률을 확인할 수 있고 현재 서버 상품·확률 설정과 표시값이 일치한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n유료 재화 등을 통한 무작위 보상 구매가 있으면 수행하며 해당 상품이 없으면 SKIP한다.\n\n[조작/확인 순서]\n1. 직접 결제/유료 재화 사용 확률 상품 목록 확인\n2. 결제 확정 전 확률 안내 열기\n3. 상품별/이벤트별/보장 조건별 표기 확인\n4. 개발 제공 서버 설정·버전과 대조; 소수 추첨 결과로 확률을 단정하지 않기\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/9858738?hl=en\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n유료 재화 등을 통한 무작위 보상 구매가 있으면 수행하며 해당 상품이 없으면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G14"
  },
  {
    "code": "G15",
    "title": "UGC 운영·신고·차단 확인",
    "priority": "P1",
    "development": false,
    "tc_no": null,
    "check_content": "UGC 이용 조건과 금지 행위 안내, 필요한 콘텐츠/사용자 신고·차단 및 운영 대응 경로가 동작한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n게시물·채팅 등 UGC가 있으면 수행하며 UGC 기능이 없으면 SKIP한다.\n\n[조작/확인 순서]\n1. 두 테스트 계정으로 게시/채팅 진입\n2. 작성 전 약관·정책 확인\n3. 테스트 콘텐츠·사용자 신고\n4. 운영 접수 확인\n5. 공개 UGC/DM별 필요한 사용자 차단 실행\n6. 차단 후 노출·연락 제한과 운영 처리 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/9876937/user-generated-content\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n게시물·채팅 등 UGC가 있으면 수행하며 UGC 기능이 없으면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G15"
  },
  {
    "code": "G16",
    "title": "제한 권한·API 사용 자격 및 최소화 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "위치·SMS/통화·접근성·패키지 조회·설치 권한·FGS 등 사용이 허용 목적에 한정되고 필요한 신고·동의·최소 범위 조건을 충족한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n릴리스 앱·SDK의 제한 권한/API 목록을 확인한다. 관련 사용이 전혀 없음을 manifest·SDK 근거로 확인한 경우 SKIP한다. 사진/전체 파일/정확한 알람/전체 화면 intent는 G17~G20에서 별도 확인한다.\n\n[조작/확인 순서]\n1. 최종 병합 manifest와 SDK 권한/API 목록 추출\n2. 핵심 기능과 각 사용 목적 연결\n3. 공식 자격·Console 선언/승인 및 대안 비교\n4. 권한 거부/제한 범위 선택 상태 테스트\n5. 무관한 기능 차단과 불필요한 백그라운드 접근 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/16558241?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n릴리스 앱·SDK의 제한 권한/API 목록을 확인한다. 관련 사용이 전혀 없음을 manifest·SDK 근거로 확인한 경우 SKIP한다. 사진/전체 파일/정확한 알람/전체 화면 intent는 G17~G20에서 별도 확인한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G16"
  },
  {
    "code": "G17",
    "title": "사진·동영상 권한 및 Photo Picker 대안 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "광범위 미디어 접근은 허용 핵심 용도와 필요한 선언에 부합한다. 일회성·제한적 선택은 Photo Picker 등 적절한 대안을 사용한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n사진·동영상 읽기 또는 선택 기능이 있으면 수행하며 관련 기능·권한이 없으면 SKIP한다.\n\n[조작/확인 순서]\n1. 병합 manifest의 READ_MEDIA 권한과 기능 목록 확인\n2. 프로필/첨부 등 파일 선택 경로 실행\n3. 선택한 파일만 접근하는 대안 확인\n4. 광범위 접근이면 빈도·핵심 목적·Console 승인 근거 확인\n5. 거부·선택 접근 상태에서 동작 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/16558241?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n사진·동영상 읽기 또는 선택 기능이 있으면 수행하며 관련 기능·권한이 없으면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G17"
  },
  {
    "code": "G18",
    "title": "All files access 사용 적격성 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "전체 파일 접근이 허용된 핵심 용도이며 SAF 등 제한된 대안으로 충족 불가능한 근거와 필요한 Console 선언/승인을 갖춘다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\nMANAGE_EXTERNAL_STORAGE 사용 시 수행한다. 앱·SDK가 선언/요청하지 않으면 SKIP한다.\n\n[조작/확인 순서]\n1. 최종 manifest 확인\n2. 실제 모든 파일 접근 요청 경로 확인\n3. 핵심 용도와 공식 허용 범위 대조\n4. SAF/미디어 선택 대안 검토 증거 확인\n5. 승인 및 미허용 상태의 기능 처리 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/16558241?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\nMANAGE_EXTERNAL_STORAGE 사용 시 수행한다. 앱·SDK가 선언/요청하지 않으면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G18"
  },
  {
    "code": "G19",
    "title": "Exact Alarm 권한 및 대안 처리 확인",
    "priority": "P1",
    "development": false,
    "tc_no": null,
    "check_content": "USE_EXACT_ALARM은 허용 핵심 용도에만 사용하고 다른 경우 SCHEDULE_EXACT_ALARM 허용 경로나 부정확 알람 대안을 검토한다. 미허용 상태에서도 오류 없이 대응한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n정확한 알람 API/권한을 사용하면 수행하며 미사용이 확인되면 SKIP한다.\n\n[조작/확인 순서]\n1. 권한·API 호출과 실제 목적 확인\n2. USE_EXACT_ALARM 허용 용도 비교\n3. SCHEDULE_EXACT_ALARM 사용 시 사용자 허용 상태별 실행\n4. 거부/철회/재실행 후 예약 처리와 대안 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/16558241?hl=en\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n정확한 알람 API/권한을 사용하면 수행하며 미사용이 확인되면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G19"
  },
  {
    "code": "G20",
    "title": "Full-screen intent 사용 적정성 확인",
    "priority": "P1",
    "development": false,
    "tc_no": null,
    "check_content": "자동 부여 대상인 통화·알람 용도와 그 외 별도 허용 경로를 구분하고 필요한 선언·사용자 허용을 갖춘다. 광고 등 부당한 방해에 사용하지 않는다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\nUSE_FULL_SCREEN_INTENT 사용 시 수행하며 관련 선언·호출이 없으면 SKIP한다.\n\n[조작/확인 순서]\n1. manifest/알림 구현 확인\n2. 실제 용도와 Console 선언 대조\n3. 자동 부여 대상 여부 확인\n4. 허용/거부 상태 및 잠금 화면에서 알림 실행\n5. 일반 광고·무관한 기능에 전체 화면을 사용하는지 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/16558241?hl=en\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\nUSE_FULL_SCREEN_INTENT 사용 시 수행하며 관련 선언·호출이 없으면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G20"
  },
  {
    "code": "G21",
    "title": "스토어 정보와 실제 제출 앱 일치 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "이름·설명·스크린샷·현지화·유료 기능 안내가 제출 앱과 일치하고 오인·과장·금지된 순위/프로모션 표현이 없다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 제출 앱에 수행한다. 기능이 적거나 변경이 없다는 이유로 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. 언어별 스토어 등록정보 확보\n2. 제출 빌드에서 소개 기능 재현\n3. 이미지·설명·가격/유료 범위 비교\n4. 앱 이름·아이콘·개발자 정보의 오인 표현 확인\n5. 지역/버전별 차이가 적절히 안내되는지 기록\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/9898842?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 제출 앱에 수행한다. 기능이 적거나 변경이 없다는 이유로 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G21"
  },
  {
    "code": "G22",
    "title": "외부 결제·링크의 지역별 적용 조건 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "외부 구매 경로가 대상 국가·프로그램·등록 자격 및 고지 조건에 맞게 제공되며 미허용 지역에서 우회 노출되지 않는다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n디지털 구매의 외부 결제/유도 링크가 있으면 수행한다. 앱·웹뷰·가입 흐름을 포함해 해당 경로가 없으면 SKIP한다.\n\n[조작/확인 순서]\n1. 공식 정책과 현재 참여 프로그램·등록 상태 확인\n2. 판매 지역별 허용 매트릭스 확보\n3. 해당 스토어 계정으로 앱/웹뷰/가입/도움말 링크 확인\n4. 허용·미허용 지역의 구매 이동과 고지 비교\n5. 링크 최종 목적지·가격·필수 안내 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nGoogle Play / Android 공식 문서\nhttps://support.google.com/googleplay/android-developer/answer/9858738?hl=en\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n디지털 구매의 외부 결제/유도 링크가 있으면 수행한다. 앱·웹뷰·가입 흐름을 포함해 해당 경로가 없으면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-G22"
  },
  {
    "code": "I40",
    "title": "App Privacy 라벨과 실제 데이터 처리 일치 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "App Store Connect 개인정보 답변의 데이터 수집·사용 목적·사용자 연결·추적 여부가 앱·서버·SDK의 실제 처리와 일치한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 iOS 제출에 수행한다. 미수집 앱도 App Privacy 미수집 답변과 SDK 동작을 확인하며 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. SDK 포함 데이터 처리 목록 확보\n2. App Store Connect 개인정보 답변 확인\n3. 동의 전후·로그인·주요 기능별 실제 전송 확인\n4. 연결/추적 정의에 맞게 각 항목 비교\n5. 미수집 선언도 실제 처리 근거와 대조\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/app-store/app-privacy-details/\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 iOS 제출에 수행한다. 미수집 앱도 App Privacy 미수집 답변과 SDK 동작을 확인하며 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I40"
  },
  {
    "code": "I41",
    "title": "Privacy manifest·Required Reason API·SDK 제출 요건 확인",
    "priority": "P0",
    "development": true,
    "tc_no": null,
    "check_content": "유효한 privacy manifest와 실제 사용에 맞는 Required Reason API 허용 사유를 갖추며 대상 SDK의 manifest·서명 등 제출 요건을 충족한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n제출 Archive의 API/SDK 목록을 확인한다. 개별 요구가 없는 경우 해당 단계만 비해당 처리하며 목록을 확인하지 않고 전체 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. 최종 Archive의 SDK/버전/API 목록 확인\n2. 공식 대상 SDK 목록 대조\n3. PrivacyInfo.xcprivacy 형식·실제 처리·Required Reason API 사유 확인\n4. 해당 바이너리 SDK 서명 확인\n5. Archive 검증/제출 진단의 관련 오류 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/support/third-party-SDK-requirements/\nhttps://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api\nhttps://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n제출 Archive의 API/SDK 목록을 확인한다. 개별 요구가 없는 경우 해당 단계만 비해당 처리하며 목록을 확인하지 않고 전체 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I41"
  },
  {
    "code": "I42",
    "title": "Accessibility 표시와 실제 지원 일치 확인",
    "priority": "P2",
    "development": false,
    "tc_no": null,
    "check_content": "기기별로 표시한 접근성 기능을 주요 작업 전반에서 실제 지원하며 일부 화면만 지원하면서 전체 지원으로 오인 표시하지 않는다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\nApp Store의 Accessibility 지원 표시를 제공하는 경우 수행한다. 선택 표시를 제공하지 않으면 SKIP하며 미표시 자체를 제출 실패로 간주하지 않는다.\n\n[조작/확인 순서]\n1. App Store Connect 기기별 지원 표시 확인\n2. 해당 기기에서 VoiceOver/텍스트 크기 등 선언 기능 활성화\n3. 가입·로그인·구매 포함 주요 작업 수행\n4. 읽기 순서·조작·잘림·차단 여부와 선언 비교\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/\n\n[우선순위]\nP2\n\n[확인일]\n2026-11-13\n\n[적용 조건]\nApp Store의 Accessibility 지원 표시를 제공하는 경우 수행한다. 선택 표시를 제공하지 않으면 SKIP하며 미표시 자체를 제출 실패로 간주하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I42"
  },
  {
    "code": "I43",
    "title": "Kids Category 보호조치 확인",
    "priority": "P0",
    "development": false,
    "tc_no": null,
    "check_content": "외부 이동·구매의 필요한 부모 게이트와 광고·분석 SDK 제한이 적용되고 예외 사용은 공식 조건을 충족한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\nKids Category 대상이면 수행하며 해당 카테고리가 아니면 SKIP한다. 다른 아동 관련 의무의 면제를 의미하지 않는다.\n\n[조작/확인 순서]\n1. Console 카테고리와 대상 연령 확인\n2. 구매·외부 링크·설정 경로의 부모 게이트 테스트\n3. 광고·분석 SDK와 실제 수집 확인\n4. 예외 조건과 콘텐츠 적정성 증거 대조\n5. 부모 게이트 우회 경로 점검\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/app-store/review/guidelines/#kids-category\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\nKids Category 대상이면 수행하며 해당 카테고리가 아니면 SKIP한다. 다른 아동 관련 의무의 면제를 의미하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I43"
  },
  {
    "code": "I44",
    "title": "앱 내 광고 콘텐츠 및 상호작용 적정성 확인",
    "priority": "P1",
    "development": false,
    "tc_no": null,
    "check_content": "광고가 연령 등급에 적합하고 닫기/건너뛰기와 부적절한 광고 신고가 명확하며 오인 클릭을 유도하지 않는다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n앱 내 광고가 있으면 수행하며 광고 경로가 없으면 SKIP한다. ATT 동의 검증은 별도 기존 TC에서 수행한다.\n\n[조작/확인 순서]\n1. 광고 형식별 실제 노출 확인\n2. 연령 설정·광고 콘텐츠 비교\n3. 닫기/건너뛰기/뒤로가기 조작\n4. 부적절한 광고 신고 경로 테스트\n5. 앱 UI와 혼동·강제 클릭 여부 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/app-store/review/guidelines/#software-requirements\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n앱 내 광고가 있으면 수행하며 광고 경로가 없으면 SKIP한다. ATT 동의 검증은 별도 기존 TC에서 수행한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I44"
  },
  {
    "code": "I45",
    "title": "제출 빌드 Xcode·SDK 최소 요구사항 확인",
    "priority": "P0",
    "development": true,
    "tc_no": null,
    "check_content": "실제 Archive의 Xcode·SDK가 제출일 기준 최소 요구를 충족한다. 확인일 기준 2026-04-28 이후 Xcode 26 이상·iOS 26 SDK 이상 요구를 공식 문서로 재확인한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 iOS 제출 빌드에 수행한다. 배포 대상 최소 OS와 빌드 SDK 요구사항을 구분하고 기능 미사용으로 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. 공식 제출 요건과 효력일 확인\n2. CI/로컬 빌드 도구 버전 기록 확인\n3. 실제 Archive의 SDK·빌드 도구 정보 대조\n4. deployment target과 SDK 버전 구분\n5. App Store Connect 업로드 검증 결과 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/news/upcoming-requirements/?id=04282026a\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 iOS 제출 빌드에 수행한다. 배포 대상 최소 OS와 빌드 SDK 요구사항을 구분하고 기능 미사용으로 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I45"
  }
]
$new_data$::jsonb;
  v_updates constant jsonb := $update_data$
[
  {
    "code": "I01",
    "title": "심사 제출 빌드 완성도 및 주요 기능 접근 가능 여부 확인",
    "priority": "P0",
    "development": false,
    "tc_no": 11,
    "check_content": "심사 대상 실제 기기·OS에서 제출 기능에 접근할 수 있고 진행 차단·비정상 종료·무한 로딩이 없다. 실제 테스트 환경이 심사 정보와 일치한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 iOS 심사 제출에 수행한다. 일반 실행 스모크와 구분하여 심사 대상 기기·OS에서 제출 기능 접근을 확인한다.\n\n[조작/확인 순서]\n1. 제출 빌드 신규 설치\n2. 대상 실제 기기·OS 조합 기록\n3. 제공 진입 방법으로 주요 기능 순회\n4. 기기 의존 기능·호환 모드 확인\n5. 심사 노트의 테스트 환경 및 재현 방법과 비교\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/help/app-review/before-submitting-for-review/complete-review\nhttps://developer.apple.com/help/app-review/before-submitting-for-review/test-compatible-devices\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 iOS 심사 제출에 수행한다. 일반 실행 스모크와 구분하여 심사 대상 기기·OS에서 제출 기능 접근을 확인한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I01"
  },
  {
    "code": "I03",
    "title": "심사용 계정 및 서버 접근 가능 여부 확인",
    "priority": "P0",
    "development": false,
    "tc_no": 13,
    "check_content": "역할별·유료 접근·필요 구독 상태 계정과 OTP/2FA 처리 방법이 제공되어 심사 기간 중 계정과 서버가 유효하다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n계정·권한·유료 접근 등 제한 기능이 있으면 수행한다. 제한 없는 앱임을 실제 확인한 경우 SKIP한다.\n\n[조작/확인 순서]\n1. 필요 역할·유료 기능·구독 상태 목록 작성\n2. 새 기기에서 제공 계정 로그인\n3. 유료/활성·만료 구독 계정으로 필요한 기능과 구매 흐름 확인\n4. OTP/2FA 안내로 접근\n5. 만료·지역·서버 제한과 심사 기간 유지 계획 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/help/app-review/before-submitting-for-review/complete-review\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n계정·권한·유료 접근 등 제한 기능이 있으면 수행한다. 제한 없는 앱임을 실제 확인한 경우 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I03"
  },
  {
    "code": "I04",
    "title": "앱 설명·스크린샷·미리보기와 실제 기능 일치 여부 확인",
    "priority": "P1",
    "development": false,
    "tc_no": 14,
    "check_content": "설명·실제 사용 스크린샷·미리보기·별도 홍보 소재가 제출 앱의 기능·콘텐츠를 정확히 표현한다. 홍보 소재와 실제 화면 요건을 구분한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 제출에 수행하며 변경이 없다는 이유로 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. 언어별 등록정보와 홍보 소재 확보\n2. 제출 빌드에서 소개 기능 재현\n3. 유료/지역/계정 제한 조건 비교\n4. 스크린샷·미리보기와 별도 홍보 아트워크의 적용 요건 확인\n5. 기능 과장·미제공 기능 표현 기록\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/app-store/review/guidelines/#accurate-metadata\nhttps://developer.apple.com/news/?id=92th7e5i\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 제출에 수행하며 변경이 없다는 이유로 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I04"
  },
  {
    "code": "I05",
    "title": "숨김·비공개 기능 및 심사 노트 누락 여부 확인",
    "priority": "P0",
    "development": false,
    "tc_no": 15,
    "check_content": "목적·사업 모델·주요 변경·테스트 환경·외부 서비스·필요 하드웨어·지역 차이가 심사 정보에 제공되고 숨겨진 미고지 기능이 없다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 제출에 수행하며 외부 서비스나 지역 차이가 없으면 없음을 확인한다.\n\n[조작/확인 순서]\n1. App Review Information 확인\n2. 실제 기능 및 원격 설정과 대조\n3. 앱 목적/사업 모델/변경사항 기록 확인\n4. 기기·OS·외부 인증/결제/AI 서비스·하드웨어와 접근 방법 확인\n5. 지역 차이 또는 차이 없음 확인\n6. 필요한 재현 안내·영상 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/help/app-review/before-submitting-for-review/complete-review\nhttps://developer.apple.com/news/?id=92th7e5i\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 제출에 수행하며 외부 서비스나 지역 차이가 없으면 없음을 확인한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I05"
  },
  {
    "code": "I10",
    "title": "연령 등급 설문과 실제 게임 콘텐츠 일치 여부 확인",
    "priority": "P0",
    "development": false,
    "tc_no": 20,
    "check_content": "현재 연령 등급 설문이 실제 콘텐츠·기능·온라인 상호작용을 반영하고 대상 지역 결과가 올바르다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 제출에 수행한다. 낮은 등급 또는 신규 콘텐츠 없음만으로 SKIP하지 않는다.\n\n[조작/확인 순서]\n1. App Store Connect 최신 설문 열기\n2. 실제 빌드/원격 콘텐츠·상호작용 기능 확인\n3. 각 답변과 콘텐츠 비교\n4. 지역·OS별 등급 표시 차이를 공식 기준과 대조\n5. 최신 설문 응답 완료 여부 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/news/upcoming-requirements/?id=07242025a\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 제출에 수행한다. 낮은 등급 또는 신규 콘텐츠 없음만으로 SKIP하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I10"
  },
  {
    "code": "I11",
    "title": "스토어 노출 이미지의 전체 이용자 적합성 확인",
    "priority": "P1",
    "development": false,
    "tc_no": 21,
    "check_content": "스토어 노출 소재가 적용되는 전체 이용자 적정성 기준을 충족하고 실제 개인정보 노출·권리 침해가 없다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n스토어에 노출되는 이미지·홍보 소재에 수행한다.\n\n[조작/확인 순서]\n1. 아이콘·스크린샷·미리보기·홍보 소재 수집\n2. 선정/폭력/부적절 표현 확인\n3. 테스트용 가상 정보 사용 여부 확인\n4. 인물·상표·이미지 사용 권리 근거 확인\n5. 지역별 노출 소재와 적용 기준 비교\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/app-store/review/guidelines/#accurate-metadata\nhttps://developer.apple.com/news/?id=92th7e5i\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n스토어에 노출되는 이미지·홍보 소재에 수행한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I11"
  },
  {
    "code": "I16",
    "title": "UGC 부적절 콘텐츠 필터링 기능 확인",
    "priority": "P1",
    "development": false,
    "tc_no": 26,
    "check_content": "부적절 UGC에 대한 필터링·운영 보호조치가 작동하며 해당 제작자 콘텐츠의 연령 식별·미성년자 접근 제한이 적용된다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\nUGC가 있으면 수행하며 미제공이면 SKIP한다. 제작자 콘텐츠의 연령 제한은 해당 콘텐츠 제공 시 추가 수행한다.\n\n[조작/확인 순서]\n1. 테스트 UGC로 허용/금지 콘텐츠 입력\n2. 필터·검토 대기·차단 동작 확인\n3. 운영 처리 경로 확인\n4. 해당 연령 제한 콘텐츠를 성인/미성년 테스트 계정으로 접근\n5. 차단·연령 안내와 우회 여부 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/app-store/review/guidelines/#user-generated-content\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\nUGC가 있으면 수행하며 미제공이면 SKIP한다. 제작자 콘텐츠의 연령 제한은 해당 콘텐츠 제공 시 추가 수행한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I16"
  },
  {
    "code": "I17",
    "title": "UGC 신고 기능 확인",
    "priority": "P1",
    "development": false,
    "tc_no": 27,
    "check_content": "콘텐츠/사용자 신고 UI가 접근 가능하고 제출한 신고가 운영 체계에 접수되어 대응 가능한 상태로 남는다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\nUGC가 있으면 수행하며 미제공이면 SKIP한다.\n\n[조작/확인 순서]\n1. 테스트 콘텐츠·사용자 선택\n2. 신고 사유 입력 및 제출\n3. 사용자 접수 안내 확인\n4. 운영 도구에서 신고 식별·내용·시각 확인\n5. 처리 담당 경로·대응 절차 확인\n6. 실제 신고 데이터 정리\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/app-store/review/guidelines/#user-generated-content\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\nUGC가 있으면 수행하며 미제공이면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I17"
  },
  {
    "code": "I20",
    "title": "디지털 상품 Apple IAP 사용 여부 확인",
    "priority": "P0",
    "development": false,
    "tc_no": 30,
    "check_content": "IAP 대상/예외를 정확히 구분하고 제출 상품 상태·계약·판매 지역이 유효하며 StoreKit 조회 및 Sandbox 구매가 가능하다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n디지털 상품/서비스 구매가 있으면 수행하며 미제공이면 SKIP한다. 지역·상품별 예외는 공식 적용 근거를 확인한다.\n\n[조작/확인 순서]\n1. 디지털 상품과 예외 목록 확인\n2. 유효 계약·상품 식별자·제출 상태/판매 지역 확인\n3. 제출 빌드에서 StoreKit 상품 조회\n4. Sandbox로 구매 진입·완료\n5. 정책상 결제 경로 확인; 지급·복원은 기존 결제 TC와 연결\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/help/app-review/before-submitting-for-review/configure-in-app-purchases\nhttps://developer.apple.com/app-store/review/guidelines/#in-app-purchase\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n디지털 상품/서비스 구매가 있으면 수행하며 미제공이면 SKIP한다. 지역·상품별 예외는 공식 적용 근거를 확인한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I20"
  },
  {
    "code": "I21",
    "title": "외부 결제 유도 요소의 스토어프론트 정책 대응 확인",
    "priority": "P0",
    "development": false,
    "tc_no": 31,
    "check_content": "지역·스토어프론트·프로그램 자격·entitlement에 맞게 외부 결제/링크를 제공하고 적용 고지·연령 조건을 충족한다. 전 세계 일괄 금지 또는 허용으로 처리하지 않는다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n외부 디지털 구매·유도 링크가 있으면 수행한다. 앱/웹뷰/가입 경로에 해당 요소가 없으면 SKIP한다.\n\n[조작/확인 순서]\n1. 배포 스토어프론트별 공식 정책/자격 확인\n2. entitlement·등록 상태와 허용 지역 매트릭스 확보\n3. 각 스토어 계정의 앱·웹뷰·가입 링크 실행\n4. 허용/미허용 지역 및 해당 연령 조건 비교\n5. 고지·목적지·우회 경로 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/app-store/review/guidelines/#other-purchase-methods\nhttps://developer.apple.com/support/payment-options-on-the-app-store-in-the-eu/\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n외부 디지털 구매·유도 링크가 있으면 수행한다. 앱/웹뷰/가입 경로에 해당 요소가 없으면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I21"
  },
  {
    "code": "I25",
    "title": "구독 가격·기간·제공 내용·해지 정보 안내 확인",
    "priority": "P1",
    "development": false,
    "tc_no": 35,
    "check_content": "구매 전에 가격·기간·제공 내용·자동 갱신·체험 종료 후 가격·해지 방법이 명확하고 실제 StoreKit 조건과 일치한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n구독 상품이 있으면 수행하며 미제공이면 SKIP한다.\n\n[조작/확인 순서]\n1. 신규/체험/기존 계정으로 구매 화면 열기\n2. 가격·청구 주기·혜택·자동 갱신·체험 종료 조건 확인\n3. StoreKit 표시와 비교\n4. 앱에서 해지 안내/관리 경로 접근\n5. 테스트 해지 후 만료 전후 권한 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/app-store/review/guidelines/#subscriptions\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n구독 상품이 있으면 수행하며 미제공이면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I25"
  },
  {
    "code": "I29",
    "title": "개인정보 처리방침과 실제 데이터 처리 내용 일치 여부 확인",
    "priority": "P0",
    "development": false,
    "tc_no": 39,
    "check_content": "방침이 앱·서버·SDK의 실제 수집·공유·목적·보존·삭제와 일치한다. 해당 제3자 AI 개인정보 전달은 사전 명시적 허용을 받는다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n모든 제출에 수행한다. 제3자 AI 개인정보 전달 동의 단계는 해당 전달이 있을 때 수행한다.\n\n[조작/확인 순서]\n1. 앱/서버/SDK 데이터 목록 확보\n2. 방침 항목별 대조\n3. 동의 전후 주요 경로의 전송 확인\n4. 제3자 AI 전달이 있으면 대상·정보 안내와 전송 전 명시적 동의 확인\n5. 거부 시 미전송과 보존/삭제 정책 일치 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/app-store/review/guidelines/#privacy\nhttps://developer.apple.com/app-store/user-privacy-and-data-use/\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n모든 제출에 수행한다. 제3자 AI 개인정보 전달 동의 단계는 해당 전달이 있을 때 수행한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I29"
  },
  {
    "code": "I30",
    "title": "권한 목적 문구의 명확성 확인",
    "priority": "P1",
    "development": false,
    "tc_no": 40,
    "check_content": "지원 언어별 purpose string이 실제 API/SDK 기능과 구체적으로 일치하며 빈 문구·누락·일반적인 모호한 설명이 없다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n권한 목적 문구가 필요한 API/SDK를 사용하면 수행한다. 해당 호출이 없다는 근거를 확인하면 SKIP한다.\n\n[조작/확인 순서]\n1. 앱/SDK API 목록과 필요한 사용 목적 키 확인\n2. 지원 언어별 시스템 권한 팝업 호출\n3. 기능·수집 목적과 문구 비교\n4. SDK가 요청하는 권한도 확인\n5. 누락/불필요 API 또는 오역 기록\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/help/app-review/guideline-reference/5-1-1-purpose-strings\n\n[우선순위]\nP1\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n권한 목적 문구가 필요한 API/SDK를 사용하면 수행한다. 해당 호출이 없다는 근거를 확인하면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I30"
  },
  {
    "code": "I33",
    "title": "계정 생성 제공 시 앱 내 계정 삭제 기능 확인",
    "priority": "P0",
    "development": false,
    "tc_no": 43,
    "check_content": "앱에서 계정 및 관련 데이터 삭제를 시작할 수 있고 단순 비활성화가 아니다. 보존 예외를 안내하며 구독 해지와 계정 삭제를 구분한다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\n계정 생성 기능이 있으면 수행하며 미제공이면 SKIP한다.\n\n[조작/확인 순서]\n1. 테스트 계정과 관련 데이터 생성\n2. 앱 내 삭제 진입\n3. 구독 계정이면 해지 관련 안내와 삭제 가능 여부 확인\n4. 삭제 완료 후 재로그인·서버 데이터 확인\n5. 법적 보존 예외 안내 확인\n6. Apple 토큰 철회는 기존 TC44와 함께 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\n계정 생성 기능이 있으면 수행하며 미제공이면 SKIP한다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I33"
  },
  {
    "code": "I35",
    "title": "ATT 추적 동의 시점 및 거부 동작 확인",
    "priority": "P0",
    "development": false,
    "tc_no": 45,
    "check_content": "SDK 포함 추적이 ATT 허용 전에 시작되지 않고 거부 시 추적하지 않는다. 동의 강요·보상 유도·핑거프린팅 등 우회 식별이 없다.\n[PASS] 적용되는 확인 사항을 증거로 확인하고 모두 충족한다.\n[FAIL] 적용되는 요구사항 위반, 선언 불일치 또는 필요한 동작 실패가 확인된다.\n[SKIP] 아래 적용 조건상 비해당임을 확인한 경우에만 사유를 기록한다. 자료 미확보는 미사용 근거가 아니며 임의로 PASS/SKIP하지 않는다.",
    "test_method": "[적용 조건]\nApple 정의상 추적을 수행하면 적용한다. 앱·SDK 모두 추적하지 않음을 실제 확인하면 SKIP하며 권한 팝업 부재만으로 미추적이라 판단하지 않는다.\n\n[조작/확인 순서]\n1. 앱/SDK 추적 목록 확인\n2. 새 설치와 미결정 상태에서 전송/SDK 초기화 확인\n3. ATT 거부 후 주요 기능·전송 확인\n4. 허용 및 설정 철회 후 동작 비교\n5. 동의 강요·우회 식별·필수 기능 차단 여부 확인\n\n[증거]\n검수 빌드/버전, 대상 OS·기기/스토어 지역, 확인 화면 또는 설정·로그, 적용/비적용 근거를 기록한다. 계정 비밀번호·토큰·실제 개인정보는 증거에 남기지 않는다.",
    "reference_note": "[정책 기준]\nApple App Store 공식 문서\nhttps://developer.apple.com/app-store/user-privacy-and-data-use/\n\n[우선순위]\nP0\n\n[확인일]\n2026-11-13\n\n[적용 조건]\nApple 정의상 추적을 수행하면 적용한다. 앱·SDK 모두 추적하지 않음을 실제 확인하면 SKIP하며 권한 팝업 부재만으로 미추적이라 판단하지 않는다.\n\n[참고]\n제출 시점 공식 기준 재확인 필요. 지역·스토어프론트·배포 유형·적용일·프로그램 자격별 예외를 확인하며 숫자와 현재 예외를 영구 정책으로 취급하지 않는다.\n[관리 식별자]\nMARKET-0014-I35"
  }
]
$update_data$::jsonb;
  v_admin uuid;
  v_ios uuid;
  v_google uuid;
  v_ios_sort integer;
  v_count integer;
  v_before jsonb;
  v_categories_before jsonb;
  r record;
BEGIN
  -- 전체 건수를 확인하며 inactive 또는 다른 카테고리의 TC로 개수를 맞춘 상태도 허용하지 않습니다.
  IF (SELECT count(*) FROM public.test_items) <> 63
     OR EXISTS (SELECT 1 FROM public.test_items WHERE NOT is_active) THEN
    RAISE EXCEPTION '0014 requires exactly 63 test_items, all active; already applied or unexpected state';
  END IF;
  IF EXISTS (SELECT 1 FROM public.categories WHERE name = 'Google Play 검수') THEN
    RAISE EXCEPTION 'Google Play category already exists; do not reuse or rerun 0014';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('공통',7),('네트워크',6),('서스펜드',5),('결제',6),('iOS 검수',39)) AS e(name,n)
  LOOP
    IF (SELECT count(*) FROM public.categories WHERE name=r.name) <> 1
       OR NOT EXISTS (SELECT 1 FROM public.categories WHERE name=r.name AND is_active)
       OR (SELECT count(*) FROM public.test_items t JOIN public.categories c ON c.id=t.category_id WHERE c.name=r.name) <> r.n THEN
      RAISE EXCEPTION 'Category % must be unique, active and contain % items', r.name,r.n;
    END IF;
  END LOOP;
  SELECT id INTO STRICT v_ios FROM public.categories WHERE name='iOS 검수';
  -- 15개 전체의 tc_no + 제목 + 카테고리를 교차 확인합니다. 제목으로 fallback하지 않습니다.
  FOR r IN SELECT * FROM jsonb_to_recordset(v_updates) AS x(tc_no bigint,title text)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.test_items WHERE tc_no=r.tc_no AND title=r.title AND category_id=v_ios) THEN
      RAISE EXCEPTION 'Existing iOS TC % title/category mismatch: %',r.tc_no,r.title;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    (11::bigint,'심사 제출 빌드 완성도 및 주요 기능 접근 가능 여부 확인'),
    (37::bigint,'제3자 로그인 사용 시 Apple 요건을 충족하는 동등 로그인 옵션 확인'),
    (44::bigint,'Sign in with Apple 계정 삭제 시 사용자 토큰 철회 확인')) AS e(tc_no,title)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.test_items WHERE tc_no=r.tc_no AND title=r.title AND category_id=v_ios) THEN
      RAISE EXCEPTION 'Refined baseline TC % mismatch',r.tc_no;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.test_items t JOIN jsonb_to_recordset(v_new) AS n(title text) ON n.title=t.title) THEN
    RAISE EXCEPTION 'A new TC title already exists; inspect unexpected data before applying';
  END IF;
  -- 알 수 없는 trigger의 다른 테이블 부작용을 차단합니다. FK 등 내부 trigger는 제외합니다.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid IN ('public.categories'::regclass,'public.test_items'::regclass)
             AND NOT tgisinternal AND tgenabled <> 'D') THEN
    RAISE EXCEPTION 'Unexpected enabled user trigger on master tables; review side effects before applying';
  END IF;
  SELECT id INTO v_admin FROM public.users WHERE role='ADMIN' AND status='APPROVED' ORDER BY created_at,id LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'An approved ADMIN is required for audit fields'; END IF;
  -- 감사 주체는 가장 먼저 생성된 승인 ADMIN입니다. 실행자와 다를 수 있으므로 운영 승인 시 확인합니다.
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) INTO v_before FROM public.test_items t;
  SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) INTO v_categories_before FROM public.categories c;
  SELECT coalesce(max(sort_order),0) INTO v_ios_sort FROM public.test_items WHERE category_id=v_ios;

  INSERT INTO public.categories (name,description,sort_order,is_active,default_ios,default_android,default_new,
      default_resubmission,default_development_review,created_by,updated_by)
  SELECT 'Google Play 검수','Google Play 제출·심사·정책·기술 요구사항을 확인하는 QA 항목',
      coalesce(max(sort_order),0)+1,true,false,true,true,true,false,v_admin,v_admin FROM public.categories
  RETURNING id INTO v_google;

  UPDATE public.test_items t
     SET check_content=u.check_content, test_method=u.test_method, reference_note=u.reference_note,
         updated_by=v_admin, updated_at=now()
    FROM jsonb_to_recordset(v_updates) AS u(tc_no bigint,title text,check_content text,test_method text,reference_note text)
   WHERE t.tc_no=u.tc_no AND t.title=u.title AND t.category_id=v_ios;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 15 THEN RAISE EXCEPTION 'Expected 15 updated TC rows, got %',v_count; END IF;

  INSERT INTO public.test_items (category_id,title,check_content,test_method,reference_note,sort_order,is_active,
      applies_ios,applies_android,applies_new,applies_resubmission,applies_development_review,created_by,updated_by)
  SELECT CASE WHEN left(n.code,1)='G' THEN v_google ELSE v_ios END,
      n.title,n.check_content,n.test_method,n.reference_note,
      CASE WHEN left(n.code,1)='G' THEN substring(n.code FROM 2)::integer ELSE v_ios_sort+substring(n.code FROM 2)::integer-39 END,
      true,left(n.code,1)='I',left(n.code,1)='G',true,true,n.development,v_admin,v_admin
    FROM jsonb_to_recordset(v_new) AS n(code text,title text,check_content text,test_method text,reference_note text,development boolean)
   ORDER BY n.code;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 28 THEN RAISE EXCEPTION 'Expected 28 inserted TC rows, got %',v_count; END IF;

  IF (SELECT count(*) FROM public.test_items) <> 91
     OR EXISTS (SELECT 1 FROM public.test_items WHERE NOT is_active) THEN
    RAISE EXCEPTION 'Postcondition failed: 91 active TC required';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('공통',7),('네트워크',6),('서스펜드',5),('결제',6),('iOS 검수',45),('Google Play 검수',22)) AS e(name,n)
  LOOP
    IF (SELECT count(*) FROM public.categories WHERE name=r.name) <> 1
       OR (SELECT count(*) FROM public.test_items t JOIN public.categories c ON c.id=t.category_id WHERE c.name=r.name) <> r.n THEN
      RAISE EXCEPTION 'Postcondition failed: category % expected %',r.name,r.n;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.categories) <> jsonb_array_length(v_categories_before)+1
     OR NOT EXISTS (SELECT 1 FROM public.categories WHERE id=v_google AND is_active AND NOT default_ios AND default_android
                    AND default_new AND default_resubmission AND NOT default_development_review) THEN
    RAISE EXCEPTION 'Category count/default flags mismatch';
  END IF;
  FOR r IN SELECT * FROM jsonb_to_recordset(v_new) AS n(code text,title text,check_content text,test_method text,reference_note text,development boolean)
  LOOP
    IF (SELECT count(*) FROM public.test_items WHERE title=r.title) <> 1 OR NOT EXISTS (
      SELECT 1 FROM public.test_items t WHERE t.title=r.title
        AND t.category_id=CASE WHEN left(r.code,1)='G' THEN v_google ELSE v_ios END
        AND t.is_active AND t.applies_ios=(left(r.code,1)='I') AND t.applies_android=(left(r.code,1)='G')
        AND t.applies_new AND t.applies_resubmission AND t.applies_development_review=r.development
        AND t.check_content=r.check_content AND t.test_method=r.test_method AND t.reference_note=r.reference_note
        AND t.sort_order=CASE WHEN left(r.code,1)='G' THEN substring(r.code FROM 2)::integer ELSE v_ios_sort+substring(r.code FROM 2)::integer-39 END
        AND t.created_by=v_admin AND t.updated_by=v_admin) THEN
      RAISE EXCEPTION 'New TC postcondition failed: %',r.code;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM jsonb_to_recordset(v_updates) AS u(tc_no bigint,check_content text,test_method text,reference_note text)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.test_items WHERE tc_no=r.tc_no AND check_content=r.check_content
                   AND test_method=r.test_method AND reference_note=r.reference_note AND updated_by=v_admin) THEN
      RAISE EXCEPTION 'Updated TC content mismatch: %',r.tc_no;
    END IF;
  END LOOP;
  -- 기존 63개 모두의 ID/번호/생성일/제목/플래그/정렬/생성자를 보존합니다.
  -- 대상 15개만 내용 3필드와 수정 감사정보 변경을 허용하며 나머지 48개는 행 전체가 같아야 합니다.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_before) b(old)
    LEFT JOIN public.test_items t ON t.id=(b.old->>'id')::uuid
    WHERE t.id IS NULL OR
      CASE WHEN EXISTS (SELECT 1 FROM jsonb_to_recordset(v_updates) AS u(tc_no bigint) WHERE u.tc_no=t.tc_no)
        THEN (to_jsonb(t)-ARRAY['check_content','test_method','reference_note','updated_by','updated_at']::text[])
             IS DISTINCT FROM (b.old-ARRAY['check_content','test_method','reference_note','updated_by','updated_at']::text[])
        ELSE to_jsonb(t) IS DISTINCT FROM b.old END
  ) THEN RAISE EXCEPTION 'Existing TC identity or unrelated fields changed'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_categories_before) b(old)
             LEFT JOIN public.categories c ON c.id=(b.old->>'id')::uuid WHERE to_jsonb(c) IS DISTINCT FROM b.old) THEN
    RAISE EXCEPTION 'Existing category changed';
  END IF;
  RAISE NOTICE '0014 verified: existing 63 preserved, 15 enriched, 28 added; total 91. No inspection snapshots changed.';
END
$migration$;
COMMIT;
