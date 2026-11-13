CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('USER', 'LEADER', 'ADMIN');

CREATE TYPE user_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'INACTIVE');

CREATE TYPE platform_type AS ENUM ('IOS', 'ANDROID');

CREATE TYPE inspection_type AS ENUM ('NEW', 'RESUBMISSION', 'DEVELOPMENT_REVIEW');

CREATE TYPE test_result_status AS ENUM ('PASS', 'FAIL', 'SKIP');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  name varchar(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'USER',
  status user_status NOT NULL DEFAULT 'PENDING',
  approved_at timestamptz,
  approved_by uuid REFERENCES users(id),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- DB-backed opaque sessions. ADMIN은 서비스 로직에서 동시 활성 세션 1개만 허용.
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES categories(id),
  name varchar(150) NOT NULL,
  description varchar(1000),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  default_ios boolean NOT NULL DEFAULT true,
  default_android boolean NOT NULL DEFAULT true,
  default_new boolean NOT NULL DEFAULT true,
  default_resubmission boolean NOT NULL DEFAULT true,
  default_development_review boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- TC 고유 번호 자동 발급용.
-- 정렬 순서(sort_order)와 별개이며 한번 발급된 번호는 재사용하지 않는다.
CREATE SEQUENCE test_item_tc_no_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE TABLE test_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tc_no bigint NOT NULL
    DEFAULT nextval('test_item_tc_no_seq')
    UNIQUE,

  category_id uuid NOT NULL REFERENCES categories(id),

  title varchar(200) NOT NULL,

  check_content text NOT NULL,

  test_method text NOT NULL,

  reference_note text,

  sort_order integer NOT NULL DEFAULT 0,

  is_active boolean NOT NULL DEFAULT true,

  applies_ios boolean NOT NULL DEFAULT true,

  applies_android boolean NOT NULL DEFAULT true,

  applies_new boolean NOT NULL DEFAULT true,

  applies_resubmission boolean NOT NULL DEFAULT true,

  applies_development_review boolean NOT NULL DEFAULT false,

  created_by uuid NOT NULL REFERENCES users(id),

  updated_by uuid NOT NULL REFERENCES users(id),

  created_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER SEQUENCE test_item_tc_no_seq
  OWNED BY test_items.tc_no;


CREATE TABLE build_histories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version varchar(150) NOT NULL,
  delivered_at date NOT NULL,
  change_summary text NOT NULL,
  qa_notes text,
  source_type varchar(30) NOT NULL DEFAULT 'MANUAL',
  source_branch varchar(255),
  risk_level varchar(20),
  regression_required boolean,
  additional_test_required boolean,
  review_status varchar(20) NOT NULL DEFAULT 'DRAFT',
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_build_histories_source_type
    CHECK (source_type IN ('MANUAL', 'VCS', 'BUILD_SYSTEM', 'ISSUE_TRACKER')),
  CONSTRAINT chk_build_histories_risk_level
    CHECK (
      risk_level IS NULL
      OR risk_level IN ('UNASSESSED', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    ),
  CONSTRAINT chk_build_histories_review_status
    CHECK (review_status IN ('DRAFT', 'REVIEWED')),
  CONSTRAINT chk_build_histories_review_audit
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
    )
);

CREATE TABLE inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id uuid NOT NULL REFERENCES projects(id),

  platform platform_type NOT NULL,

  version varchar(150) NOT NULL,

  inspection_type inspection_type NOT NULL,

  test_devices varchar(500) NOT NULL,

  created_by uuid NOT NULL REFERENCES users(id),

  created_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now()
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
  related_url varchar(2048),
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
        'OTHER',
        'DELIVERY_ISSUE',
        'REMAINING_ISSUE',
        'REMAINING_TEST',
        'LIVE_ISSUE_RESPONSE'
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

-- 검사 생성 시 원본 TC를 snapshot으로 복제해 과거 결과가 관리 항목 수정의 영향을 받지 않게 함
CREATE TABLE inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,

  source_test_item_id uuid REFERENCES test_items(id),

  category_name varchar(150) NOT NULL,

  category_sort_order integer NOT NULL DEFAULT 0,

  item_title varchar(200) NOT NULL,

  check_content text NOT NULL,

  test_method text NOT NULL,

  reference_note text,

  item_sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (inspection_id, source_test_item_id)
);

-- 현재 최신 결과. 보고서/진행률 조회 성능을 위해 별도 보관
CREATE TABLE test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  inspection_item_id uuid NOT NULL UNIQUE REFERENCES inspection_items(id) ON DELETE CASCADE,

  status test_result_status NOT NULL,

  memo varchar(500),

  tested_by uuid NOT NULL REFERENCES users(id),

  tested_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 전체 변경 이력. UI는 최신 2건만 노출
