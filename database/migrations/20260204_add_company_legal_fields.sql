-- Migration: add legal address and registry info to companies
-- Created: 2026-02-04

ALTER TABLE IF EXISTS public.companies
  ADD COLUMN IF NOT EXISTS legal_address text,
  ADD COLUMN IF NOT EXISTS registry_info text;

-- End of migration
