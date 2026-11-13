BEGIN;
CREATE TABLE qa_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  title varchar(200) NOT NULL DEFAULT '',
  target_build varchar(200) NOT NULL DEFAULT '',
  filter_build_version varchar(200),
  test_start_date date,
  test_end_date date,
  test_scope text NOT NULL DEFAULT '' CHECK (length(test_scope)<=2000),
  test_environment text NOT NULL DEFAULT '' CHECK (length(test_environment)<=2000),
  test_method text NOT NULL DEFAULT '' CHECK (length(test_method)<=2000),
  considerations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(considerations)='object'),
  lead_opinion text NOT NULL DEFAULT '' CHECK (length(lead_opinion)<=10000),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (test_start_date IS NULL OR test_end_date IS NULL OR test_start_date<=test_end_date)
);
CREATE INDEX idx_qa_reports_project_updated ON qa_reports(project_id,updated_at DESC,id);
CREATE TABLE qa_report_issue_links (
  report_id uuid NOT NULL REFERENCES qa_reports(id) ON DELETE CASCADE,
  defect_id uuid NOT NULL REFERENCES defects(id),
  purpose varchar(30) NOT NULL CHECK (purpose IN ('FEATURED','REQUIRED_CONSIDERATION','PRIORITY_CONSIDERATION','FUTURE_CONSIDERATION','NEEDS_REVIEW')),
  sort_order integer NOT NULL CHECK (sort_order>=0 AND sort_order<100),
  attachment_id uuid REFERENCES defect_attachments(id),
  PRIMARY KEY (report_id,purpose,defect_id),
  UNIQUE (report_id,purpose,sort_order),
  CHECK (purpose='FEATURED' OR attachment_id IS NULL),
  CHECK (purpose<>'FEATURED' OR sort_order<5)
);
CREATE INDEX idx_qa_report_links_defect ON qa_report_issue_links(defect_id);
CREATE INDEX idx_qa_report_links_attachment ON qa_report_issue_links(attachment_id) WHERE attachment_id IS NOT NULL;
COMMIT;
