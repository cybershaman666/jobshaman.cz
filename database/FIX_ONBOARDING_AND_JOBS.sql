-- FIX ONBOARDING AND JOBS SCHEMA
-- Run this in Supabase SQL Editor to fix "400 Bad Request" and missing fields.
-- 1. Ensure Subscriptions Table Exists and is Correct
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    tier VARCHAR(50) DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'inactive',
    -- active, inactive, past_due, canceled
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE,
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Companies can view own subscription" ON public.subscriptions FOR
SELECT USING (
        auth.uid() IN (
            SELECT owner_id
            FROM public.companies
            WHERE id = subscriptions.company_id
        )
    );
-- 2. Enhance Companies Table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS company_size VARCHAR(50),
    -- '1-10', '11-50', etc.
ADD COLUMN IF NOT EXISTS founded_year INTEGER,
    ADD COLUMN IF NOT EXISTS field_of_business VARCHAR(100),
    ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100);
-- 3. Enhance Jobs Table
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS salary_min INTEGER,
    ADD COLUMN IF NOT EXISTS salary_max INTEGER,
    ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(10) DEFAULT 'CZK',
    ADD COLUMN IF NOT EXISTS benefits TEXT [],
    -- Array of strings
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100),
    ADD COLUMN IF NOT EXISTS workplace_address VARCHAR(255);
-- 4. Create Usage Tracking Table (if missing)
CREATE TABLE IF NOT EXISTS public.subscription_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    active_jobs_count INTEGER DEFAULT 0,
    ai_assessments_used INTEGER DEFAULT 0,
    ad_optimizations_used INTEGER DEFAULT 0,
    period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_end TIMESTAMP WITH TIME ZONE,
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 5. Fix RLS for Jobs (Ensure companies can insert)
DROP POLICY IF EXISTS "Companies can insert jobs" ON public.jobs;
CREATE POLICY "Companies can insert jobs" ON public.jobs FOR
INSERT WITH CHECK (
        auth.uid() IN (
            SELECT owner_id
            FROM public.companies
            WHERE id = jobs.company_id
        )
    );
DROP POLICY IF EXISTS "Companies can update own jobs" ON public.jobs;
CREATE POLICY "Companies can update own jobs" ON public.jobs FOR
UPDATE USING (
        auth.uid() IN (
            SELECT owner_id
            FROM public.companies
            WHERE id = jobs.company_id
        )
    );
COMMENT ON TABLE public.subscriptions IS 'Tracks company subscription status and tiers';