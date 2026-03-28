BEGIN;

-- Hard migration away from public.jobs as the FK anchor for side-channel and
-- telemetry tables. Canonical job existence is now validated in the app layer
-- against Jobs Postgres, while Supabase keeps only loose job_id references.

ALTER TABLE IF EXISTS public.assessment_results
    DROP CONSTRAINT IF EXISTS assessment_results_job_id_fkey,
    ALTER COLUMN job_id TYPE bigint USING job_id::bigint;

ALTER TABLE IF EXISTS public.job_candidate_matches
    DROP CONSTRAINT IF EXISTS job_candidate_matches_job_id_fkey,
    ALTER COLUMN job_id TYPE bigint USING job_id::bigint;

ALTER TABLE IF EXISTS public.job_embeddings
    DROP CONSTRAINT IF EXISTS job_embeddings_job_id_fkey;

ALTER TABLE IF EXISTS public.job_interactions
    DROP CONSTRAINT IF EXISTS job_interactions_job_id_fkey,
    ALTER COLUMN job_id TYPE bigint USING job_id::bigint;

ALTER TABLE IF EXISTS public.job_public_people
    DROP CONSTRAINT IF EXISTS job_public_people_job_id_fkey;

ALTER TABLE IF EXISTS public.job_solution_snapshots
    DROP CONSTRAINT IF EXISTS job_solution_snapshots_job_id_fkey;

ALTER TABLE IF EXISTS public.recommendation_cache
    DROP CONSTRAINT IF EXISTS recommendation_cache_job_id_fkey;

ALTER TABLE IF EXISTS public.recommendation_exposures
    DROP CONSTRAINT IF EXISTS recommendation_exposures_job_id_fkey;

ALTER TABLE IF EXISTS public.recommendation_feedback_events
    DROP CONSTRAINT IF EXISTS recommendation_feedback_events_job_id_fkey;

ALTER TABLE IF EXISTS public.search_exposures
    DROP CONSTRAINT IF EXISTS search_exposures_job_id_fkey,
    ALTER COLUMN job_id TYPE bigint USING job_id::bigint;

ALTER TABLE IF EXISTS public.search_feedback_events
    DROP CONSTRAINT IF EXISTS search_feedback_events_job_id_fkey,
    ALTER COLUMN job_id TYPE bigint USING job_id::bigint;

CREATE INDEX IF NOT EXISTS idx_assessment_results_job_id
    ON public.assessment_results(job_id);

CREATE INDEX IF NOT EXISTS idx_job_candidate_matches_job_id
    ON public.job_candidate_matches(job_id);

CREATE INDEX IF NOT EXISTS idx_job_public_people_job_id
    ON public.job_public_people(job_id);

CREATE INDEX IF NOT EXISTS idx_job_solution_snapshots_job_id
    ON public.job_solution_snapshots(job_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_cache_job_id
    ON public.recommendation_cache(job_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_exposures_job_id
    ON public.recommendation_exposures(job_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_events_job_id
    ON public.recommendation_feedback_events(job_id);

CREATE INDEX IF NOT EXISTS idx_job_interactions_job_id
    ON public.job_interactions(job_id);

CREATE INDEX IF NOT EXISTS idx_search_exposures_job_id
    ON public.search_exposures(job_id);

CREATE INDEX IF NOT EXISTS idx_search_feedback_events_job_id
    ON public.search_feedback_events(job_id);

COMMIT;
