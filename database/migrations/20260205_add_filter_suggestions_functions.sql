-- Popular filter suggestions (global + per-user)

DROP FUNCTION IF EXISTS public.get_popular_filter_combinations(integer);
DROP FUNCTION IF EXISTS public.get_user_popular_filter_combinations(integer);

CREATE OR REPLACE FUNCTION public.get_popular_filter_combinations(limit_count integer DEFAULT 5)
RETURNS TABLE (
  combination_key text,
  usage_count bigint,
  avg_results numeric,
  filters jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent AS (
    SELECT *
    FROM public.filter_analytics
    WHERE created_at >= now() - interval '30 days'
      AND (
        filter_city IS NOT NULL
        OR filter_contract_types IS NOT NULL
        OR filter_benefits IS NOT NULL
        OR filter_min_salary IS NOT NULL
      )
  ),
  aggregated AS (
    SELECT
      COALESCE(filter_city, '') || '|' ||
      COALESCE(array_to_string(filter_contract_types, ','), '') || '|' ||
      COALESCE(array_to_string(filter_benefits, ','), '') || '|' ||
      COALESCE(filter_min_salary::text, '') AS combination_key,
      COUNT(*)::bigint AS usage_count,
      AVG(result_count)::numeric AS avg_results,
      filter_city,
      filter_contract_types,
      filter_benefits,
      filter_min_salary
    FROM recent
    GROUP BY filter_city, filter_contract_types, filter_benefits, filter_min_salary
  )
  SELECT
    combination_key,
    usage_count,
    avg_results,
    jsonb_build_object(
      'filterCity', filter_city,
      'filterContractTypes', filter_contract_types,
      'filterBenefits', filter_benefits,
      'filterMinSalary', filter_min_salary
    ) AS filters
  FROM aggregated
  ORDER BY usage_count DESC, avg_results DESC NULLS LAST
  LIMIT limit_count;
$$;

CREATE OR REPLACE FUNCTION public.get_user_popular_filter_combinations(limit_count integer DEFAULT 5)
RETURNS TABLE (
  combination_key text,
  usage_count bigint,
  avg_results numeric,
  filters jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent AS (
    SELECT *
    FROM public.filter_analytics
    WHERE user_id = auth.uid()
      AND created_at >= now() - interval '30 days'
      AND (
        filter_city IS NOT NULL
        OR filter_contract_types IS NOT NULL
        OR filter_benefits IS NOT NULL
        OR filter_min_salary IS NOT NULL
      )
  ),
  aggregated AS (
    SELECT
      COALESCE(filter_city, '') || '|' ||
      COALESCE(array_to_string(filter_contract_types, ','), '') || '|' ||
      COALESCE(array_to_string(filter_benefits, ','), '') || '|' ||
      COALESCE(filter_min_salary::text, '') AS combination_key,
      COUNT(*)::bigint AS usage_count,
      AVG(result_count)::numeric AS avg_results,
      filter_city,
      filter_contract_types,
      filter_benefits,
      filter_min_salary
    FROM recent
    GROUP BY filter_city, filter_contract_types, filter_benefits, filter_min_salary
  )
  SELECT
    combination_key,
    usage_count,
    avg_results,
    jsonb_build_object(
      'filterCity', filter_city,
      'filterContractTypes', filter_contract_types,
      'filterBenefits', filter_benefits,
      'filterMinSalary', filter_min_salary
    ) AS filters
  FROM aggregated
  ORDER BY usage_count DESC, avg_results DESC NULLS LAST
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_popular_filter_combinations(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_popular_filter_combinations(integer) TO anon, authenticated;
