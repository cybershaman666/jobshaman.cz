-- Migration: add updated_at to jobs for inline edits
-- Created: 2026-02-04

ALTER TABLE IF EXISTS public.jobs
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- End of migration
