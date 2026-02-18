-- Improve search relevance by favoring headline matches for short queries.
SET lock_timeout = '5s';
SET statement_timeout = '20min';
SET idle_in_transaction_session_timeout = '2min';

CREATE OR REPLACE FUNCTION public.search_jobs_v2(
    p_search_term text DEFAULT NULL,
    p_page integer DEFAULT 0,
    p_page_size integer DEFAULT 50,
    p_user_id uuid DEFAULT NULL,
    p_user_lat double precision DEFAULT NULL,
    p_user_lng double precision DEFAULT NULL,
    p_radius_km double precision DEFAULT NULL,
    p_filter_city text DEFAULT NULL,
    p_filter_contract_types text[] DEFAULT NULL,
    p_filter_benefits text[] DEFAULT NULL,
    p_filter_min_salary integer DEFAULT NULL,
    p_filter_date_posted text DEFAULT 'all',
    p_filter_experience_levels text[] DEFAULT NULL,
    p_filter_country_codes text[] DEFAULT NULL,
    p_exclude_country_codes text[] DEFAULT NULL,
    p_filter_language_codes text[] DEFAULT NULL,
    p_sort_mode text DEFAULT 'default'
)
RETURNS TABLE (
    id integer,
    title text,
    company text,
    location text,
    description text,
    benefits text[],
    contract_type text,
    salary_from integer,
    salary_to integer,
    currency text,
    salary_currency varchar,
    work_type text,
    work_model text,
    scraped_at timestamp,
    source text,
    education_level text,
    url text,
    lat double precision,
    lng double precision,
    country_code varchar,
    language_code varchar,
    legality_status text,
    verification_notes text,
    distance_km double precision,
    hybrid_score double precision,
    fts_score double precision,
    trigram_score double precision,
    profile_fit_score double precision,
    recency_score double precision,
    behavior_prior_score double precision,
    rank_position integer,
    total_count integer
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        GREATEST(0, COALESCE(p_page, 0)) AS page_num,
        GREATEST(1, LEAST(200, COALESCE(p_page_size, 50))) AS page_size,
        trim(COALESCE(p_search_term, '')) AS raw_query,
        NULLIF(trim(COALESCE(p_filter_city, '')), '') AS city,
        CASE
            WHEN trim(COALESCE(p_search_term, '')) = '' THEN NULL
            ELSE unaccent(lower(trim(p_search_term)))
        END AS normalized_query,
        CASE
            WHEN trim(COALESCE(p_search_term, '')) = '' THEN 0
            ELSE array_length(regexp_split_to_array(unaccent(lower(trim(p_search_term))), '\\s+'), 1)
        END AS query_terms,
        CASE
            WHEN trim(COALESCE(p_search_term, '')) = '' THEN 0
            ELSE length(unaccent(lower(trim(p_search_term))))
        END AS query_len,
        LOWER(COALESCE(p_sort_mode, 'default')) AS sort_mode,
        public.normalize_contract_filter_array(p_filter_contract_types) AS contract_filters,
        public.normalize_benefit_filter_array(p_filter_benefits) AS benefit_filters,
        CASE LOWER(COALESCE(p_filter_date_posted, 'all'))
            WHEN '24h' THEN interval '1 day'
            WHEN '3d' THEN interval '3 day'
            WHEN '7d' THEN interval '7 day'
            WHEN '14d' THEN interval '14 day'
            WHEN '30d' THEN interval '30 day'
            ELSE NULL
        END AS date_window
),
feedback_agg AS (
    SELECT
        sfe.job_id,
        SUM(
            CASE sfe.signal_type
                WHEN 'apply_click' THEN 1.0
                WHEN 'save' THEN 0.6
                WHEN 'open_detail' THEN 0.3
                WHEN 'unsave' THEN -0.2
                ELSE 0.0
            END
        ) AS weighted_signal
    FROM public.search_feedback_events sfe
    WHERE sfe.created_at >= now() - interval '90 day'
    GROUP BY sfe.job_id
),
filtered AS (
    SELECT
        j.*, p.normalized_query, p.sort_mode, p.query_terms, p.query_len,
        CASE
            WHEN p.normalized_query IS NULL THEN NULL
            ELSE plainto_tsquery('simple', p.normalized_query)
        END AS ts_query,
        CASE
            WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND j.lat IS NOT NULL AND j.lng IS NOT NULL
            THEN 6371.0 * acos(
                GREATEST(-1.0, LEAST(1.0,
                    cos(radians(p_user_lat)) * cos(radians(j.lat)) * cos(radians(j.lng - p_user_lng)) +
                    sin(radians(p_user_lat)) * sin(radians(j.lat))
                ))
            )
            ELSE NULL
        END AS distance_km,
        COALESCE(f.weighted_signal, 0.0) AS behavior_prior,
        unaccent(lower(concat_ws(' ', j.title, j.company, j.location, j.contract_type, j.work_model, j.job_level))) AS headline_plain,
        CASE
            WHEN p.normalized_query IS NULL THEN false
            ELSE (
                to_tsvector('simple', unaccent(concat_ws(' ', j.title, j.company, j.location, j.contract_type, j.work_model, j.job_level))) @@
                    plainto_tsquery('simple', p.normalized_query)
                OR (
                    p.query_len >= 3
                    AND unaccent(lower(concat_ws(' ', j.title, j.company, j.location, j.contract_type, j.work_model, j.job_level))) % p.normalized_query
                )
            )
        END AS headline_match
    FROM public.jobs j
    CROSS JOIN params p
    LEFT JOIN feedback_agg f ON f.job_id = j.id
    WHERE
        COALESCE(j.legality_status, 'legal') = 'legal'
        AND COALESCE(j.status, 'active') = 'active'
        AND (
            p.date_window IS NULL
            OR j.scraped_at >= (now() - p.date_window)
        )
        AND (
            p_filter_country_codes IS NULL OR cardinality(p_filter_country_codes) = 0
            OR lower(COALESCE(j.country_code, '')) = ANY (SELECT lower(x) FROM unnest(p_filter_country_codes) AS x)
        )
        AND (
            p_exclude_country_codes IS NULL OR cardinality(p_exclude_country_codes) = 0
            OR NOT (lower(COALESCE(j.country_code, '')) = ANY (SELECT lower(x) FROM unnest(p_exclude_country_codes) AS x))
        )
        AND (
            p_filter_language_codes IS NULL OR cardinality(p_filter_language_codes) = 0
            OR lower(COALESCE(j.language_code, '')) = ANY (SELECT lower(x) FROM unnest(p_filter_language_codes) AS x)
        )
        AND (
            p_filter_min_salary IS NULL OR COALESCE(j.salary_from, 0) >= p_filter_min_salary
        )
        AND (
            p_filter_contract_types IS NULL OR cardinality(p_filter_contract_types) = 0
            OR (
                p.contract_filters IS NOT NULL AND cardinality(p.contract_filters) > 0
                AND COALESCE(j.contract_type_norm, public.normalize_contract_type(j.contract_type), '{}'::text[]) && p.contract_filters
            )
            OR (
                (p.contract_filters IS NULL OR cardinality(p.contract_filters) = 0)
                AND lower(COALESCE(j.contract_type, '')) = ANY (SELECT lower(x) FROM unnest(p_filter_contract_types) AS x)
            )
        )
        AND (
            p.city IS NULL
            OR unaccent(lower(COALESCE(j.location, ''))) LIKE '%' || unaccent(lower(p.city)) || '%'
        )
        AND (
            p_filter_benefits IS NULL OR cardinality(p_filter_benefits) = 0
            OR (
                p.benefit_filters IS NOT NULL AND cardinality(p.benefit_filters) > 0
                AND COALESCE(j.benefits_norm, public.normalize_benefits_tags(j.benefits, j.description, j.title), '{}'::text[]) && p.benefit_filters
            )
            OR (
                (p.benefit_filters IS NULL OR cardinality(p.benefit_filters) = 0)
                AND NOT EXISTS (
                    SELECT 1
                    FROM unnest(p_filter_benefits) AS req
                    WHERE unaccent(lower(
                        COALESCE(array_to_string(j.benefits, ' '), '') || ' ' || COALESCE(j.description, '')
                    )) NOT LIKE '%' || unaccent(lower(req)) || '%'
                )
            )
        )
        AND (
            p_filter_experience_levels IS NULL OR cardinality(p_filter_experience_levels) = 0
            OR EXISTS (
                SELECT 1
                FROM unnest(p_filter_experience_levels) lvl
                WHERE
                    unaccent(lower(COALESCE(j.title, '') || ' ' || COALESCE(j.description, ''))) LIKE '%' || unaccent(lower(lvl)) || '%'
                    OR (lower(lvl) = 'medior' AND unaccent(lower(COALESCE(j.title, '') || ' ' || COALESCE(j.description, ''))) LIKE '%mid%')
                    OR (lower(lvl) = 'junior' AND unaccent(lower(COALESCE(j.title, '') || ' ' || COALESCE(j.description, ''))) LIKE '%jr%')
                    OR (lower(lvl) = 'senior' AND unaccent(lower(COALESCE(j.title, '') || ' ' || COALESCE(j.description, ''))) LIKE '%sr%')
            )
        )
),
stage_a AS (
    SELECT
        f.*,
        CASE
            WHEN f.normalized_query IS NULL OR f.ts_query IS NULL THEN 0.0
            ELSE ts_rank_cd(COALESCE(f.search_text, to_tsvector('simple', '')), f.ts_query)
        END AS fts_score,
        CASE
            WHEN f.normalized_query IS NULL THEN 0.0
            WHEN f.query_len < 3 THEN similarity(COALESCE(f.headline_plain, ''), f.normalized_query)
            ELSE similarity(COALESCE(f.search_text_plain, ''), f.normalized_query)
        END AS trigram_score,
        CASE
            WHEN f.headline_match THEN 1.0
            ELSE 0.0
        END AS headline_score
    FROM filtered f
    WHERE
        (
            f.normalized_query IS NULL
            OR (
                (
                    (f.ts_query IS NOT NULL AND COALESCE(f.search_text, to_tsvector('simple', '')) @@ f.ts_query)
                    OR (f.query_len >= 3 AND COALESCE(f.search_text_plain, '') % f.normalized_query)
                )
                AND (f.query_terms > 1 OR f.headline_match)
            )
        )
        AND (
            p_radius_km IS NULL
            OR (
                f.distance_km IS NOT NULL
                AND f.distance_km <= p_radius_km
            )
        )
    ORDER BY
        CASE
            WHEN f.normalized_query IS NULL THEN COALESCE(EXTRACT(EPOCH FROM f.scraped_at), 0)
            ELSE (0.65 * CASE WHEN f.ts_query IS NULL THEN 0.0 ELSE ts_rank_cd(COALESCE(f.search_text, to_tsvector('simple', '')), f.ts_query) END) +
                 (0.20 * CASE WHEN f.query_len < 3 THEN similarity(COALESCE(f.headline_plain, ''), f.normalized_query) ELSE similarity(COALESCE(f.search_text_plain, ''), f.normalized_query) END) +
                 (0.15 * CASE WHEN f.headline_match THEN 1.0 ELSE 0.0 END)
        END DESC,
        f.id DESC
    LIMIT 2000
),
scored AS (
    SELECT
        a.*,
        LEAST(1.0, GREATEST(0.0, 1.0 - (GREATEST(EXTRACT(EPOCH FROM (now() - COALESCE(a.scraped_at, now()))), 0) / 86400.0) / 30.0)) AS recency_score,
        LEAST(1.0, GREATEST(0.0,
            (0.5 * CASE
                WHEN a.distance_km IS NULL THEN 0.5
                WHEN p_radius_km IS NULL OR p_radius_km <= 0 THEN GREATEST(0.0, 1.0 - (a.distance_km / 120.0))
                ELSE GREATEST(0.0, 1.0 - (a.distance_km / p_radius_km))
            END)
            +
            (0.3 * CASE
                WHEN p_filter_min_salary IS NULL OR p_filter_min_salary <= 0 THEN 0.5
                WHEN COALESCE(a.salary_from, 0) >= p_filter_min_salary THEN 1.0
                ELSE 0.2
            END)
            +
            (0.2 * CASE
                WHEN p_filter_experience_levels IS NULL OR cardinality(p_filter_experience_levels) = 0 THEN 0.5
                WHEN EXISTS (
                    SELECT 1
                    FROM unnest(p_filter_experience_levels) lvl
                    WHERE unaccent(lower(COALESCE(a.title, '') || ' ' || COALESCE(a.description, ''))) LIKE '%' || unaccent(lower(lvl)) || '%'
                ) THEN 1.0
                ELSE 0.2
            END)
        )) AS profile_fit_score
    FROM stage_a a
),
ranked AS (
    SELECT
        s.*,
        LEAST(1.0, GREATEST(0.0, s.behavior_prior / 12.0)) AS behavior_prior_score,
        CASE
            WHEN (SELECT sort_mode FROM params) IN ('newest', 'jhi_desc', 'jhi_asc') THEN s.recency_score
            ELSE (0.50 * s.fts_score) + (0.20 * s.trigram_score) + (0.20 * s.recency_score) + (0.10 * s.headline_score)
        END AS hybrid_score
    FROM scored s
),
ranked_with_position AS (
    SELECT
        r.*,
        ROW_NUMBER() OVER (ORDER BY r.hybrid_score DESC, r.id DESC) AS rank_position
    FROM ranked r
),
final_rows AS (
    SELECT
        r.*, (SELECT COUNT(*) FROM ranked_with_position) AS total_count
    FROM ranked_with_position r
    ORDER BY r.rank_position
    OFFSET (SELECT page_num FROM params) * (SELECT page_size FROM params)
    LIMIT (SELECT page_size FROM params)
)
SELECT
    id,
    title,
    company,
    location,
    description,
    benefits,
    contract_type,
    salary_from,
    salary_to,
    currency,
    salary_currency,
    work_type,
    work_model,
    scraped_at,
    source,
    education_level,
    url,
    lat,
    lng,
    country_code,
    language_code,
    legality_status,
    verification_notes,
    distance_km,
    hybrid_score,
    fts_score,
    trigram_score,
    profile_fit_score,
    recency_score,
    behavior_prior_score,
    rank_position,
    total_count
FROM final_rows;
$$;
