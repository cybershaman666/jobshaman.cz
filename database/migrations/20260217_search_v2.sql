-- Search/Ranking V2 foundation: text indexing, analytics tables, and RPC search function.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS status text,
    ADD COLUMN IF NOT EXISTS search_text tsvector,
    ADD COLUMN IF NOT EXISTS search_text_plain text;

ALTER TABLE public.jobs
    ALTER COLUMN status SET DEFAULT 'active';

UPDATE public.jobs
SET status = 'active'
WHERE status IS NULL;

CREATE OR REPLACE FUNCTION public.build_jobs_search_text(
    p_title text,
    p_company text,
    p_location text,
    p_description text,
    p_benefits text[],
    p_contract_type text,
    p_work_model text,
    p_job_level text
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT
        setweight(to_tsvector('simple', unaccent(coalesce(p_title, ''))), 'A') ||
        setweight(to_tsvector('simple', unaccent(coalesce(p_company, ''))), 'A') ||
        setweight(to_tsvector('simple', unaccent(coalesce(p_location, ''))), 'B') ||
        setweight(to_tsvector('simple', unaccent(coalesce(array_to_string(p_benefits, ' '), ''))), 'B') ||
        setweight(to_tsvector('simple', unaccent(coalesce(p_contract_type, ''))), 'C') ||
        setweight(to_tsvector('simple', unaccent(coalesce(p_work_model, ''))), 'C') ||
        setweight(to_tsvector('simple', unaccent(coalesce(p_job_level, ''))), 'C') ||
        setweight(to_tsvector('simple', unaccent(coalesce(p_description, ''))), 'D');
$$;

CREATE OR REPLACE FUNCTION public.build_jobs_search_plain(
    p_title text,
    p_company text,
    p_location text,
    p_description text,
    p_benefits text[],
    p_contract_type text,
    p_work_model text,
    p_job_level text
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT trim(
        unaccent(lower(concat_ws(' ',
            coalesce(p_title, ''),
            coalesce(p_company, ''),
            coalesce(p_location, ''),
            coalesce(p_description, ''),
            coalesce(array_to_string(p_benefits, ' '), ''),
            coalesce(p_contract_type, ''),
            coalesce(p_work_model, ''),
            coalesce(p_job_level, '')
        )))
    );
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

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_search_text_update ON public.jobs;
CREATE TRIGGER trg_jobs_search_text_update
BEFORE INSERT OR UPDATE OF title, company, location, description, benefits, contract_type, work_model, job_level
ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.jobs_search_text_trigger();

UPDATE public.jobs
SET
    search_text = public.build_jobs_search_text(title, company, location, description, benefits, contract_type, work_model, job_level),
    search_text_plain = public.build_jobs_search_plain(title, company, location, description, benefits, contract_type, work_model, job_level)
WHERE search_text IS NULL OR search_text_plain IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_search_text_gin ON public.jobs USING gin (search_text);
CREATE INDEX IF NOT EXISTS idx_jobs_search_text_plain_trgm ON public.jobs USING gin (search_text_plain gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_status_legality_scraped ON public.jobs (status, legality_status, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_country_language ON public.jobs (country_code, language_code);
CREATE INDEX IF NOT EXISTS idx_jobs_salary_from ON public.jobs (salary_from);
CREATE INDEX IF NOT EXISTS idx_jobs_contract_type ON public.jobs (contract_type);

CREATE TABLE IF NOT EXISTS public.search_exposures (
    id bigserial PRIMARY KEY,
    request_id uuid NOT NULL,
    user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    job_id integer NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    position integer NOT NULL,
    query text,
    filters_json jsonb DEFAULT '{}'::jsonb,
    ranking_features_json jsonb DEFAULT '{}'::jsonb,
    shown_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (request_id, job_id)
);

CREATE TABLE IF NOT EXISTS public.search_feedback_events (
    id bigserial PRIMARY KEY,
    request_id uuid,
    user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    job_id integer NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    signal_type text NOT NULL,
    signal_value double precision,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_exposures_shown_at ON public.search_exposures (shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_exposures_user_job ON public.search_exposures (user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_search_feedback_created_at ON public.search_feedback_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_feedback_user_job ON public.search_feedback_events (user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_search_feedback_request ON public.search_feedback_events (request_id);

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
        j.*,
        p.normalized_query,
        p.sort_mode,
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
            OR lower(COALESCE(j.contract_type, '')) = ANY (SELECT lower(x) FROM unnest(p_filter_contract_types) AS x)
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
    LIMIT 5000
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
                ELSE 0.3
            END)
        )) AS profile_fit_score,
        LEAST(1.0, GREATEST(0.0, (a.behavior_prior + 2.0) / 8.0)) AS behavior_prior_score
    FROM stage_a a
),
stage_b AS (
    SELECT
        s.*,
        CASE
            WHEN s.sort_mode = 'recommended' THEN
                (0.40 * s.fts_score) +
                (0.18 * s.trigram_score) +
                (0.17 * s.profile_fit_score) +
                (0.10 * s.recency_score) +
                (0.15 * s.behavior_prior_score)
            ELSE
                (0.45 * s.fts_score) +
                (0.20 * s.trigram_score) +
                (0.20 * s.profile_fit_score) +
                (0.10 * s.recency_score) +
                (0.05 * s.behavior_prior_score)
        END AS hybrid_score,
        CASE
            WHEN s.sort_mode = 'newest' THEN row_number() OVER (ORDER BY s.scraped_at DESC NULLS LAST, s.id DESC)
            WHEN s.sort_mode = 'jhi_desc' THEN row_number() OVER (ORDER BY COALESCE((s.salary_from + s.salary_to) / 2, s.salary_from, s.salary_to, 0) DESC, s.id DESC)
            WHEN s.sort_mode = 'jhi_asc' THEN row_number() OVER (ORDER BY COALESCE((s.salary_from + s.salary_to) / 2, s.salary_from, s.salary_to, 0) ASC, s.id DESC)
            ELSE row_number() OVER (
                ORDER BY
                    CASE
                        WHEN s.sort_mode = 'recommended' THEN
                            (0.40 * s.fts_score) +
                            (0.18 * s.trigram_score) +
                            (0.17 * s.profile_fit_score) +
                            (0.10 * s.recency_score) +
                            (0.15 * s.behavior_prior_score)
                        ELSE
                            (0.45 * s.fts_score) +
                            (0.20 * s.trigram_score) +
                            (0.20 * s.profile_fit_score) +
                            (0.10 * s.recency_score) +
                            (0.05 * s.behavior_prior_score)
                    END DESC,
                    s.id DESC
            )
        END AS rank_position,
        count(*) OVER () AS total_count
    FROM scored s
    ORDER BY
        CASE WHEN s.sort_mode = 'newest' THEN s.scraped_at END DESC NULLS LAST,
        CASE WHEN s.sort_mode = 'jhi_desc' THEN COALESCE((s.salary_from + s.salary_to) / 2, s.salary_from, s.salary_to, 0) END DESC NULLS LAST,
        CASE WHEN s.sort_mode = 'jhi_asc' THEN COALESCE((s.salary_from + s.salary_to) / 2, s.salary_from, s.salary_to, 0) END ASC NULLS LAST,
        CASE WHEN s.sort_mode NOT IN ('newest', 'jhi_desc', 'jhi_asc') THEN
            CASE
                WHEN s.sort_mode = 'recommended' THEN
                    (0.40 * s.fts_score) +
                    (0.18 * s.trigram_score) +
                    (0.17 * s.profile_fit_score) +
                    (0.10 * s.recency_score) +
                    (0.15 * s.behavior_prior_score)
                ELSE
                    (0.45 * s.fts_score) +
                    (0.20 * s.trigram_score) +
                    (0.20 * s.profile_fit_score) +
                    (0.10 * s.recency_score) +
                    (0.05 * s.behavior_prior_score)
            END
        END DESC NULLS LAST,
        s.id DESC
    LIMIT 600
),
paged AS (
    SELECT *
    FROM stage_b
    CROSS JOIN params p
    ORDER BY rank_position
    OFFSET (p.page_num * p.page_size)
    LIMIT p.page_size
)
SELECT
    p.id,
    p.title,
    p.company,
    p.location,
    p.description,
    p.benefits,
    p.contract_type,
    p.salary_from,
    p.salary_to,
    p.currency,
    p.salary_currency,
    p.work_type,
    p.work_model,
    p.scraped_at,
    p.source,
    p.education_level,
    p.url,
    p.lat,
    p.lng,
    p.country_code,
    p.language_code,
    p.legality_status,
    p.verification_notes,
    p.distance_km,
    p.hybrid_score,
    p.fts_score,
    p.trigram_score,
    p.profile_fit_score,
    p.recency_score,
    p.behavior_prior_score,
    p.rank_position,
    p.total_count
FROM paged p
ORDER BY p.rank_position;
$$;

-- Ensure PostgREST can see new functions/tables immediately.
NOTIFY pgrst, 'reload schema';
