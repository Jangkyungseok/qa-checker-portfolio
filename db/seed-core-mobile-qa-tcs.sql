BEGIN;

DO $$
DECLARE
  v_admin_id uuid;
  v_category_id uuid;
  v_inserted integer;
BEGIN
  SELECT id INTO v_admin_id
  FROM users
  WHERE role = 'ADMIN'
    AND status = 'APPROVED'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '승인된 ADMIN 계정을 찾을 수 없습니다.';
  END IF;


  SELECT id INTO v_category_id
  FROM categories
  WHERE name = '공통'
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO categories (
      name,
      description,
      sort_order,
      default_ios,
      default_android,
      default_new,
      default_resubmission,
      default_development_review,
      created_by,
      updated_by
    )
    VALUES (
      '공통',
      '플랫폼과 무관하게 모든 모바일 게임 빌드에서 기본적으로 확인하는 공통 QA 항목입니다.',
      1,
      true,
      true,
      true,
      true,
      true,
      v_admin_id,
      v_admin_id
    );

    SELECT id INTO v_category_id
    FROM categories
    WHERE name = '공통'
    LIMIT 1;
  ELSE
    UPDATE categories
    SET description = '플랫폼과 무관하게 모든 모바일 게임 빌드에서 기본적으로 확인하는 공통 QA 항목입니다.',
        sort_order = 1,
        default_ios = true,
        default_android = true,
        default_new = true,
        default_resubmission = true,
        default_development_review = true,
        updated_by = v_admin_id,
        updated_at = now()
    WHERE id = v_category_id;
  END IF;

  CREATE TEMP TABLE tmp_seed_1 (
    sort_order integer,
    title text,
    check_content text,
    test_method text
  ) ON COMMIT DROP;

  INSERT INTO tmp_seed_1 (sort_order, title, check_content, test_method)
  VALUES

    (1, '앱 실행 및 초기 진입 확인', '앱을 실행했을 때 비정상 종료나 진행 차단 없이 초기 로딩을 완료하고 정상적으로 첫 진입 화면까지 이동할 수 있는지 확인한다.', '신규 설치 또는 정상 설치 상태에서 앱을 실행하여 초기 로딩, 필수 리소스 처리, 첫 화면 진입까지의 기본 흐름을 확인한다.

[조작 순서]
앱 완전 종료 > 앱 실행 > 초기 로딩 진행 확인 > 필수 리소스 처리 확인 > 첫 진입 화면 도달 > 비정상 종료·진행 차단 여부 확인'),
    (2, '정상 종료 및 재실행 확인', '앱을 정상 종료한 뒤 다시 실행했을 때 이전 종료 상태로 인한 오류 없이 정상적으로 시작되는지 확인한다.', '앱을 실행해 주요 화면까지 진입한 뒤 완전히 종료하고 다시 실행하여 재실행 흐름과 데이터 상태를 확인한다.

[조작 순서]
앱 실행 > 주요 화면 진입 > 앱 완전 종료 > 앱 재실행 > 초기 진입 확인 > 비정상 상태·오류 여부 확인'),
    (3, '주요 화면 이동 및 복귀 확인', '메인 화면에서 주요 메뉴와 콘텐츠로 이동하고 이전 화면으로 복귀하는 과정이 끊김 없이 정상 동작하는지 확인한다.', '사용 빈도가 높은 메뉴와 콘텐츠를 순차 이동하면서 진입, 뒤로가기, 닫기, 메인 복귀 동작을 확인한다.

[조작 순서]
메인 화면 진입 > 주요 메뉴 선택 > 하위 화면 진입 > 이전 화면 복귀 > 다른 주요 메뉴 이동 > 메인 화면 복귀 확인'),
    (4, '기본 UI 표시 및 조작 확인', '주요 화면의 버튼, 텍스트, 이미지, 아이콘, 팝업 등이 잘림·겹침·오표시 없이 노출되고 기본 조작에 정상 반응하는지 확인한다.', '대표 해상도 단말에서 주요 화면을 순차 확인하며 UI 표시 상태와 터치·스크롤·닫기 등 기본 조작을 점검한다.

[조작 순서]
앱 실행 > 주요 화면 순차 진입 > 텍스트·이미지·아이콘 표시 확인 > 버튼 터치 > 스크롤·팝업 조작 > 잘림·겹침·오동작 여부 확인'),
    (5, '설치 후 최초 실행 확인', '앱을 신규 설치한 직후 최초 실행 과정에서 필요한 초기화와 데이터 생성이 정상적으로 처리되는지 확인한다.', '앱을 삭제한 뒤 다시 설치하여 최초 실행 시 권한, 데이터 다운로드, 약관 또는 초기 설정 흐름을 확인한다.

[조작 순서]
기존 앱 삭제 > 앱 신규 설치 > 최초 실행 > 초기화·데이터 다운로드 확인 > 최초 진입 절차 수행 > 메인 화면 정상 진입 확인'),
    (6, '업데이트 후 기존 데이터 유지 확인', '이전 버전에서 신규 버전으로 업데이트했을 때 계정 및 로컬 설정 등 유지되어야 할 데이터가 정상 보존되는지 확인한다.', '이전 버전에서 테스트 데이터를 생성한 뒤 신규 빌드로 업데이트하여 데이터 유지와 주요 기능 진입을 확인한다.

[조작 순서]
이전 버전 설치 > 계정·설정·진행 데이터 생성 > 신규 버전 업데이트 설치 > 앱 실행 > 기존 데이터 유지 확인 > 주요 기능 정상 이용 확인'),
    (7, '날짜·시간 변경 시 동작 확인', '단말의 날짜 또는 시간을 변경했을 때 앱이 비정상 종료되거나 주요 기능이 비정상 상태에 빠지지 않고 시간 기반 기능을 적절히 처리하는지 확인한다.', '앱 사용 중 또는 종료 상태에서 단말 날짜·시간을 앞뒤로 변경하고 재진입하여 로그인, 보상, 이벤트 등 시간 영향을 받는 기능을 확인한다.

[조작 순서]
앱 정상 상태 준비 > 단말 날짜·시간 변경 > 앱 복귀 또는 재실행 > 로그인·이벤트·보상 등 확인 > 원래 시간 복원 > 정상 상태 회복 여부 확인');

  INSERT INTO test_items (
    category_id,
    title,
    check_content,
    test_method,
    reference_note,
    sort_order,
    applies_ios,
    applies_android,
    applies_new,
    applies_resubmission,
    applies_development_review,
    created_by,
    updated_by
  )
  SELECT
    v_category_id,
    s.title,
    s.check_content,
    s.test_method,
    NULL,
    s.sort_order,
    true,
    true,
    true,
    true,
    true,
    v_admin_id,
    v_admin_id
  FROM tmp_seed_1 s
  WHERE NOT EXISTS (
    SELECT 1
    FROM test_items ti
    WHERE ti.category_id = v_category_id
      AND ti.title = s.title
  )
  ORDER BY s.sort_order;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE '공통 TC 신규 등록: %건', v_inserted;


  SELECT id INTO v_category_id
  FROM categories
  WHERE name = '네트워크'
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO categories (
      name,
      description,
      sort_order,
      default_ios,
      default_android,
      default_new,
      default_resubmission,
      default_development_review,
      created_by,
      updated_by
    )
    VALUES (
      '네트워크',
      '네트워크 변경·단절·복구 및 요청 중 예외 상황에서 서비스 안정성을 확인하는 QA 항목입니다.',
      2,
      true,
      true,
      true,
      true,
      true,
      v_admin_id,
      v_admin_id
    );

    SELECT id INTO v_category_id
    FROM categories
    WHERE name = '네트워크'
    LIMIT 1;
  ELSE
    UPDATE categories
    SET description = '네트워크 변경·단절·복구 및 요청 중 예외 상황에서 서비스 안정성을 확인하는 QA 항목입니다.',
        sort_order = 2,
        default_ios = true,
        default_android = true,
        default_new = true,
        default_resubmission = true,
        default_development_review = true,
        updated_by = v_admin_id,
        updated_at = now()
    WHERE id = v_category_id;
  END IF;

  CREATE TEMP TABLE tmp_seed_2 (
    sort_order integer,
    title text,
    check_content text,
    test_method text
  ) ON COMMIT DROP;

  INSERT INTO tmp_seed_2 (sort_order, title, check_content, test_method)
  VALUES

    (1, 'Wi-Fi ↔ 모바일 데이터 전환 확인', '앱 사용 중 Wi-Fi와 모바일 데이터를 전환했을 때 연결 변경으로 인한 비정상 종료나 장시간 진행 차단 없이 통신이 정상 복구되는지 확인한다.', '네트워크 통신이 발생하는 상태에서 Wi-Fi와 모바일 데이터를 상호 전환하여 세션 유지와 재통신 동작을 확인한다.

[조작 순서]
게임 플레이 진행 > Wi-Fi 연결 상태 확인 > 모바일 데이터로 전환 > 통신 기능 수행 > Wi-Fi로 재전환 > 정상 통신 및 플레이 가능 여부 확인'),
    (2, '네트워크 단절 시 예외 처리 확인', '플레이 중 네트워크가 단절되었을 때 앱이 비정상 종료되거나 무한 로딩 상태에 빠지지 않고 적절한 네트워크 오류 안내와 복구 동작을 제공하는지 확인한다.', '게임 플레이가 정상적으로 가능한 상태에서 네트워크를 강제로 차단한 뒤 게임 복귀 시 오류 안내와 재연결 처리가 정상적으로 이루어지는지 확인한다.

[조작 순서]
게임 플레이 진행 > 단말 네트워크 차단 > 게임 화면 복귀 > 네트워크 오류 팝업 출력 여부 확인 > 재접속 진행 > 정상 플레이 가능 여부 확인'),
    (3, '네트워크 복구 후 정상 진행 확인', '네트워크 단절 이후 연결을 복구했을 때 앱을 강제 종료하지 않아도 재연결되고 중단된 기능을 정상적으로 다시 이용할 수 있는지 확인한다.', '네트워크 오류 상태를 만든 뒤 연결을 복구하여 재시도, 자동 재연결 또는 화면 갱신 후 정상 상태로 돌아오는지 확인한다.

[조작 순서]
네트워크 기능 이용 > 네트워크 차단 > 오류 상태 확인 > 네트워크 복구 > 재시도 또는 자동 재연결 확인 > 정상 플레이 지속 여부 확인'),
    (4, '요청 처리 중 네트워크 단절 확인', '로그인, 저장, 보상 수령 등 서버 요청을 처리하는 도중 네트워크가 끊겨도 데이터가 비정상 중복 처리되거나 진행 상태가 깨지지 않는지 확인한다.', '서버 요청이 발생하는 주요 기능에서 요청 직후 네트워크를 차단하고 오류 처리 후 재접속하여 최종 데이터 상태를 확인한다.

[조작 순서]
서버 요청 기능 진입 > 요청 실행 > 처리 중 네트워크 차단 > 오류 안내 확인 > 네트워크 복구·재접속 > 최종 데이터 및 중복 처리 여부 확인'),
    (5, '느린 네트워크 환경 대응 확인', '응답이 느린 네트워크 환경에서 앱이 무한 대기 상태에 빠지지 않고 로딩, 타임아웃, 재시도 등의 상태를 사용자에게 적절히 제공하는지 확인한다.', '네트워크 속도를 제한한 환경에서 로그인과 주요 서버 기능을 수행하여 응답 지연 시 UI 및 예외 처리를 확인한다.

[조작 순서]
저속 네트워크 환경 준비 > 앱 실행 또는 서버 기능 수행 > 로딩 상태 확인 > 지연 지속 시 안내·타임아웃 확인 > 재시도 > 정상 복구 여부 확인'),
    (6, '연속 입력·재시도 시 중복 요청 방지 확인', '네트워크 지연 또는 오류 상황에서 사용자가 버튼을 연속 입력하거나 재시도해도 동일 요청이 중복 처리되어 보상·재화·데이터가 중복 반영되지 않는지 확인한다.', '서버 처리 버튼의 응답을 지연시킨 상태에서 연속 입력과 재시도를 수행한 뒤 서버 결과와 화면 데이터를 확인한다.

[조작 순서]
서버 처리 기능 진입 > 요청 실행 > 응답 지연 상태에서 연속 입력 > 재시도 수행 > 처리 완료 대기 > 보상·재화·데이터 중복 반영 여부 확인');

  INSERT INTO test_items (
    category_id,
    title,
    check_content,
    test_method,
    reference_note,
    sort_order,
    applies_ios,
    applies_android,
    applies_new,
    applies_resubmission,
    applies_development_review,
    created_by,
    updated_by
  )
  SELECT
    v_category_id,
    s.title,
    s.check_content,
    s.test_method,
    NULL,
    s.sort_order,
    true,
    true,
    true,
    true,
    true,
    v_admin_id,
    v_admin_id
  FROM tmp_seed_2 s
  WHERE NOT EXISTS (
    SELECT 1
    FROM test_items ti
    WHERE ti.category_id = v_category_id
      AND ti.title = s.title
  )
  ORDER BY s.sort_order;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE '네트워크 TC 신규 등록: %건', v_inserted;


  SELECT id INTO v_category_id
  FROM categories
  WHERE name = '서스펜드'
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO categories (
      name,
      description,
      sort_order,
      default_ios,
      default_android,
      default_new,
      default_resubmission,
      default_development_review,
      created_by,
      updated_by
    )
    VALUES (
      '서스펜드',
      '앱의 백그라운드 전환, 화면 잠금 및 다른 앱 사용 후 복귀 시 상태 복구를 확인하는 QA 항목입니다.',
      3,
      true,
      true,
      true,
      true,
      true,
      v_admin_id,
      v_admin_id
    );

    SELECT id INTO v_category_id
    FROM categories
    WHERE name = '서스펜드'
    LIMIT 1;
  ELSE
    UPDATE categories
    SET description = '앱의 백그라운드 전환, 화면 잠금 및 다른 앱 사용 후 복귀 시 상태 복구를 확인하는 QA 항목입니다.',
        sort_order = 3,
        default_ios = true,
        default_android = true,
        default_new = true,
        default_resubmission = true,
        default_development_review = true,
        updated_by = v_admin_id,
        updated_at = now()
    WHERE id = v_category_id;
  END IF;

  CREATE TEMP TABLE tmp_seed_3 (
    sort_order integer,
    title text,
    check_content text,
    test_method text
  ) ON COMMIT DROP;

  INSERT INTO tmp_seed_3 (sort_order, title, check_content, test_method)
  VALUES

    (1, '홈 화면 이동 후 앱 복귀 확인', '앱 사용 중 홈 화면으로 이동했다가 다시 복귀했을 때 비정상 종료 없이 화면과 진행 상태가 정상 복구되는지 확인한다.', '주요 화면 또는 플레이 상태에서 홈 화면으로 이동한 뒤 짧은 시간 내 앱으로 복귀하여 상태 유지와 재개 동작을 확인한다.

[조작 순서]
앱 실행 > 주요 화면 또는 플레이 진행 > 홈 화면 이동 > 잠시 대기 > 앱 재진입 > 화면·진행 상태 및 조작 가능 여부 확인'),
    (2, '장시간 백그라운드 후 복귀 확인', '앱을 장시간 백그라운드 상태로 유지한 뒤 복귀했을 때 세션 만료나 프로세스 정리 상황을 적절히 처리하고 정상 상태로 복구되는지 확인한다.', '로그인 및 주요 화면 진입 후 앱을 백그라운드로 전환하여 일정 시간 대기한 뒤 재진입한다.

[조작 순서]
앱 로그인 > 주요 화면 진입 > 홈 화면 이동 > 장시간 대기 > 앱 재진입 > 세션·데이터 갱신 확인 > 정상 조작 가능 여부 확인'),
    (3, '화면 잠금·해제 후 복귀 확인', '앱 사용 중 단말 화면을 잠갔다가 해제했을 때 앱 화면과 입력 상태가 정상적으로 복구되는지 확인한다.', '플레이 또는 주요 UI 조작 중 화면을 잠근 뒤 해제하여 앱 복귀 상태와 일시정지·재개 처리를 확인한다.

[조작 순서]
앱 실행 > 주요 기능 진행 > 단말 화면 잠금 > 잠시 대기 > 화면 잠금 해제 > 앱 복귀 > 화면·사운드·입력 정상 여부 확인'),
    (4, '다른 앱 사용 후 복귀 확인', '앱 사용 중 다른 앱으로 전환해 일정 작업을 수행한 뒤 돌아왔을 때 기존 상태가 비정상적으로 깨지지 않는지 확인한다.', '게임 플레이 중 최근 앱 또는 알림 등을 통해 다른 앱으로 전환한 뒤 다시 게임으로 복귀한다.

[조작 순서]
게임 플레이 진행 > 다른 앱으로 전환 > 다른 앱 일정 시간 사용 > 게임 앱 재선택 > 복귀 화면 확인 > 진행 상태·사운드·입력 확인'),
    (5, '중요 진행 구간에서 서스펜드·복귀 확인', '전투 결과 처리, 보상 수령, 저장 등 중요 데이터 처리 구간에서 앱이 백그라운드로 전환되어도 데이터가 유실되거나 중복 반영되지 않는지 확인한다.', '서버 저장 또는 보상 처리 직전·직후에 홈 화면 이동이나 화면 잠금을 수행한 뒤 복귀하여 최종 상태를 확인한다.

[조작 순서]
중요 처리 구간 진입 > 저장·보상 등 처리 실행 > 즉시 홈 이동 또는 화면 잠금 > 앱 복귀 > 결과 데이터 확인 > 유실·중복 처리 여부 확인');

  INSERT INTO test_items (
    category_id,
    title,
    check_content,
    test_method,
    reference_note,
    sort_order,
    applies_ios,
    applies_android,
    applies_new,
    applies_resubmission,
    applies_development_review,
    created_by,
    updated_by
  )
  SELECT
    v_category_id,
    s.title,
    s.check_content,
    s.test_method,
    NULL,
    s.sort_order,
    true,
    true,
    true,
    true,
    true,
    v_admin_id,
    v_admin_id
  FROM tmp_seed_3 s
  WHERE NOT EXISTS (
    SELECT 1
    FROM test_items ti
    WHERE ti.category_id = v_category_id
      AND ti.title = s.title
  )
  ORDER BY s.sort_order;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE '서스펜드 TC 신규 등록: %건', v_inserted;


  SELECT id INTO v_category_id
  FROM categories
  WHERE name = '결제'
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO categories (
      name,
      description,
      sort_order,
      default_ios,
      default_android,
      default_new,
      default_resubmission,
      default_development_review,
      created_by,
      updated_by
    )
    VALUES (
      '결제',
      '모바일 게임 상품 구매의 성공·취소·실패·중복·미지급 복구를 확인하는 QA 항목입니다.',
      4,
      true,
      true,
      true,
      true,
      true,
      v_admin_id,
      v_admin_id
    );

    SELECT id INTO v_category_id
    FROM categories
    WHERE name = '결제'
    LIMIT 1;
  ELSE
    UPDATE categories
    SET description = '모바일 게임 상품 구매의 성공·취소·실패·중복·미지급 복구를 확인하는 QA 항목입니다.',
        sort_order = 4,
        default_ios = true,
        default_android = true,
        default_new = true,
        default_resubmission = true,
        default_development_review = true,
        updated_by = v_admin_id,
        updated_at = now()
    WHERE id = v_category_id;
  END IF;

  CREATE TEMP TABLE tmp_seed_4 (
    sort_order integer,
    title text,
    check_content text,
    test_method text
  ) ON COMMIT DROP;

  INSERT INTO tmp_seed_4 (sort_order, title, check_content, test_method)
  VALUES

    (1, '정상 상품 구매 및 지급 확인', '결제 가능한 상품을 정상 구매했을 때 결제 완료 후 해당 상품 또는 재화가 정확한 수량으로 한 번만 지급되는지 확인한다.', '테스트 결제 환경에서 대표 상품을 선택하여 정상 결제를 완료하고 구매 결과와 지급 내역을 확인한다.

[조작 순서]
상점 진입 > 테스트 상품 선택 > 구매 진행 > 플랫폼 결제 완료 > 앱 복귀 > 상품·재화 지급 확인 > 구매 내역 확인'),
    (2, '결제 취소 시 처리 확인', '결제 과정에서 사용자가 구매를 취소했을 때 오류 상태로 남지 않고 상품이 지급되지 않으며 다시 정상적으로 구매를 시도할 수 있는지 확인한다.', '상품 구매를 시작한 뒤 플랫폼 결제 화면에서 취소하고 앱 복귀 후 상태와 재구매 가능 여부를 확인한다.

[조작 순서]
상점 진입 > 상품 선택 > 결제 화면 진입 > 사용자 취소 > 앱 복귀 > 미지급 확인 > 동일 상품 재구매 가능 여부 확인'),
    (3, '결제 실패 시 처리 확인', '결제가 실패했을 때 사용자에게 적절한 실패 안내가 제공되고 상품이 지급되지 않으며 앱 상태가 정상 유지되는지 확인한다.', '테스트 환경에서 결제 실패 조건을 발생시키거나 실패 응답을 사용하여 앱의 결과 처리를 확인한다.

[조작 순서]
상점 진입 > 상품 선택 > 결제 실패 조건 발생 > 실패 안내 확인 > 상품 미지급 확인 > 상점 및 게임 기능 정상 이용 여부 확인'),
    (4, '결제 중 네트워크 단절 확인', '결제 요청 또는 결과 반영 중 네트워크가 단절되어도 결제 상태와 상품 지급 상태가 서로 어긋나거나 중복 처리되지 않는지 확인한다.', '결제 흐름의 주요 구간에서 네트워크를 차단하고 복구한 뒤 영수증 검증과 최종 지급 결과를 확인한다.

[조작 순서]
상품 선택 > 결제 진행 > 처리 중 네트워크 차단 > 오류·대기 상태 확인 > 네트워크 복구 > 앱 재접속 또는 복원 > 결제·지급 최종 상태 확인'),
    (5, '중복 결제 및 중복 지급 방지 확인', '결제 버튼 연속 입력, 응답 지연, 재접속 등의 상황에서도 동일 구매가 의도치 않게 중복 결제되거나 상품이 중복 지급되지 않는지 확인한다.', '결제 응답이 지연되는 조건에서 연속 입력과 화면 재진입을 수행한 뒤 결제 내역과 지급 결과를 비교한다.

[조작 순서]
상품 선택 > 결제 버튼 연속 입력 또는 응답 지연 > 결제 완료 > 앱 재진입 > 플랫폼 구매 내역 확인 > 상품 지급 횟수 비교'),
    (6, '결제 완료 후 미지급 복구 확인', '플랫폼 결제는 완료되었지만 앱 내 상품 지급이 완료되지 않은 상황에서 재접속 또는 복원 절차를 통해 누락 상품이 정상 지급되는지 확인한다.', '결제 완료 후 지급 실패 또는 지급 확인이 중단되는 테스트 조건을 구성하고 앱 재실행·재접속 후 복구 동작을 확인한다.

[조작 순서]
상품 결제 완료 > 지급 실패 조건 구성 > 상품 미지급 상태 확인 > 앱 재실행 또는 재접속 > 구매 복구·영수증 재검증 > 누락 상품 정상 지급 확인');

  INSERT INTO test_items (
    category_id,
    title,
    check_content,
    test_method,
    reference_note,
    sort_order,
    applies_ios,
    applies_android,
    applies_new,
    applies_resubmission,
    applies_development_review,
    created_by,
    updated_by
  )
  SELECT
    v_category_id,
    s.title,
    s.check_content,
    s.test_method,
    NULL,
    s.sort_order,
    true,
    true,
    true,
    true,
    true,
    v_admin_id,
    v_admin_id
  FROM tmp_seed_4 s
  WHERE NOT EXISTS (
    SELECT 1
    FROM test_items ti
    WHERE ti.category_id = v_category_id
      AND ti.title = s.title
  )
  ORDER BY s.sort_order;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE '결제 TC 신규 등록: %건', v_inserted;


  -- iOS 검수는 공통 카테고리들 다음 순서로 정렬
  UPDATE categories
  SET sort_order = 5,
      updated_by = v_admin_id,
      updated_at = now()
  WHERE name = 'iOS 검수';

  -- 최종 안전 검증
  IF (SELECT COUNT(*) FROM test_items ti JOIN categories c ON c.id = ti.category_id WHERE c.name = '공통') <> 7 THEN
    RAISE EXCEPTION '공통 TC 수가 7개가 아닙니다.';
  END IF;

  IF (SELECT COUNT(*) FROM test_items ti JOIN categories c ON c.id = ti.category_id WHERE c.name = '네트워크') <> 6 THEN
    RAISE EXCEPTION '네트워크 TC 수가 6개가 아닙니다.';
  END IF;

  IF (SELECT COUNT(*) FROM test_items ti JOIN categories c ON c.id = ti.category_id WHERE c.name = '서스펜드') <> 5 THEN
    RAISE EXCEPTION '서스펜드 TC 수가 5개가 아닙니다.';
  END IF;

  IF (SELECT COUNT(*) FROM test_items ti JOIN categories c ON c.id = ti.category_id WHERE c.name = '결제') <> 6 THEN
    RAISE EXCEPTION '결제 TC 수가 6개가 아닙니다.';
  END IF;

  IF (SELECT COUNT(*) FROM test_items ti JOIN categories c ON c.id = ti.category_id WHERE c.name = 'iOS 검수') <> 39 THEN
    RAISE EXCEPTION 'iOS 검수 TC 수가 39개가 아닙니다.';
  END IF;

  RAISE NOTICE '완료: 공통 7 + 네트워크 6 + 서스펜드 5 + 결제 6 = 총 24개 등록 상태 확인';
END $$;

COMMIT;
