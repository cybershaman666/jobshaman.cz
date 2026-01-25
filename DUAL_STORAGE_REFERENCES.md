# Dual Storage Field References - Complete Audit

## Summary
This document lists **ALL** references to the old dual-storage subscription fields that need to be migrated:
- `profiles.subscription_tier` (OLD field)
- `companies.subscription` (OLD JSON field)
- `companies.subscription_tier` (OLD field)

---

## 1. BACKEND PYTHON CODE

### File: [backend/app/main.py](backend/app/main.py)

**Line 206** - Reading subscription_tier in verify_subscription
```python
user_tier = user.get("subscription_tier", "free")
```

**Line 663** - Logging subscription_tier to webhook_logs
```python
"subscription_tier": user.get("subscription_tier", "free"),
```

**Line 745** - Reading subscription_tier in get_subscription_status
```python
user_tier = user.get("subscription_tier", "free")
```

**Line 841** - Reading subscription_tier in verify_billing
```python
user_tier = user.get("subscription_tier", "free")
```

**Line 976-1016** - Writing to profiles.subscription_tier in stripe webhook
```python
supabase.table("profiles").update({"subscription_tier": "basic"}).eq("id", user_id).execute()
supabase.table("companies").update({"subscription_tier": "business"}).eq("id", user_id).execute()
supabase.table("profiles").update({"subscription_tier": "assessment_bundle"}).eq(...)
```

---

## 2. FRONTEND TYPESCRIPT/JAVASCRIPT

### File: [services/supabaseService.ts](services/supabaseService.ts)

**Line 105** - Default value in profile creation
```typescript
subscription_tier: 'free',
```

**Line 139** - Inserting subscription_tier into profiles
```typescript
subscription_tier,
```

**Line 187-209** - Reading subscription_tier and writing to it
```typescript
// Line 187: Reading
tier: profileData.subscription_tier || 'free',

// Line 209: Writing
if (updates.subscription?.tier !== undefined) profileUpdates.subscription_tier = updates.subscription.tier;
```

**Line 287** - Reading subscription_tier in company profile
```typescript
subscription_tier,
```

**Line 302** - Converting old field to new object
```typescript
tier: data.subscription_tier || 'basic',
```

### File: [services/billingService.ts](services/billingService.ts)

**Line 35** - Reading company.subscription object
```typescript
if (!company.subscription?.expiresAt) return false;
```

**Line 37** - Reading company.subscription.expiresAt
```typescript
const expiryDate = new Date(company.subscription.expiresAt);
```

**Line 74-75** - Reading company.subscription
```typescript
const tier = company.subscription?.tier || 'basic';
const used = company.subscription?.usage?.aiAssessmentsUsed || 0;
```

### File: [components/PlanUpgradeModal.tsx](components/PlanUpgradeModal.tsx)

**Line 86** - Reading subscription tier for UI display
```typescript
currentTier: companyProfile.subscription?.tier || 'basic',
```

**Line 136** - Reading subscription tier for UI display
```typescript
currentTier: companyProfile.subscription?.tier || 'basic',
```

### File: [components/AssessmentCreator.tsx](components/AssessmentCreator.tsx)

**Line 28-29** - Reading subscription tier and usage
```typescript
const tier = companyProfile.subscription?.tier || 'basic';
const used = companyProfile.subscription?.usage?.aiAssessmentsUsed || 0;
```

**Line 71** - Setting subscription tier in request
```typescript
tier: companyProfile.subscription?.tier || 'basic'
```

**Line 83** - Reading subscription tier
```typescript
const tier = companyProfile?.subscription?.tier || 'basic';
```

### File: [components/CompanyDashboard.tsx](components/CompanyDashboard.tsx)

**Line 147** - Reading subscription tier
```typescript
currentTier: companyProfile?.subscription?.tier || 'basic',
```

**Line 183** - Reading subscription tier
```typescript
currentTier: companyProfile?.subscription?.tier || 'basic',
```

**Line 218** - Setting subscription tier in request
```typescript
tier: companyProfile.subscription?.tier || 'basic'
```

---

## 3. DATABASE QUERIES

### File: [database/AUDIT_FIXES.sql](database/AUDIT_FIXES.sql)

**Line 118** - Selecting subscription_tier from companies
```sql
subscription_tier,
```

**Line 126** - Grouping by subscription_tier
```sql
GROUP BY user_id, feature, subscription_tier;
```

**Line 155** - Comparing companies.subscription_tier with subscriptions.tier
```sql
WHERE c.subscription_tier != s.tier;
```

**Line 166** - Selecting subscription_tier
```sql
subscription_tier,
```

**Line 170** - WHERE clause checking both fields
```sql
WHERE subscription IS NOT NULL OR subscription_tier IS NOT NULL;
```

**Line 191-202** - COALESCE reading from both old and new fields
```sql
COALESCE((c.subscription->>'tier'), c.subscription_tier, 'basic') as tier,
COALESCE((c.subscription->>'status'), 'active') as status,
(c.subscription->>'stripe_subscription_id')::VARCHAR,
(c.subscription->>'stripe_customer_id')::VARCHAR,
AND (c.subscription IS NOT NULL OR c.subscription_tier != 'free');
```

