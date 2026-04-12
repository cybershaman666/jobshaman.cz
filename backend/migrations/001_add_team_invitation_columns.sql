-- Migration: Add team invitation columns to company_members
-- Date: 2026-04-11
-- Description: Adds support for team invitation system with email-based invitations

-- Add invited_email column (stores the email of the invited person before they register)
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS invited_email TEXT;

-- Add invited_name column (stores the name of the invited person)
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS invited_name TEXT;

-- Add invitation token column (unique token for accepting the invitation)
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS invitation_token TEXT UNIQUE;

-- Add status column (tracks invitation lifecycle: invited -> accepted -> active)
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Create index for faster invitation lookups
CREATE INDEX IF NOT EXISTS idx_company_members_invitation_token ON company_members(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_members_invited_email ON company_members(company_id, invited_email) WHERE invited_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_members_status ON company_members(company_id, status) WHERE status IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN company_members.invited_email IS 'Email of the invited person (used before account registration)';
COMMENT ON COLUMN company_members.invited_name IS 'Name of the invited person';
COMMENT ON COLUMN company_members.invitation_token IS 'Unique token for accepting the team invitation';
COMMENT ON COLUMN company_members.status IS 'Invitation status: invited, accepted, active, expired, revoked';
