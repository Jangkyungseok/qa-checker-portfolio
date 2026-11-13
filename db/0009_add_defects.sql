BEGIN;

CREATE TABLE defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_no bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  project_id uuid NOT NULL REFERENCES projects(id),
  title varchar(200) NOT NULL CHECK (length(trim(title)) > 0),
  description text NOT NULL,
  steps_to_reproduce text NOT NULL,
  expected_result text NOT NULL,
  actual_result text NOT NULL,
  severity varchar(20) NOT NULL CHECK (severity IN ('CRITICAL','MAJOR','MINOR','TRIVIAL')),
  priority varchar(10) NOT NULL CHECK (priority IN ('HIGH','MEDIUM','LOW')),
  status varchar(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','READY_FOR_RETEST','CLOSED')),
  assignee_id uuid REFERENCES users(id),
  build_history_id uuid REFERENCES build_histories(id) ON DELETE SET NULL,
  inspection_id uuid REFERENCES inspections(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES users(id),
  closed_at timestamptz,
  resolution varchar(30) CHECK (resolution IN ('FIXED','DUPLICATE','NOT_REPRODUCIBLE','WONT_FIX')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((status = 'CLOSED' AND closed_by IS NOT NULL AND closed_at IS NOT NULL AND resolution IS NOT NULL)
    OR (status <> 'CLOSED' AND closed_by IS NULL AND closed_at IS NULL AND resolution IS NULL))
);
CREATE INDEX idx_defects_project_created ON defects(project_id, created_at DESC, id);
CREATE INDEX idx_defects_project_status ON defects(project_id, status);
CREATE INDEX idx_defects_project_assignee ON defects(project_id, assignee_id);

CREATE TABLE defect_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id uuid NOT NULL REFERENCES defects(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES users(id),
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
);
CREATE INDEX idx_defect_comments_time ON defect_comments(defect_id, created_at, id);

CREATE TABLE defect_activities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  defect_id uuid NOT NULL REFERENCES defects(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  event_type varchar(30) NOT NULL CHECK (event_type IN (
    'CREATED','STATUS_CHANGED','ASSIGNEE_CHANGED','SEVERITY_CHANGED','PRIORITY_CHANGED',
    'CONTENT_UPDATED','COMMENT_CREATED','COMMENT_UPDATED','COMMENT_DELETED')),
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment_id uuid REFERENCES defect_comments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_defect_activities_time ON defect_activities(defect_id, created_at, id);

COMMIT;
