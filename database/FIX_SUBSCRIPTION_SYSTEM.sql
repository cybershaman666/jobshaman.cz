-- COMPREHENSIVE FIX: Subscription Usage & Company Members RLS
-- Fixes:
-- 1. Infinite recursion in company_members (caused by SECURE_TABLES.sql re-enabling RLS)
-- 2. Missing RLS policies for subscription_usage (causing 403 errors)
-- 3. Ensures subscription system works end-to-end
-- =====================================================================================
-- 1. FIX COMPANY_MEMBERS INFINITE RECURSION
-- =====================================================================================
-- The SECURE_TABLES.sql script re-enabled RLS on company_members, but the existing
-- policies have circular dependencies. We need to disable RLS or use simple policies.
-- Disable RLS on company_members (safest for now - this is an internal table)
ALTER TABLE IF EXISTS public.company_members DISABLE ROW LEVEL SECURITY;
-- Alternative: If you want RLS enabled, use these simple non-recursive policies instead:
-- ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
-- 
-- DROP POLICY IF EXISTS "Members can view own membership" ON public.company_members;
-- CREATE POLICY "Members can view own membership" ON public.company_members
--     FOR SELECT USING (user_id = (select auth.uid()));
-- 
-- DROP POLICY IF EXISTS "Company owners can manage members" ON public.company_members;
-- CREATE POLICY "Company owners can manage members" ON public.company_members
--     USING (
--         company_id IN (
--             SELECT id FROM public.companies WHERE owner_id = (select auth.uid())
--         )
--     );
-- =====================================================================================
-- 2. ADD RLS POLICIES FOR SUBSCRIPTION_USAGE
-- =====================================================================================
-- This table was created in FIX_ONBOARDING_AND_JOBS.sql but never got RLS policies
-- Enable RLS
ALTER TABLE IF EXISTS public.subscription_usage ENABLE ROW LEVEL SECURITY;
-- Allow company owners to view their subscription usage
DROP POLICY IF EXISTS "Company owners can view usage" ON public.subscription_usage;
CREATE POLICY "Company owners can view usage" ON public.subscription_usage FOR
SELECT USING (
        subscription_id IN (
            SELECT id
            FROM public.subscriptions
            WHERE company_id IN (
                    SELECT id
                    FROM public.companies
                    WHERE owner_id = (
                            select auth.uid()
                        )
                )
        )
    );
-- Allow company owners to insert usage records (for trial activation)
DROP POLICY IF EXISTS "Company owners can insert usage" ON public.subscription_usage;
CREATE POLICY "Company owners can insert usage" ON public.subscription_usage FOR
INSERT WITH CHECK (
        subscription_id IN (
            SELECT id
            FROM public.subscriptions
            WHERE company_id IN (
                    SELECT id
                    FROM public.companies
                    WHERE owner_id = (
                            select auth.uid()
                        )
                )
        )
    );
-- Allow company owners to update usage (for incrementing counters)
DROP POLICY IF EXISTS "Company owners can update usage" ON public.subscription_usage;
CREATE POLICY "Company owners can update usage" ON public.subscription_usage FOR
UPDATE USING (
        subscription_id IN (
            SELECT id
            FROM public.subscriptions
            WHERE company_id IN (
                    SELECT id
                    FROM public.companies
                    WHERE owner_id = (
                            select auth.uid()
                        )
                )
        )
    );
-- =====================================================================================
-- 3. VERIFY SUBSCRIPTION POLICIES ARE COMPLETE
-- =====================================================================================
-- Ensure subscriptions table has all necessary policies (from FIX_SUBSCRIPTION_RLS.sql)
-- View policy (should already exist from OPTIMIZE_RLS.sql)
DROP POLICY IF EXISTS "Companies can view own subscription" ON public.subscriptions;
CREATE POLICY "Companies can view own subscription" ON public.subscriptions FOR
SELECT USING (
        company_id IN (
            SELECT id
            FROM public.companies
            WHERE owner_id = (
                    select auth.uid()
                )
        )
    );
-- Insert policy (from FIX_SUBSCRIPTION_RLS.sql)
DROP POLICY IF EXISTS "Companies can insert own subscription" ON public.subscriptions;
CREATE POLICY "Companies can insert own subscription" ON public.subscriptions FOR
INSERT WITH CHECK (
        company_id IN (
            SELECT id
            FROM public.companies
            WHERE owner_id = (
                    select auth.uid()
                )
        )
    );
-- Update policy (from FIX_SUBSCRIPTION_RLS.sql)
DROP POLICY IF EXISTS "Companies can update own subscription" ON public.subscriptions;
CREATE POLICY "Companies can update own subscription" ON public.subscriptions FOR
UPDATE USING (
        company_id IN (
            SELECT id
            FROM public.companies
            WHERE owner_id = (
                    select auth.uid()
                )
        )
    );