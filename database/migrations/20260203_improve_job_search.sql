-- Migration: Improve job search with fuzzy matching and full-text search
-- Created: 2026-02-03
-- Purpose: Implement better search functionality with typo tolerance and partial matching

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create trigram index for job titles and descriptions for fast fuzzy matching
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_description_trgm ON jobs USING gin (description gin_trgm_ops);

-- Create a helper function to calculate similarity score for a search term
CREATE OR REPLACE FUNCTION calculate_job_relevance_score(
    p_title text,
    p_description text,
    p_search_term text
) RETURNS numeric AS $$
DECLARE
    v_term_lower text;
    v_title_lower text;
    v_desc_lower text;
    v_score numeric := 0;
    v_title_similarity numeric;
    v_desc_similarity numeric;
BEGIN
    -- Normalize inputs
    v_term_lower := lower(unaccent(p_search_term));
    v_title_lower := lower(unaccent(COALESCE(p_title, '')));
    v_desc_lower := lower(unaccent(COALESCE(p_description, '')));
    
    -- Exact match in title: highest score
    IF v_title_lower = v_term_lower THEN
        v_score := v_score + 100;
    END IF;
    
    -- Substring match at start of title
    IF v_title_lower LIKE v_term_lower || '%' THEN
        v_score := v_score + 80;
    END IF;
    
    -- Substring match anywhere in title
    IF v_title_lower LIKE '%' || v_term_lower || '%' THEN
        v_score := v_score + 60;
    END IF;
    
    -- Trigram similarity for typo tolerance (title)
    v_title_similarity := similarity(v_title_lower, v_term_lower);
    IF v_title_similarity > 0.3 THEN
        v_score := v_score + (v_title_similarity * 50);
    END IF;
    
    -- Trigram similarity for typo tolerance (description)
    v_desc_similarity := similarity(v_desc_lower, v_term_lower);
    IF v_desc_similarity > 0.3 THEN
        v_score := v_score + (v_desc_similarity * 20);
    END IF;
    
    -- Word boundary match (e.g., "řidič sk." matches "řidič/skladník sk.b")
    IF v_title_lower LIKE '%' || v_term_lower || ' %' 
       OR v_title_lower LIKE '% ' || v_term_lower || '%'
       OR v_title_lower LIKE '% ' || v_term_lower THEN
        v_score := v_score + 40;
    END IF;
    
    RETURN v_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create the improved search function with better matching
CREATE OR REPLACE FUNCTION search_jobs_with_filters(
    search_term text DEFAULT NULL,
    user_lat double precision DEFAULT NULL,
    user_lng double precision DEFAULT NULL,
    radius_km double precision DEFAULT NULL,
    filter_city text DEFAULT NULL,
    filter_contract_types text[] DEFAULT NULL,
    filter_benefits text[] DEFAULT NULL,
    filter_min_salary numeric DEFAULT NULL,
    filter_date_posted text DEFAULT 'all',
    filter_experience_levels text[] DEFAULT NULL,
    limit_count int DEFAULT 50,
    offset_val int DEFAULT 0,
    filter_country_codes text[] DEFAULT NULL
)
RETURNS TABLE (
    id bigint,
    title text,
    company text,
    location text,
    description text,
    benefits text[],
    contract_type text,
    salary_from numeric,
    salary_to numeric,
    work_type text,
    scraped_at timestamp with time zone,
    source text,
    education_level text,
    url text,
    lat double precision,
    lng double precision,
    country_code text,
    legality_status text,
    verification_notes text,
    distance_km numeric,
    tags text[],
    total_count bigint,
    relevance_score numeric
) AS $$
DECLARE
    v_query text;
    v_total bigint;
