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