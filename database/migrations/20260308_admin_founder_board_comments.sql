CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_founder_board_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.admin_founder_board_cards(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_admin_user_id uuid,
  author_admin_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_founder_board_comments_card_created
  ON public.admin_founder_board_comments (card_id, created_at ASC);

ALTER TABLE IF EXISTS public.admin_founder_board_comments ENABLE ROW LEVEL SECURITY;