BEGIN
    -- Count total matching records
    SELECT COUNT(*)::bigint INTO v_total FROM jobs j
    WHERE 
        (search_term IS NULL OR search_term = '' OR
         unaccent(j.title) ILIKE '%' || unaccent(search_term) || '%' OR
         unaccent(j.description) ILIKE '%' || unaccent(search_term) || '%' OR
         j.title % search_term OR -- Trigram similarity
         j.description % search_term)
        AND (filter_country_codes IS NULL OR array_length(filter_country_codes, 1) IS NULL OR j.country_code = ANY(filter_country_codes))
        AND (filter_city IS NULL OR filter_city = '' OR j.location ILIKE '%' || filter_city || '%')
        AND (filter_contract_types IS NULL OR array_length(filter_contract_types, 1) IS NULL OR j.contract_type = ANY(filter_contract_types))
        AND (filter_benefits IS NULL OR array_length(filter_benefits, 1) IS NULL OR j.benefits @> filter_benefits)
        AND (filter_min_salary IS NULL OR j.salary_from >= filter_min_salary OR j.salary_to >= filter_min_salary)
        AND (filter_date_posted = 'all' OR
             (filter_date_posted = '24h' AND j.scraped_at > NOW() - INTERVAL '24 hours') OR
             (filter_date_posted = '3d' AND j.scraped_at > NOW() - INTERVAL '3 days') OR
             (filter_date_posted = '7d' AND j.scraped_at > NOW() - INTERVAL '7 days') OR
             (filter_date_posted = '14d' AND j.scraped_at > NOW() - INTERVAL '14 days'))
        AND (filter_experience_levels IS NULL OR array_length(filter_experience_levels, 1) IS NULL OR j.education_level = ANY(filter_experience_levels))
        AND (user_lat IS NULL OR user_lng IS NULL OR radius_km IS NULL OR 
             (6371 * acos(cos(radians(user_lat)) * cos(radians(j.lat)) * cos(radians(j.lng) - radians(user_lng)) + sin(radians(user_lat)) * sin(radians(j.lat)))) <= radius_km);

    -- Return results with relevance scoring
    RETURN QUERY
    SELECT 
        j.id,
        j.title,
        j.company,
        j.location,
        j.description,
        j.benefits,
        j.contract_type,
        j.salary_from,
        j.salary_to,
        j.work_type,
        j.scraped_at,
        j.source,
        j.education_level,
        j.url,
        j.lat,
        j.lng,
        j.country_code,
        j.legality_status,
        j.verification_notes,
        CASE 
            WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL 
            THEN 6371 * acos(cos(radians(user_lat)) * cos(radians(j.lat)) * cos(radians(j.lng) - radians(user_lng)) + sin(radians(user_lat)) * sin(radians(j.lat)))
            ELSE NULL 
        END as distance_km,
        j.tags,
        v_total as total_count,
        CASE
            WHEN search_term IS NULL OR search_term = '' THEN 0
            ELSE calculate_job_relevance_score(j.title, j.description, search_term)
        END as relevance_score
    FROM jobs j
    WHERE 
        (search_term IS NULL OR search_term = '' OR
         unaccent(j.title) ILIKE '%' || unaccent(search_term) || '%' OR
         unaccent(j.description) ILIKE '%' || unaccent(search_term) || '%' OR
         j.title % search_term OR -- Trigram similarity for fuzzy matching
         j.description % search_term)
        AND (filter_country_codes IS NULL OR array_length(filter_country_codes, 1) IS NULL OR j.country_code = ANY(filter_country_codes))
        AND (filter_city IS NULL OR filter_city = '' OR j.location ILIKE '%' || filter_city || '%')
        AND (filter_contract_types IS NULL OR array_length(filter_contract_types, 1) IS NULL OR j.contract_type = ANY(filter_contract_types))
        AND (filter_benefits IS NULL OR array_length(filter_benefits, 1) IS NULL OR j.benefits @> filter_benefits)
        AND (filter_min_salary IS NULL OR j.salary_from >= filter_min_salary OR j.salary_to >= filter_min_salary)
        AND (filter_date_posted = 'all' OR
             (filter_date_posted = '24h' AND j.scraped_at > NOW() - INTERVAL '24 hours') OR
             (filter_date_posted = '3d' AND j.scraped_at > NOW() - INTERVAL '3 days') OR
             (filter_date_posted = '7d' AND j.scraped_at > NOW() - INTERVAL '7 days') OR
             (filter_date_posted = '14d' AND j.scraped_at > NOW() - INTERVAL '14 days'))
        AND (filter_experience_levels IS NULL OR array_length(filter_experience_levels, 1) IS NULL OR j.education_level = ANY(filter_experience_levels))
        AND (user_lat IS NULL OR user_lng IS NULL OR radius_km IS NULL OR 
             (6371 * acos(cos(radians(user_lat)) * cos(radians(j.lat)) * cos(radians(j.lng) - radians(user_lng)) + sin(radians(user_lat)) * sin(radians(j.lat)))) <= radius_km)
    ORDER BY 
        CASE
            WHEN search_term IS NOT NULL AND search_term != '' 
            THEN calculate_job_relevance_score(j.title, j.description, search_term)
            ELSE 0
        END DESC,
        j.scraped_at DESC
    LIMIT limit_count
    OFFSET offset_val;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION search_jobs_with_filters(text, double precision, double precision, double precision, text, text[], text[], numeric, text, text[], int, int, text[]) TO authenticated;

-- Grant execute to anonymous role (for public searches)
GRANT EXECUTE ON FUNCTION search_jobs_with_filters(text, double precision, double precision, double precision, text, text[], text[], numeric, text, text[], int, int, text[]) TO anon;

-- End of migration
