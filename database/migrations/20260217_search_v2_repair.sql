-- Repair script for partial apply of 20260217_search_v2.sql
-- Safe to run multiple times.
-- Run in SQL editor (autocommit mode), not inside an explicit BEGIN/COMMIT block.

SET lock_timeout = '5s';
SET statement_timeout = '20min';
SET idle_in_transaction_session_timeout = '2min';

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
DECLARE
    v_attempt integer;
BEGIN
    -- Retry lock-sensitive DDL instead of failing whole script on transient lock contention.
    FOR v_attempt IN 1..30 LOOP
        BEGIN
            EXECUTE '
                ALTER TABLE public.jobs
                    ADD COLUMN IF NOT EXISTS status text,
                    ADD COLUMN IF NOT EXISTS search_text tsvector,
                    ADD COLUMN IF NOT EXISTS search_text_plain text
            ';
            EXIT;
        EXCEPTION WHEN lock_not_available THEN
            IF v_attempt = 30 THEN
                RAISE;
            END IF;
            PERFORM pg_sleep(1);
        END;
    END LOOP;

    FOR v_attempt IN 1..30 LOOP
        BEGIN
            EXECUTE '
                ALTER TABLE public.jobs
                    ALTER COLUMN status SET DEFAULT ''active''
            ';
            EXIT;
        EXCEPTION WHEN lock_not_available THEN
            IF v_attempt = 30 THEN
                RAISE;
            END IF;
            PERFORM pg_sleep(1);
        END;
    END LOOP;
END;
$$;

DO $$
DECLARE
    v_rows_updated integer := 0;
    v_batch_size integer := 5000;
BEGIN
    LOOP
        UPDATE public.jobs j
        SET status = 'active'
        WHERE j.ctid IN (
            SELECT ctid
            FROM public.jobs
            WHERE status IS NULL
            LIMIT v_batch_size
        );

        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        EXIT WHEN v_rows_updated = 0;
        PERFORM pg_sleep(0.02);
    END LOOP;
END;
$$;

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

DO $$
DECLARE
    v_rows_updated integer := 0;
    v_batch_size integer := 5000;
BEGIN
    LOOP
        UPDATE public.jobs j
        SET
            search_text = public.build_jobs_search_text(
                j.title,
                j.company,
                j.location,
                j.description,
                j.benefits,
                j.contract_type,
                j.work_model,
                j.job_level
            ),
            search_text_plain = public.build_jobs_search_plain(
                j.title,
                j.company,
                j.location,
                j.description,
                j.benefits,
                j.contract_type,
                j.work_model,
                j.job_level
            )
        WHERE j.ctid IN (
            SELECT ctid
            FROM public.jobs
            WHERE search_text IS NULL OR search_text_plain IS NULL
            LIMIT v_batch_size
        );

        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        EXIT WHEN v_rows_updated = 0;
        PERFORM pg_sleep(0.02);
    END LOOP;
END;
$$;

-- Index builds can take long and require brief lock acquisition at start/end.
-- Do not fail instantly on lock timeout here.
SET lock_timeout = '0';
SET statement_timeout = '0';

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
