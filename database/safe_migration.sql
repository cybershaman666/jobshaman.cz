-- JobShaman Paywall Database Migration (Safe Version)
-- This migration works with existing JSON-based schema
-- and adds new tables for advanced features

-- ========================================
-- STEP 1: ADD NEW TABLES (works with existing schema)
-- ========================================

-- Add subscriptions table (keeps existing JSON for compatibility)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    tier VARCHAR(20) NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'business', 'enterprise', 'assessment_bundle')),
    stripe_subscription_id VARCHAR UNIQUE,
    stripe_customer_id VARCHAR,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add usage tracking table
CREATE TABLE IF NOT EXISTS subscription_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    active_jobs_count INTEGER DEFAULT 0,
    ai_assessments_used INTEGER DEFAULT 0,
    ad_optimizations_used INTEGER DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(subscription_id, period_start)
);

-- Add analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    feature VARCHAR(100),
    tier VARCHAR(20),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add A/B testing tables
CREATE TABLE IF NOT EXISTS ab_test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    test_id VARCHAR(50) NOT NULL,
    variant_id VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_test_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES ab_test_assignments(id) ON DELETE CASCADE,
    conversion_event VARCHAR(50) NOT NULL,
    conversion_value DECIMAL(10,2),
    converted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add enterprise leads table
CREATE TABLE IF NOT EXISTS enterprise_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    company_size VARCHAR(50),
    industry VARCHAR(100),
    current_challenges TEXT,
    expected_hires VARCHAR(50),
    timeline VARCHAR(100),
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed_won', 'closed_lost')),
    assigned_to UUID REFERENCES profiles(id),
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- STEP 2: MIGRATE EXISTING DATA
-- ========================================

-- Create subscriptions for existing companies
INSERT INTO subscriptions (company_id, tier, status, current_period_start, current_period_end)
SELECT 
    id,
    COALESCE(subscription_tier, 'basic') as tier,
    'active' as status,
    NOW() as current_period_start,
    NOW() + INTERVAL '1 month' as current_period_end
FROM companies 
WHERE subscription_tier IS NOT NULL
ON CONFLICT (company_id) DO UPDATE SET
    tier = EXCLUDED.tier;

-- Create initial usage records for existing companies
INSERT INTO subscription_usage (subscription_id, period_start, period_end, ai_assessments_used, ad_optimizations_used)
SELECT 
    s.id as subscription_id,
    NOW() as period_start,
    NOW() + INTERVAL '1 month' as period_end,
    COALESCE((usage_stats->>'aiAssessmentsUsed')::int, 0) as ai_assessments_used,
    COALESCE((usage_stats->>'adOptimizationsUsed')::int, 0) as ad_optimizations_used
FROM companies c
JOIN subscriptions s ON c.id = s.company_id
WHERE c.subscription_tier IS NOT NULL
ON CONFLICT (subscription_id, period_start) DO NOTHING;

-- ========================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry ON subscriptions(current_period_end);

-- Usage indexes
CREATE INDEX IF NOT EXISTS idx_subscription_usage_subscription ON subscription_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_period ON subscription_usage(period_start, period_end);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_user ON analytics_events(event_type, user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_company ON analytics_events(company_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);

-- A/B test indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_ab_assignments_user_test ON ab_test_assignments(user_id, test_id);
CREATE INDEX IF NOT EXISTS idx_ab_conversions_assignment ON ab_test_conversions(assignment_id);

-- Enterprise leads indexes
CREATE INDEX IF NOT EXISTS idx_enterprise_leads_status ON enterprise_leads(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_leads_created ON enterprise_leads(created_at);
CREATE INDEX IF NOT EXISTS idx_enterprise_leads_email ON enterprise_leads(contact_email);

-- ========================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ========================================

-- Enable RLS for all new tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_leads ENABLE ROW LEVEL SECURITY;

-- Create basic security policies (adjust as needed)
CREATE POLICY "Users can view own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() IN (SELECT owner_id FROM companies WHERE id = company_id));

CREATE POLICY "Users can view own usage" ON subscription_usage
    FOR SELECT USING (auth.uid() IN (SELECT owner_id FROM companies WHERE id = (SELECT company_id FROM subscriptions WHERE id = subscription_usage.subscription_id)));

CREATE POLICY "Users can view own analytics" ON analytics_events
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = company_id);

-- ========================================
-- STEP 5: CLEANUP FUNCTIONS (optional)
-- ========================================

-- Function to clean up old analytics events
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS VOID AS $$
BEGIN
    DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM ab_test_conversions WHERE converted_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 6: VERIFICATION QUERIES
-- ========================================

-- Run this to verify migration success
SELECT 
    'Migration Complete' as status,
    COUNT(*) as total_subscriptions,
    COUNT(CASE WHEN tier = 'basic' THEN 1 END) as basic_count,
    COUNT(CASE WHEN tier = 'business' THEN 1 END) as business_count
FROM subscriptions;

SELECT 
    COUNT(*) as new_analytics_tables,
    COUNT(*) as total_indexes
FROM information_schema.tables 
WHERE table_name IN ('analytics_events', 'ab_test_assignments', 'enterprise_leads');

-- Notes:
-- 1. Keep existing JSON fields in companies table for backward compatibility
-- 2. New service functions will gradually migrate to relational schema
-- 3. Set up RLS policies as per your security requirements
-- 4. Consider cleanup of JSON fields after successful migration