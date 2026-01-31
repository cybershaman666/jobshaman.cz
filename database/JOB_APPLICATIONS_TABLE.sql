-- Migration: Create job_applications table
-- Description: This table tracks job applications from candidates to companies.
CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id BIGINT NOT NULL,
    -- References jobs.id
    candidate_id UUID REFERENCES public.profiles(id) ON DELETE
    SET NULL,
        company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
        applied_at TIMESTAMPTZ DEFAULT now(),
        cover_letter TEXT,
        status TEXT DEFAULT 'pending' CHECK (
            status IN (
                'pending',
                'reviewed',
                'shortlisted',
                'rejected',
                'hired'
            )
        ),
        created_at TIMESTAMPTZ DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
-- Policies
-- 1. Candidates can see their own applications
CREATE POLICY "Candidates can view own applications" ON public.job_applications FOR
SELECT USING (auth.uid() = candidate_id);
-- 2. Companies can see applications for their jobs
CREATE POLICY "Companies can view applications for their jobs" ON public.job_applications FOR
SELECT USING (
        auth.uid() IN (
            SELECT owner_id
            FROM public.companies
            WHERE id = job_applications.company_id
        )
    );
-- 3. Candidates can insert their own applications
CREATE POLICY "Candidates can insert own applications" ON public.job_applications FOR
INSERT WITH CHECK (
        auth.uid() = candidate_id
        OR candidate_id IS NULL
    );
-- Index for performance
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_company_id ON public.job_applications(company_id);