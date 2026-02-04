-- Migration: ensure RLS policies for freelancer_portfolio_items
-- Created: 2026-02-04

ALTER TABLE IF EXISTS public.freelancer_portfolio_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freelancer_portfolio_items'
      AND policyname = 'freelancer_portfolio_select_public'
  ) THEN
    CREATE POLICY freelancer_portfolio_select_public
      ON public.freelancer_portfolio_items
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freelancer_portfolio_items'
      AND policyname = 'freelancer_portfolio_insert_own'
  ) THEN
    CREATE POLICY freelancer_portfolio_insert_own
      ON public.freelancer_portfolio_items
      FOR INSERT
      WITH CHECK (auth.uid() = freelancer_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freelancer_portfolio_items'
      AND policyname = 'freelancer_portfolio_update_own'
  ) THEN
    CREATE POLICY freelancer_portfolio_update_own
      ON public.freelancer_portfolio_items
      FOR UPDATE
      USING (auth.uid() = freelancer_id)
      WITH CHECK (auth.uid() = freelancer_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freelancer_portfolio_items'
      AND policyname = 'freelancer_portfolio_delete_own'
  ) THEN
    CREATE POLICY freelancer_portfolio_delete_own
      ON public.freelancer_portfolio_items
      FOR DELETE
      USING (auth.uid() = freelancer_id);
  END IF;
END $$;

-- End of migration
