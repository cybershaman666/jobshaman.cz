-- Keep search_exposures bounded to the newest 50k rows to control storage growth.
SET lock_timeout = '5s';
SET statement_timeout = '20min';
SET idle_in_transaction_session_timeout = '2min';

-- Optimize the retention query path.
CREATE INDEX IF NOT EXISTS idx_search_exposures_shown_at_id_desc
  ON public.search_exposures (shown_at DESC, id DESC);

-- Extend retention policy schema for row-cap driven cleanup.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'data_retention_policies'
  ) THEN
    EXECUTE 'ALTER TABLE public.data_retention_policies
      ADD COLUMN IF NOT EXISTS retain_rows integer';
  END IF;
END $$;

-- Upsert policy for search_exposures:
-- keep only the newest 50k records and do not rely on time-only retention.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'data_retention_policies'
  ) THEN
    UPDATE public.data_retention_policies
    SET retain_rows = 50000,
        is_enabled = true
    WHERE table_name = 'search_exposures';

    IF NOT FOUND THEN
      INSERT INTO public.data_retention_policies (table_name, retain_days, retain_rows, is_enabled)
      VALUES ('search_exposures', NULL, 50000, true);
    END IF;
  END IF;
END $$;

-- One-time immediate trim to newest 50k rows.
WITH ranked AS (
  SELECT id
  FROM public.search_exposures
  ORDER BY shown_at DESC, id DESC
  OFFSET 50000
)
DELETE FROM public.search_exposures se
USING ranked
WHERE se.id = ranked.id;
