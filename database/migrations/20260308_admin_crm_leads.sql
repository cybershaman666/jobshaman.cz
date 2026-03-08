CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text,
  contact_role text,
  email text,
  phone text,
  website text,
  country text,
  city text,
  status text NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'medium',
  source text NOT NULL DEFAULT 'manual',
  notes text,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  linked_company_id uuid REFERENCES public.companies(id),
  owner_admin_user_id uuid,
  owner_admin_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_crm_leads_status_updated
  ON public.admin_crm_leads (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_crm_leads_company_name
  ON public.admin_crm_leads (company_name);

CREATE INDEX IF NOT EXISTS idx_admin_crm_leads_email
  ON public.admin_crm_leads (email);

CREATE INDEX IF NOT EXISTS idx_admin_crm_leads_owner
  ON public.admin_crm_leads (owner_admin_user_id, updated_at DESC);

ALTER TABLE IF EXISTS public.admin_crm_leads ENABLE ROW LEVEL SECURITY;
