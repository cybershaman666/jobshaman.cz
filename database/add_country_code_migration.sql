-- Migration: Add country_code column to jobs table
-- Description: Enables filtering of job listings by country based on user's selected language
-- Date: 2026-02-01
-- Add country_code column with default value 'cs' for existing records
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'cs';
-- Add check constraint to ensure only valid country codes
ALTER TABLE public.jobs
ADD CONSTRAINT jobs_country_code_check CHECK (country_code IN ('cs', 'pl', 'sk', 'de'));
-- Add index for efficient filtering by country_code
CREATE INDEX IF NOT EXISTS idx_jobs_country_code ON public.jobs(country_code);
-- Add comment to document the column
COMMENT ON COLUMN public.jobs.country_code IS 'ISO 3166-1 alpha-2 country code (cs=Czech, pl=Poland, sk=Slovakia, de=Germany)';
-- Verify the migration
DO $$ BEGIN -- Check if column exists
IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND table_name = 'jobs'
        AND column_name = 'country_code'
) THEN RAISE NOTICE '✅ Column country_code successfully added to jobs table';
ELSE RAISE EXCEPTION '❌ Failed to add country_code column';
END IF;
-- Check if index exists
IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
        AND tablename = 'jobs'
        AND indexname = 'idx_jobs_country_code'
) THEN RAISE NOTICE '✅ Index idx_jobs_country_code successfully created';
ELSE RAISE EXCEPTION '❌ Failed to create index on country_code';
END IF;
END $$;
-- Display summary of country codes in existing data
SELECT country_code,
    COUNT(*) as job_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM public.jobs
GROUP BY country_code
ORDER BY job_count DESC;