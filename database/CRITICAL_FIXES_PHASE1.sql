-- CRITICAL AUDIT FIXES - Phase 1
-- Run these immediately in Supabase SQL Editor

-- ========================================
-- 1. WEBHOOK IDEMPOTENCY TRACKING
-- ========================================
-- This prevents duplicate webhook processing

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'processed'
);

CREATE INDEX IF NOT EXISTS idx_webhook_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_event_type ON webhook_events(event_type);

-- ========================================
-- 2. PREMIUM ACCESS AUDIT LOGS
-- ========================================
-- This logs every premium feature access attempt

DROP TABLE IF EXISTS premium_access_logs CASCADE;

CREATE TABLE premium_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    feature VARCHAR(100) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    ip_address INET,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subscription_tier VARCHAR(20),
    result VARCHAR(20),
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
-- 3. RECREATE SUBSCRIPTIONS TABLE PROPERLY
-- ========================================
-- Drop and recreate with correct constraints since no production data exists

DROP TABLE IF EXISTS subscriptions CASCADE;

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    company_id UUID,
    tier VARCHAR(50) DEFAULT 'free',
    status VARCHAR(20) DEFAULT 'inactive',
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    ai_assessments_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT unique_company_subscription UNIQUE(company_id),
    CONSTRAINT check_active_subscription_complete CHECK (
        CASE 
            WHEN status = 'active' THEN
                stripe_subscription_id IS NOT NULL
                AND current_period_start IS NOT NULL
                AND current_period_end IS NOT NULL
            ELSE TRUE
        END
    )
);

-- Create indexes for performance
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify tables were created
SELECT 'webhook_events' as table_name, COUNT(*) as record_count FROM webhook_events
UNION ALL
SELECT 'premium_access_logs', COUNT(*) FROM premium_access_logs;

-- Check for existing data issues
SELECT 
    COUNT(*) as companies_without_subscription_record
FROM companies c
LEFT JOIN subscriptions s ON c.id = s.company_id
WHERE s.id IS NULL;

-- Success check
SELECT 'Phase 1 Database Migration' as status, 'COMPLETE' as result;
