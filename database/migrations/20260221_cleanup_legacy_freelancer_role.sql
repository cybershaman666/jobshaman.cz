-- Cleanup legacy freelancer residue:
-- Some historical candidate accounts ended up with recruiter role and
-- a placeholder company (industry=Freelancer, empty business data).
-- This migration reverts those accounts back to candidate role.

SET lock_timeout = '5s';
SET statement_timeout = '2min';
SET idle_in_transaction_session_timeout = '2min';

-- 1) Identify legacy placeholder companies.
CREATE TEMP TABLE tmp_legacy_freelancer_companies ON COMMIT DROP AS
SELECT
    c.id AS company_id,
    c.owner_id
FROM public.companies c
LEFT JOIN public.subscriptions s ON s.id = c.subscription_id
WHERE c.owner_id IS NOT NULL
  AND LOWER(COALESCE(c.industry, '')) IN ('freelancer', 'freelance')
  AND COALESCE(BTRIM(c.website), '') = ''
  AND COALESCE(BTRIM(c.ico), '') = ''
  AND COALESCE(BTRIM(c.description), '') = ''
  AND s.id IS NULL;

-- 2) Remove dependent records so company deletion is clean.
DELETE FROM public.company_members cm
USING tmp_legacy_freelancer_companies t
WHERE cm.company_id = t.company_id;

DELETE FROM public.recruiter_profiles rp
USING tmp_legacy_freelancer_companies t
WHERE rp.company_id = t.company_id;

DELETE FROM public.assessment_invitations ai
USING tmp_legacy_freelancer_companies t
WHERE ai.company_id = t.company_id;

DELETE FROM public.job_applications ja
USING tmp_legacy_freelancer_companies t
WHERE ja.company_id = t.company_id;

DELETE FROM public.jobs j
USING tmp_legacy_freelancer_companies t
WHERE j.company_id = t.company_id;

DELETE FROM public.analytics_events ae
USING tmp_legacy_freelancer_companies t
WHERE ae.company_id = t.company_id;

DELETE FROM public.subscriptions s
USING tmp_legacy_freelancer_companies t
WHERE s.company_id = t.company_id;

-- 3) Delete placeholder companies themselves.
DELETE FROM public.companies c
USING tmp_legacy_freelancer_companies t
WHERE c.id = t.company_id;

-- 4) Revert affected users to candidate role.
UPDATE public.profiles p
SET role = 'candidate'
WHERE p.role = 'recruiter'
  AND p.id IN (SELECT owner_id FROM tmp_legacy_freelancer_companies);
