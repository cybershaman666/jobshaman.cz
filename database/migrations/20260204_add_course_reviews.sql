-- Migration: add course reviews and stats
-- Created: 2026-02-04

CREATE TABLE IF NOT EXISTS public.course_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id text NOT NULL,
  reviewer_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  is_verified_graduate boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT course_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT course_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_reviews_course_id ON public.course_reviews (course_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_created_at ON public.course_reviews (created_at DESC);

CREATE OR REPLACE VIEW public.course_review_stats AS
SELECT
  course_id,
  ROUND(AVG(rating)::numeric, 2) AS avg_rating,
  COUNT(*)::int AS reviews_count
FROM public.course_reviews
GROUP BY course_id;

ALTER TABLE IF EXISTS public.course_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'course_reviews' AND policyname = 'course_reviews_select_public'
  ) THEN
    CREATE POLICY course_reviews_select_public
      ON public.course_reviews
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'course_reviews' AND policyname = 'course_reviews_insert_own'
  ) THEN
    CREATE POLICY course_reviews_insert_own
      ON public.course_reviews
      FOR INSERT
      WITH CHECK (reviewer_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'course_reviews' AND policyname = 'course_reviews_update_own'
  ) THEN
    CREATE POLICY course_reviews_update_own
      ON public.course_reviews
      FOR UPDATE
      USING (reviewer_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'course_reviews' AND policyname = 'course_reviews_delete_own'
  ) THEN
    CREATE POLICY course_reviews_delete_own
      ON public.course_reviews
      FOR DELETE
      USING (reviewer_id = auth.uid());
  END IF;
END $$;

-- End of migration
