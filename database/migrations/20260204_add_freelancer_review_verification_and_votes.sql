-- Migration: add freelancer review verification + votes
-- Created: 2026-02-04

ALTER TABLE IF EXISTS public.freelancer_reviews
  ADD COLUMN IF NOT EXISTS is_verified_customer boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.freelancer_review_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL,
  voter_id uuid NOT NULL,
  is_helpful boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT freelancer_review_votes_pkey PRIMARY KEY (id),
  CONSTRAINT freelancer_review_votes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.freelancer_reviews(id) ON DELETE CASCADE,
  CONSTRAINT freelancer_review_votes_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT freelancer_review_votes_unique UNIQUE (review_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_freelancer_review_votes_review_id ON public.freelancer_review_votes (review_id);

CREATE OR REPLACE VIEW public.freelancer_review_vote_stats AS
SELECT
  review_id,
  COUNT(*) FILTER (WHERE is_helpful) AS helpful_count,
  COUNT(*) FILTER (WHERE NOT is_helpful) AS unhelpful_count
FROM public.freelancer_review_votes
GROUP BY review_id;

ALTER TABLE IF EXISTS public.freelancer_review_votes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'freelancer_review_votes' AND policyname = 'freelancer_review_votes_select_public'
  ) THEN
    CREATE POLICY freelancer_review_votes_select_public
      ON public.freelancer_review_votes
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'freelancer_review_votes' AND policyname = 'freelancer_review_votes_insert_own'
  ) THEN
    CREATE POLICY freelancer_review_votes_insert_own
      ON public.freelancer_review_votes
      FOR INSERT
      WITH CHECK (voter_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'freelancer_review_votes' AND policyname = 'freelancer_review_votes_update_own'
  ) THEN
    CREATE POLICY freelancer_review_votes_update_own
      ON public.freelancer_review_votes
      FOR UPDATE
      USING (voter_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'freelancer_review_votes' AND policyname = 'freelancer_review_votes_delete_own'
  ) THEN
    CREATE POLICY freelancer_review_votes_delete_own
      ON public.freelancer_review_votes
      FOR DELETE
      USING (voter_id = auth.uid());
  END IF;
END $$;

-- End of migration
