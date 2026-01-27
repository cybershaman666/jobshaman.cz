# Database Migrations

This directory contains SQL migration scripts to initialize and update the JobShaman Supabase database schema.

## Quick Setup

### 1. Access Supabase SQL Editor
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **SQL Editor** on the left sidebar
4. Click **New Query**

### 2. Run Migrations (in order)

Run these SQL files in the Supabase SQL Editor:

#### **REQUIRED** (Must run these first):
- **CSRF_SESSIONS_TABLE.sql** - CSRF token storage for security
  - Run this FIRST before deploying backend
  - Needed for multi-instance CSRF token validation

#### **RECOMMENDED** (Run if you're using these features):
- **CRITICAL_FIXES_PHASE1.sql** - Payment webhook tracking and premium access logs
  - Required if using Stripe payments
  - Required if you need premium feature audit logs

- **ASSESSMENT_INVITATIONS.sql** - Assessment system tables
  - Required if using the assessment center feature
  - Allows companies to invite candidates to assessments

#### **OPTIONAL**:
- **POSTGIS_MINIMAL_FINAL.sql** - Spatial search functions
  - Only needed if you want location-based job search
  - Requires PostGIS extension to be enabled in Supabase

## File Descriptions

### CSRF_SESSIONS_TABLE.sql
**Purpose**: Store CSRF tokens in database for multi-instance deployments

**What it creates**:
- `public.csrf_sessions` table - Stores CSRF tokens with expiration
- Indexes for fast lookups by token, user_id, and expiration
- Row-level security policies for access control

**Why it's needed**:
- When the backend runs on multiple Render instances, in-memory CSRF storage doesn't work
- CSRF tokens must be stored in a shared database so any instance can validate them
- Prevents "CSRF token missing or invalid" errors

**Error you'll see if missing**:
```
⚠️ Failed to store CSRF token in Supabase: {'message': "Could not find the table 'public.csrf_sessions'..."}
```

### CRITICAL_FIXES_PHASE1.sql
**Purpose**: Track payment webhooks and premium feature access

**What it creates**:
- `webhook_events` table - Prevents duplicate webhook processing (idempotency)
- `premium_access_logs` table - Audit trail of premium feature usage
- `subscriptions` table - Subscription status tracking

**Why it's needed**:
- Ensures Stripe webhooks are processed only once (prevents duplicate charges)
- Tracks which users access premium features and when
- Maintains subscription state in database

### ASSESSMENT_INVITATIONS.sql
**Purpose**: Assessment center system for company-candidate interactions

**What it creates**:
- `assessment_invitations` table - Companies send invitations to candidates
- `assessment_results` table - Stores assessment answers and scoring
- Row-level security policies

**Why it's needed**:
- Allows companies (Business plan) to create assessment invitations
- Lets candidates take assessments after receiving invitations
- Tracks assessment results for evaluation

## How to Run

### Method 1: Copy-Paste (Easiest)
1. Open migration SQL file in your text editor
2. Copy all the content (Ctrl+A, Ctrl+C)
3. Go to Supabase SQL Editor
4. Paste into the query box (Ctrl+V)
5. Click **Run** button

### Method 2: CLI (For automation)
If you have Supabase CLI installed:
```bash
supabase db push --file-path database/CSRF_SESSIONS_TABLE.sql
```

## Verification

After running each migration, verify it worked:

### Check CSRF Sessions Table
```sql
SELECT * FROM public.csrf_sessions LIMIT 1;
```

### Check Webhook Events Table
```sql
SELECT * FROM webhook_events LIMIT 1;
```

### Check Subscriptions Table
```sql
SELECT * FROM subscriptions LIMIT 1;
```

### List All Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

## Troubleshooting

### "Could not find the table" error
- Run the corresponding SQL migration for that table
- Check that the migration ran successfully (no error messages)

### "Permission denied" error
- Ensure you're using a Supabase role with create/alter privileges
- By default, the anon key has limited permissions
- Use service_role key if needed (for admin operations)

### "Column already exists" error
- The table or column has already been created
- This is safe to ignore - the `IF NOT EXISTS` clauses prevent duplicates

## Maintenance

### Clean up expired CSRF tokens
Run periodically (e.g., daily) to remove old tokens:
```sql
DELETE FROM public.csrf_sessions 
WHERE expires_at < now();
```

Or set up a PostgreSQL scheduled job:
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_csrf_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.csrf_sessions WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Run daily
SELECT cron.schedule('cleanup-csrf-tokens', '0 2 * * *', 
    'SELECT cleanup_expired_csrf_tokens()');
```

## Next Steps

1. ✅ Run **CSRF_SESSIONS_TABLE.sql** 
2. ✅ Verify table was created
3. ✅ Deploy backend to Render
4. ✅ Test CSRF token generation (should work without warnings)

For more info, see [backend/DEPLOYMENT.md](../DEPLOYMENT.md)
