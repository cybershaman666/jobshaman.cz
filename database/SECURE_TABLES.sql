-- SECURE PUBLIC TABLES & ENABLE RLS
-- Fixes "Policy Exists RLS Disabled" and "RLS Disabled in Public" warnings.
-- 1. Enable RLS on tables that already have policies defined
-- These tables had policies created but RLS was never turned on, rendering them ineffective.
ALTER TABLE public.career_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_reviews ENABLE ROW LEVEL SECURITY;
-- 2. Secure Public Reference Tables
-- These tables are exposed to the API but had no security.
-- We enable RLS and allow public read access (assuming they are reference data).
-- Benefit Valuations (e.g., value of specific benefits)
ALTER TABLE public.benefit_valuations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view benefit valuations" ON public.benefit_valuations;
CREATE POLICY "Public can view benefit valuations" ON public.benefit_valuations FOR
SELECT USING (true);
-- Marketplace Partners (List of integration partners)
ALTER TABLE public.marketplace_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view marketplace partners" ON public.marketplace_partners;
CREATE POLICY "Public can view marketplace partners" ON public.marketplace_partners FOR
SELECT USING (true);
-- 3. Secure System Tables
-- Webhook events should generally not be publicly readable.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- No policy added = Deny All by default (Internal use only)
-- 4. Fix Security Definer View (Optional/Cautionary)
-- The view `public_candidate_cv_urls` is marked as SECURITY DEFINER.
-- To fix this securely without breaking potential "sudo" functionality it might provide,
-- we'd typically need to see the definition.
-- For now, we are skipping this auto-fix to prevent breaking CV downloads.
-- Recommendation: If this view is for presigned URLs, ensure it filters by auth.uid inside.