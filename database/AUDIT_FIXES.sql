-- COMPREHENSIVE AUDIT FIXES - SQL MIGRATIONS
-- Run these in Supabase SQL Editor to fix identified issues
-- Location: dashboard.supabase.com → SQL Editor

-- ========================================
-- 1. WEBHOOK IDEMPOTENCY TRACKING
-- ========================================

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'processed',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_status ON webhook_events(status);

-- ========================================
-- 2. PREMIUM ACCESS AUDIT LOGGING
-- ========================================

CREATE TABLE IF NOT EXISTS premium_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    feature VARCHAR(100) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    ip_address INET,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subscription_tier VARCHAR(20),
    result VARCHAR(20),  -- 'allowed' or 'denied'
    reason TEXT,
    metadata JSONB,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_premium_access_user ON premium_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_access_feature ON premium_access_logs(feature);
CREATE INDEX IF NOT EXISTS idx_premium_access_result ON premium_access_logs(result);
CREATE INDEX IF NOT EXISTS idx_premium_access_timestamp ON premium_access_logs(timestamp);

-- Enable RLS for privacy
ALTER TABLE premium_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access logs" ON premium_access_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert access logs" ON premium_access_logs
    FOR INSERT WITH CHECK (true);

-- ========================================
-- 3. SUBSCRIPTION UNIQUENESS CONSTRAINT
-- ========================================

-- Add unique constraint to prevent multiple subscriptions per company
ALTER TABLE subscriptions
ADD CONSTRAINT unique_company_subscription UNIQUE(company_id);

-- ========================================
-- 4. ENHANCE SUBSCRIPTION TRACKING
-- ========================================

-- Add columns to track subscription lifecycle
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- ========================================
-- 5. ENSURE CRITICAL FIELDS NOT NULL FOR ACTIVE SUBSCRIPTIONS
-- ========================================

-- Add check constraint for active subscriptions
ALTER TABLE subscriptions
ADD CONSTRAINT check_active_subscription_complete
CHECK (
    CASE 
        WHEN status = 'active' THEN
            stripe_subscription_id IS NOT NULL
            AND current_period_start IS NOT NULL
            AND current_period_end IS NOT NULL
        ELSE TRUE
    END
);

-- ========================================
-- 6. ADD SUBSCRIPTION CHANGE AUDIT TRAIL
-- ========================================

