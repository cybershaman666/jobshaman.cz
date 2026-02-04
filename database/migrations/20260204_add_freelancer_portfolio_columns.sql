-- Migration: add portfolio columns used by app
-- Created: 2026-02-04

ALTER TABLE IF EXISTS public.freelancer_portfolio_items
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- End of migration
