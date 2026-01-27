# ⚠️ CSRF Token Error - Quick Fix

## Problem
```
⚠️ Failed to store CSRF token in Supabase: 
{'message': "Could not find the table 'public.csrf_sessions'..."}
```

## Root Cause
The `csrf_sessions` table is **missing** from your Supabase database. This table was added to support multi-instance deployments where CSRF tokens need to be shared across multiple backend servers.

## Solution (2 minutes)

### Step 1: Go to Supabase
1. Open https://app.supabase.com
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

### Step 2: Run the Migration
1. Open file: `database/CSRF_SESSIONS_TABLE.sql`
2. Copy all the content
3. Paste into Supabase SQL Editor
4. Click **Run** ✅

That's it! The table is now created.

### Step 3: Verify (Optional)
Run this in Supabase SQL Editor to confirm:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'csrf_sessions';
```

You should see: `csrf_sessions` in the results.

---

## What Does This Table Do?

- **Stores CSRF tokens** securely in the database
- **Validates tokens** when users perform sensitive actions
- **Prevents CSRF attacks** (Cross-Site Request Forgery)
- **Works across multiple server instances** (Render.io scalability)

---

## Why Is This Important?

Without this table:
- ❌ CSRF tokens fail to store
- ❌ Gets logged as a warning, but still works (fallback to in-memory)
- ❌ Won't work if backend restarts (in-memory cache is lost)
- ❌ Won't work with multiple backend instances

With this table:
- ✅ CSRF tokens persist in database
- ✅ Any backend instance can validate them
- ✅ Survives server restarts
- ✅ Scales properly on Render.io

---

## If Still Not Working

### Check 1: Verify table exists
```sql
\dt csrf_sessions
```
Should show the table.

### Check 2: Check if RLS is blocking you
```sql
SELECT * FROM public.csrf_sessions LIMIT 1;
```
Should work (might return empty, that's OK).

### Check 3: Review logs
Look for this message in Render logs:
```
⚠️ WARNING: CSRF sessions table not found or not accessible
```

If you see this, table needs to be created.

---

## Next Steps

1. ✅ Create the table (step 2 above)
2. ✅ Restart backend: Go to Render dashboard → redeploy
3. ✅ Test: Make a request that generates CSRF token
4. ✅ Check logs: Should show `✅ CSRF token generated and stored in Supabase`

Done! 🎉
