BEGIN;

CREATE TABLE IF NOT EXISTS build_histories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version varchar(150) NOT NULL,
  delivered_at date NOT NULL,
  change_summary text NOT NULL,
  qa_notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_build_histories_project_delivered
  ON build_histories(project_id, delivered_at DESC, created_at DESC);

COMMIT;
