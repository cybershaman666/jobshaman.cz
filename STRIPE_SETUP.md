# Stripe Integration Setup Guide

## Current Issue
The app is encountering Stripe checkout session errors:
- **Error 1:** "Invalid API Key provided: mk_1StCn..." (malformed or test-mode key)
- **Error 2:** "You specified `payment` mode but passed a recurring price" (placeholder price ID)

## Root Causes
1. **Missing `STRIPE_SECRET_KEY`** environment variable
2. **Placeholder Stripe price ID** for `single_assessment` tier (`price_1Q...`)
3. **Missing environment variable documentation** in deployment guides

## Solution

### Step 1: Get Your Stripe Secret Key
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API Keys**
3. Copy your **Secret Key** (starts with `sk_`)
4. ⚠️ **NEVER** use your Publishable Key (starts with `pk_`) as the secret key

### Step 2: Set Environment Variables
Set these in your local `.env` file or on Render.io:
```
STRIPE_SECRET_KEY=sk_live_your_actual_key_here
```

### Step 3: Verify Price IDs
Current price IDs configured in `backend/app/main.py` (lines ~1310):
```python
prices = {
    "premium": "price_1StDJuG2Aezsy59eqi584FWl",           # ✅ 99 CZK/month
    "business": "price_1StDKmG2Aezsy59e1eiG9bny",         # ✅ 4990 CZK/month
    "assessment_bundle": "price_1StDTGG2Aezsy59esZLgocHw", # ✅ 990 CZK/month recurring
    "single_assessment": None,                              # ❌ TODO: Not configured
}
```

### Step 4: Create Missing One-Time Price (Optional)
If you want to allow single-assessment purchases:
1. In Stripe Dashboard, go to **Products**
2. Find or create a product for "Single Assessment"
3. Add a **one-time** price (NOT recurring)
4. Copy the price ID (`price_...`)
5. Update `backend/app/main.py` line ~1322:
   ```python
   "single_assessment": "price_your_stripe_id_here",
   ```

### Step 5: Test Checkout
1. Start the backend: `python -m uvicorn backend.app.main:app --reload`
2. Start the frontend: `npm run dev`
3. Navigate to Subscription Dashboard
4. Try purchasing "Premium" or "Business" tier
5. Verify checkout session is created without errors

## Valid Tier → Mode Mapping
| Tier | Mode | Payment Type | Price |
|------|------|--------------|-------|
| `premium` | subscription | Recurring | price_1StDJuG2Aezsy59eqi584FWl |
| `business` | subscription | Recurring | price_1StDKmG2Aezsy59e1eiG9bny |
| `assessment_bundle` | subscription | Recurring | price_1StDTGG2Aezsy59esZLgocHw |
| `single_assessment` | payment | One-time | _Not configured_ |

## Deployment Checklist
- [ ] Add `STRIPE_SECRET_KEY` to Render.io environment variables
- [ ] Verify key starts with `sk_` (secret key, not publishable key)
- [ ] Update `render.yaml` with `STRIPE_SECRET_KEY` variable definition (✅ Done)
- [ ] Update deployment guide with `STRIPE_SECRET_KEY` instructions (✅ Done)
- [ ] Test checkout locally before deploying
- [ ] Monitor Stripe webhooks in Dashboard after deployment

## Troubleshooting

### Error: "Invalid API Key provided"
- **Cause:** Missing `STRIPE_SECRET_KEY` env var or using wrong key
- **Fix:** Set `STRIPE_SECRET_KEY=sk_...` in environment

### Error: "payment mode but passed a recurring price"
- **Cause:** Trying to use `single_assessment` (requires one-time price) but price ID is placeholder or recurring
- **Fix:** Create one-time price in Stripe or use `premium`/`business` tier

### Error: "Could not find price"
- **Cause:** Price ID in code doesn't exist in Stripe account
- **Fix:** Verify price IDs match between Stripe Dashboard and `backend/app/main.py`

## Files Updated
- ✅ `backend/app/main.py`: Fixed price ID validation and comments
- ✅ `backend/render.yaml`: Added `STRIPE_SECRET_KEY` to env vars
- ✅ `backend/DEPLOYMENT.md`: Added Stripe setup instructions
