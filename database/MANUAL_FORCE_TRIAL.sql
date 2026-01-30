-- FORCE TRIAL UPGRADE MANUALLY
-- Run this script in the Supabase SQL Editor if the backend auto-upgrade isn't working (e.g., due to deployment issues).
-- This will upgrade all companies created in the last 14 days that are still on the 'free' tier.
UPDATE subscriptions
SET tier = 'business',
    status = 'active',
    -- 'trialing' might be better but 'active' works for feature checks
    current_period_end = NOW() + INTERVAL '14 days',
    updated_at = NOW()
WHERE tier = 'free'
    AND company_id IN (
        SELECT id
        FROM companies
        WHERE created_at > NOW() - INTERVAL '14 days'
    );
-- Verify the update
SELECT *
FROM subscriptions
WHERE tier = 'business'
ORDER BY updated_at DESC
LIMIT 5;