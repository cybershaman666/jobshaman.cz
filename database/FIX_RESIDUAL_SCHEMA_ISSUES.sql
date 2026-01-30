-- Ensure created_at exists in jobs table for sorting (Fixes 400 error)
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
-- Ensure company_id is UUID (defensive fix for potential conversion issues)
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'jobs'
        AND column_name = 'company_id'
        AND data_type != 'uuid'
) THEN
ALTER TABLE public.jobs
ALTER COLUMN company_id TYPE UUID USING company_id::uuid;
END IF;
END $$;