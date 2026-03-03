SET lock_timeout = '5s';
SET statement_timeout = '5min';

CREATE TABLE IF NOT EXISTS public.application_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  company_id uuid NULL,
  candidate_id uuid NULL,
  sender_user_id uuid NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('candidate', 'recruiter')),
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  read_by_candidate_at timestamptz NULL,
  read_by_company_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_application_messages_application_created
  ON public.application_messages (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_messages_company
  ON public.application_messages (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_messages_candidate
  ON public.application_messages (candidate_id, created_at DESC);
