-- Fix for jobs_country_code_check constraint
-- This script adds 'at' (Austria) to the allowed country codes.
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_country_code_check;
ALTER TABLE public.jobs
ADD CONSTRAINT jobs_country_code_check CHECK (
        country_code IN ('cs', 'cz', 'sk', 'pl', 'de', 'at')
    );