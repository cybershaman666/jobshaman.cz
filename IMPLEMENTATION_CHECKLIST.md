# ✅ IMPLEMENTATION CHECKLIST

## Pre-Implementation

- [ ] Read COMPREHENSIVE_AUDIT_REPORT.md (20 min)
- [ ] Review AUDIT_ACTION_ITEMS.md (15 min)
- [ ] Understand database changes in AUDIT_FIXES.sql (10 min)
- [ ] Brief team on changes
- [ ] Create feature branch: `git checkout -b audit/fixes`
- [ ] Backup database

---

## 🔴 CRITICAL FIXES - WEEK 1

### Task 1: Rotate Stripe API Keys
**Time**: 2 hours  
**Blocker**: YES - Do this first

- [ ] Go to https://dashboard.stripe.com
- [ ] Navigate to Developers → API Keys
- [ ] Review both Secret and Publishable keys
  - [ ] Old Secret Key: `sk_live_...`
  - [ ] Old Publishable Key: `pk_live_...`
  - [ ] Old Webhook Secret: `whsec_...`
- [ ] Click "Revoke" on old keys
- [ ] Click "Create Restricted Key"
  - [ ] For new Secret Key:
    - [ ] Grant: Write access to Charges, Customers, Subscriptions
    - [ ] Restrict to: Checkout
  - [ ] For Webhook Secret:
    - [ ] Click "Reveal test signing secret"
    - [ ] Copy the webhook secret
- [ ] Update environment variables:
  ```bash
  STRIPE_SECRET_KEY=sk_live_YOUR_NEW_KEY
  STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_NEW_KEY  
  STRIPE_WEBHOOK_SECRET=whsec_YOUR_NEW_SECRET
  ```
- [ ] In Stripe dashboard, update webhook URL to ensure it still points to your server
- [ ] Test webhook delivery: Send test event from Stripe dashboard
- [ ] Verify in logs that webhook was received
- [ ] Commit changes (if config in repo)
- [ ] Deploy to staging
- [ ] Test payment flow in staging
- [ ] Deploy to production
- [ ] Verify payment works in production
- [ ] Monitor Stripe logs for 24 hours

