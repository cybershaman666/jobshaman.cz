-- Migration: Add branding columns to companies
-- Date: 2026-04-11
-- Description: Adds brand identity columns for recruiter settings modernization

-- Add cover_url column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Add brand_color column (defaults to JobShaman blue)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#2563eb';

-- Add accent_color column (defaults to JobShaman light blue)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#0ea5e9';

-- Add comments for documentation
COMMENT ON COLUMN companies.cover_url IS 'URL of the company brand cover image';
COMMENT ON COLUMN companies.brand_color IS 'Primary brand color hex code';
COMMENT ON COLUMN companies.accent_color IS 'Accent brand color hex code';
