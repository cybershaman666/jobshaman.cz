-- Migration: add freelancer reviews and stats
-- Created: 2026-02-04

CREATE TABLE IF NOT EXISTS public.freelancer_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  service_id integer,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT freelancer_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT freelancer_reviews_freelancer_id_fkey FOREIGN KEY (freelancer_id) REFERENCES public.freelancer_profiles(id) ON DELETE CASCADE,
  CONSTRAINT freelancer_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT freelancer_reviews_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_freelancer_reviews_freelancer_id ON public.freelancer_reviews (freelancer_id);
CREATE INDEX IF NOT EXISTS idx_freelancer_reviews_created_at ON public.freelancer_reviews (created_at DESC);

CREATE OR REPLACE VIEW public.freelancer_review_stats AS
SELECT
  freelancer_id,
  ROUND(AVG(rating)::numeric, 2) AS avg_rating,
  COUNT(*)::int AS reviews_count
FROM public.freelancer_reviews
GROUP BY freelancer_id;

ALTER TABLE IF EXISTS public.freelancer_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'freelancer_reviews' AND policyname = 'freelancer_reviews_select_public'
  ) THEN
    CREATE POLICY freelancer_reviews_select_public
      ON public.freelancer_reviews
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'freelancer_reviews' AND policyname = 'freelancer_reviews_insert_own'
  ) THEN
    CREATE POLICY freelancer_reviews_insert_own
      ON public.freelancer_reviews
      FOR INSERT
      WITH CHECK (reviewer_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'freelancer_reviews' AND policyname = 'freelancer_reviews_update_own'
  ) THEN
    CREATE POLICY freelancer_reviews_update_own
      ON public.freelancer_reviews
      FOR UPDATE
      USING (reviewer_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'freelancer_reviews' AND policyname = 'freelancer_reviews_delete_own'
  ) THEN
    CREATE POLICY freelancer_reviews_delete_own
      ON public.freelancer_reviews
      FOR DELETE
      USING (reviewer_id = auth.uid());
  END IF;
END $$;

-- End of migration