**Files to Update**:
- `.env` or `.env.local` (don't commit these!)
- Render environment variables (if deploying there)

**Validation**:
```bash
# Check that old key is no longer in code
grep -r "pk_live_51StCnSG2Aezsy59epwvFwsyhMk0N9ySXq0U5fYgWBoTpfzZnX2rMCaQ41XEfGgWZoI3lWD2P0mUxF169hQYZV5Cc00Yl5xKCGh" .
# Should return: No results ✓

# Check environment variable is set
echo $STRIPE_PUBLISHABLE_KEY
# Should show: pk_live_... (new key) ✓
```

---

### Task 2: Remove Hardcoded Stripe Key from Code
**Time**: 30 minutes  
**Blocker**: YES - Do this immediately after key rotation

**File**: `services/stripeService.ts`

- [ ] Open file
- [ ] Find line with hardcoded key
  ```typescript
  // Current (line 3):
  export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 
      'pk_live_51StCnSG2Aezsy59epwvFwsyhMk0N9ySXq0U5fYgWBoTpfzZnX2rMCaQ41XEfGgWZoI3lWD2P0mUxF169hQYZV5Cc00Yl5xKCGh';
  ```
- [ ] Replace with:
  ```typescript
  export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  
  if (!STRIPE_PUBLIC_KEY) {
      throw new Error(
          '❌ CRITICAL: Stripe public key not configured.\n' +
          'Set VITE_STRIPE_PUBLISHABLE_KEY environment variable to your Stripe publishable key.'
      );
  }
  ```
- [ ] Update `.env.example` or `.env.local.example`:
  ```
  VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_key_here
  ```
- [ ] Test locally
  ```bash
  npm run dev
  # Browser console should NOT show error
  # Stripe key in dev tools should be new key
  ```
- [ ] Commit: `git commit -m "security: remove hardcoded stripe key from source"`
- [ ] Push and deploy

**Validation**:
```bash
# Verify no hardcoded keys remain
grep -r "pk_live_" src/
grep -r "sk_live_" src/
grep -r "whsec_" src/
# All should return: No results ✓
```

---

### Task 3: Database Migration - Webhook Idempotency
**Time**: 4 hours  
**Blocker**: YES - Core fix for duplicate processing

1. **Run SQL Migration**
   - [ ] Open Supabase dashboard
   - [ ] Go to SQL Editor
   - [ ] Open file: `database/AUDIT_FIXES.sql`
   - [ ] Copy sections 1-2 (webhook_events + premium_access_logs tables)
   - [ ] Paste into SQL editor
   - [ ] Review (should be safe to run on production)
   - [ ] Execute
   - [ ] Verify success:
     ```sql
     SELECT COUNT(*) FROM webhook_events;
     -- Should return: 0 rows ✓
     
     SELECT COUNT(*) FROM premium_access_logs;
     -- Should return: 0 rows ✓
     ```

2. **Update Backend Code**
   - [ ] Open `backend/app/main.py`
   - [ ] Find `stripe_webhook` function (line ~919)
   - [ ] At the start of webhook processing, add idempotency check:
     ```python
     @app.post("/webhooks/stripe")
     async def stripe_webhook(request: Request):
         payload = await request.body()
         sig_header = request.headers.get("stripe-signature")
     
         try:
             event = stripe.Webhook.construct_event(
                 payload, sig_header, STRIPE_WEBHOOK_SECRET
             )
         except Exception as e:
             raise HTTPException(status_code=400, detail=f"Webhook Error: {str(e)}")
     
         # NEW: Check if already processed
         event_id = event["id"]
         try:
             existing = supabase.table("webhook_events")\
                 .select("*")\
                 .eq("stripe_event_id", event_id)\
                 .execute()
             
             if existing.data:
                 print(f"✅ Webhook {event_id} already processed, skipping")
                 return {"status": "already_processed"}
         except Exception as e:
             print(f"Warning: Could not check webhook idempotency: {e}")
             # Continue anyway to not block payments
     
         # Existing webhook processing logic
         if event["type"] == "checkout.session.completed":
             # ... existing logic ...
             pass
         
         # NEW: Mark as processed
         try:
             supabase.table("webhook_events").insert({
                 "stripe_event_id": event_id,
                 "event_type": event["type"],
                 "processed_at": now_iso(),
                 "status": "processed"
             }).execute()
             print(f"✅ Webhook {event_id} marked as processed")
         except Exception as e:
             print(f"Warning: Could not mark webhook as processed: {e}")
             # Don't fail webhook if we can't mark it
     
         return {"status": "success"}
     ```

3. **Test Changes**
   - [ ] Local testing:
     ```bash
     cd backend
     python -m pytest tests/test_webhook_idempotency.py -v
     # Should pass: test_webhook_duplicate_detection
     # Should pass: test_webhook_marked_as_processed
     ```
   
   - [ ] Staging test:
     ```bash
     # 1. Make test payment in Stripe dashboard using staging environment
     # 2. Manually trigger webhook twice from Stripe dashboard
     # 3. Verify only one subscription created
     
     # Query: SELECT COUNT(*) FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx';
     # Should return: 1 ✓
     ```

4. **Deploy**
   - [ ] Commit changes
   - [ ] Push to staging
   - [ ] Test for 1 hour
   - [ ] Push to production
   - [ ] Monitor for 24 hours

---

### Task 4: Fix Dual Subscription Storage
**Time**: 8 hours  
**Blocker**: YES - Data consistency issue

1. **Audit Current Data**
   - [ ] Check how much data is affected:
     ```sql
     SELECT COUNT(*) as companies_with_json_subscription 
     FROM companies WHERE subscription IS NOT NULL;
     
     SELECT COUNT(*) as profiles_with_subscription_tier 
     FROM profiles WHERE subscription_tier != 'free';
     
     SELECT COUNT(*) as subscriptions_in_new_table 
     FROM subscriptions;
     ```
   - [ ] Document results

2. **Backup Data**
   - [ ] Create backup table:
     ```sql
     CREATE TABLE companies_backup_subscriptions AS
     SELECT * FROM companies
     WHERE subscription IS NOT NULL OR subscription_tier IS NOT NULL;
     ```
   - [ ] Verify backup:
     ```sql
     SELECT COUNT(*) FROM companies_backup_subscriptions;
     -- Should match count from step 1
     ```

3. **Migrate to New Schema**
   - [ ] Copy SQL section 10 from `database/AUDIT_FIXES.sql`
   - [ ] Execute migration:
     ```sql
     INSERT INTO subscriptions (...)
     SELECT ...
     FROM companies c
     WHERE c.id NOT IN (SELECT company_id FROM subscriptions)
         AND (c.subscription IS NOT NULL OR c.subscription_tier != 'free');
     ```
   - [ ] Verify migration:
     ```sql
     SELECT COUNT(*) FROM subscriptions;
     -- Should be at least as many as before
     ```

4. **Add Constraints**
   - [ ] Run constraint creation SQL:
     ```sql
     ALTER TABLE subscriptions
     ADD CONSTRAINT unique_company_subscription UNIQUE(company_id);
     ```
   - [ ] Test by trying to insert duplicate (should fail):
     ```sql
     INSERT INTO subscriptions (company_id, tier) 
     VALUES ('uuid-that-exists', 'basic');
     -- Should error: UNIQUE constraint violated ✓
     ```

5. **Mark Old Columns as Deprecated**
   - [ ] Add comments:
     ```sql
     COMMENT ON COLUMN companies.subscription IS 
         'DEPRECATED: Migrated to subscriptions table. 
          Will be removed in v2.4 (2026-03-01).
          Do NOT use for new code.';
     
     COMMENT ON COLUMN profiles.subscription_tier IS 
         'DEPRECATED: Migrated to subscriptions table.
          Will be removed in v2.4 (2026-03-01).
          Do NOT use for new code.';
     ```

6. **Update Application Code**
   - [ ] Search for all references to old fields:
     ```bash
     grep -r "companies.subscription" src/
     grep -r "\.subscription_tier" src/
     grep -r "subscriptions_tier" src/
     ```
   - [ ] Update all references to use `subscriptions` table
   - [ ] Example changes in `services/supabaseService.ts`:
     ```typescript
     // OLD:
     const tier = profileData.subscription_tier || 'free';
     
     // NEW:
     const subscription = await supabase
         .from('subscriptions')
         .select('tier')
         .eq('company_id', companyId)
         .single();
     const tier = subscription?.data?.tier || 'free';
     ```

7. **Test All Billing Features**
   - [ ] Create new subscription → Verify in subscriptions table
   - [ ] Upgrade subscription → Verify tier updated
   - [ ] Verify billing → Check server-side verification works
   - [ ] Check premium features → Verify access control works
   - [ ] Run full payment flow test

8. **Deploy & Monitor**
   - [ ] Deploy to staging
   - [ ] Test extensively (4 hours)
   - [ ] Deploy to production
   - [ ] Monitor for 48 hours
   - [ ] Watch for any errors related to subscriptions

---

## 🟠 HIGH PRIORITY FIXES - WEEK 2

### Task 5: Add Subscription Cancellation Endpoint
**Time**: 8 hours

- [ ] Backend Implementation
  - [ ] Add endpoint to `backend/app/main.py`:
    ```python
    @app.post("/cancel-subscription")
    @limiter.limit("5/minute")
    async def cancel_subscription(
        user: dict = Depends(get_current_user),
        request: Request = None
    ):
        # See AUDIT_ACTION_ITEMS.md section 5 for full implementation
    ```
  - [ ] Test endpoint with Postman
  - [ ] Test rate limiting
  
- [ ] Frontend Implementation  
  - [ ] Create component `components/SubscriptionManager.tsx`
  - [ ] Add cancellation button to UI
  - [ ] Test UI flow
  
- [ ] Tests
  - [ ] Unit test for cancel endpoint
  - [ ] Integration test with Stripe
  - [ ] UI test for cancellation flow

---

### Task 6: Extend Webhook Coverage
**Time**: 8 hours

- [ ] Implement new events in `backend/app/main.py`:
  - [ ] `customer.subscription.updated` (tier changes)
  - [ ] `customer.subscription.deleted` (cancellations)
  - [ ] `invoice.payment_failed` (failed renewals)

- [ ] Update Stripe webhook configuration
  - [ ] Go to Stripe Dashboard → Webhooks
  - [ ] Add events to webhook endpoint:
    - [ ] `customer.subscription.updated`
    - [ ] `customer.subscription.deleted`
    - [ ] `invoice.payment_failed`

- [ ] Test each event
  - [ ] Use Stripe webhook tester
  - [ ] Verify event handling in logs
  - [ ] Verify database updates correctly

---

### Task 7: Add Comprehensive Audit Logging
**Time**: 6 hours

- [ ] Update `backend/app/main.py` verify_billing function
  - [ ] Log every access attempt (allowed & denied)
  - [ ] Include: user, feature, result, tier, timestamp, IP
  - [ ] See AUDIT_ACTION_ITEMS.md section 8

- [ ] Update subscription change tracking
  - [ ] Log every tier change
  - [ ] Log every status change
  - [ ] Log cancellations with reason

- [ ] Test logging
  - [ ] Make purchases and verify logged
  - [ ] Access features and verify logged
  - [ ] Query logs and verify data complete

---

## 🟡 MEDIUM PRIORITY FIXES - WEEK 3

### Task 8: Add Security Headers
**Time**: 2 hours

- [ ] Add middleware to `backend/app/main.py`:
  ```python
  @app.middleware("http")
  async def add_security_headers(request: Request, call_next):
      response = await call_next(request)
      response.headers["X-Content-Type-Options"] = "nosniff"
      response.headers["X-Frame-Options"] = "DENY"
      response.headers["X-XSS-Protection"] = "1; mode=block"
      response.headers["Strict-Transport-Security"] = "max-age=31536000"
      return response
  ```
- [ ] Test headers with browser dev tools
- [ ] Verify with security header checker

---

### Task 9: Implement CSRF Protection
**Time**: 4 hours

- [ ] Add CSRF token generation endpoint
- [ ] Add CSRF token validation to protected endpoints
- [ ] Update frontend to use CSRF tokens
- [ ] Test CSRF protection

---

### Task 10: Remove Old JSON Columns
**Time**: 1 hour
**Note**: Only after 2-3 weeks of monitoring new schema

- [ ] Verify no code references old columns
- [ ] Create final backup
- [ ] Run cleanup SQL:
  ```sql
  ALTER TABLE companies DROP COLUMN subscription;
  ALTER TABLE profiles DROP COLUMN subscription_tier;
  ```
- [ ] Verify application still works
- [ ] Monitor for errors

---

## 🟢 LOW PRIORITY - ONGOING

### Task 11: Monitor & Maintain
- [ ] Watch Stripe webhook logs daily
- [ ] Monitor failed webhook alerts
- [ ] Review audit logs for patterns
- [ ] Track subscription metrics

### Task 12: Additional Features (When Ready)
- [ ] Invoice history tracking
- [ ] Trial period implementation
- [ ] Discount code support
- [ ] Subscription upgrade/downgrade flows

---

## 🧪 TESTING CHECKLIST

### Unit Tests
- [ ] Webhook idempotency test
- [ ] Billing verification test
- [ ] Subscription cancellation test
- [ ] Security header test
- [ ] CSRF token test

### Integration Tests
- [ ] Full payment flow
- [ ] Subscription upgrade
- [ ] Subscription cancellation
- [ ] Webhook processing
- [ ] Rate limiting

### Manual Testing
- [ ] Create new subscription
- [ ] Verify features are accessible
- [ ] Cancel subscription
- [ ] Verify access is revoked
- [ ] Check audit logs
- [ ] Simulate webhook duplicate
- [ ] Test error scenarios

### Security Testing
- [ ] CSRF vulnerability test
- [ ] SQL injection test
- [ ] XSS test
- [ ] Rate limit test
- [ ] Authentication bypass test

---

## 📋 DEPLOYMENT CHECKLIST

### Before Deployment
- [ ] All tests pass locally
- [ ] No console errors or warnings
- [ ] Database backups created
- [ ] Rollback plan documented
- [ ] Team notified of changes

### Staging Deployment
- [ ] Deploy to staging environment
- [ ] Run full test suite
- [ ] Perform manual testing
- [ ] Monitor for 4 hours
- [ ] Get approval from team lead

### Production Deployment
- [ ] Create deployment ticket
- [ ] Schedule deployment window
- [ ] Deploy to production
- [ ] Monitor Stripe logs
- [ ] Monitor error logs
- [ ] Monitor user signups/payments
- [ ] Be available for 24 hours

### Post-Deployment
- [ ] Verify no new errors
- [ ] Check Stripe webhook deliveries
- [ ] Review audit logs
- [ ] Monitor usage metrics
- [ ] Document any issues
- [ ] Schedule follow-up review

---

## 📞 SUPPORT & ROLLBACK

### If Something Goes Wrong
1. **Immediately**
   - [ ] Stop deployment
   - [ ] Check error logs
   - [ ] Notify team

2. **Assessment**
   - [ ] Is payment processing affected?
   - [ ] Are users losing access?
   - [ ] Are there data corruption issues?

3. **Rollback** (if critical)
   - [ ] Revert database changes from backup
   - [ ] Revert code to previous version
   - [ ] Verify system working
   - [ ] Post-mortem meeting

4. **Resolution**
   - [ ] Fix the issue
   - [ ] Add test to prevent recurrence
   - [ ] Re-deploy with fixes

---

## 📊 SUCCESS CRITERIA

You're done when:

✅ Stripe keys are rotated and only in env variables  
✅ No hardcoded secrets in source code  
✅ Webhook_events table tracks all deliveries  
✅ No duplicate subscriptions can be created  
✅ Subscription data is only in subscriptions table  
✅ Premium access is logged for all attempts  
✅ Subscriptions can be cancelled through UI  
✅ All webhook event types are handled  
✅ Security headers are present  
✅ CSRF protection is working  
✅ All tests pass  
✅ No errors in production logs after 24 hours  

---

## 📝 NOTES & OBSERVATIONS

**Week 1**: Focus on critical security fixes
- Rotate keys immediately
- Don't delay on hardcoded secrets
- Test webhook idempotency thoroughly

**Week 2**: Build out missing features
- Cancellation is essential for legal compliance
- Webhook coverage prevents missed events

**Week 3**: Polish security & prepare for scale
- Headers and CSRF are prerequisites for security cert
- Comprehensive logging essential for debugging

**Ongoing**: Maintenance is key
- Monitor webhook failures daily
- Review audit logs weekly
- Schedule security reviews monthly

---

**Checklist Version**: 1.0  
**Created**: January 25, 2026  
**Last Updated**: January 25, 2026  
**Status**: Ready for Use
