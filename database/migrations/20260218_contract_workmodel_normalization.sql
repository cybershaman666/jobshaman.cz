-- Normalize contract/work model metadata across languages for server-side filters.
SET lock_timeout = '5s';
SET statement_timeout = '20min';
SET idle_in_transaction_session_timeout = '2min';

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS contract_type_norm text[],
    ADD COLUMN IF NOT EXISTS work_model_norm text[];

CREATE OR REPLACE FUNCTION public.normalize_contract_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT trim(regexp_replace(unaccent(lower(coalesce(p_text, ''))), '[^a-z0-9]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.normalize_contract_type(p_contract_type text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v text := ' ' || public.normalize_contract_text(p_contract_type) || ' ';
    out text[] := '{}'::text[];
BEGIN
    IF trim(v) = '' THEN
        RETURN out;
    END IF;

    -- IČO / OSVČ / B2B / Self-employed
    IF v ~ '(^| )(ico|osvc|szco|b2b|freelanc[a-z]*|contractor|self employed|selfemployed|dzialalnosc|gospodarcza)( |$)'
        OR v LIKE '%zivnost%'
        OR v LIKE '%zivnostensk%'
        OR v LIKE '%freiberuf%'
        OR v LIKE '%gewerbe%'
        OR v LIKE '%selbst%'
    THEN
        out := array_append(out, 'ico');
    END IF;

    -- HPP / Full-time
    IF v ~ '(^| )(hpp|plny uvazek|plny pracovn[a-z]*|pracovni pomer|pracovny pomer|pracovn[a-z]* smlouv[a-z]*|pracovn[a-z]* zmluv[a-z]*|full time|fulltime|vollzeit|umowa o prace|pelny etat|festanstell[a-z]*|arbeitsvertrag|employment contract|contract of employment)( |$)' THEN
        out := array_append(out, 'hpp');
    END IF;

    -- Part-time / zkrácený úvazek
    IF v ~ '(^| )(part time|parttime|teilzeit|zkracen[a-z]*|skracen[a-z]*|castecn[a-z]*|skrat[a-z]*|polovicn[a-z]*|kratk[a-z]* uvazek|niepelny etat|czesc etatu)( |$)' THEN
        out := array_append(out, 'part_time');
    END IF;

    -- Brigáda / dohoda / temporary
    IF v ~ '(^| )(brigad[a-z]*|dpp|dpc|dohod[a-z]*|minijob|aushilfe|umowa zlecenie|umowa o dzielo|temporary|temp|seasonal|casual)( |$)' THEN
        out := array_append(out, 'brigada');
    END IF;

    -- Internship / trainee
    IF v ~ '(^| )(intern|staz|praktik|trainee)( |$)' THEN
        out := array_append(out, 'internship');
    END IF;

    RETURN (SELECT ARRAY(SELECT DISTINCT x FROM unnest(out) x));
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_contract_filter_array(p_filters text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(
        ARRAY(
            SELECT DISTINCT token
            FROM unnest(coalesce(p_filters, '{}'::text[])) f
            CROSS JOIN LATERAL unnest(public.normalize_contract_type(f)) token
            WHERE token IS NOT NULL AND token <> ''
        ),
        '{}'::text[]
    );
$$;

CREATE OR REPLACE FUNCTION public.normalize_work_model(
    p_work_model text,
    p_title text,
    p_description text,
    p_location text
) RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v text := ' ' || regexp_replace(unaccent(lower(concat_ws(' ', p_work_model, p_title, p_description, p_location))), '[^a-z0-9]+', ' ', 'g') || ' ';
BEGIN
    IF trim(v) = '' THEN
        RETURN '{}'::text[];
    END IF;

    -- Hybrid first
    IF v ~ '(^| )(hybrid|hybridni|kombinovan|kombinovana|castecne z domova|cast z domova|teilweise|czesciowo zdaln)( |$)' THEN
        RETURN ARRAY['hybrid'];
    END IF;

    -- Remote / Home-office
    IF v ~ '(^| )(remote|home office|homeoffice|work from home|prace z domova|praca z domu|z domova|na dalku|zdaln)( |$)' THEN
        RETURN ARRAY['remote'];
    END IF;

    -- On-site
    IF v ~ '(^| )(on site|onsite|in office|na miste|stacjonarn|vor ort|inhouse)( |$)' THEN
        RETURN ARRAY['on_site'];
    END IF;

    RETURN '{}'::text[];
END;
$$;

CREATE OR REPLACE FUNCTION public.jobs_search_text_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_text := public.build_jobs_search_text(
        NEW.title,
        NEW.company,
        NEW.location,
        NEW.description,
        NEW.benefits,
        NEW.contract_type,
        NEW.work_model,
        NEW.job_level
    );

    NEW.search_text_plain := public.build_jobs_search_plain(
        NEW.title,
        NEW.company,
        NEW.location,
        NEW.description,
        NEW.benefits,
        NEW.contract_type,
        NEW.work_model,
        NEW.job_level
    );

    NEW.contract_type_norm := public.normalize_contract_type(NEW.contract_type);
    NEW.work_model_norm := public.normalize_work_model(NEW.work_model, NEW.title, NEW.description, NEW.location);

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_jobs_norm_batch(p_batch_size integer DEFAULT 2000)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated integer := 0;
BEGIN
    UPDATE public.jobs j
    SET
        contract_type_norm = public.normalize_contract_type(j.contract_type),
        work_model_norm = public.normalize_work_model(j.work_model, j.title, j.description, j.location)
    WHERE j.ctid IN (
        SELECT ctid
        FROM public.jobs
        WHERE
            contract_type_norm IS DISTINCT FROM public.normalize_contract_type(contract_type)
            OR work_model_norm IS DISTINCT FROM public.normalize_work_model(work_model, title, description, location)
        LIMIT GREATEST(1, COALESCE(p_batch_size, 2000))
    );
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

-- Backfill + indexes should be executed manually in smaller batches to avoid timeouts:
-- SELECT public.backfill_jobs_norm_batch(2000);
-- (repeat until 0)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_contract_type_norm ON public.jobs USING GIN (contract_type_norm);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_work_model_norm ON public.jobs USING GIN (work_model_norm);

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
        LOWER(COALESCE(p_sort_mode, 'default')) AS sort_mode,
        public.normalize_contract_filter_array(p_filter_contract_types) AS contract_filters,
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
        j.*, p.normalized_query, p.sort_mode,
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
        COALESCE(f.weighted_signal, 0.0) AS behavior_prior
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
            OR NOT EXISTS (
                SELECT 1
                FROM unnest(p_filter_benefits) AS req
                WHERE unaccent(lower(COALESCE(array_to_string(j.benefits, ' '), ''))) NOT LIKE '%' || unaccent(lower(req)) || '%'
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
            ELSE similarity(COALESCE(f.search_text_plain, ''), f.normalized_query)
        END AS trigram_score
    FROM filtered f
    WHERE
        (
            f.normalized_query IS NULL
            OR (
                (f.ts_query IS NOT NULL AND COALESCE(f.search_text, to_tsvector('simple', '')) @@ f.ts_query)
                OR COALESCE(f.search_text_plain, '') % f.normalized_query
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
            ELSE (0.75 * CASE WHEN f.ts_query IS NULL THEN 0.0 ELSE ts_rank_cd(COALESCE(f.search_text, to_tsvector('simple', '')), f.ts_query) END) +
                 (0.25 * similarity(COALESCE(f.search_text_plain, ''), f.normalized_query))
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
            ELSE (0.55 * s.fts_score) + (0.25 * s.trigram_score) + (0.20 * s.recency_score)
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
