-- ========================================
-- CLEANUP MIGRATION: Remove JSON subscription fields
-- ========================================
-- This migration removes legacy JSON subscription fields from companies table
-- after successful migration to the relational subscriptions structure

-- First, ensure all companies have proper subscription_id reference
UPDATE companies 
SET subscription_id = s.id 
FROM subscriptions s 
WHERE companies.id = s.company_id AND companies.subscription_id IS NULL;

-- Drop the JSON subscription column from companies table
ALTER TABLE companies DROP COLUMN IF EXISTS subscription;

-- Drop subscription_tier column from companies table (now redundant)
ALTER TABLE companies DROP COLUMN IF EXISTS subscription_tier;

-- Add NOT NULL constraint to subscription_id (all companies should have a subscription reference)
-- Note: Only run this if all companies should have subscriptions
-- ALTER TABLE companies ALTER COLUMN subscription_id SET NOT NULL;

-- Update foreign key constraint to ensure referential integrity
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_subscription_id_fkey;
ALTER TABLE companies ADD CONSTRAINT companies_subscription_id_fkey 
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_companies_subscription_id ON companies(subscription_id);

-- Grant necessary permissions for the updated table structure
GRANT SELECT, INSERT, UPDATE, DELETE ON companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON companies TO service_role;

-- Update RLS policies to work with new structure
DROP POLICY IF EXISTS "Users can view own company" ON companies;
DROP POLICY IF EXISTS "Users can update own company" ON companies;

CREATE POLICY "Users can view own company" ON companies
    FOR SELECT USING (auth.uid() IN (
        SELECT id FROM recruiter_profiles WHERE company_id = companies.id
    ));

CREATE POLICY "Users can update own company" ON companies
    FOR UPDATE USING (auth.uid() IN (
        SELECT id FROM recruiter_profiles WHERE company_id = companies.id
    ));

-- ========================================
-- VERIFICATION QUERIES (for manual verification)
-- ========================================

-- Verify no JSON subscription fields remain
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'companies' AND column_name LIKE '%subscription%';

-- Verify all companies have subscription references
-- SELECT c.id, c.name, c.subscription_id, s.tier, s.status 
-- FROM companies c LEFT JOIN subscriptions s ON c.subscription_id = s.id 
-- WHERE c.subscription_id IS NULL;

-- Check data integrity
-- SELECT COUNT(*) as companies_with_subscriptions FROM companies WHERE subscription_id IS NOT NULL;
-- SELECT COUNT(*) as total_subscriptions FROM subscriptions;

-- ========================================
-- CLEANUP COMPLETED
-- ========================================