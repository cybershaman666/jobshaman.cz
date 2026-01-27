## Debugging the "Infinite Recursion" Policy Error

### Error Details
```
infinite recursion detected in policy for relation "company_members"
Code: 42P17
```

This PostgreSQL error happens when a Row Level Security (RLS) policy creates a circular reference. For example:
- Policy A checks if user can access company_members by verifying if they're in jobs table
- Policy B on jobs checks if user can access jobs by verifying if they're in company_members
- Result: Infinite loop 🔄

### Step 1: Identify the Problem (Do this in Supabase)

1. Go to **Database → company_members table**
2. Click the **Lock icon** (RLS indicator)
3. View all active policies - **Note down the exact policy logic**
4. Look for any references to other tables like `jobs`, `companies`, etc.

### Step 2: Quick Temporary Fix (Immediate - 1 minute)

Run this in Supabase SQL Editor:

```sql
ALTER TABLE company_members DISABLE ROW LEVEL SECURITY;
```

✅ **Result**: Scraper can save jobs immediately
⚠️ **Side Effect**: company_members table is now publicly readable/writable (security risk)

Then test if scraper works:
```bash
python -m scraper.scraper_multi
```

### Step 3: Permanent Fix (Do after confirming scraper works)

Once scraper is working, identify the circular policy and replace it with a safer version.

**Example of WRONG policy** (causes recursion):
```sql
-- ❌ BAD - Creates circular dependency
CREATE POLICY "company_member_access" ON company_members
    FOR SELECT
    USING (
        -- This checks if user is a member of a company
        company_id IN (
            SELECT company_id FROM jobs  -- ← If jobs also checks company_members, RECURSION!
            WHERE created_by = auth.uid()
        )
    );
```

**Example of CORRECT policy** (avoids recursion):
```sql
-- ✅ GOOD - Direct user check, no cross-table references
CREATE POLICY "company_member_access" ON company_members
    FOR SELECT
    USING (
        -- Simple: user can only see members of their own company
        created_by = auth.uid()
        OR
        company_id IN (
            SELECT id FROM companies 
            WHERE created_by = auth.uid()  -- Only check companies, not jobs
        )
    );
```

### Step 4: Verify the Fix

After applying permanent fix, re-enable RLS:

```sql
-- First, remove problematic policies
DROP POLICY IF EXISTS "problematic_policy_name" ON company_members;

-- Then re-enable RLS with safer policies
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- Test if recursion is gone
SELECT * FROM company_members LIMIT 1;
```

### Step 5: Test Scraper Again

```bash
python -m scraper.scraper_multi
```

### Debugging Commands (Run in Supabase SQL Editor)

**1. Check which policies exist:**
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'company_members'
ORDER BY policyname;
```

**2. Check all policies across all tables:**
```sql
SELECT schemaname, tablename, policyname, permissive, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**3. View policy definition:**
```sql
SELECT pg_get_expr(pol.qual, pol.relid) as policy_definition
FROM pg_policy pol
WHERE pol.relname = 'company_members'
  AND pol.policyname = 'the_policy_name_here';
```

**4. Test if RLS is causing the issue:**
```sql
-- Temporarily disable RLS to see if error goes away
ALTER TABLE company_members DISABLE ROW LEVEL SECURITY;

-- Try the operation that was failing
INSERT INTO jobs (...) VALUES (...);

-- If it works, RLS policy is the problem
-- If it still fails, it's a different issue
```

### Common Causes of Infinite Recursion

1. **Mutual Foreign Key Checks**
   ```sql
   -- ❌ company_members policy checks jobs.company_id
   -- ❌ jobs policy checks company_members.user_id
   -- = RECURSION
   ```

2. **Nested Subqueries**
   ```sql
   -- ❌ Policy checks a subquery that includes the same table
   USING (id IN (SELECT ... FROM company_members))
   ```

3. **Role-Based Circular Dependencies**
   ```sql
   -- ❌ checking role that depends on table access
   -- which depends on role
   ```

### Quick Reference

| Issue | Fix | Time |
|-------|-----|------|
| Scraper can't save jobs | `ALTER TABLE company_members DISABLE ROW LEVEL SECURITY;` | 1 min |
| Need to find policy | Run debugging SQL queries above | 5 min |
| Policy is circular | Rewrite using direct user checks | 10-15 min |
| Verify it works | Run scraper again | 2 min |

---

**Next Steps:**
1. ✅ Run the temporary fix above
2. ✅ Confirm scraper can save jobs
3. ⏳ Check Supabase for the exact policy causing recursion
4. ⏳ Apply permanent fix with safer policy logic
