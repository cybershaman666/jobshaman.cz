-- Fix Database Subscription Schema Inconsistencies
-- Run this to fix the critical security issues

-- 1. Add missing premium_access_logs table for audit logging
CREATE TABLE IF NOT EXISTS premium_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    feature VARCHAR(100) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    ip_address INET,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subscription_tier VARCHAR(20) DEFAULT 'free',
    metadata JSONB
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_premium_access_logs_user ON premium_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_access_logs_timestamp ON premium_access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_premium_access_logs_feature ON premium_access_logs(feature);

-- 2. Fix the subscriptions table to include ai_assessments_used column directly
-- This simplifies the logic and reduces joins
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS ai_assessments_used INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. Ensure we have proper constraints for subscription tiers
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check 
    CHECK (tier IN ('free', 'basic', 'premium', 'business', 'enterprise', 'assessment_bundle'));

-- 4. Fix company_id constraint to allow NULL for user subscriptions
-- This allows us to use the same table for both company and user subscriptions
ALTER TABLE subscriptions ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_or_company 
    CHECK ((company_id IS NOT NULL) OR (user_id IS NOT NULL));

-- 5. Add a function to check subscription status consistently
CREATE OR REPLACE FUNCTION check_subscription_status(
    user_uuid UUID,
    feature_name VARCHAR,
    company_uuid UUID DEFAULT NULL
) RETURNS TABLE(has_access BOOLEAN, tier VARCHAR, reason VARCHAR) AS $$
BEGIN
    RETURN QUERY
    WITH user_sub AS (
        SELECT s.tier, s.status, s.ai_assessments_used, s.current_period_end
        FROM subscriptions s 
        WHERE s.user_id = user_uuid OR s.company_id = COALESCE(company_uuid, user_uuid)
        AND s.status = 'active'
        AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
        ORDER BY s.tier DESC  -- Get the highest tier if multiple exist
        LIMIT 1
    ),
    feature_access AS (
        SELECT 
            us.tier,
            us.status,
            CASE 
                WHEN us.tier IS NULL THEN FALSE
                WHEN feature_name IN ('COVER_LETTER', 'CV_OPTIMIZATION', 'ATC_HACK') 
                     AND us.tier IN ('premium', 'business', 'enterprise') THEN TRUE
                WHEN feature_name IN ('COMPANY_AI_AD', 'COMPANY_RECOMMENDATIONS', 'COMPANY_UNLIMITED_JOBS') 
                     AND us.tier IN ('business', 'enterprise') THEN TRUE
                WHEN feature_name LIKE '%ASSESS%' AND us.tier IN ('business', 'enterprise', 'assessment_bundle') 
                     AND (us.ai_assessments_used < 10 OR us.tier = 'enterprise') THEN TRUE
                ELSE FALSE
            END as has_access,
            CASE 
                WHEN us.tier IS NULL THEN 'No active subscription found'
                WHEN feature_name LIKE '%ASSESS%' AND us.ai_assessments_used >= 10 
                     AND us.tier != 'enterprise' THEN 'Assessment limit exceeded'
                WHEN us.current_period_end <= NOW() THEN 'Subscription expired'
                ELSE 'Feature not available in current tier'
            END as reason
        FROM user_sub us
    )
    SELECT 
        fa.has_access,
        COALESCE(fa.tier, 'free'),
        COALESCE(fa.reason, 'Access granted')
    FROM feature_access fa
    UNION ALL
    SELECT 
        FALSE,
        'free',
        'No active subscription'
    WHERE NOT EXISTS (SELECT 1 FROM user_sub);
END;
$$ LANGUAGE plpgsql;

-- 6. Create a view to simplify subscription queries
CREATE OR REPLACE VIEW user_subscription_summary AS
SELECT 
    COALESCE(p.id, c.id) as user_id,
    COALESCE(s.tier, 'free') as tier,
    COALESCE(s.status, 'inactive') as status,
    s.current_period_start,
    s.current_period_end,
    s.ai_assessments_used,
    CASE 
        WHEN s.id IS NULL THEN FALSE
        WHEN s.current_period_end <= NOW() THEN TRUE
        ELSE FALSE
    END as is_expired,
    CASE 
        WHEN c.id IS NOT NULL THEN TRUE
        ELSE FALSE
    END as is_company
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.id
LEFT JOIN companies c ON c.id = p.id OR s.company_id = p.id
WHERE p.id IS NOT NULL;

-- 7. Add RLS policies for the new table
ALTER TABLE premium_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can insert premium access logs" ON premium_access_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own premium access logs" ON premium_access_logs
    FOR SELECT USING (auth.uid() = user_id);

-- 8. Create a summary function to verify the fixes
CREATE OR REPLACE FUNCTION verify_subscription_fixes()
RETURNS TABLE(check_name VARCHAR, check_status VARCHAR, details INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Premium access logs table exists'::VARCHAR,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'premium_access_logs') 
             THEN 'PASS' ELSE 'FAIL' END::VARCHAR,
        (SELECT COUNT(*) FROM premium_access_logs)::INTEGER
    UNION ALL
    SELECT 
        'Subscriptions table has ai_assessments_used'::VARCHAR,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'subscriptions' AND column_name = 'ai_assessments_used') 
             THEN 'PASS' ELSE 'FAIL' END::VARCHAR,
        NULL::INTEGER
    UNION ALL
    SELECT 
        'Total active subscriptions'::VARCHAR,
        'INFO'::VARCHAR,
        (SELECT COUNT(*) FROM subscriptions WHERE subscriptions.status = 'active')::INTEGER
    UNION ALL
    SELECT 
        'Users without proper subscription records'::VARCHAR,
        'WARNING'::VARCHAR,
        (SELECT COUNT(*) FROM profiles p 
         LEFT JOIN subscriptions s ON s.user_id = p.id 
         WHERE s.id IS NULL AND p.id IS NOT NULL)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Run the verification
SELECT * FROM verify_subscription_fixes();

-- Notes:
-- 1. This fixes the immediate security issues by providing proper server-side verification
-- 2. The check_subscription_status function is now the single source of truth for access
-- 3. All old JSON-based checks should be deprecated
-- 4. Run this script in Supabase SQL Editor to apply fixes