CREATE TABLE test_result_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  inspection_item_id uuid NOT NULL REFERENCES inspection_items(id) ON DELETE CASCADE,

  status test_result_status NOT NULL,

  memo varchar(500),

  changed_by uuid NOT NULL REFERENCES users(id),

  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_single_admin
  ON users ((role))
  WHERE role = 'ADMIN';

CREATE INDEX idx_user_sessions_user_active
  ON user_sessions(user_id, revoked_at, expires_at);

CREATE INDEX idx_categories_parent_sort
  ON categories(parent_id, sort_order);

CREATE INDEX idx_test_items_category_sort
  ON test_items(category_id, sort_order);


CREATE INDEX idx_build_histories_project_delivered
  ON build_histories(project_id, delivered_at DESC, created_at DESC);

CREATE INDEX idx_build_histories_project_review_delivered
  ON build_histories(project_id, review_status, delivered_at DESC);

CREATE INDEX idx_build_histories_project_risk_delivered
  ON build_histories(project_id, risk_level, delivered_at DESC);

CREATE INDEX idx_build_history_inspections_inspection
  ON build_history_inspections(inspection_id);

CREATE INDEX idx_build_history_impacts_impact_area
  ON build_history_impacts(impact_area);

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

CREATE INDEX idx_inspections_project_created
  ON inspections(project_id, created_at DESC);

CREATE INDEX idx_inspection_items_run_sort
  ON inspection_items(
    inspection_id,
    category_sort_order,
    item_sort_order
  );

CREATE INDEX idx_result_history_item_time
  ON test_result_history(
    inspection_item_id,
    changed_at DESC
  );

-- BTS: project membership is deferred; approved users retain existing project access.
CREATE TABLE defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_no bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  project_id uuid NOT NULL REFERENCES projects(id),
  title varchar(200) NOT NULL CHECK (length(trim(title)) > 0),
  description text NOT NULL,
  steps_to_reproduce text NOT NULL,
  expected_result text,
  actual_result text,
  fix_direction text CHECK (fix_direction IS NULL OR length(trim(fix_direction)) BETWEEN 1 AND 10000),
  reproducibility varchar(30) NOT NULL CHECK (reproducibility IN ('PERCENT_100','PERCENT_70','PERCENT_50','PERCENT_30','PERCENT_1','ALWAYS','SOMETIMES','RANDOM','NOT_TESTED','UNABLE_TO_REPRODUCE','NOT_APPLICABLE')),
  severity varchar(20) CHECK (severity IN ('BLOCKER','CRITICAL','MAJOR','MINOR','TRIVIAL')),
  priority varchar(10) NOT NULL CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT','IMMEDIATE')),
  status varchar(30) NOT NULL DEFAULT 'NEW'
    CHECK (status IN ('NEW','REQUESTED','RE_REQUESTED','IN_PROGRESS','RESPONDED','VERIFIED','SKIP_REQUESTED','SKIP_CONFIRMED')),
  build_version varchar(200),
  device_os varchar(500) NOT NULL DEFAULT '공통',
  related_defect_id uuid REFERENCES defects(id) ON DELETE SET NULL,
  legacy_status varchar(30),
  CONSTRAINT defects_related_not_self CHECK (related_defect_id IS NULL OR related_defect_id <> id),
  assignee_id uuid REFERENCES users(id),
  build_history_id uuid REFERENCES build_histories(id) ON DELETE SET NULL,
  inspection_id uuid REFERENCES inspections(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES users(id),
  closed_at timestamptz,
  resolution varchar(30) CHECK (resolution IN ('FIXED','UNABLE_TO_REPRODUCE','DUPLICATE','NOT_FIXABLE','WONT_FIX','NOT_AN_ISSUE')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((status IN ('VERIFIED','SKIP_CONFIRMED') AND closed_by IS NOT NULL AND closed_at IS NOT NULL)
    OR (status NOT IN ('VERIFIED','SKIP_CONFIRMED') AND closed_by IS NULL AND closed_at IS NULL))
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
    'CONTENT_UPDATED','COMMENT_CREATED','COMMENT_UPDATED','COMMENT_DELETED','ATTACHMENT_ADDED','ATTACHMENT_REMOVED')),
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment_id uuid REFERENCES defect_comments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_defect_activities_time ON defect_activities(defect_id, created_at, id);

CREATE INDEX idx_defects_project_priority ON defects(project_id,priority);
CREATE INDEX idx_defects_project_updated ON defects(project_id,updated_at DESC,id);

CREATE INDEX idx_defects_related ON defects(related_defect_id);
CREATE INDEX idx_defects_project_frequency ON defects(project_id,reproducibility);

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

CREATE INDEX idx_defect_activities_event_time ON defect_activities(event_type,created_at,defect_id);
