CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_founder_board_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  card_type text NOT NULL DEFAULT 'idea',
  status text NOT NULL DEFAULT 'inbox',
  priority text NOT NULL DEFAULT 'medium',
  assignee_name text,
  assignee_email text,
  author_admin_user_id uuid,
  author_admin_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_founder_board_status_updated
  ON public.admin_founder_board_cards (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_founder_board_type_updated
  ON public.admin_founder_board_cards (card_type, updated_at DESC);

ALTER TABLE IF EXISTS public.admin_founder_board_cards ENABLE ROW LEVEL SECURITY;
