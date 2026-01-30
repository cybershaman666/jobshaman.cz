-- Add contact fields to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS contact_email text,
    ADD COLUMN IF NOT EXISTS contact_phone text;
-- Add comment for documentation
COMMENT ON COLUMN public.companies.contact_email IS 'Primary contact email for the company (e.g. HR department)';
COMMENT ON COLUMN public.companies.contact_phone IS 'Primary contact phone number for the company';