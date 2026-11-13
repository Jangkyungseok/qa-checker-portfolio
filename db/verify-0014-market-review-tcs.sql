-- 0014 조회 전용 검증. migration을 실행하지 않으며 실제 적용 이력을 증명하는 ledger는 아닙니다.
-- 모든 결과를 함께 확인합니다. 개수만 같다고 적용 완료로 판단하지 않습니다.
-- BASELINE_COUNTS_MATCH는 번호/제목, trigger, ADMIN 등 migration의 나머지 사전 조건까지 보증하지 않습니다.
-- EXPANDED_COUNTS_MATCH도 아래 신규/보강 행 검증까지 전부 확인해야 합니다.
-- 적용 전 기존 ID/번호/생성일과 inspection snapshot 보존 증거가 필요하면 별도 백업을 보관합니다.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

WITH expected(name,before_n,after_n) AS (VALUES
 ('공통',7,7),('네트워크',6,6),('서스펜드',5,5),('결제',6,6),('iOS 검수',39,45),('Google Play 검수',0,22))
SELECT e.*, (SELECT count(*) FROM public.categories c WHERE c.name=e.name) AS category_rows,
 (SELECT count(*) FROM public.categories c WHERE c.name=e.name AND c.is_active) AS active_category_rows,
 (SELECT count(*) FROM public.test_items t JOIN public.categories c ON c.id=t.category_id WHERE c.name=e.name) AS actual_n,
 (SELECT count(*) FROM public.test_items t JOIN public.categories c ON c.id=t.category_id WHERE c.name=e.name AND t.is_active) AS active_n
FROM expected e ORDER BY e.before_n DESC,e.name;

SELECT count(*) AS total_tc, count(*) FILTER (WHERE is_active) AS active_tc,
 CASE WHEN count(*)=63 AND bool_and(is_active) THEN 'BASELINE_COUNTS_MATCH'
      WHEN count(*)=91 AND bool_and(is_active) THEN 'EXPANDED_COUNTS_MATCH'
      ELSE 'STOP_UNEXPECTED_STATE' END AS count_check
FROM public.test_items;

-- 기존 보강 대상 + 이미 보강되어 있어야 하는 TC37/44의 번호·제목·카테고리 확인.
WITH expected(tc_no,title) AS (VALUES
 (11::bigint,'심사 제출 빌드 완성도 및 주요 기능 접근 가능 여부 확인'),
 (13::bigint,'심사용 계정 및 서버 접근 가능 여부 확인'),
 (14::bigint,'앱 설명·스크린샷·미리보기와 실제 기능 일치 여부 확인'),
 (15::bigint,'숨김·비공개 기능 및 심사 노트 누락 여부 확인'),
 (20::bigint,'연령 등급 설문과 실제 게임 콘텐츠 일치 여부 확인'),
 (21::bigint,'스토어 노출 이미지의 전체 이용자 적합성 확인'),
 (26::bigint,'UGC 부적절 콘텐츠 필터링 기능 확인'),
 (27::bigint,'UGC 신고 기능 확인'),
 (30::bigint,'디지털 상품 Apple IAP 사용 여부 확인'),
 (31::bigint,'외부 결제 유도 요소의 스토어프론트 정책 대응 확인'),
 (35::bigint,'구독 가격·기간·제공 내용·해지 정보 안내 확인'),
 (37::bigint,'제3자 로그인 사용 시 Apple 요건을 충족하는 동등 로그인 옵션 확인'),
 (39::bigint,'개인정보 처리방침과 실제 데이터 처리 내용 일치 여부 확인'),
 (40::bigint,'권한 목적 문구의 명확성 확인'),
 (43::bigint,'계정 생성 제공 시 앱 내 계정 삭제 기능 확인'),
 (44::bigint,'Sign in with Apple 계정 삭제 시 사용자 토큰 철회 확인'),
 (45::bigint,'ATT 추적 동의 시점 및 거부 동작 확인'))
SELECT e.tc_no,e.title AS expected_title,t.id,t.title AS actual_title,c.name AS category,
 coalesce(t.title=e.title AND c.name='iOS 검수' AND t.is_active,false) AS baseline_identity_matches,
 t.created_at,t.updated_at
FROM expected e LEFT JOIN public.test_items t ON t.tc_no=e.tc_no
LEFT JOIN public.categories c ON c.id=t.category_id ORDER BY e.tc_no;

