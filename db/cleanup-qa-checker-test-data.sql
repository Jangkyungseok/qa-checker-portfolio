BEGIN;

-- QA Checker 테스트 데이터 정리
-- 보존:
--   1) users
--   2) projects
--   3) 'iOS 검수' 카테고리
--   4) 'iOS 검수' 카테고리의 TC
--
-- 삭제:
--   1) 모든 검사 및 검사 결과/이력/첨부 스냅샷
--   2) 'iOS 검수' 이외의 모든 TC 및 카테고리

DO $$
DECLARE
  v_inspections_before bigint;
  v_inspection_items_before bigint;
  v_results_before bigint;
  v_history_before bigint;
  v_snapshot_attachments_before bigint;
  v_master_items_before bigint;
  v_categories_before bigint;

  v_inspections_after bigint;
  v_master_items_after bigint;
  v_categories_after bigint;
BEGIN
  SELECT COUNT(*) INTO v_inspections_before
  FROM inspections;

  SELECT COUNT(*) INTO v_inspection_items_before
  FROM inspection_items;

  SELECT COUNT(*) INTO v_results_before
  FROM test_results;

  SELECT COUNT(*) INTO v_history_before
  FROM test_result_history;

  SELECT COUNT(*) INTO v_snapshot_attachments_before
  FROM inspection_item_attachments;

  SELECT COUNT(*) INTO v_master_items_before
  FROM test_items;

  SELECT COUNT(*) INTO v_categories_before
  FROM categories;

  -- 1. 모든 검사 실행 데이터 삭제
  -- FK 제약 조건과 무관하게 자식 -> 부모 순서로 명시적으로 삭제한다.
  DELETE FROM inspection_item_attachments;

  DELETE FROM test_result_history;

  DELETE FROM test_results;

  DELETE FROM inspection_items;

  DELETE FROM inspections;

  -- 2. iOS 검수 이외의 마스터 TC 삭제
  -- test_item_attachments는 test_items 삭제 시 ON DELETE CASCADE 처리된다.
  DELETE FROM test_items ti
  USING categories c
  WHERE ti.category_id = c.id
    AND c.name <> 'iOS 검수';

  -- 3. iOS 검수 이외의 카테고리 삭제
  DELETE FROM categories
  WHERE name <> 'iOS 검수';

  -- 안전 확인: iOS 검수 카테고리가 반드시 남아 있어야 한다.
  IF NOT EXISTS (
    SELECT 1
    FROM categories
    WHERE name = 'iOS 검수'
  ) THEN
    RAISE EXCEPTION
      '안전 중단: iOS 검수 카테고리를 찾을 수 없습니다.';
  END IF;

  SELECT COUNT(*) INTO v_inspections_after
  FROM inspections;

  SELECT COUNT(*) INTO v_master_items_after
  FROM test_items;

  SELECT COUNT(*) INTO v_categories_after
  FROM categories;

  RAISE NOTICE '정리 전 검사: %', v_inspections_before;
  RAISE NOTICE '정리 전 검사 TC 스냅샷: %', v_inspection_items_before;
  RAISE NOTICE '정리 전 결과: %', v_results_before;
  RAISE NOTICE '정리 전 결과 이력: %', v_history_before;
  RAISE NOTICE '정리 전 검사 첨부 스냅샷: %', v_snapshot_attachments_before;
  RAISE NOTICE '정리 전 마스터 TC: %', v_master_items_before;
  RAISE NOTICE '정리 전 카테고리: %', v_categories_before;

  RAISE NOTICE '정리 후 검사: %', v_inspections_after;
  RAISE NOTICE '정리 후 마스터 TC: %', v_master_items_after;
  RAISE NOTICE '정리 후 카테고리: %', v_categories_after;

  IF v_inspections_after <> 0 THEN
    RAISE EXCEPTION
      '안전 중단: 검사 데이터가 남아 있습니다. 현재 %건',
      v_inspections_after;
  END IF;

  IF v_categories_after <> 1 THEN
    RAISE EXCEPTION
      '안전 중단: 보존 카테고리 수가 예상과 다릅니다. 현재 %개',
      v_categories_after;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM test_items ti
    JOIN categories c ON c.id = ti.category_id
    WHERE c.name = 'iOS 검수'
  ) <> 39 THEN
    RAISE EXCEPTION
      '안전 중단: iOS 검수 TC가 39개가 아닙니다. 트랜잭션을 롤백합니다.';
  END IF;

  RAISE NOTICE '완료: 모든 테스트 검사와 임시 카테고리/TC를 삭제했고 iOS 검수 39개 TC는 보존했습니다.';
END $$;

COMMIT;
