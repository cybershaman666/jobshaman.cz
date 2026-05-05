CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE candidate_profiles_v2
  ADD COLUMN IF NOT EXISTS legacy_candidate_profile_id text,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS public_summary text,
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS profile_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_profiles_v2_legacy_id
  ON candidate_profiles_v2(legacy_candidate_profile_id)
  WHERE legacy_candidate_profile_id IS NOT NULL;

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS legacy_job_id text,
  ADD COLUMN IF NOT EXISTS opportunity_type text NOT NULL DEFAULT 'job',
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'company_statement',
  ADD COLUMN IF NOT EXISTS source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS normalization_version text NOT NULL DEFAULT 'v2.0.0',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_legacy_job_id
  ON opportunities(legacy_job_id)
  WHERE legacy_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_status_type
  ON opportunities(status, opportunity_type);

ALTER TABLE handshakes
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS legacy_application_id text,
  ADD COLUMN IF NOT EXISTS state_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS candidate_share_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_handshakes_legacy_application_id
  ON handshakes(legacy_application_id)
  WHERE legacy_application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_handshakes_opportunity_id
  ON handshakes(opportunity_id);

CREATE TABLE IF NOT EXISTS candidate_identity_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_key text NOT NULL,
  signal_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0.500,
  sensitivity_level text NOT NULL DEFAULT 'medium',
  visibility_scope text NOT NULL DEFAULT 'candidate_only',
  confirmation_status text NOT NULL DEFAULT 'inferred',
  is_user_confirmed boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  interpreter_version text,
  prompt_version text,
  rule_version text,
  input_hash text,
  created_from text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (confidence >= 0 AND confidence <= 1),
  CHECK (source_type IN (
    'manual_admin',
    'user_statement',
    'user_confirmed_ai',
    'system_calculation',
    'jcfpm_result',
    'derived_rule',
    'behavior_signal',
    'imported_profile',
    'ai_interpretation',
    'company_statement',
    'legacy_migration',
    'admin_override'
  )),
  CHECK (sensitivity_level IN ('low', 'medium', 'high', 'restricted')),
  CHECK (visibility_scope IN (
    'candidate_only',
    'recommendation_internal',
    'candidate_explanation',
    'company_share',
    'admin_only'
  )),
  CHECK (confirmation_status IN ('inferred', 'suggested', 'confirmed', 'rejected', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_candidate_identity_signals_user_active
  ON candidate_identity_signals(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_candidate_identity_signals_key
  ON candidate_identity_signals(signal_key);

CREATE TABLE IF NOT EXISTS candidate_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  organization text,
  location text,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  description text,
  source_type text NOT NULL DEFAULT 'user_statement',
  confidence numeric(4,3) NOT NULL DEFAULT 1.000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_candidate_experiences_user_id
  ON candidate_experiences(user_id);

CREATE TABLE IF NOT EXISTS candidate_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution text NOT NULL,
  field text,
  degree text,
  start_date date,
  end_date date,
  description text,
  source_type text NOT NULL DEFAULT 'user_statement',
  confidence numeric(4,3) NOT NULL DEFAULT 1.000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_candidate_education_user_id
  ON candidate_education(user_id);

CREATE TABLE IF NOT EXISTS candidate_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_key text NOT NULL,
  label text NOT NULL,
  category text,
  level text,
  source_type text NOT NULL DEFAULT 'user_statement',
  confidence numeric(4,3) NOT NULL DEFAULT 1.000,
  is_user_confirmed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_candidate_skills_user_id
  ON candidate_skills(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_skills_user_skill
  ON candidate_skills(user_id, skill_key);

CREATE TABLE IF NOT EXISTS candidate_onboarding_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flow_key text NOT NULL,
  question_key text NOT NULL,
  answer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL DEFAULT 'user_statement',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_onboarding_answers_user_flow
  ON candidate_onboarding_answers(user_id, flow_key);

CREATE TABLE IF NOT EXISTS candidate_search_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hard_constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  soft_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  jhi_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL DEFAULT 'user_statement',
  preference_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raw_opportunity_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  source_external_id text,
  legacy_job_id text,
  import_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_status text NOT NULL DEFAULT 'pending',
  error_message text,
  CHECK (processing_status IN ('pending', 'processed', 'failed', 'ignored'))
);

CREATE INDEX IF NOT EXISTS idx_raw_opportunity_imports_source
  ON raw_opportunity_imports(source_system, source_external_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_opportunity_imports_payload_hash
  ON raw_opportunity_imports(payload_hash)
  WHERE payload_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS opportunity_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  raw_import_id uuid REFERENCES raw_opportunity_imports(id) ON DELETE SET NULL,
  source_system text NOT NULL,
  source_url text,
  source_external_id text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_source_links_opportunity
  ON opportunity_source_links(opportunity_id);

CREATE TABLE IF NOT EXISTS opportunity_duplicates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  duplicate_opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  confidence numeric(4,3) NOT NULL DEFAULT 0.500,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (canonical_opportunity_id <> duplicate_opportunity_id),
  CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_duplicates_pair
  ON opportunity_duplicates(canonical_opportunity_id, duplicate_opportunity_id);

CREATE TABLE IF NOT EXISTS opportunity_quality (
  opportunity_id uuid PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  quality_score numeric(4,3) NOT NULL DEFAULT 0.500,
  missing_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_version text NOT NULL DEFAULT 'quality-v1',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quality_score >= 0 AND quality_score <= 1)
);

CREATE TABLE IF NOT EXISTS tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  tax_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL DEFAULT 'user_statement',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_profiles_user_country
  ON tax_profiles(user_id, country_code);

CREATE TABLE IF NOT EXISTS opportunity_reality_profile (
  opportunity_id uuid PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  salary_reality jsonb NOT NULL DEFAULT '{}'::jsonb,
  commute_reality jsonb NOT NULL DEFAULT '{}'::jsonb,
  routine_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  stress_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL DEFAULT 'system_calculation',
  confidence numeric(4,3) NOT NULL DEFAULT 0.500,
  rule_version text NOT NULL,
  input_hash text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE IF NOT EXISTS candidate_opportunity_reality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  salary_reality jsonb NOT NULL DEFAULT '{}'::jsonb,
  commute_reality jsonb NOT NULL DEFAULT '{}'::jsonb,
  availability_reality jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_version text NOT NULL,
  input_hash text NOT NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0.500,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_opportunity_reality_pair
  ON candidate_opportunity_reality(user_id, opportunity_id);

CREATE TABLE IF NOT EXISTS candidate_jhi_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  hard_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL DEFAULT 'user_statement',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunity_jhi_profile (
  opportunity_id uuid PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  profile_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_version text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_opportunity_jhi_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  score numeric(5,2) NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  jhi_model_version text NOT NULL,
  rule_version text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (score >= 0 AND score <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_opportunity_jhi_scores_pair
  ON candidate_opportunity_jhi_scores(user_id, opportunity_id);

CREATE TABLE IF NOT EXISTS recommendation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feed_key text NOT NULL DEFAULT 'candidate_main',
  algorithm_version text NOT NULL,
  eligibility_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  scoring_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ranked_opportunity_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_snapshots_user_feed
  ON recommendation_snapshots(user_id, feed_key, generated_at DESC);

CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES recommendation_snapshots(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  fit_score numeric(5,2) NOT NULL,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  eligibility_status text NOT NULL DEFAULT 'eligible',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fit_score >= 0 AND fit_score <= 100),
  CHECK (eligibility_status IN ('eligible', 'filtered_out', 'needs_confirmation'))
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user_rank
  ON recommendations(user_id, rank);

CREATE TABLE IF NOT EXISTS recommendation_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  candidate_narrative text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  caveats jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid REFERENCES recommendations(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feedback_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_user
  ON recommendation_feedback(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_company_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  share_version integer NOT NULL DEFAULT 1,
  shared_layers jsonb NOT NULL DEFAULT '[]'::jsonb,
  shared_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (consent_status IN ('active', 'revoked', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_candidate_company_shares_user_company
  ON candidate_company_shares(user_id, company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS handshake_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handshake_id uuid NOT NULL REFERENCES handshakes(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'system',
  event_type text NOT NULL,
  from_status text,
  to_status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handshake_events_handshake
  ON handshake_events(handshake_id, created_at);

CREATE TABLE IF NOT EXISTS handshake_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handshake_id uuid NOT NULL REFERENCES handshakes(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_handshake_messages_handshake
  ON handshake_messages(handshake_id, created_at);

CREATE TABLE IF NOT EXISTS sandbox_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handshake_id uuid NOT NULL REFERENCES handshakes(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'created',
  assignment_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  submission_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_handshake
  ON sandbox_sessions(handshake_id);

CREATE TABLE IF NOT EXISTS sandbox_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sandbox_session_id uuid NOT NULL REFERENCES sandbox_sessions(id) ON DELETE CASCADE,
  evaluator_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  score numeric(5,2),
  evaluation_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (score IS NULL OR (score >= 0 AND score <= 100))
);

CREATE TABLE IF NOT EXISTS user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user_created
  ON user_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recommendation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid REFERENCES recommendations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_created
  ON recommendation_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS behavior_summaries (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  summary_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary_version text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sensitive_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  access_reason text NOT NULL,
  accessed_layer text NOT NULL,
  accessed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensitive_access_logs_subject
  ON sensitive_access_logs(subject_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text NOT NULL,
  version text NOT NULL,
  prompt_body text NOT NULL,
  allowed_use text NOT NULL DEFAULT 'internal_scoring',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prompt_key, version)
);

CREATE TABLE IF NOT EXISTS ai_interpretation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  input_hash text NOT NULL,
  prompt_version_id uuid REFERENCES ai_prompt_versions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_ai_interpretation_jobs_status
  ON ai_interpretation_jobs(status, created_at);

CREATE TABLE IF NOT EXISTS ai_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interpretation_job_id uuid REFERENCES ai_interpretation_jobs(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  output_type text NOT NULL,
  output_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_use text NOT NULL DEFAULT 'internal_scoring',
  confidence numeric(4,3) NOT NULL DEFAULT 0.500,
  prompt_version text,
  input_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_ai_outputs_user_created
  ON ai_outputs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_output_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_output_id uuid NOT NULL REFERENCES ai_outputs(id) ON DELETE CASCADE,
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  feedback_type text NOT NULL,
  feedback_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_handshakes_candidate_share'
  ) THEN
    ALTER TABLE handshakes
      ADD CONSTRAINT fk_handshakes_candidate_share
      FOREIGN KEY (candidate_share_id)
      REFERENCES candidate_company_shares(id)
      ON DELETE SET NULL;
  END IF;
END $$;
