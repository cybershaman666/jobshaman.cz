# SQL Migration Quick Guide

## 🚀 Execute These SQL Migrations in Supabase

**⏱️ Takes ~1 minute to run**

### Steps:
1. Go to https://app.supabase.com → Your Project → SQL Editor
2. Click "New Query"
3. Copy & paste the SQL below
4. Click "Run"
5. Verify success message

---

## SQL Script

```sql
-- ========================================
-- WEBHOOK IDEMPOTENCY TRACKING
-- ========================================
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
-- PREMIUM ACCESS AUDIT LOGS
-- ========================================
CREATE TABLE IF NOT EXISTS premium_access_logs (
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

ALTER TABLE premium_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access logs" ON premium_access_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert access logs" ON premium_access_logs
    FOR INSERT WITH CHECK (true);

-- ========================================
-- SUBSCRIPTION UNIQUENESS CONSTRAINT
-- ========================================
ALTER TABLE subscriptions
ADD CONSTRAINT unique_company_subscription UNIQUE(company_id);

-- ========================================
-- VALIDATION CONSTRAINT
-- ========================================
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
-- VERIFY SUCCESS
-- ========================================
SELECT 'Migration complete!' as status;
```

---

## What These Do

| Table | Purpose |
|-------|---------|
| `webhook_events` | Tracks Stripe webhooks to prevent duplicate processing |
| `premium_access_logs` | Audits all premium feature access attempts |
| Constraints | Ensures data integrity (unique companies, valid active subscriptions) |

---

## ⚠️ If You Get Errors

### Error: "Constraint already exists"
- This is fine, means it was already created
- Safe to run again

### Error: "Table already exists"
- This is fine, means migration already ran
- Safe to run again

### Error: "Foreign key constraint failed"
- Check that `profiles` table exists
- If not, run basic setup migrations first

---

## ✅ After Migration

1. **Verify tables exist**:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name IN ('webhook_events', 'premium_access_logs');
   ```

2. **Check constraints**:
   ```sql
   \d subscriptions;  -- Shows all constraints
   ```

3. **Test webhook idempotency**:
   - Backend will now check webhook_events table
   - If webhook comes twice, it will be skipped

4. **Test audit logging**:
   - Call /verify-billing endpoint
   - Check premium_access_logs table for entries

---

## 🚀 Ready for Next Steps

Once SQL migrations are complete:
1. Deploy backend code changes (all in production_ready)
2. Test subscription flow
3. Start on Task #5 (Subscription Cancellation)

See [CRITICAL_FIXES_PROGRESS.md](CRITICAL_FIXES_PROGRESS.md) for full roadmap.
