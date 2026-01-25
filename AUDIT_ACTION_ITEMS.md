# ⚡ AUDIT ACTION ITEMS - PRIORITY MATRIX

## 🔴 CRITICAL (Do This Week)

### 1. **ROTATE STRIPE KEYS** 
**Why**: Hardcoded live key in production code  
**Where**: `services/stripeService.ts:3`  
**How**:
```bash
# 1. Stripe Dashboard → Developers → API Keys
# 2. Click "Revoke" on old key
# 3. Click "Create restricted key" for new one
# 4. Update environment variables:
STRIPE_SECRET_KEY=sk_live_xxxxx_new
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx_new
STRIPE_WEBHOOK_SECRET=whsec_xxxxx_new

# 5. Update services/stripeService.ts to use env var
# 6. Deploy immediately
# 7. Monitor Stripe logs for any issues
```
**Timeline**: 2 hours  
**Blocker**: No, but urgent  

### 2. **REMOVE HARDCODED STRIPE KEY**
**File**: `services/stripeService.ts:1-3`  
**Current**:
```typescript
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 
    'pk_live_51StCnSG2Aezsy59epwvFwsyhMk0N9ySXq0U5fYgWBoTpfzZnX2rMCaQ41XEfGgWZoI3lWD2P0mUxF169hQYZV5Cc00Yl5xKCGh';
```
**Fix**:
```typescript
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_PUBLIC_KEY) {
    throw new Error('❌ CRITICAL: Stripe public key not configured. Set VITE_STRIPE_PUBLISHABLE_KEY environment variable.');
}
```
**Timeline**: 30 minutes  

### 3. **FIX SUBSCRIPTION DATA DUAL-STORAGE**
**Problem**: Data in 3 places:
- `companies.subscription` (JSON - OLD)
- `profiles.subscription_tier` (string - OLD)
- `subscriptions` table (relational - NEW)

**Action Plan**:
```sql
-- Step 1: AUDIT - what data exists?
SELECT COUNT(*) as json_subscriptions FROM companies WHERE subscription IS NOT NULL;
SELECT COUNT(*) as old_tier FROM profiles WHERE subscription_tier != 'free';
SELECT COUNT(*) as new_subscriptions FROM subscriptions;

-- Step 2: MIGRATE - ensure all data in subscriptions table
INSERT INTO subscriptions (company_id, tier, status, created_at)
SELECT id, 
       COALESCE(subscription->>'tier', 'basic'),
       COALESCE(subscription->>'status', 'active'),
       NOW()
FROM companies 
WHERE subscription IS NOT NULL
AND id NOT IN (SELECT company_id FROM subscriptions WHERE company_id IS NOT NULL)
ON CONFLICT (company_id) DO NOTHING;

-- Step 3: ADD CONSTRAINT - prevent duplicates
ALTER TABLE subscriptions 
ADD CONSTRAINT one_subscription_per_company UNIQUE(company_id);

-- Step 4: DEPRECATE - mark old columns for removal
-- Add comment to schema
-- COMMENT ON COLUMN companies.subscription IS 'DEPRECATED: Use subscriptions table instead. Remove in v2.4';
-- COMMENT ON COLUMN profiles.subscription_tier IS 'DEPRECATED: Use subscriptions table instead. Remove in v2.4';

-- Step 5: UPDATE APP CODE
-- Remove all reads from companies.subscription
-- Remove all reads from profiles.subscription_tier  
-- Point to subscriptions table only

-- Step 6: SCHEDULE REMOVAL
-- v2.2: Dual-write mode (write to both old & new)
-- v2.3: Read-only from new table
-- v2.4: Delete old columns
```
**Timeline**: 1-2 days  

### 4. **IMPLEMENT WEBHOOK IDEMPOTENCY**
**Problem**: Stripe webhook could be delivered twice, creating duplicate subscriptions  
**File**: `backend/app/main.py:919-1005`

```python
# Create tracking table
@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    # Verify signature
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook Error: {str(e)}")

    # NEW: Check if event already processed
    event_id = event["id"]
    existing = supabase.table("webhook_events")\
        .select("*")\
        .eq("stripe_event_id", event_id)\
        .execute()
    
    if existing.data:
        print(f"✅ Webhook already processed: {event_id}")
        return {"status": "already_processed"}

    try:
        # Process webhook (existing logic)
        if event["type"] == "checkout.session.completed":
            # ... existing logic ...
            pass
        
        # NEW: Mark as processed
        supabase.table("webhook_events").insert({
            "stripe_event_id": event_id,
            "event_type": event["type"],
            "processed_at": now_iso(),
            "status": "processed"
        }).execute()
        
        print(f"✅ Webhook processed successfully: {event_id}")
        return {"status": "success"}
    
    except Exception as e:
        print(f"❌ Webhook processing failed: {event_id} - {str(e)}")
        # Return 500 to Stripe to retry
        raise HTTPException(status_code=500, detail="Processing failed")
```

**Database**:
```sql
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'processed'
);

CREATE INDEX idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
```
**Timeline**: 4 hours  

