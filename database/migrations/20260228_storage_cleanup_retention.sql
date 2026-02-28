-- Storage cleanup for Supabase 512 MB tier
-- Safe-first cleanup: removes old volatile/log/analytics/session data.
-- Does NOT delete core product entities (profiles, companies, active jobs, applications, assessments).

-- 1) CSRF/session garbage (short-lived by design)
DELETE FROM public.csrf_sessions
WHERE expires_at < now() - interval '7 days'
   OR created_at < now() - interval '30 days';

-- 2) High-volume interaction logs
DELETE FROM public.job_interactions
WHERE created_at < now() - interval '120 days';

-- 3) Analytics/event logs
DELETE FROM public.analytics_events
WHERE created_at < now() - interval '90 days';

DELETE FROM public.filter_analytics
WHERE created_at < now() - interval '60 days';

DELETE FROM public.premium_access_logs
WHERE timestamp < now() - interval '90 days';

-- 4) AB testing history (retain only recent window)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ab_test_conversions'
  ) THEN
    -- handle both possible timestamp column names across environments
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ab_test_conversions'
        AND column_name = 'converted_at'
    ) THEN
      DELETE FROM public.ab_test_conversions
      WHERE converted_at < now() - interval '90 days';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ab_test_conversions'
        AND column_name = 'created_at'
    ) THEN
      DELETE FROM public.ab_test_conversions
      WHERE created_at < now() - interval '90 days';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ab_test_assignments'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ab_test_assignments'
        AND column_name = 'assigned_at'
    ) THEN
      DELETE FROM public.ab_test_assignments
      WHERE assigned_at < now() - interval '90 days';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ab_test_assignments'
        AND column_name = 'created_at'
    ) THEN
      DELETE FROM public.ab_test_assignments
      WHERE created_at < now() - interval '90 days';
    END IF;
  END IF;
END $$;

-- 5) Processed webhook history
DELETE FROM public.webhook_events
WHERE processed_at < now() - interval '90 days';

-- 6) Geocoding cache retention (keeps recent cache warm)
DELETE FROM public.geocode_cache
WHERE created_at < now() - interval '180 days';

-- 7) Old soft-inactive jobs (keeps active feed intact)
DELETE FROM public.jobs
WHERE is_active = false
  AND (
    (updated_at IS NOT NULL AND updated_at < now() - interval '120 days')
    OR (updated_at IS NULL AND created_at < now() - interval '120 days')
  );

-- Refresh planner stats after mass deletes
ANALYZE public.csrf_sessions;
ANALYZE public.job_interactions;
ANALYZE public.analytics_events;
ANALYZE public.filter_analytics;
ANALYZE public.premium_access_logs;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ab_test_assignments') THEN
    EXECUTE 'ANALYZE public.ab_test_assignments';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ab_test_conversions') THEN
    EXECUTE 'ANALYZE public.ab_test_conversions';
  END IF;
END $$;
ANALYZE public.webhook_events;
ANALYZE public.geocode_cache;
ANALYZE public.jobs;
