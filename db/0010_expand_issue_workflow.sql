BEGIN;

-- Preserve legacy narrative fields; new UI uses fix_direction instead.
ALTER TABLE defects
  ALTER COLUMN expected_result DROP NOT NULL,
  ALTER COLUMN actual_result DROP NOT NULL,
  ADD COLUMN fix_direction text CHECK (fix_direction IS NULL OR length(trim(fix_direction)) BETWEEN 1 AND 10000),
  ADD COLUMN reproducibility varchar(30) NOT NULL DEFAULT 'NOT_TESTED'
    CHECK (reproducibility IN ('ALWAYS','SOMETIMES','RANDOM','NOT_TESTED','UNABLE_TO_REPRODUCE','NOT_APPLICABLE'));
ALTER TABLE defects ALTER COLUMN reproducibility DROP DEFAULT;

ALTER TABLE defects
  DROP CONSTRAINT defects_status_check,
  DROP CONSTRAINT defects_severity_check,
  DROP CONSTRAINT defects_priority_check,
  DROP CONSTRAINT defects_resolution_check,
  DROP CONSTRAINT defects_check;

-- Only enum aliases are migrated. Existing prose, links, audit actors and activity rows remain intact.
UPDATE defects SET
  status = CASE status WHEN 'OPEN' THEN 'NEW' WHEN 'READY_FOR_RETEST' THEN 'RESOLVED' ELSE status END,
  priority = CASE priority WHEN 'MEDIUM' THEN 'NORMAL' ELSE priority END,
  resolution = CASE resolution WHEN 'NOT_REPRODUCIBLE' THEN 'UNABLE_TO_REPRODUCE' ELSE resolution END,
  version = version + 1
WHERE status IN ('OPEN','READY_FOR_RETEST') OR priority='MEDIUM' OR resolution='NOT_REPRODUCIBLE';

ALTER TABLE defects
  ALTER COLUMN status SET DEFAULT 'NEW',
  ADD CONSTRAINT defects_status_check CHECK (status IN ('NEW','FEEDBACK','CONFIRMED','ASSIGNED','IN_PROGRESS','RESOLVED','RETEST','CLOSED')),
  ADD CONSTRAINT defects_severity_check CHECK (severity IN ('BLOCKER','CRITICAL','MAJOR','MINOR','TRIVIAL')),
  ADD CONSTRAINT defects_priority_check CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT','IMMEDIATE')),
  ADD CONSTRAINT defects_resolution_check CHECK (resolution IN ('FIXED','UNABLE_TO_REPRODUCE','DUPLICATE','NOT_FIXABLE','WONT_FIX','NOT_AN_ISSUE')),
  ADD CONSTRAINT defects_check CHECK (
    (status='CLOSED' AND closed_by IS NOT NULL AND closed_at IS NOT NULL AND resolution IS NOT NULL)
    OR (status IN ('RESOLVED','RETEST') AND closed_by IS NULL AND closed_at IS NULL)
    OR (status IN ('NEW','FEEDBACK','CONFIRMED','ASSIGNED','IN_PROGRESS') AND closed_by IS NULL AND closed_at IS NULL AND resolution IS NULL)
  );
CREATE INDEX idx_defects_project_priority ON defects(project_id,priority);
CREATE INDEX idx_defects_project_updated ON defects(project_id,updated_at DESC,id);

COMMIT;