---

## 🟠 HIGH (Next 2 Weeks)

### 5. **ADD SUBSCRIPTION CANCELLATION ENDPOINT**
**Why**: Users need ability to cancel subscriptions  
**Where**: `backend/app/main.py` (new endpoint)

```python
@app.post("/cancel-subscription")
@limiter.limit("5/minute")
async def cancel_subscription(
    user: dict = Depends(get_current_user),
    request: Request = None
):
    """Cancel user's active subscription"""
    user_id = user.get("id")
    
    try:
        # Get subscription
        sub_response = supabase.table("subscriptions")\
            .select("*")\
            .eq("company_id", user_id)\
            .execute()
        
        if not sub_response.data:
            raise HTTPException(status_code=404, detail="No subscription found")
        
        subscription = sub_response.data[0]
        
        # Cancel in Stripe
        if subscription.get("stripe_subscription_id"):
            stripe.Subscription.delete(
                subscription["stripe_subscription_id"],
                prorate=True
            )
        
        # Update database
        supabase.table("subscriptions")\
            .update({
                "status": "cancelled",
                "updated_at": now_iso()
            })\
            .eq("id", subscription["id"])\
            .execute()
        
        # Log cancellation
        supabase.table("analytics_events").insert({
            "event_type": "subscription_cancelled",
            "company_id": user_id,
            "tier": subscription.get("tier"),
            "metadata": {"reason": "user_requested"}
        }).execute()
        
        return {
            "status": "success",
            "message": "Subscription cancelled successfully",
            "refund_status": "processing"
        }
    
    except Exception as e:
        print(f"Cancellation error: {str(e)}")
        raise HTTPException(status_code=500, detail="Cancellation failed")
```

**Frontend**: `components/SubscriptionManager.tsx`
```typescript
const handleCancel = async () => {
    if (!confirm('Are you sure? You will lose access immediately.')) return;
    
    try {
        const response = await fetch('/cancel-subscription', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            alert('Subscription cancelled. Thank you for using JobShaman!');
            window.location.reload();
        }
    } catch (error) {
        alert('Cancellation failed: ' + error.message);
    }
};
```
**Timeline**: 8 hours  

### 6. **EXTEND WEBHOOK COVERAGE**
**Missing events**:
```python
@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    event = stripe.Webhook.construct_event(...)
    
    if event["type"] == "checkout.session.completed":
        # Already implemented
        pass
    
    elif event["type"] == "customer.subscription.updated":
        # NEW: Handle tier changes mid-cycle
        subscription = event["data"]["object"]
        items = subscription.get("items", {}).get("data", [])
        
        # Get tier from Stripe metadata
        # Update subscriptions table
        supabase.table("subscriptions")\
            .update({
                "tier": extract_tier_from_items(items),
                "current_period_end": subscription["current_period_end"],
                "status": subscription["status"],
                "updated_at": now_iso()
            })\
            .eq("stripe_subscription_id", subscription["id"])\
            .execute()
    
    elif event["type"] == "customer.subscription.deleted":
        # NEW: Handle cancellation
        subscription = event["data"]["object"]
        
        supabase.table("subscriptions")\
            .update({"status": "cancelled"})\
            .eq("stripe_subscription_id", subscription["id"])\
            .execute()
    
    elif event["type"] == "invoice.payment_failed":
        # NEW: Handle failed payments
        invoice = event["data"]["object"]
        
        supabase.table("subscriptions")\
            .update({"status": "past_due"})\
            .eq("stripe_customer_id", invoice["customer"])\
            .execute()
        
        # Send email notification
```
**Timeline**: 8 hours  

### 7. **REMOVE OLD JSON COLUMNS FROM DATABASE**
**When**: After migration is validated (2 weeks)

```sql
-- Verify no code references old columns
-- Search codebase for: companies.subscription, profiles.subscription_tier

-- After verification:
ALTER TABLE companies DROP COLUMN subscription;
ALTER TABLE profiles DROP COLUMN subscription_tier;

-- Add new check constraint to prevent accidental reintroduction
ALTER TABLE subscriptions 
ADD CONSTRAINT check_tier_valid 
CHECK (tier IN ('free', 'basic', 'business', 'enterprise', 'assessment_bundle'));
```
**Timeline**: 1 week from start  

---

## 🟡 MEDIUM (This Month)

### 8. **ADD COMPREHENSIVE AUDIT LOGGING**
**Files to update**:
- `backend/app/main.py:740-820` (verify_billing endpoint)
- `backend/app/main.py:199-230` (verify_subscription function)

