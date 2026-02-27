-- Fix: Drop all overloaded versions of search_jobs_with_filters and recreate cleanly

-- Drop all versions of the function if they exist
DROP FUNCTION IF EXISTS public.search_jobs_with_filters CASCADE;

-- Create the wrapper function once with all parameters
CREATE OR REPLACE FUNCTION public.search_jobs_with_filters(
    search_term text DEFAULT NULL,
    user_lat double precision DEFAULT NULL,
    user_lng double precision DEFAULT NULL,
    radius_km double precision DEFAULT NULL,
    filter_city text DEFAULT NULL,
    filter_contract_types text[] DEFAULT NULL,
    filter_benefits text[] DEFAULT NULL,
    filter_min_salary integer DEFAULT NULL,
    filter_date_posted text DEFAULT 'all',
    filter_experience_levels text[] DEFAULT NULL,
    limit_count integer DEFAULT 50,
    offset_val integer DEFAULT 0,
    filter_country_codes text[] DEFAULT NULL,
    exclude_country_codes text[] DEFAULT NULL,
    filter_language_codes text[] DEFAULT NULL
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
    SELECT * FROM public.search_jobs_v2(
        p_search_term := search_term,
        p_page := (offset_val / GREATEST(limit_count, 1))::integer,
        p_page_size := limit_count,
        p_user_id := NULL,
        p_user_lat := user_lat,
        p_user_lng := user_lng,
        p_radius_km := radius_km,
        p_filter_city := filter_city,
        p_filter_contract_types := filter_contract_types,
        p_filter_benefits := filter_benefits,
        p_filter_min_salary := filter_min_salary,
        p_filter_date_posted := filter_date_posted,
        p_filter_experience_levels := filter_experience_levels,
        p_filter_country_codes := filter_country_codes,
        p_exclude_country_codes := exclude_country_codes,
        p_filter_language_codes := filter_language_codes,
        p_sort_mode := 'default'
    );
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
