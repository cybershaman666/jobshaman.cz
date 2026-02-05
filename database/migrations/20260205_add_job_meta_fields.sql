-- Migration: add job meta fields (job_level, working_time, work_model, salary_timeframe)
-- Created: 2026-02-05

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_level text,
  ADD COLUMN IF NOT EXISTS working_time text,
  ADD COLUMN IF NOT EXISTS work_model text,
  ADD COLUMN IF NOT EXISTS salary_timeframe text;

-- End of migration
