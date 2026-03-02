CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.company_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  event_type text NOT NULL,
  subject_type text,
  subject_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_activity_log_company_created
  ON public.company_activity_log (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_company_activity_log_company_event
  ON public.company_activity_log (company_id, event_type, created_at DESC);
