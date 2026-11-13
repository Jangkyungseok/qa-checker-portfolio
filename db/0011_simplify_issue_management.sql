BEGIN;
-- Keep retired fields and historical narrative/activity data intact.
ALTER TABLE defects
  ALTER COLUMN severity DROP NOT NULL,
  ADD COLUMN build_version varchar(200),
  ADD COLUMN device_os varchar(500) NOT NULL DEFAULT '공통',
  ADD COLUMN related_defect_id uuid REFERENCES defects(id) ON DELETE SET NULL,
  ADD COLUMN legacy_status varchar(30),
  ADD CONSTRAINT defects_related_not_self CHECK (related_defect_id IS NULL OR related_defect_id <> id);
ALTER TABLE defects DROP CONSTRAINT defects_status_check, DROP CONSTRAINT defects_check,
  DROP CONSTRAINT defects_reproducibility_check;
-- Preserve the original status explicitly; never rewrite activity events.
UPDATE defects SET legacy_status=status,
  status=CASE
    WHEN status IN ('FEEDBACK','CONFIRMED','ASSIGNED') THEN 'REQUESTED'
    WHEN status IN ('RESOLVED','RETEST') THEN 'RESPONDED'
    WHEN status='CLOSED' AND resolution='FIXED' THEN 'VERIFIED'
    WHEN status='CLOSED' THEN 'SKIP_CONFIRMED'
    ELSE status END,
  version=version+1
WHERE status IN ('FEEDBACK','CONFIRMED','ASSIGNED','RESOLVED','RETEST','CLOSED');
ALTER TABLE defects
  ADD CONSTRAINT defects_status_check CHECK (status IN ('NEW','REQUESTED','IN_PROGRESS','RESPONDED','VERIFIED','SKIP_REQUESTED','SKIP_CONFIRMED')),
  ADD CONSTRAINT defects_check CHECK (
    (status IN ('VERIFIED','SKIP_CONFIRMED') AND closed_by IS NOT NULL AND closed_at IS NOT NULL)
    OR (status NOT IN ('VERIFIED','SKIP_CONFIRMED') AND closed_by IS NULL AND closed_at IS NULL)),
  ADD CONSTRAINT defects_reproducibility_check CHECK (reproducibility IN (
    'PERCENT_100','PERCENT_70','PERCENT_50','PERCENT_30','PERCENT_1',
    'ALWAYS','SOMETIMES','RANDOM','NOT_TESTED','UNABLE_TO_REPRODUCE','NOT_APPLICABLE'));
CREATE INDEX idx_defects_related ON defects(related_defect_id);
CREATE INDEX idx_defects_project_frequency ON defects(project_id,reproducibility);
COMMIT;