-- 신규 28개: 적용 전은 absent, 적용 후는 각 행이 정확히 1개이고 matches=true이어야 합니다.
WITH expected(code,title,development) AS (VALUES
 ('G01','제출 빌드 Target API 요구사항 충족 확인',true),
 ('G02','16KB 페이지 크기 호환성 확인',true),
 ('G03','App access 및 심사용 접근 정보 확인',false),
 ('G04','Data Safety와 실제 데이터 처리 일치 확인',false),
 ('G05','개인정보처리방침 및 데이터 처리 고지 확인',false),
 ('G06','계정 및 관련 데이터 삭제 경로 확인',false),
 ('G07','광고 포함 선언과 실제 광고 일치 확인',false),
 ('G08','광고 콘텐츠 및 표시 방식 적정성 확인',false),
 ('G09','타깃 연령 및 콘텐츠 선언 일치 확인',false),
 ('G10','Families 적용 및 아동 대상 처리 확인',false),
 ('G11','콘텐츠 등급 설문과 실제 콘텐츠 일치 확인',false),
 ('G12','Google Play Billing 적용 및 제출 적격성 확인',false),
 ('G13','구독 조건 및 해지 경로 확인',false),
 ('G14','확률형 유료 상품 확률 표시 확인',false),
 ('G15','UGC 운영·신고·차단 확인',false),
 ('G16','제한 권한·API 사용 자격 및 최소화 확인',false),
 ('G17','사진·동영상 권한 및 Photo Picker 대안 확인',false),
 ('G18','All files access 사용 적격성 확인',false),
 ('G19','Exact Alarm 권한 및 대안 처리 확인',false),
 ('G20','Full-screen intent 사용 적정성 확인',false),
 ('G21','스토어 정보와 실제 제출 앱 일치 확인',false),
 ('G22','외부 결제·링크의 지역별 적용 조건 확인',false),
 ('I40','App Privacy 라벨과 실제 데이터 처리 일치 확인',false),
 ('I41','Privacy manifest·Required Reason API·SDK 제출 요건 확인',true),
 ('I42','Accessibility 표시와 실제 지원 일치 확인',false),
 ('I43','Kids Category 보호조치 확인',false),
 ('I44','앱 내 광고 콘텐츠 및 상호작용 적정성 확인',false),
 ('I45','제출 빌드 Xcode·SDK 최소 요구사항 확인',true))
SELECT e.code,e.title,t.tc_no,t.id,c.name AS category,
 (SELECT count(*) FROM public.test_items a WHERE a.title=e.title) AS title_count,
 coalesce(t.is_active AND c.is_active AND c.name=CASE WHEN left(e.code,1)='G' THEN 'Google Play 검수' ELSE 'iOS 검수' END
  AND t.applies_android=(left(e.code,1)='G') AND t.applies_ios=(left(e.code,1)='I')
  AND t.applies_new AND t.applies_resubmission AND t.applies_development_review=e.development
  AND position('MARKET-0014-'||e.code IN t.reference_note)>0
  AND position('[적용 조건]' IN t.test_method)=1
  AND position('[PASS]' IN t.check_content)>0 AND position('[FAIL]' IN t.check_content)>0
  AND position('[SKIP]' IN t.check_content)>0,false) AS matches
FROM expected e LEFT JOIN public.test_items t ON t.title=e.title
LEFT JOIN public.categories c ON c.id=t.category_id ORDER BY e.code,t.tc_no;

-- 기존 15개: 적용 후 내용·방법·정책 관리 식별자 존재 확인. 상세 문구는 migration과 대조합니다.
WITH expected(tc_no,code) AS (VALUES
 (11::bigint,'I01'),
 (13::bigint,'I03'),
 (14::bigint,'I04'),
 (15::bigint,'I05'),
 (20::bigint,'I10'),
 (21::bigint,'I11'),
 (26::bigint,'I16'),
 (27::bigint,'I17'),
 (30::bigint,'I20'),
 (31::bigint,'I21'),
 (35::bigint,'I25'),
 (39::bigint,'I29'),
 (40::bigint,'I30'),
 (43::bigint,'I33'),
 (45::bigint,'I35'))
SELECT e.tc_no,e.code,t.title,
 coalesce(position('MARKET-0014-'||e.code IN t.reference_note)>0
 AND position('[적용 조건]' IN t.test_method)=1 AND position('[PASS]' IN t.check_content)>0
 AND position('[FAIL]' IN t.check_content)>0 AND position('[SKIP]' IN t.check_content)>0,false) AS enriched
FROM expected e LEFT JOIN public.test_items t ON t.tc_no=e.tc_no ORDER BY e.tc_no;

-- audit 및 알려지지 않은 trigger 사전 점검. 승인 ADMIN이 없거나 사용자 trigger가 있으면 migration 중단.
SELECT id,role,status,created_at FROM public.users WHERE role='ADMIN' AND status='APPROVED' ORDER BY created_at,id;
SELECT tgrelid::regclass AS master_table,tgname,tgenabled FROM pg_catalog.pg_trigger
WHERE tgrelid IN ('public.categories'::regclass,'public.test_items'::regclass) AND NOT tgisinternal AND tgenabled<>'D';
SELECT name,is_active,default_ios,default_android,default_new,default_resubmission,default_development_review
FROM public.categories WHERE name='Google Play 검수';
COMMIT;
