-- Migration: Enable RLS + policies for course providers
-- Created: 2026-02-05

-- Enable RLS
ALTER TABLE public.marketplace_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;

-- marketplace_partners: public read, owners manage own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_partners'
      AND policyname = 'Marketplace partners are public'
  ) THEN
    CREATE POLICY "Marketplace partners are public"
      ON public.marketplace_partners
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_partners'
      AND policyname = 'Marketplace partners can manage own profile'
  ) THEN
    CREATE POLICY "Marketplace partners can manage own profile"
      ON public.marketplace_partners
      FOR ALL
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;
END$$;

-- learning_resources: public read for active, owners manage via partner_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'learning_resources'
      AND policyname = 'Learning resources public read'
  ) THEN
    CREATE POLICY "Learning resources public read"
      ON public.learning_resources
      FOR SELECT
      USING (
        status = 'active'
        OR EXISTS (
          SELECT 1
          FROM public.marketplace_partners mp
          WHERE mp.id = learning_resources.partner_id
            AND mp.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'learning_resources'
      AND policyname = 'Learning resources owner manage'
  ) THEN
    CREATE POLICY "Learning resources owner manage"
      ON public.learning_resources
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.marketplace_partners mp
          WHERE mp.id = learning_resources.partner_id
            AND mp.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.marketplace_partners mp
          WHERE mp.id = learning_resources.partner_id
            AND mp.owner_id = auth.uid()
        )
      );
  END IF;
END$$;
