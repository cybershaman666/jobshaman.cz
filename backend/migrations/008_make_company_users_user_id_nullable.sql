-- Migration: Make user_id nullable in company_users to support team invitations
-- Date: 2026-05-17

ALTER TABLE company_users ALTER COLUMN user_id DROP NOT NULL;
