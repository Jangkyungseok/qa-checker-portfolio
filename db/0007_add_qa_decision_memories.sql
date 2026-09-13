BEGIN;

CREATE TABLE qa_decision_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL
    REFERENCES projects(id) ON DELETE CASCADE,
  build_history_id uuid
    REFERENCES build_histories(id) ON DELETE SET NULL,
  build_version_snapshot varchar(100),
  inspection_id uuid
    REFERENCES inspections(id) ON DELETE SET NULL,
  inspection_version_snapshot varchar(100),
  decision_type varchar(30) NOT NULL,
  risk_level varchar(20),
  decision text NOT NULL,
  reason text NOT NULL,
  conditions text,
  result text,
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  resolved_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT chk_qa_decision_memories_decision_type
    CHECK (
      decision_type IN (
        'RELEASE',
        'RISK_ACCEPTANCE',
        'TEST_SCOPE',
        'REGRESSION',
        'DEFECT_DISPOSITION',
        'OTHER'
      )
    ),
  CONSTRAINT chk_qa_decision_memories_risk_level
    CHECK (
      risk_level IS NULL
      OR risk_level IN ('UNASSESSED', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    ),
  CONSTRAINT chk_qa_decision_memories_status
    CHECK (status IN ('OPEN', 'RESOLVED')),
  CONSTRAINT chk_qa_decision_memories_resolution
    CHECK (
      (
        status = 'OPEN'
        AND result IS NULL
        AND resolved_by IS NULL
        AND resolved_at IS NULL
      )
      OR
      (
        status = 'RESOLVED'
        AND result IS NOT NULL
        AND resolved_by IS NOT NULL
        AND resolved_at IS NOT NULL
      )
    )
);

CREATE INDEX idx_qa_decision_memories_project_created
  ON qa_decision_memories(project_id, created_at DESC);

CREATE INDEX idx_qa_decision_memories_project_status_created
  ON qa_decision_memories(project_id, status, created_at DESC);

CREATE INDEX idx_qa_decision_memories_project_risk_created
  ON qa_decision_memories(project_id, risk_level, created_at DESC);

CREATE INDEX idx_qa_decision_memories_build_history
  ON qa_decision_memories(build_history_id)
  WHERE build_history_id IS NOT NULL;

CREATE INDEX idx_qa_decision_memories_inspection
  ON qa_decision_memories(inspection_id)
  WHERE inspection_id IS NOT NULL;

COMMIT;
