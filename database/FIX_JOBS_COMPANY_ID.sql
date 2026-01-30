-- FIX: Add missing company_id column to jobs table
-- This resolves the HTTP 400 error when filtering jobs by company_id in the dashboard.
-- 1. Add the column if it doesn't exist
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
-- 2. Create an index for performance
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs(company_id);
-- 3. Update RLS policies to use the new column (if not already handled by OPTIMIZE_RLS.sql)
-- Note: OPTIMIZE_RLS.sql already attempts to use company_id for jobs, which is why it fails currently.
-- Optional: If you want to associate existing jobs with a company based on the 'company' text field (not recommended but helpful if data exists)
-- UPDATE public.jobs j
-- SET company_id = c.id
-- FROM public.companies c
-- WHERE j.company = c.name AND j.company_id IS NULL;