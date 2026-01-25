-- JobShaman Paywall Database Schema Migration
-- Run this in Supabase SQL Editor to support all new paywall features

-- ========================================
-- 1. SUBSCRIPTION MANAGEMENT TABLES
-- ========================================

-- Main subscriptions table to replace JSON fields in companies table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
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

-- Subscription usage tracking table
CREATE TABLE IF NOT EXISTS subscription_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    active_jobs_count INTEGER DEFAULT 0,
    ai_assessments_used INTEGER DEFAULT 0,
    ad_optimizations_used INTEGER DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 2. ANALYTICS & TRACKING TABLES
-- ========================================

-- Analytics events storage
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

-- A/B test assignments
CREATE TABLE IF NOT EXISTS ab_test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    test_id VARCHAR(50) NOT NULL,
    variant_id VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B test conversion tracking
CREATE TABLE IF NOT EXISTS ab_test_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES ab_test_assignments(id) ON DELETE CASCADE,
    conversion_event VARCHAR(50) NOT NULL,
    conversion_value DECIMAL(10,2),
    converted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 3. ENTERPRISE LEAD MANAGEMENT
-- ========================================

-- Enterprise signup leads
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
-- 4. INDEXES FOR PERFORMANCE
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
-- 5. MIGRATE EXISTING DATA
-- ========================================

-- Create subscriptions for existing companies
INSERT INTO subscriptions (company_id, tier, status, current_period_start, current_period_end)
SELECT 
    id,
    COALESCE(subscription->>'tier', 'basic') as tier,
    COALESCE(subscription->>'status', 'active') as status,
    NOW() as current_period_start,
    NOW() + INTERVAL '1 month' as current_period_end
FROM companies 
WHERE subscription IS NOT NULL
ON CONFLICT (company_id) DO UPDATE SET
    tier = EXCLUDED.tier,
    status = EXCLUDED.status;

-- Create usage records for existing companies
INSERT INTO subscription_usage (subscription_id, period_start, period_end, ai_assessments_used, ad_optimizations_used)
SELECT 
    s.id as subscription_id,
    NOW() as period_start,
    NOW() + INTERVAL '1 month' as period_end,
    COALESCE(subscription->>'usage'->>'aiAssessmentsUsed', 0) as ai_assessments_used,
    COALESCE(subscription->>'usage'->>'adOptimizationsUsed', 0) as ad_optimizations_used
FROM companies c
JOIN subscriptions s ON c.id = s.company_id
WHERE c.subscription IS NOT NULL
ON CONFLICT (subscription_id, period_start) DO NOTHING;

-- ========================================
-- 6. UPDATE COMPANIES TABLE REFERENCES
-- ========================================

-- Add foreign key references to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id);

-- Note: Keep existing JSON fields for backward compatibility during migration
-- They can be dropped later after confirming migration success

-- ========================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ========================================

-- Enable RLS for all new tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_leads ENABLE ROW LEVEL SECURITY;

-- Create policies (basic - adjust as needed for your security requirements)
CREATE POLICY "Users can view own company subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = (SELECT company_id FROM companies WHERE id = company_id));

CREATE POLICY "Users can view own analytics" ON analytics_events
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = company_id);

CREATE POLICY "Service can insert analytics" ON analytics_events
    FOR INSERT WITH CHECK (true);

-- Similar policies needed for other tables...

-- ========================================
-- 8. TRIGGERS FOR AUTOMATION
-- ========================================

-- Function to reset monthly usage counters
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE subscription_usage 
    SET 
        active_jobs_count = 0,
        ai_assessments_used = 0,
        ad_optimizations_used = 0,
        last_reset_at = NOW()
    WHERE period_end <= NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically reset usage when subscription renews
CREATE TRIGGER trigger_reset_monthly_usage
AFTER INSERT ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION reset_monthly_usage();

-- ========================================
-- 9. CLEANUP FUNCTIONS
-- ========================================

-- Function to clean up old analytics events
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS VOID AS $$
DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM ab_test_conversions WHERE converted_at < NOW() - INTERVAL '90 days';
DELETE FROM enterprise_leads WHERE created_at < NOW() - INTERVAL '365 days';
$$ LANGUAGE plpgsql;

-- Schedule cleanup (run manually or set up via pg_cron)
-- SELECT cleanup_old_analytics();

-- ========================================
-- 10. VIEWS FOR COMMON QUERIES
-- ========================================

-- Company subscription summary view
CREATE OR REPLACE VIEW company_subscription_summary AS
SELECT 
    c.id as company_id,
    c.name as company_name,
    s.tier,
    s.status,
    su.active_jobs_count,
    su.ai_assessments_used,
    su.ad_optimizations_used,
    CASE 
        WHEN s.current_period_end < NOW() THEN true
        ELSE false
    END as is_expired
FROM companies c
LEFT JOIN subscriptions s ON c.subscription_id = s.id
LEFT JOIN subscription_usage su ON s.id = su.subscription_id
WHERE s.id IS NOT NULL;

-- Usage analytics view
CREATE OR REPLACE VIEW usage_analytics AS
SELECT 
    ae.company_id,
    COUNT(*) as total_events,
    COUNT(CASE WHEN ae.event_type = 'upgrade_triggered' THEN 1 END) as upgrade_triggers,
    COUNT(CASE WHEN ae.event_type = 'feature_used' THEN 1 END) as feature_usage,
    MAX(ae.created_at) as last_activity
FROM analytics_events ae
WHERE ae.created_at > NOW() - INTERVAL '30 days'
GROUP BY ae.company_id;

-- ========================================
-- MIGRATION COMPLETION CHECK
-- ========================================

-- Run this to verify migration success
SELECT 
    'Migration Complete' as status,
    COUNT(*) as total_subscriptions,
    COUNT(CASE WHEN tier = 'basic' THEN 1 END) as basic_count,
    COUNT(CASE WHEN tier = 'business' THEN 1 END) as business_count
FROM subscriptions;

-- Notes:
-- 1. Test migration in development first
-- 2. Update application code to use new tables
-- 3. Drop old JSON columns after confirming everything works
-- 4. Add more sophisticated RLS policies as needed
-- 5. Set up proper backup strategies