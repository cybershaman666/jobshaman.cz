-- V2 SCHEMA DRAFT (Paralelní produkční model v Northflank Postgres) V1.2
-- Supabase slouží pouze pro Auth. Zde leží produktová pravda.

-- ==========================================
-- 0. AUTH & ACCOUNT IDENTITY (Northflank Mirror)
-- ==========================================

CREATE TABLE public.users (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    supabase_user_id uuid UNIQUE NOT NULL, -- Odkaz na Supabase auth.users.id
    email text,
    email_source text DEFAULT 'supabase_auth',
    account_type text NOT NULL CHECK (account_type IN ('candidate', 'company', 'admin')),
    display_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 1. IDENTITY DOMAIN
-- ==========================================

CREATE TABLE public.candidate_profiles_v2 (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id),
    legacy_candidate_profile_id uuid, -- Vazba na historický profil v Supabase
    migration_status text DEFAULT 'pending',
    geo_lat double precision,
    geo_lon double precision,
    tax_profile_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.candidate_identity_signals (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_id uuid NOT NULL REFERENCES public.candidate_profiles_v2(id),
    signal_key text NOT NULL, 
    signal_value jsonb NOT NULL, 
    source_type text NOT NULL CHECK (source_type IN ('manual_admin', 'user_statement', 'user_confirmed_ai', 'system_calculation', 'jcfpm_result', 'derived_rule', 'behavioral_signal', 'imported_profile', 'ai_interpretation', 'legacy_migration')),
    source_ref text, -- Např. 'candidate_profiles.inferred_skills'
    confidence double precision NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    sensitivity_level text NOT NULL DEFAULT 'medium' CHECK (sensitivity_level IN ('low', 'medium', 'high', 'restricted')),
    visibility_scope text NOT NULL DEFAULT 'private' CHECK (visibility_scope IN ('private', 'candidate_only', 'shareable_summary', 'company_visible', 'admin_only')),
    confirmation_status text NOT NULL DEFAULT 'inferred' CHECK (confirmation_status IN ('inferred', 'suggested', 'confirmed', 'rejected', 'revoked')),
    rule_version text,
    prompt_version text,
    input_hash text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    revoked_at timestamp with time zone
);

CREATE TABLE public.candidate_search_preferences (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_id uuid NOT NULL REFERENCES public.candidate_profiles_v2(id),
    constraint_type text NOT NULL CHECK (constraint_type IN ('hard', 'soft', 'growth')),
    preference_key text NOT NULL, 
    preference_value jsonb NOT NULL,
    source_type text NOT NULL CHECK (source_type IN ('user_statement', 'behavioral_signal', 'legacy_migration')),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 2. OPPORTUNITIES DOMAIN
-- ==========================================

CREATE TABLE public.raw_opportunity_imports (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    source_system text NOT NULL, -- 'legacy_job_snapshot', 'scraper_xy', atd.
    external_id text,
    raw_payload jsonb NOT NULL,
    import_batch_id text,
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.opportunities (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    legacy_job_id integer, -- Vazba na původní tabulku jobs
    source_type text,
    source_name text,
    external_id text,
    canonical_url text,
    migration_batch_id text,
    migration_status text DEFAULT 'migrated',
    title text NOT NULL,
    company_id uuid, -- Vazba na budoucí companies tabulku v Northflanku
    geo_lat double precision,
    geo_lon double precision,
    salary_min numeric,
    salary_max numeric,
    currency text DEFAULT 'CZK',
    opportunity_type text NOT NULL DEFAULT 'job' CHECK (opportunity_type IN ('job', 'challenge', 'microjob', 'course')),
    status text NOT NULL DEFAULT 'active',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.opportunity_quality (
    opportunity_id uuid NOT NULL PRIMARY KEY REFERENCES public.opportunities(id),
    has_salary boolean DEFAULT false,
    has_location boolean DEFAULT false,
    confidence_total double precision NOT NULL CHECK (confidence_total >= 0.0 AND confidence_total <= 1.0),
    missing_critical_data jsonb DEFAULT '[]',
    publishable boolean DEFAULT false,
    last_checked_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 3. REALITY DOMAIN
-- ==========================================

CREATE TABLE public.opportunity_reality_profile (
    opportunity_id uuid NOT NULL PRIMARY KEY REFERENCES public.opportunities(id),
    routine_level double precision CHECK (routine_level >= 0.0 AND routine_level <= 1.0),
    routine_level_confidence double precision,
    stress_level double precision CHECK (stress_level >= 0.0 AND stress_level <= 1.0),
    stress_level_confidence double precision,
    physical_demand double precision,
    is_shift_work boolean,
    source_type text NOT NULL CHECK (source_type IN ('ai_interpretation', 'derived_rule', 'company_statement', 'system_calculation', 'manual_admin')),
    sensitivity_level text NOT NULL DEFAULT 'low' CHECK (sensitivity_level IN ('low', 'medium', 'high', 'restricted')),
    visibility_scope text NOT NULL DEFAULT 'company_visible' CHECK (visibility_scope IN ('private', 'candidate_only', 'shareable_summary', 'company_visible', 'admin_only')),
    rule_version text,
    prompt_version text,
    input_hash text,
    calculated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 4. RECOMMENDATION DOMAIN
-- ==========================================

CREATE TABLE public.recommendation_snapshots (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_id uuid NOT NULL REFERENCES public.candidate_profiles_v2(id),
    opportunity_id uuid NOT NULL REFERENCES public.opportunities(id),
    recommendation_intent text NOT NULL CHECK (recommendation_intent IN ('safe_match', 'stretch_match', 'income_now', 'growth_path', 'exploration', 'sandbox_validation', 'fallback')),
    eligibility_status text NOT NULL CHECK (eligibility_status IN ('eligible', 'soft_blocked', 'blocked')),
    score_total double precision,
    score_confidence double precision,
    score_breakdown jsonb NOT NULL,
    risk_breakdown jsonb NOT NULL,
    explanation_structured jsonb NOT NULL,
    input_refs jsonb NOT NULL, 
    rule_version text NOT NULL,
    model_version text,
    status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'shown', 'opened', 'saved', 'hidden', 'applied', 'expired', 'invalidated')),
    created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 5. HANDSHAKE & COMPANY SHARES
-- ==========================================

CREATE TABLE public.handshakes (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    legacy_application_id uuid, -- Vazba na původní job_applications.id
    candidate_id uuid NOT NULL REFERENCES public.candidate_profiles_v2(id),
    company_id uuid NOT NULL, -- Odkaz do tabulky companies
    opportunity_id uuid REFERENCES public.opportunities(id),
    status text NOT NULL CHECK (status IN ('suggested', 'opened', 'started', 'in_progress', 'submitted', 'company_reviewing', 'company_interested', 'company_declined', 'candidate_declined', 'mutual_handshake', 'archived')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.handshake_events (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    handshake_id uuid NOT NULL REFERENCES public.handshakes(id),
    actor_id uuid NOT NULL,
    actor_type text NOT NULL CHECK (actor_type IN ('candidate', 'company', 'system')),
    event_type text NOT NULL, -- 'legacy_application_migrated', 'status_changed', atd.
    previous_status text,
    new_status text NOT NULL,
    event_payload jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.candidate_company_shares (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_id uuid NOT NULL REFERENCES public.candidate_profiles_v2(id),
    company_id uuid NOT NULL,
    handshake_id uuid REFERENCES public.handshakes(id),
    shared_profile_version text NOT NULL,
    shared_fields jsonb NOT NULL,
    consent_given_at timestamp with time zone NOT NULL DEFAULT now(),
    revoked_at timestamp with time zone
);

-- ==========================================
-- 6. AI GOVERNANCE & AUDIT LOGS
-- ==========================================

CREATE TABLE public.ai_interpretation_jobs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    target_entity_type text NOT NULL,
    target_entity_id uuid NOT NULL,
    job_status text NOT NULL DEFAULT 'pending' CHECK (job_status IN ('pending', 'running', 'completed', 'failed', 'replaced', 'invalidated')),
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);

CREATE TABLE public.ai_outputs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id uuid REFERENCES public.ai_interpretation_jobs(id),
    prompt_version text NOT NULL,
    model text NOT NULL,
    input_hash text NOT NULL,
    output_payload jsonb NOT NULL,
    confidence double precision NOT NULL,
    allowed_use jsonb NOT NULL, 
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_output_feedback (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ai_output_id uuid NOT NULL REFERENCES public.ai_outputs(id),
    reviewer_id uuid NOT NULL,
    reviewer_type text NOT NULL CHECK (reviewer_type IN ('admin', 'user')),
    feedback_status text NOT NULL CHECK (feedback_status IN ('accurate', 'wrong', 'too_harsh', 'too_vague', 'sensitive', 'unsafe')),
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.sensitive_access_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id uuid NOT NULL,
    actor_type text NOT NULL CHECK (actor_type IN ('admin', 'company')),
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
