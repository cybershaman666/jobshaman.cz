-- JOB SHAMAN - COMPLETE DATABASE RECOVERY SCRIPT v2
-- Run this in Supabase SQL Editor to fix 400, 403, 404, and PostGIS errors.
-- 1. ENABLE EXTENSIONS AND FIX SEARCH PATH
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER DATABASE postgres
SET search_path TO "$user",
    public,
    extensions;
-- 2. ENSURE CORE TABLES EXIST
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    ico TEXT,
    address TEXT,
    website TEXT,
    description TEXT,
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 3. ENSURE COMPANY MEMBERS TABLE EXIST
CREATE TABLE IF NOT EXISTS public.company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'recruiter',
    -- admin, recruiter
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, user_id)
);
-- 4. FIX JOBS TABLE SCHEMA
CREATE TABLE IF NOT EXISTS public.jobs (
    id BIGSERIAL PRIMARY KEY,
    title TEXT,
    company TEXT,
    location TEXT,
    description TEXT,
    benefits TEXT [],
    contract_type TEXT,
    salary_from NUMERIC,
    salary_to NUMERIC,
    work_type TEXT,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source TEXT,
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Add missing company_id column to jobs (Fix 400 error)
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
-- Add lat/lng columns if they don't exist
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
-- Add PostGIS geometry column
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
-- 5. CREATE SPATIAL INDEX AND TRIGGER (Use fully qualified function names to be safe)
CREATE INDEX IF NOT EXISTS idx_jobs_geom ON public.jobs USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs(company_id);
CREATE OR REPLACE FUNCTION public.update_job_geom() RETURNS TRIGGER AS $$ BEGIN IF NEW.lat IS NOT NULL
    AND NEW.lng IS NOT NULL THEN -- Try to use extension's functions explicitly if needed
    BEGIN NEW.geom = extensions.ST_SetSRID(extensions.ST_MakePoint(NEW.lng, NEW.lat), 4326);
EXCEPTION
WHEN OTHERS THEN -- Fallback to default schema
NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
END;
ELSE NEW.geom = NULL;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_update_job_geom ON public.jobs;
CREATE TRIGGER trg_update_job_geom BEFORE
INSERT
    OR
UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_job_geom();
-- 6. ENSURE SUBSCRIPTION SYSTEM TABLES EXIST
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    -- For personal users
    tier VARCHAR(50) DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'active',
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.subscription_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID UNIQUE REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    active_jobs_count INTEGER DEFAULT 0,
    ai_assessments_used INTEGER DEFAULT 0,
    ad_optimizations_used INTEGER DEFAULT 0,
    last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 7. FIX GEOCODE CACHE (Fix 403 errors)
CREATE TABLE IF NOT EXISTS public.geocode_cache (
    id BIGSERIAL PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read geocode_cache" ON public.geocode_cache;
CREATE POLICY "Public can read geocode_cache" ON public.geocode_cache FOR
SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can insert geocode_cache" ON public.geocode_cache;
CREATE POLICY "Authenticated can insert geocode_cache" ON public.geocode_cache FOR
INSERT WITH CHECK (auth.role() = 'authenticated');
-- 8. FIX RLS FOR JOBS (Essential for Post success)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Companies can manage their own jobs" ON public.jobs;
CREATE POLICY "Companies can manage their own jobs" ON public.jobs FOR ALL USING (
    company_id IN (
        SELECT id
        FROM public.companies
        WHERE owner_id = (
                select auth.uid()
            )
        UNION
        SELECT company_id
        FROM public.company_members
        WHERE user_id = (
                select auth.uid()
            )
    )
) WITH CHECK (
    company_id IN (
        SELECT id
        FROM public.companies
        WHERE owner_id = (
                select auth.uid()
            )
        UNION
        SELECT company_id
        FROM public.company_members
        WHERE user_id = (
                select auth.uid()
            )
    )
);
DROP POLICY IF EXISTS "Anyone can read jobs" ON public.jobs;
CREATE POLICY "Anyone can read jobs" ON public.jobs FOR
SELECT USING (true);
-- 9. NOTIFY
-- Recovery script v2 completed.