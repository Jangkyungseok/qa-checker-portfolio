CREATE TABLE IF NOT EXISTS inspection_item_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_item_id uuid NOT NULL REFERENCES inspection_items(id) ON DELETE CASCADE,
  original_name varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL,
  file_size bigint NOT NULL CHECK (file_size > 0),
  file_path varchar(500) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_item_attachments_item_id
  ON inspection_item_attachments(inspection_item_id);

COMMENT ON TABLE inspection_item_attachments IS
  '검사 생성 시점의 TC 참고 자료 스냅샷 메타데이터. 원본 TC 첨부 변경과 독립적으로 검사 이력을 보존한다.';
