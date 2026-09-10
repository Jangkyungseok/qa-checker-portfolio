BEGIN;

ALTER TABLE build_histories
  ADD COLUMN source_type varchar(30) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN source_branch varchar(255),
  ADD COLUMN risk_level varchar(20),
  ADD COLUMN regression_required boolean,
  ADD COLUMN additional_test_required boolean,
  ADD COLUMN review_status varchar(20) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN reviewed_by uuid REFERENCES users(id),
  ADD COLUMN reviewed_at timestamptz;

ALTER TABLE build_histories
  ADD CONSTRAINT chk_build_histories_source_type
    CHECK (source_type IN ('MANUAL', 'VCS', 'BUILD_SYSTEM', 'ISSUE_TRACKER')),
  ADD CONSTRAINT chk_build_histories_risk_level
    CHECK (
      risk_level IS NULL
      OR risk_level IN ('UNASSESSED', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    ),
  ADD CONSTRAINT chk_build_histories_review_status
    CHECK (review_status IN ('DRAFT', 'REVIEWED')),
  ADD CONSTRAINT chk_build_histories_review_audit
    CHECK (
      (
        review_status = 'DRAFT'
        AND reviewed_by IS NULL
        AND reviewed_at IS NULL
      )
      OR
      (
        review_status = 'REVIEWED'
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
      )
    );

CREATE TABLE build_history_inspections (
  build_history_id uuid NOT NULL
    REFERENCES build_histories(id) ON DELETE CASCADE,
  inspection_id uuid NOT NULL
    REFERENCES inspections(id) ON DELETE RESTRICT,
  linked_by uuid NOT NULL
    REFERENCES users(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (build_history_id, inspection_id)
);

CREATE TABLE build_history_impacts (
  build_history_id uuid NOT NULL
    REFERENCES build_histories(id) ON DELETE CASCADE,
  impact_area varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (build_history_id, impact_area)
);

CREATE INDEX idx_build_histories_project_review_delivered
  ON build_histories(project_id, review_status, delivered_at DESC);

CREATE INDEX idx_build_histories_project_risk_delivered
  ON build_histories(project_id, risk_level, delivered_at DESC);

CREATE INDEX idx_build_history_inspections_inspection
  ON build_history_inspections(inspection_id);

CREATE INDEX idx_build_history_impacts_impact_area
  ON build_history_impacts(impact_area);

COMMIT;
