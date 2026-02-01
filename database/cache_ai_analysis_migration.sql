-- Migration: Add AI Analysis Cache Column and RPC Function
-- 1. Add JSONB column to jobs table
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
-- 2. Create RPC function to safely update analysis
-- This allows any authenticated user to "contribute" the analysis to the common pool
-- efficiently without giving them full UPDATE rights on the jobs table.
CREATE OR REPLACE FUNCTION save_job_ai_analysis(p_job_id BIGINT, p_analysis JSONB) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER -- Run as owner (bypass RLS for this specific update)
    AS $$ BEGIN -- Only update if it's currently null (avoid race conditions/overwrites)
UPDATE public.jobs
SET ai_analysis = p_analysis
WHERE id = p_job_id
    AND ai_analysis IS NULL;
RETURN FOUND;
END;
$$;
-- Grant execute permission to authenticated users and anon (if needed for public view)
GRANT EXECUTE ON FUNCTION save_job_ai_analysis TO anon,
    authenticated,
    service_role;
-- 3. Verification
SELECT id,
    title,
    ai_analysis
FROM public.jobs
LIMIT 5;