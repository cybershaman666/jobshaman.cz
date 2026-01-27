-- FIX: Infinite Recursion in company_members Policy
-- The error "infinite recursion detected in policy for relation company_members"
-- occurs when a policy on company_members references itself directly or indirectly

-- TEMPORARY FIX: Disable RLS on company_members to allow scraper to save jobs
-- PERMANENT FIX: Review and rewrite the policies to avoid circular dependencies

-- Step 1: Check current policies on company_members
-- SELECT * FROM pg_policies WHERE tablename = 'company_members';

-- Step 2: Disable RLS on company_members table (temporary fix)
-- This allows the scraper to save jobs without hitting the policy recursion
ALTER TABLE IF EXISTS company_members DISABLE ROW LEVEL SECURITY;

-- Step 3: Re-enable with safer policies (comment out until we verify the structure)
-- ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
-- 
-- -- Remove all existing policies to start fresh
-- DROP POLICY IF EXISTS "company_members_insert_policy" ON company_members;
-- DROP POLICY IF EXISTS "company_members_select_policy" ON company_members;
-- DROP POLICY IF EXISTS "company_members_update_policy" ON company_members;
-- DROP POLICY IF EXISTS "company_members_delete_policy" ON company_members;
--
-- -- Create simple non-recursive policies
-- CREATE POLICY "company_members_select_policy" ON company_members
--     FOR SELECT
--     USING (true);  -- Allow all selects for now
--
-- CREATE POLICY "company_members_insert_policy" ON company_members
--     FOR INSERT
--     WITH CHECK (true);  -- Allow all inserts for now
--
-- CREATE POLICY "company_members_update_policy" ON company_members
--     FOR UPDATE
--     USING (true)
--     WITH CHECK (true);
--
-- CREATE POLICY "company_members_delete_policy" ON company_members
--     FOR DELETE
--     USING (true);

-- PERMANENT SOLUTION:
-- The recursion typically happens when:
-- 1. A policy on company_members references the jobs table
-- 2. Which has a foreign key or policy referencing company_members
-- 3. Creating a circular dependency
--
-- To fix permanently:
-- 1. Check the EXACT policy definition in Supabase UI
-- 2. Replace recursive checks with direct user ID comparisons
-- 3. Use auth.uid() instead of subqueries on other tables
-- 4. Test with the scraper before re-enabling full RLS