```python
# Every verification should log

async def verify_subscription(user: dict, request: Request = None):
    # ... existing logic ...
    
    # Add logging for EVERY outcome
    
    if verification_passes:
        # Log successful access
        supabase.table("premium_access_logs").insert({
            "user_id": user.get("id"),
            "feature": feature_name,
            "endpoint": request.url.path,
            "ip_address": get_remote_address(request),
            "timestamp": now_iso(),
            "subscription_tier": user.get("subscription_tier"),
            "result": "allowed",
            "metadata": {
                "feature": feature_name,
                "method": request.method
            }
        }).execute()
    else:
        # Log failed access
        supabase.table("premium_access_logs").insert({
            "user_id": user.get("id"),
            "feature": feature_name,
            "endpoint": request.url.path,
            "ip_address": get_remote_address(request),
            "timestamp": now_iso(),
            "subscription_tier": user.get("subscription_tier"),
            "result": "denied",
            "metadata": {
                "reason": reason,
                "required_tier": required_tier
            }
        }).execute()
```
**Timeline**: 6 hours  

### 9. **ADD SECURITY HEADERS MIDDLEWARE**
**File**: `backend/app/main.py` (new middleware)

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Frame-Options"] = "DENY"
    
    # Enable XSS protection in older browsers
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Force HTTPS
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # CSP - Restrict content sources
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://js.stripe.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://api.stripe.com https://jobshaman-cz.onrender.com; "
        "frame-src https://js.stripe.com"
    )
    
    return response
```
**Timeline**: 4 hours  

### 10. **IMPLEMENT CSRF PROTECTION**
**File**: `backend/app/main.py` (new CSRF module)

```python
import secrets
from fastapi import Request, HTTPException

csrf_tokens = {}  # In production: use Redis

@app.get("/csrf-token")
async def get_csrf_token(request: Request):
    """Generate CSRF token for session"""
    token = secrets.token_urlsafe(32)
    session_id = request.cookies.get("session_id", secrets.token_urlsafe(16))
    csrf_tokens[session_id] = token
    
    response = JSONResponse({"csrf_token": token})
    response.set_cookie("session_id", session_id, httponly=True, secure=True)
    return response

@app.post("/create-checkout-session")
async def create_checkout_session(
    req: CheckoutRequest,
    x_csrf_token: str = Header(None),
    request: Request = None
):
    """Validate CSRF token before processing"""
    session_id = request.cookies.get("session_id")
    
    if not session_id or session_id not in csrf_tokens:
        raise HTTPException(status_code=403, detail="Session expired")
    
    if x_csrf_token != csrf_tokens[session_id]:
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    
    # Clean up token (single use)
    del csrf_tokens[session_id]
    
    # ... rest of checkout logic ...
```

**Frontend**: `services/stripeService.ts`
```typescript
export const redirectToCheckout = async (tier: string, userId: string) => {
    try {
        // Get CSRF token
        const csrfRes = await fetch(`${BACKEND_URL}/csrf-token`);
        const { csrf_token } = await csrfRes.json();
        
        // Create checkout with CSRF token
        const response = await fetch(`${BACKEND_URL}/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrf_token,
            },
            body: JSON.stringify({ tier, userId, ... }),
        });
        
        // ...rest of logic...
    }
};
```
**Timeline**: 4 hours  

---

## 🟢 LOW (Next Quarter)

### 11. **IMPLEMENT ENCRYPTION FOR STRIPE IDS**
**When**: After critical fixes are stable  
**Timeline**: 6 hours  

### 12. **CREATE INVOICE HISTORY TRACKING**
**When**: User feature, lower priority  
**Timeline**: 6 hours  

### 13. **IMPLEMENT TRIAL PERIODS**
**When**: Growth feature  
**Timeline**: 4 hours  

### 14. **ADD DISCOUNT CODE SUPPORT**
**When**: Marketing feature  
**Timeline**: 4 hours  

---

## 📋 QUICK DEPLOYMENT CHECKLIST

```bash
# Week 1
[ ] Rotate Stripe keys
[ ] Remove hardcoded Stripe key from code
[ ] Add webhook idempotency tracking
[ ] Create webhook_events table

# Week 2
[ ] Fix subscription dual-storage issue
[ ] Add subscription cancellation endpoint
[ ] Extend webhook event coverage
[ ] Add comprehensive audit logging

# Week 3
[ ] Add security headers
[ ] Implement CSRF protection
[ ] Remove old JSON columns from schema
[ ] Deploy to production

# Monitoring
[ ] Monitor Stripe webhook delivery
[ ] Watch for duplicate subscriptions
[ ] Check audit logs for unusual patterns
[ ] Monitor failed webhook processing
```

---

## 🧪 TESTING CHECKLIST

### Unit Tests
```bash
# Test webhook idempotency
pytest tests/test_webhook_idempotency.py

# Test subscription cancellation
pytest tests/test_subscription_cancellation.py

# Test billing verification
pytest tests/test_billing_verification.py
```

### Integration Tests
```bash
# Test full Stripe flow
pytest tests/test_stripe_integration.py

# Test payment verification
pytest tests/test_payment_verification.py

# Test webhook processing
pytest tests/test_webhook_processing.py
```

### Security Tests
```bash
# Test CSRF protection
pytest tests/test_csrf_protection.py

# Test rate limiting
pytest tests/test_rate_limiting.py

# Test authentication
pytest tests/test_authentication.py
```

---

## 📞 CONTACT FOR QUESTIONS

All issues documented in: `/COMPREHENSIVE_AUDIT_REPORT.md`
