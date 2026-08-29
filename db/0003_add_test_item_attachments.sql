CREATE TABLE IF NOT EXISTS test_item_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_item_id uuid NOT NULL REFERENCES test_items(id) ON DELETE CASCADE,
  original_name varchar(255) NOT NULL,
  stored_name varchar(255) NOT NULL UNIQUE,
  mime_type varchar(100) NOT NULL,
  file_size bigint NOT NULL CHECK (file_size > 0),
  file_path varchar(500) NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_item_attachments_test_item_id
  ON test_item_attachments(test_item_id);

COMMENT ON TABLE test_item_attachments IS
  'TC 참고 자료 첨부파일 메타데이터. 실제 파일은 로컬 uploads/test-items에 저장.';
