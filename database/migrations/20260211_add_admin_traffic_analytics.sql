-- Admin traffic analytics helpers
-- Adds index + secure RPC for aggregated page-view stats

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created_at
  ON public.analytics_events (event_type, created_at DESC);

DROP FUNCTION IF EXISTS public.get_admin_traffic_stats(integer);

CREATE OR REPLACE FUNCTION public.get_admin_traffic_stats(top_limit integer DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Allow only service role (backend) to call this function
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH base_30 AS (
    SELECT *
    FROM public.analytics_events
    WHERE event_type = 'page_view'
      AND created_at >= now() - interval '30 days'
  ),
  base_7 AS (
    SELECT *
    FROM base_30
    WHERE created_at >= now() - interval '7 days'
  ),
  sessions_30 AS (
    SELECT
      metadata->>'session_id' AS session_id,
      COUNT(*)::bigint AS views
    FROM base_30
    WHERE metadata ? 'session_id'
    GROUP BY 1
  ),
  sessions_7 AS (
    SELECT
      metadata->>'session_id' AS session_id,
      COUNT(*)::bigint AS views
    FROM base_7
    WHERE metadata ? 'session_id'
    GROUP BY 1
  ),
  totals_30 AS (
    SELECT
      COUNT(*)::bigint AS pageviews,
      COUNT(DISTINCT COALESCE(metadata->>'visitor_id', user_id::text, metadata->>'session_id'))::bigint AS unique_visitors,
      COUNT(DISTINCT metadata->>'session_id')::bigint AS sessions,
      COALESCE(
        ROUND(
          CASE WHEN COUNT(DISTINCT metadata->>'session_id') > 0
            THEN COUNT(*)::numeric / COUNT(DISTINCT metadata->>'session_id')
            ELSE 0
          END,
          2
        ),
        0
      ) AS pages_per_session,
      COALESCE(
        ROUND(
          CASE WHEN (SELECT COUNT(*) FROM sessions_30) > 0
            THEN 100.0 * (SELECT COUNT(*) FROM sessions_30 WHERE views = 1)::numeric / (SELECT COUNT(*) FROM sessions_30)
            ELSE 0
          END,
          2
        ),
        0
      ) AS bounce_rate
    FROM base_30
  ),
  totals_7 AS (
    SELECT
      COUNT(*)::bigint AS pageviews,
      COUNT(DISTINCT COALESCE(metadata->>'visitor_id', user_id::text, metadata->>'session_id'))::bigint AS unique_visitors,
      COUNT(DISTINCT metadata->>'session_id')::bigint AS sessions,
      COALESCE(
        ROUND(
          CASE WHEN COUNT(DISTINCT metadata->>'session_id') > 0
            THEN COUNT(*)::numeric / COUNT(DISTINCT metadata->>'session_id')
            ELSE 0
          END,
          2
        ),
        0
      ) AS pages_per_session,
      COALESCE(
        ROUND(
          CASE WHEN (SELECT COUNT(*) FROM sessions_7) > 0
            THEN 100.0 * (SELECT COUNT(*) FROM sessions_7 WHERE views = 1)::numeric / (SELECT COUNT(*) FROM sessions_7)
            ELSE 0
          END,
          2
        ),
        0
      ) AS bounce_rate
    FROM base_7
  ),
  top_pages AS (
    SELECT
      COALESCE(NULLIF(metadata->>'path', ''), '/') AS path,
      COUNT(*)::bigint AS pageviews
    FROM base_30
    GROUP BY 1
    ORDER BY pageviews DESC
    LIMIT top_limit
  ),
  top_referrers AS (
    SELECT
      COALESCE(NULLIF(metadata->>'referrer_domain', ''), '(direct)') AS referrer,
      COUNT(DISTINCT metadata->>'session_id')::bigint AS sessions
    FROM base_30
    GROUP BY 1
    ORDER BY sessions DESC
    LIMIT top_limit
  ),
  daily AS (
    SELECT
      date_trunc('day', created_at) AS day,
      COUNT(*)::bigint AS pageviews,
      COUNT(DISTINCT COALESCE(metadata->>'visitor_id', user_id::text, metadata->>'session_id'))::bigint AS unique_visitors,
      COUNT(DISTINCT metadata->>'session_id')::bigint AS sessions
    FROM base_30
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'period_days', 30,
    'totals_30', (SELECT to_jsonb(totals_30) FROM totals_30),
    'totals_7', (SELECT to_jsonb(totals_7) FROM totals_7),
    'top_pages', COALESCE((SELECT jsonb_agg(to_jsonb(top_pages)) FROM top_pages), '[]'::jsonb),
    'top_referrers', COALESCE((SELECT jsonb_agg(to_jsonb(top_referrers)) FROM top_referrers), '[]'::jsonb),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(daily)) FROM daily), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_traffic_stats(integer) FROM PUBLIC;
