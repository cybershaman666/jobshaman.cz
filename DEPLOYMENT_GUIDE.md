# 🚀 JobShaman Deployment Guide

## Frontend Deployment (Vercel)

### 1. Environment Variables
Add these to your Vercel project settings:

```
VITE_BACKEND_URL=https://jobshaman-cz.onrender.com
VITE_SUPABASE_URL=https://[your-project].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

### 2. Build Configuration
- Framework: Next.js (Vite)
- Node.js: 18+
- Build command: `npm run build`
- Output directory: `dist/`

---

## Backend Deployment (Render.io)

### 1. Create Service on Render

**Service Settings:**
- Name: `jobshaman-cz`
- Language: Python
- Start Command: `gunicorn -k uvicorn.workers.UvicornWorker app.main:app --chdir backend --bind 0.0.0.0:$PORT --timeout 120`

### 2. Environment Variables

Add these in Render dashboard:

```
# Stripe Configuration
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SECRET_KEY=sk_live_...

# Supabase Configuration
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_ADMIN_KEY=[your-service-role-key]

# Authentication
JWT_SECRET=[generate-secure-random-string]

# Email Service
RESEND_API_KEY=[your-resend-api-key]

# Environment
ENVIRONMENT=production
```

### 3. Build Configuration (render.yaml)

The project includes `render.yaml` with pre-configured settings:

```yaml
services:
  - type: web
    name: jobshaman-cz
    runtime: python
    pythonVersion: 3.13
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn -k uvicorn.workers.UvicornWorker app.main:app --chdir backend --bind 0.0.0.0:$PORT --timeout 120
```

### 4. Database Migration

After backend is deployed:

1. Go to Supabase Dashboard
2. Open SQL Editor
3. Run the migration script: [database/CRITICAL_FIXES_PHASE1.sql](database/CRITICAL_FIXES_PHASE1.sql)

This creates:
- `webhook_events` table (Stripe event deduplication)
- `premium_access_logs` table (Audit logging)
- Indexes for performance
- RLS policies for security

---

## Post-Deployment Configuration

### 1. Update Frontend Environment Variable

After Render backend deployment is successful, update Vercel:

**VITE_BACKEND_URL** = `https://jobshaman-cz.onrender.com`

(Replace `jobshaman-cz` with your actual Render service name)

### 2. Configure Stripe Webhooks

1. Go to Stripe Dashboard → Webhooks
2. Add Endpoint: `https://jobshaman-cz.onrender.com/webhooks/stripe`
3. Select Events:
   - `checkout.session.completed`
   - `subscription.updated`
   - `subscription.deleted`
   - `invoice.payment_failed`
4. Copy Signing Secret → Set as `STRIPE_WEBHOOK_SECRET` in Render

### 3. Test CSRF Protection

```bash
# 1. Login to your app
# 2. Open DevTools → Network tab
# 3. Make a POST request (e.g., subscription action)
# 4. Verify X-CSRF-Token header is present
# 5. Response should be 200, not 403
```

### 4. Verify Webhooks

```sql
-- Check webhook processing
SELECT * FROM webhook_events LIMIT 10;

-- Check audit logs
SELECT * FROM premium_access_logs LIMIT 10;
```

---

## Troubleshooting

### Render Build Failure: `regex is removed`
**Status**: ✅ FIXED

Changed all Pydantic v2 incompatible `regex=` parameters to `pattern=` in [backend/app/main.py](backend/app/main.py)

### Frontend Errors: `BACKEND_URL not found`
**Status**: ✅ FIXED

Added `BACKEND_URL` export to [constants.ts](constants.ts):
```typescript
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
```

Make sure `VITE_BACKEND_URL` is set in Vercel environment variables.

### CSRF Token Fetch Failing
**Check**:
1. Is backend running? → Test `https://[backend-url]/csrf-token`
2. Is user authenticated? → CSRF token only available after login
3. Is token being stored? → Check DevTools → Application → Session Storage

### Webhook Not Processing
**Check**:
1. Is webhook endpoint accessible? → `https://[backend-url]/webhooks/stripe`
2. Is STRIPE_WEBHOOK_SECRET set correctly? → Must match Stripe dashboard
3. Are duplicate webhooks? → Check `webhook_events` table
4. Check Render logs for errors

---

## Monitoring

### Key Metrics
- Backend response time: Should be < 500ms
- CSRF token generation rate: Monitor for unusual patterns
- Webhook processing: Check `webhook_events` table for failures
- Premium access: Check `premium_access_logs` for denials

### Useful Queries

```sql
-- Webhook processing summary
SELECT event_type, COUNT(*) as count, MAX(processed_at) as last_processed 
FROM webhook_events 
GROUP BY event_type;

-- Failed premium access attempts
SELECT user_id, feature, reason, COUNT(*) as count 
FROM premium_access_logs 
WHERE result = 'denied' 
GROUP BY user_id, feature, reason;

-- Subscription status
SELECT status, COUNT(*) as count 
FROM subscriptions 
GROUP BY status;
```

---

## Security Checklist

- [ ] All environment variables configured
- [ ] HTTPS enabled on both frontend and backend
- [ ] Stripe webhook endpoint registered
- [ ] Database migrations executed
- [ ] CSRF token generation working
- [ ] Rate limiting active
- [ ] Security headers present in responses
- [ ] Logs monitored for errors
- [ ] Backup plan in place

---

## Deployment URLs

After successful deployment:

| Service | URL |
|---------|-----|
| Frontend | `https://jobshaman-cz.vercel.app` |
| Backend API | `https://jobshaman-cz.onrender.com` |
| Stripe Webhooks | `https://jobshaman-cz.onrender.com/webhooks/stripe` |
| CSRF Token | `https://jobshaman-cz.onrender.com/csrf-token` |

---

## Support

For issues:
1. Check Render logs: Render Dashboard → Service → Logs
2. Check Vercel logs: Vercel Dashboard → Project → Deployments → Logs
3. Check browser console for frontend errors
4. Check database logs for backend errors

---

**Last Updated**: 25. ledna 2026  
**Status**: Production Ready ✅
