-- FIX SUBSCRIPTION INSERT POLICY
-- The OPTIMIZE_RLS.sql script removed the INSERT policy for subscriptions
-- This hotfix adds it back to allow trial subscription activation
-- Add INSERT policy for subscriptions
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
-- Also add UPDATE policy for subscription management
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