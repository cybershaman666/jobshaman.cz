-- Migration: add category to jobs for freelancer services
-- Created: 2026-02-04

ALTER TABLE IF EXISTS public.jobs
  ADD COLUMN IF NOT EXISTS category text;

-- End of migration
