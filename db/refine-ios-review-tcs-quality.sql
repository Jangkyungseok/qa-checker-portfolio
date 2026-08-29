BEGIN;

DO $$
DECLARE
  v_category_id uuid;
  v_updated integer;
BEGIN
  SELECT id
    INTO v_category_id
    FROM categories
   WHERE name = 'iOS 검수'
   LIMIT 1;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'iOS 검수 카테고리를 찾을 수 없습니다.';
  END IF;

  -- 1) 공통 '앱 실행' TC와 역할이 겹치지 않도록
  --    iOS 심사 제출 관점(심사자가 실제 주요 기능에 접근 가능한지)으로 초점을 변경.
  UPDATE test_items
     SET title = '심사 제출 빌드 완성도 및 주요 기능 접근 가능 여부 확인',
         check_content = '심사 제출 빌드가 비정상 종료, 진행 불가, 무한 로딩 등 심각한 오류 없이 동작하고 심사자가 앱의 주요 기능과 콘텐츠에 실제로 접근하여 확인할 수 있는지 점검한다.',
         test_method = '일반 스모크 테스트를 반복하는 목적이 아니라, 심사 제출 상태에서 심사자가 핵심 기능을 막힘 없이 확인할 수 있는지를 중심으로 점검한다.'
                       || E'\n\n[조작 순서]\n'
                       || '심사 대상 빌드 신규 설치 > 앱 실행 > 심사용 계정 또는 제공된 진입 방법 사용 > 주요 기능 순차 접근 > 진행 차단·비정상 종료·무한 로딩 여부 확인',
         updated_at = now()
   WHERE category_id = v_category_id
     AND title = '앱 실행 안정성 및 주요 기능 정상 동작 확인';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION '심사 제출 빌드 TC 수정 대상이 정확히 1건이 아닙니다: %건', v_updated;
  END IF;

  -- 2) 제3자 로그인 TC 문구를 현재 Apple 심사 요건에 맞게 더 정확하게 표현.
  UPDATE test_items
     SET title = '제3자 로그인 사용 시 Apple 요건을 충족하는 동등 로그인 옵션 확인',
         check_content = 'Facebook, Google 등 제3자 또는 소셜 로그인을 주 계정 인증에 사용하는 경우 Apple 심사 지침이 요구하는 개인정보 보호 특성을 충족하는 동등한 로그인 옵션이 함께 제공되는지 확인한다.',
         test_method = '[적용 조건] 제3자 또는 소셜 로그인을 주 계정 인증에 사용하는 경우 수행하며, 해당 기능이 없으면 SKIP한다. 로그인 화면에서 제공되는 인증 수단과 각 로그인 방식의 사용자 정보 수집·공개 범위를 확인한다.'
                       || E'\n\n[조작 순서]\n'
                       || '로그인 화면 진입 > 제3자 로그인 옵션 확인 > 동등 로그인 옵션 확인 > 이름·이메일 등 최소 정보 요청 여부 확인 > 이메일 비공개 등 개인정보 보호 선택지 확인',
         updated_at = now()
   WHERE category_id = v_category_id
     AND title = '제3자 로그인 사용 시 동등한 로그인 옵션 제공 여부 확인';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION '제3자 로그인 TC 수정 대상이 정확히 1건이 아닙니다: %건', v_updated;
  END IF;

  -- 3) 기존의 일반적인 '소셜 로그인 연동 해제'는 Apple 심사 체크로 모호하므로
  --    Sign in with Apple 계정 삭제 시 토큰 철회 확인으로 교체.
  UPDATE test_items
     SET title = 'Sign in with Apple 계정 삭제 시 사용자 토큰 철회 확인',
         check_content = 'Sign in with Apple을 계정 생성 또는 인증에 사용하는 경우 사용자가 계정을 삭제했을 때 관련 계정 데이터 삭제와 함께 Apple 사용자 토큰 및 인증 연결이 적절히 철회되는지 확인한다.',
         test_method = '[적용 조건] Sign in with Apple을 사용하는 경우 수행하며, 사용하지 않으면 SKIP한다. 계정 삭제를 완료한 뒤 앱과 서버의 계정 상태, 재로그인 상태 및 Apple 인증 연결 해제 처리를 확인한다.'
                       || E'\n\n[조작 순서]\n'
                       || 'Sign in with Apple 계정 로그인 > 계정 삭제 진입 > 삭제 완료 > 앱 로그아웃 상태 확인 > 서버 계정 데이터 삭제 확인 > Apple 인증 토큰 철회 처리 확인 > 재로그인 시 신규·정상 인증 흐름 확인',
         updated_at = now()
   WHERE category_id = v_category_id
     AND title = '소셜 로그인 연동 해제 및 데이터 접근 해제 기능 확인';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Sign in with Apple 전환 TC 수정 대상이 정확히 1건이 아닙니다: %건', v_updated;
  END IF;

  -- 4) 조건부 기능은 초보 QA도 즉시 SKIP 판단을 할 수 있도록 적용 조건을 테스트 방법 앞에 명시.
  UPDATE test_items
     SET test_method =
           CASE
             WHEN test_method LIKE '[적용 조건]%' THEN test_method
             ELSE '[적용 조건] 해당 기능 또는 정책 적용 대상인 경우 수행하며, 프로젝트에서 사용하지 않으면 SKIP한다. ' || test_method
           END,
         updated_at = now()
   WHERE category_id = v_category_id
     AND title IN (
      '심사용 계정 및 서버 접근 가능 여부 확인',
      '추가 결제가 필요한 콘텐츠의 메타데이터 안내 확인',
      'UGC 부적절 콘텐츠 필터링 기능 확인',
      'UGC 신고 기능 확인',
      '악성 사용자 차단 기능 확인',
      'UGC 운영 문의 연락처 제공 여부 확인',
      '디지털 상품 Apple IAP 사용 여부 확인',
      '외부 결제 유도 요소의 스토어프론트 정책 대응 확인',
      'IAP 구매 게임 내 화폐의 사용 기한 여부 확인',
      '복원 가능한 IAP의 구매 복원 기능 확인',
      '확률형 상품 구매 전 획득 확률 표시 확인',
      '구독 가격·기간·제공 내용·해지 정보 안내 확인',
      '구독 업그레이드·다운그레이드 중 중복 구독 방지 확인',
      '제3자 로그인 사용 시 동등한 로그인 옵션 제공 여부 확인',
      '계정 생성 제공 시 앱 내 계정 삭제 기능 확인',
      'ATT 추적 동의 시점 및 거부 동작 확인',
      '푸시 알림 비허용 시 핵심 기능 이용 가능 여부 확인',
      '마케팅 푸시 사전 동의 및 해제 기능 확인',
      '푸시 알림 내 민감정보 노출 여부 확인'
     );

  -- 위 목록에서 제목이 바뀐 제3자 로그인 항목도 포함.
  UPDATE test_items
     SET test_method =
           CASE
             WHEN test_method LIKE '[적용 조건]%' THEN test_method
             ELSE '[적용 조건] 해당 기능 또는 정책 적용 대상인 경우 수행하며, 프로젝트에서 사용하지 않으면 SKIP한다. ' || test_method
           END,
         updated_at = now()
   WHERE category_id = v_category_id
     AND title IN (
       '제3자 로그인 사용 시 Apple 요건을 충족하는 동등 로그인 옵션 확인',
       'Sign in with Apple 계정 삭제 시 사용자 토큰 철회 확인'
     );

  -- 최종 개수는 유지되어야 한다.
  IF (
    SELECT COUNT(*)
      FROM test_items
     WHERE category_id = v_category_id
  ) <> 39 THEN
    RAISE EXCEPTION 'iOS 검수 TC 수가 39개가 아닙니다. 롤백합니다.';
  END IF;

  RAISE NOTICE '품질 검수 반영 완료: iOS TC 39개 유지';
  RAISE NOTICE '중복 역할 1건 재정의 / 로그인 정책 2건 정교화 / 조건부 TC에 SKIP 기준 추가';
END $$;

COMMIT;