CREATE TABLE IF NOT EXISTS subscription_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL,
    old_tier VARCHAR(20),
    new_tier VARCHAR(20),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    change_reason TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by VARCHAR(255),  -- User ID or 'webhook'
    CONSTRAINT fk_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sub_changes_subscription ON subscription_changes(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_changes_date ON subscription_changes(changed_at);

-- ========================================
-- 7. CREATE AUDIT LOG MATERIALIZED VIEW
-- ========================================

CREATE OR REPLACE VIEW access_logs_summary AS
SELECT 
    user_id,
    feature,
    subscription_tier,
    COUNT(*) as access_attempts,
    COUNT(CASE WHEN result = 'allowed' THEN 1 END) as allowed_count,
    COUNT(CASE WHEN result = 'denied' THEN 1 END) as denied_count,
    MAX(timestamp) as last_access,
    MIN(timestamp) as first_access
FROM premium_access_logs
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY user_id, feature, subscription_tier;

-- ========================================
-- 8. VERIFY SUBSCRIPTION DATA CONSISTENCY
-- ========================================

-- Run these queries to verify data health:

-- Check for orphaned company_ids
SELECT 
    's.id',
    's.company_id',
    'Orphaned Subscription' as issue
FROM subscriptions s
LEFT JOIN companies c ON s.company_id = c.id
WHERE c.id IS NULL AND s.company_id IS NOT NULL;

-- Check for companies without subscriptions
SELECT 
    COUNT(*) as companies_without_subscription
FROM companies c
LEFT JOIN subscriptions s ON c.id = s.company_id
WHERE s.id IS NULL;

-- Check for data inconsistency
SELECT 
    COUNT(*) as mismatches
FROM companies c
JOIN subscriptions s ON c.id = s.company_id
WHERE c.subscription_tier != s.tier;

-- ========================================
-- 9. BACKUP OLD DATA BEFORE REMOVING COLUMNS
-- ========================================

-- Create backup table
CREATE TABLE IF NOT EXISTS companies_backup_subscriptions AS
SELECT 
    id,
    subscription,
    subscription_tier,
    created_at,
    updated_at
FROM companies
WHERE subscription IS NOT NULL OR subscription_tier IS NOT NULL;

-- ========================================
-- 10. MIGRATE REMAINING JSON SUBSCRIPTIONS
-- ========================================

-- Ensure all companies with old JSON subscriptions are migrated to new table
INSERT INTO subscriptions (
    company_id,
    tier,
    status,
    stripe_subscription_id,
    stripe_customer_id,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    created_at,
    updated_at
)
SELECT 
    c.id,
    COALESCE((c.subscription->>'tier'), c.subscription_tier, 'basic') as tier,
    COALESCE((c.subscription->>'status'), 'active') as status,
    (c.subscription->>'stripe_subscription_id')::VARCHAR,
    (c.subscription->>'stripe_customer_id')::VARCHAR,
    NOW() as current_period_start,
    NOW() + INTERVAL '1 month' as current_period_end,
    FALSE,
    COALESCE(c.created_at, NOW()),
    COALESCE(c.updated_at, NOW())
FROM companies c
WHERE c.id NOT IN (SELECT company_id FROM subscriptions WHERE company_id IS NOT NULL)
    AND (c.subscription IS NOT NULL OR c.subscription_tier != 'free');

-- ========================================
-- 11. TRACK SUBSCRIPTION CREATIONS
-- ========================================

CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,  -- 'created', 'upgraded', 'downgraded', 'renewed', 'cancelled'
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sub_events_subscription ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sub_events_date ON subscription_events(created_at);

-- ========================================
-- 12. CREATE MONTHLY USAGE RESET FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION reset_monthly_usage_for_active_subscriptions()
RETURNS void AS $$
BEGIN
    UPDATE subscription_usage
    SET 
        ai_assessments_used = 0,
        ad_optimizations_used = 0,
        active_jobs_count = 0,
        period_start = date_trunc('month', CURRENT_DATE),
        period_end = date_trunc('month', CURRENT_DATE) + INTERVAL '1 month',
        last_reset_at = NOW()
    WHERE 
        period_end <= NOW()
        AND (SELECT status FROM subscriptions WHERE subscriptions.id = subscription_usage.subscription_id) = 'active';
    
    -- Log the reset
    INSERT INTO analytics_events (
        event_type,
        feature,
        metadata,
        created_at
    ) VALUES (
        'usage_reset',
        'monthly_reset',
        jsonb_build_object('rows_updated', FOUND),
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Test the function
-- SELECT reset_monthly_usage_for_active_subscriptions();

-- ========================================
-- 13. ANALYTICS EVENT CLEANUP
-- ========================================

-- Archive old analytics events (older than 90 days)
CREATE TABLE IF NOT EXISTS analytics_events_archive AS
SELECT * FROM analytics_events
WHERE created_at < NOW() - INTERVAL '90 days';

-- Delete archived events from main table
-- DELETE FROM analytics_events 
-- WHERE created_at < NOW() - INTERVAL '90 days';

-- ========================================
-- 14. VERIFY MIGRATION COMPLETION
-- ========================================

-- Run this to check if migration was successful
SELECT 
    'Subscription Tables Status' as check_category,
    'Subscriptions Table' as item,
    COUNT(*) as record_count,
    'OK' as status
FROM subscriptions
UNION ALL
SELECT 
    'Subscription Tables Status',
    'Subscription Usage Table',
    COUNT(*),
    'OK'
FROM subscription_usage
UNION ALL
SELECT 
    'Subscription Tables Status',
    'Webhook Events Table',
    COUNT(*),
    'OK'
FROM webhook_events
UNION ALL
SELECT 
    'Subscription Tables Status',
    'Premium Access Logs',
    COUNT(*),
    'OK'
FROM premium_access_logs
UNION ALL
SELECT 
    'Data Consistency',
    'Companies without Subscriptions',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END
FROM companies c
LEFT JOIN subscriptions s ON c.id = s.company_id
WHERE s.id IS NULL;

-- ========================================
-- 15. CLEANUP SCRIPT (RUN AFTER VERIFICATION)
-- ========================================

-- WARNING: Only run this after verifying all data is in new tables
-- and after monitoring for 2-3 weeks in production

-- Step 1: Create final backup
CREATE TABLE companies_final_backup AS
SELECT * FROM companies;

-- Step 2: Remove old subscription columns
-- ALTER TABLE companies DROP COLUMN subscription;
-- ALTER TABLE profiles DROP COLUMN subscription_tier;

-- Step 3: Verify application still works

-- ========================================
-- 16. DOCUMENT DEPRECATED COLUMNS
-- ========================================

-- Add comments to deprecated columns
COMMENT ON COLUMN companies.subscription IS 
    'DEPRECATED: Use subscriptions table instead. 
     This column will be removed in v2.4 (2026-03-01).
     Migration started: 2026-01-25';

COMMENT ON COLUMN profiles.subscription_tier IS 
    'DEPRECATED: Use subscriptions table instead. 
     This column will be removed in v2.4 (2026-03-01).
     Migration started: 2026-01-25';

-- ========================================
-- 17. PERFORMANCE MONITORING
-- ========================================

CREATE OR REPLACE VIEW table_sizes AS
SELECT 
    'subscriptions' as table_name,
    pg_size_pretty(pg_total_relation_size('subscriptions'::regclass)) as size
UNION ALL
SELECT 
    'subscription_usage',
    pg_size_pretty(pg_total_relation_size('subscription_usage'::regclass))
UNION ALL
SELECT 
    'premium_access_logs',
    pg_size_pretty(pg_total_relation_size('premium_access_logs'::regclass))
UNION ALL
SELECT 
    'webhook_events',
    pg_size_pretty(pg_total_relation_size('webhook_events'::regclass));

-- Check table sizes
-- SELECT * FROM table_sizes;

-- ========================================
-- 18. CREATE SUBSCRIPTION HEALTH CHECK
-- ========================================

CREATE OR REPLACE FUNCTION check_subscription_health()
RETURNS TABLE(
    metric TEXT,
    value TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Total Active Subscriptions'::TEXT,
        COUNT(*)::TEXT,
        'OK'::TEXT
    FROM subscriptions
    WHERE status = 'active'
    
    UNION ALL
    SELECT 
        'Subscriptions Expiring in 7 Days',
        COUNT(*)::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END
    FROM subscriptions
    WHERE status = 'active' 
      AND current_period_end BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    
    UNION ALL
    SELECT 
        'Past Due Subscriptions',
        COUNT(*)::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END
    FROM subscriptions
    WHERE status = 'past_due'
    
    UNION ALL
    SELECT 
        'Cancelled This Month',
        COUNT(*)::TEXT,
        'INFO'
    FROM subscriptions
    WHERE status = 'cancelled'
      AND cancelled_at > NOW() - INTERVAL '30 days'
    
    UNION ALL
    SELECT 
        'Failed Webhooks',
        COUNT(*)::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END
    FROM webhook_events
    WHERE status = 'failed'
      AND processed_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Check subscription health
-- SELECT * FROM check_subscription_health();

-- ========================================
-- TESTING QUERIES
-- ========================================

-- Find subscriptions with issues
SELECT 
    'Subscriptions with missing Stripe ID' as issue,
    COUNT(*) as count,
    STRING_AGG(company_id::TEXT, ', ') as affected_companies
FROM subscriptions
WHERE status = 'active' AND stripe_subscription_id IS NULL
UNION ALL
SELECT 
    'Subscriptions with expired period_end',
    COUNT(*),
    STRING_AGG(company_id::TEXT, ', ')
FROM subscriptions
WHERE status = 'active' AND current_period_end < NOW()
UNION ALL
SELECT 
    'Duplicate subscriptions per company',
    COUNT(*),
    STRING_AGG(company_id::TEXT, ', ')
FROM (
    SELECT company_id, COUNT(*) as cnt
    FROM subscriptions
    WHERE company_id IS NOT NULL
    GROUP BY company_id
    HAVING COUNT(*) > 1
) subq
GROUP BY true;

-- ========================================
-- ALERTS & MONITORING
-- ========================================

-- Create alerts for critical issues
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,  -- 'critical', 'warning', 'info'
    message TEXT NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE
);

-- Example: Alert if too many failed webhooks
INSERT INTO alerts (alert_type, severity, message)
SELECT 
    'webhook_failures',
    'critical',
    'More than 5 failed webhook deliveries in last hour'
FROM webhook_events
WHERE status = 'failed' AND processed_at > NOW() - INTERVAL '1 hour'
HAVING COUNT(*) > 5;

-- ========================================
-- FINAL VERIFICATION
-- ========================================

-- Run this LAST to verify everything is correct
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM subscriptions) > 0 
             AND (SELECT COUNT(*) FROM webhook_events) > 0 
             AND (SELECT COUNT(*) FROM premium_access_logs) >= 0
        THEN '✅ MIGRATION SUCCESSFUL'
        ELSE '❌ MIGRATION INCOMPLETE'
    END as status,
    (SELECT COUNT(*) FROM subscriptions) as total_subscriptions,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as active_subscriptions,
    (SELECT COUNT(*) FROM webhook_events) as webhook_events_processed,
    (SELECT COUNT(*) FROM premium_access_logs) as audit_log_entries;
