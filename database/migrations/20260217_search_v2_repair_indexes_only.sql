-- Index-only repair for search v2 (NO-DOWNTIME variant).
-- Use this when schema/tables already exist but index creation was interrupted.
-- IMPORTANT: This script requires an environment that does NOT wrap the whole script
-- into a single explicit transaction block.
-- If your SQL editor auto-wraps statements in BEGIN/COMMIT, use:
--   database/migrations/20260217_search_v2_repair_indexes_only_nonconcurrent.sql
-- (that variant may block writes while index is being built).

SET lock_timeout = '0';
SET statement_timeout = '0';
SET idle_in_transaction_session_timeout = '2min';

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS status text,
    ADD COLUMN IF NOT EXISTS search_text tsvector,
    ADD COLUMN IF NOT EXISTS search_text_plain text;

CREATE TABLE IF NOT EXISTS public.search_exposures (
    id bigserial PRIMARY KEY,
    request_id uuid NOT NULL,
    user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    job_id integer NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    position integer NOT NULL,
    query text,
    filters_json jsonb DEFAULT '{}'::jsonb,
    ranking_features_json jsonb DEFAULT '{}'::jsonb,
    shown_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (request_id, job_id)
);

CREATE TABLE IF NOT EXISTS public.search_feedback_events (
    id bigserial PRIMARY KEY,
    request_id uuid,
    user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    job_id integer NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    signal_type text NOT NULL,
    signal_value double precision,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_search_text_gin ON public.jobs USING gin (search_text);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_search_text_plain_trgm ON public.jobs USING gin (search_text_plain gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_legality_scraped ON public.jobs (status, legality_status, scraped_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_country_language ON public.jobs (country_code, language_code);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_salary_from ON public.jobs (salary_from);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_contract_type ON public.jobs (contract_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_exposures_shown_at ON public.search_exposures (shown_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_exposures_user_job ON public.search_exposures (user_id, job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_feedback_created_at ON public.search_feedback_events (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_feedback_user_job ON public.search_feedback_events (user_id, job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_feedback_request ON public.search_feedback_events (request_id);

NOTIFY pgrst, 'reload schema';
