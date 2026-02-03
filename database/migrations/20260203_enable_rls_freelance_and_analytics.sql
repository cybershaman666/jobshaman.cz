-- Migration: Enable RLS + policies for freelance marketplace & analytics
-- Created: 2026-02-03

-- Enable RLS on tables flagged by linter
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filter_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_filter_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- freelancer_profiles: public read, owners manage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'freelancer_profiles'
      AND policyname = 'Freelancer profiles are public'
  ) THEN
    CREATE POLICY "Freelancer profiles are public"
      ON public.freelancer_profiles
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'freelancer_profiles'
      AND policyname = 'Freelancers can manage own profile'
  ) THEN
    CREATE POLICY "Freelancers can manage own profile"
      ON public.freelancer_profiles
      FOR ALL
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END$$;

-- company_members: replace policies to avoid recursive checks
DROP POLICY IF EXISTS "Company members can view membership" ON public.company_members;
DROP POLICY IF EXISTS "Company owners can manage members" ON public.company_members;

CREATE POLICY "Company members can view membership"
  ON public.company_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can manage members"
  ON public.company_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

-- freelancer_services: public read for active, owners manage all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'freelancer_services'
      AND policyname = 'Public can view active services'
  ) THEN
    CREATE POLICY "Public can view active services"
      ON public.freelancer_services
      FOR SELECT
      USING (is_active = true OR freelancer_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'freelancer_services'
      AND policyname = 'Freelancers can manage own services'
  ) THEN
    CREATE POLICY "Freelancers can manage own services"
      ON public.freelancer_services
      FOR ALL
      USING (freelancer_id = auth.uid())
      WITH CHECK (freelancer_id = auth.uid());
  END IF;
END$$;

-- freelancer_portfolio_items: public read, owners manage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'freelancer_portfolio_items'
      AND policyname = 'Public can view portfolio items'
  ) THEN
    CREATE POLICY "Public can view portfolio items"
      ON public.freelancer_portfolio_items
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'freelancer_portfolio_items'
      AND policyname = 'Freelancers can manage own portfolio'
  ) THEN
    CREATE POLICY "Freelancers can manage own portfolio"
      ON public.freelancer_portfolio_items
      FOR ALL
      USING (freelancer_id = auth.uid())
      WITH CHECK (freelancer_id = auth.uid());
  END IF;
END$$;

-- freelancer_skills: public read, owners manage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'freelancer_skills'
      AND policyname = 'Public can view freelancer skills'
  ) THEN
    CREATE POLICY "Public can view freelancer skills"
      ON public.freelancer_skills
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'freelancer_skills'
      AND policyname = 'Freelancers can manage own skills'
  ) THEN
    CREATE POLICY "Freelancers can manage own skills"
      ON public.freelancer_skills
      FOR ALL
      USING (freelancer_id = auth.uid())
      WITH CHECK (freelancer_id = auth.uid());
  END IF;
END$$;

-- service_inquiries: allow insert for anyone, read for involved users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'service_inquiries'
      AND policyname = 'Anyone can create service inquiry'
  ) THEN
    CREATE POLICY "Anyone can create service inquiry"
      ON public.service_inquiries
      FOR INSERT
      WITH CHECK (from_user_id IS NULL OR from_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'service_inquiries'
      AND policyname = 'Users can view related inquiries'
  ) THEN
    CREATE POLICY "Users can view related inquiries"
      ON public.service_inquiries
      FOR SELECT
      USING (freelancer_id = auth.uid() OR from_user_id = auth.uid());
  END IF;
END$$;

-- job_interactions: user-only access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_interactions'
      AND policyname = 'Users can manage own job interactions'
  ) THEN
    CREATE POLICY "Users can manage own job interactions"
      ON public.job_interactions
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- filter_analytics: allow insert for anyone (including anon), restrict reads to existing admin policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'filter_analytics'
      AND policyname = 'Anyone can insert filter analytics'
  ) THEN
    CREATE POLICY "Anyone can insert filter analytics"
      ON public.filter_analytics
      FOR INSERT
      WITH CHECK (user_id IS NULL OR user_id = auth.uid());
  END IF;
END$$;

-- saved_filter_sets: users manage their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_filter_sets'
      AND policyname = 'Users can view own saved filters'
  ) THEN
    CREATE POLICY "Users can view own saved filters"
      ON public.saved_filter_sets
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_filter_sets'
      AND policyname = 'Users can insert own saved filters'
  ) THEN
    CREATE POLICY "Users can insert own saved filters"
      ON public.saved_filter_sets
      FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_filter_sets'
      AND policyname = 'Users can update own saved filters'
  ) THEN
    CREATE POLICY "Users can update own saved filters"
      ON public.saved_filter_sets
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_filter_sets'
      AND policyname = 'Users can delete own saved filters'
  ) THEN
    CREATE POLICY "Users can delete own saved filters"
      ON public.saved_filter_sets
      FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END$$;

-- analytics_events: allow insert for anyone (including anon)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analytics_events'
      AND policyname = 'Anyone can insert analytics events'
  ) THEN
    CREATE POLICY "Anyone can insert analytics events"
      ON public.analytics_events
      FOR INSERT
      WITH CHECK (user_id IS NULL OR user_id = auth.uid());
  END IF;
END$$;

-- Allow client inserts for analytics events
GRANT INSERT ON public.analytics_events TO anon, authenticated;
