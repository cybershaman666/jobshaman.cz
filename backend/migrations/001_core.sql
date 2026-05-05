CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_id uuid UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'candidate',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz
);

CREATE TABLE IF NOT EXISTS candidate_profiles_v2 (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name text,
  location text,
  bio text,
  avatar_url text,
  skills text NOT NULL DEFAULT '[]',
  preferences text NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_cv_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  original_name text NOT NULL,
  file_url text NOT NULL DEFAULT '',
  file_size integer NOT NULL DEFAULT 0,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  is_active boolean NOT NULL DEFAULT false,
  label text,
  locale text,
  parsed_data text NOT NULL DEFAULT '{}',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  last_used timestamptz,
  parsed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_candidate_cv_documents_user_id ON candidate_cv_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_cv_documents_active ON candidate_cv_documents(user_id, is_active);

CREATE TABLE IF NOT EXISTS candidate_jcfpm_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schema_version text NOT NULL DEFAULT 'jcfpm-v1',
  responses text NOT NULL DEFAULT '{}',
  item_ids text NOT NULL DEFAULT '[]',
  variant_seed text,
  dimension_scores text NOT NULL DEFAULT '[]',
  percentile_summary text NOT NULL DEFAULT '{}',
  archetype text NOT NULL DEFAULT '{}',
  confidence integer NOT NULL DEFAULT 0,
  snapshot_payload text NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_jcfpm_snapshots_user_created ON candidate_jcfpm_snapshots(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text UNIQUE,
  logo_url text,
  hero_image text,
  narrative text,
  website_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_users_user_id ON company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON company_users(company_id);

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  description text,
  salary_from integer,
  salary_to integer,
  currency text NOT NULL DEFAULT 'CZK',
  work_model text NOT NULL DEFAULT 'Hybrid',
  location text,
  skills_required text NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_company_id ON opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_active ON opportunities(is_active);

CREATE TABLE IF NOT EXISTS handshakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id text NOT NULL,
  status text NOT NULL DEFAULT 'initiated',
  current_step integer NOT NULL DEFAULT 1,
  match_score_snapshot double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_handshakes_user_id ON handshakes(user_id);
CREATE INDEX IF NOT EXISTS idx_handshakes_job_id ON handshakes(job_id);

CREATE TABLE IF NOT EXISTS recommendation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL,
  match_score double precision NOT NULL,
  signals text NOT NULL DEFAULT '[]',
  narrative text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  algorithm_version text NOT NULL DEFAULT 'v2.0.0',
  governance_status text NOT NULL DEFAULT 'logged'
);

CREATE INDEX IF NOT EXISTS idx_recommendation_logs_user_job ON recommendation_logs(user_id, job_id, created_at DESC);
