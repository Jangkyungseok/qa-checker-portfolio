BEGIN;
ALTER TABLE defects DROP CONSTRAINT defects_status_check;
ALTER TABLE defects ADD CONSTRAINT defects_status_check CHECK (status IN ('NEW','REQUESTED','RE_REQUESTED','IN_PROGRESS','RESPONDED','VERIFIED','SKIP_REQUESTED','SKIP_CONFIRMED'));
CREATE TABLE defect_attachments (
  id uuid PRIMARY KEY,
  defect_id uuid NOT NULL REFERENCES defects(id),
  original_filename varchar(255) NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type varchar(100) NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp','application/pdf','video/mp4','video/quicktime')),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 104857600),
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES users(id),
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
);
CREATE INDEX idx_defect_attachments_issue ON defect_attachments(defect_id,created_at,id) WHERE deleted_at IS NULL;
ALTER TABLE defect_activities DROP CONSTRAINT defect_activities_event_type_check;
ALTER TABLE defect_activities ADD CONSTRAINT defect_activities_event_type_check CHECK (event_type IN (
  'CREATED','STATUS_CHANGED','ASSIGNEE_CHANGED','SEVERITY_CHANGED','PRIORITY_CHANGED','CONTENT_UPDATED',
  'COMMENT_CREATED','COMMENT_UPDATED','COMMENT_DELETED','ATTACHMENT_ADDED','ATTACHMENT_REMOVED'));
-- Existing activity rows are immutable. Support future event/time aggregations without duplicate timestamp columns.
CREATE INDEX idx_defect_activities_event_time ON defect_activities(event_type,created_at,defect_id);
COMMIT;
