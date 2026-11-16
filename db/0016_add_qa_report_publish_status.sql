-- Existing reports remain private to QA roles. Apply once, before code deployment.
-- No report content, links, ownership or version values are modified.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.qa_reports
  ADD COLUMN status varchar(16) NOT NULL DEFAULT 'DRAFT'
  CONSTRAINT qa_reports_status_check CHECK (status IN ('DRAFT', 'PUBLISHED'));
COMMIT;