### File: [database/CRITICAL_FIXES_PHASE1.sql](database/CRITICAL_FIXES_PHASE1.sql)

**Line 32** - Column definition
```sql
subscription_tier VARCHAR(20),
```

### File: [database/safe_migration.sql](database/safe_migration.sql)

**Line 94** - COALESCE reading subscription_tier from companies
```sql
COALESCE(subscription_tier, 'basic') as tier,
```

**Line 99, 113** - WHERE clause checking subscription_tier
```sql
WHERE subscription_tier IS NOT NULL
WHERE c.subscription_tier IS NOT NULL
```

### File: [database/fix_subscription_security.sql](database/fix_subscription_security.sql)

**Line 12** - Column definition with DEFAULT
```sql
subscription_tier VARCHAR(20) DEFAULT 'free',
```

### File: [database/cleanup_subscription_json.sql](database/cleanup_subscription_json.sql)

**Line 17** - Dropping subscription_tier from companies
```sql
ALTER TABLE companies DROP COLUMN IF EXISTS subscription_tier;
```

---

## 4. MIGRATION QUERIES

### File: [database/migration_paywall_schema.sql](database/migration_paywall_schema.sql)

**Line 149** - WHERE clause checking old JSON field
```sql
WHERE c.subscription IS NOT NULL
```

---

## 5. DOCUMENTATION/CHECKLISTS (NOT EXECUTABLE)

### Files with references (informational only):
- [COMPREHENSIVE_AUDIT_REPORT.md](COMPREHENSIVE_AUDIT_REPORT.md) - Lines 59, 195, 301, 416, 441, 540, 543, 893, 917
- [AUDIT_ACTION_ITEMS.md](AUDIT_ACTION_ITEMS.md) - Lines 44-45, 52, 72-77, 295, 299, 333, 348
- [AUDIT_VISUAL_SUMMARY.md](AUDIT_VISUAL_SUMMARY.md) - Lines 69-70, 138, 150, 355-356, 411-412
- [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) - Lines 227-228, 240, 256, 280, 285, 294-295, 302, 442

---

## CRITICAL ISSUES FOUND

### 1. **Inconsistent Data Sources**
- `profiles.subscription_tier` is read from user profiles
- `companies.subscription` is a JSON field with tier, status, stripe IDs
- `companies.subscription_tier` is a string field that can diverge from subscriptions table

### 2. **Multiple Storage Patterns**
- **Profiles table**: Uses `subscription_tier` directly
- **Companies table**: Has BOTH `subscription` (JSON) AND `subscription_tier` (string)
- **Subscriptions table**: Single source of truth with `tier`, `status`, etc.

### 3. **Code Creating Dual Writes**
- [services/supabaseService.ts#L209](services/supabaseService.ts#L209): Writing to `subscription_tier` when subscription.tier changes
- [backend/app/main.py#L976-1016](backend/app/main.py#L976-1016): Webhook creating/updating `subscription_tier` in companies and profiles

### 4. **Code Reading from Old Fields**
- [backend/app/main.py#L206](backend/app/main.py#L206): Reading `subscription_tier` for billing verification
- [services/supabaseService.ts#L187](services/supabaseService.ts#L187): Reading `subscription_tier` from profiles
- [services/billingService.ts#L74-75](services/billingService.ts#L74-75): Reading `subscription` object structure

---

## MIGRATION STRATEGY

### Phase 1: Update Reads
Convert all reads to use the `subscriptions` table:
- `user.get("subscription_tier")` → Query `subscriptions` table
- `company.subscription?.tier` → Query `subscriptions` table  
- `data.subscription_tier` → Use `subscriptions` table value

### Phase 2: Disable Dual Writes
Comment/remove writes to old fields in webhook handlers:
- [backend/app/main.py#L976](backend/app/main.py#L976)
- [backend/app/main.py#L982](backend/app/main.py#L982)
- [backend/app/main.py#L1016](backend/app/main.py#L1016)

### Phase 3: Database Cleanup
After 2-3 weeks of monitoring:
1. Run [database/cleanup_subscription_json.sql](database/cleanup_subscription_json.sql)
2. Drop `profiles.subscription_tier`
3. Drop `companies.subscription`
4. Drop `companies.subscription_tier`

---

## DEPENDENCY TREE

**High Priority (Used for Access Control)**:
- [backend/app/main.py#L206](backend/app/main.py#L206) - Billing verification
- [backend/app/main.py#L745](backend/app/main.py#L745) - Subscription status check
- [backend/app/main.py#L841](backend/app/main.py#L841) - Feature access verification

**Medium Priority (UI Display)**:
- [components/AssessmentCreator.tsx#L28-29](components/AssessmentCreator.tsx#L28-29) - Usage limits
- [components/CompanyDashboard.tsx#L147](components/CompanyDashboard.tsx#L147) - Dashboard display
- [services/billingService.ts#L74-75](services/billingService.ts#L74-75) - Feature checking

**Low Priority (Internal Data Mapping)**:
- [services/supabaseService.ts#L187](services/supabaseService.ts#L187) - Profile mapping
- [database/AUDIT_FIXES.sql#L191](database/AUDIT_FIXES.sql#L191) - COALESCE queries
