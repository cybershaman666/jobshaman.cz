-- Migration: Exclude freelance services from job list search by default
-- Created: 2026-02-03

-- Re-create search function with default exclusion for freelance services
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
    id integer,
    title text,
    company text,
    location text,
    description text,
    benefits text[],
    contract_type text,
    salary_from integer,
    salary_to integer,
    work_type text,
    scraped_at timestamp without time zone,
    source text,
    education_level text,
    url text,
    lat double precision,
    lng double precision,
    country_code character varying,
    legality_status text,
    verification_notes text,
    distance_km numeric,
    total_count bigint,
    relevance_score numeric
) AS $$
DECLARE
    v_total bigint;
BEGIN
    -- Count total matching records (exclude swiped-left for logged-in users)
    SELECT COUNT(*)::bigint INTO v_total FROM jobs j
    WHERE 
        (search_term IS NULL OR search_term = '' OR
         unaccent(j.title) ILIKE '%' || unaccent(search_term) || '%' OR
         unaccent(j.description) ILIKE '%' || unaccent(search_term) || '%' OR
         j.title % search_term OR
         j.description % search_term)
        AND (filter_country_codes IS NULL OR array_length(filter_country_codes, 1) IS NULL OR j.country_code = ANY(filter_country_codes))
        AND (filter_city IS NULL OR filter_city = '' OR j.location ILIKE '%' || filter_city || '%')
        AND (filter_contract_types IS NULL OR array_length(filter_contract_types, 1) IS NULL OR j.contract_type = ANY(filter_contract_types))
        AND (
            (filter_contract_types IS NOT NULL AND array_length(filter_contract_types, 1) IS NOT NULL AND 'freelance_service' = ANY(filter_contract_types))
            OR j.contract_type IS DISTINCT FROM 'freelance_service'
        )
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
        AND (
            auth.uid() IS NULL OR NOT EXISTS (
                SELECT 1 FROM public.job_interactions ji
                WHERE ji.user_id = auth.uid()
                  AND ji.job_id = j.id
                  AND ji.event_type = 'swipe_left'
            )
        );

    -- Return results with relevance scoring + personalization boosts
    RETURN QUERY
    WITH user_prefs AS (
        SELECT
            (SELECT j.contract_type
             FROM public.job_interactions ji
             JOIN public.jobs j ON j.id = ji.job_id
             WHERE ji.user_id = auth.uid()
               AND ji.event_type IN ('swipe_right','save','apply_click','open_detail')
               AND ji.created_at > NOW() - INTERVAL '120 days'
               AND j.contract_type IS NOT NULL
             GROUP BY j.contract_type
             ORDER BY COUNT(*) DESC
             LIMIT 1) AS top_contract_type,

            (SELECT j.work_type
             FROM public.job_interactions ji
             JOIN public.jobs j ON j.id = ji.job_id
             WHERE ji.user_id = auth.uid()
               AND ji.event_type IN ('swipe_right','save','apply_click','open_detail')
               AND ji.created_at > NOW() - INTERVAL '120 days'
               AND j.work_type IS NOT NULL
             GROUP BY j.work_type
             ORDER BY COUNT(*) DESC
             LIMIT 1) AS top_work_type,

            (SELECT j.country_code
             FROM public.job_interactions ji
             JOIN public.jobs j ON j.id = ji.job_id
             WHERE ji.user_id = auth.uid()
               AND ji.event_type IN ('swipe_right','save','apply_click','open_detail')
               AND ji.created_at > NOW() - INTERVAL '120 days'
               AND j.country_code IS NOT NULL
             GROUP BY j.country_code
             ORDER BY COUNT(*) DESC
             LIMIT 1) AS top_country_code
    )
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
        END::numeric as distance_km,
        v_total as total_count,
        CASE
            WHEN search_term IS NULL OR search_term = '' THEN 0
            ELSE calculate_job_relevance_score(j.title, j.description, search_term)
        END as relevance_score
    FROM jobs j
    CROSS JOIN user_prefs p
    WHERE 
        (search_term IS NULL OR search_term = '' OR
         unaccent(j.title) ILIKE '%' || unaccent(search_term) || '%' OR
         unaccent(j.description) ILIKE '%' || unaccent(search_term) || '%' OR
         j.title % search_term OR
         j.description % search_term)
        AND (filter_country_codes IS NULL OR array_length(filter_country_codes, 1) IS NULL OR j.country_code = ANY(filter_country_codes))
        AND (filter_city IS NULL OR filter_city = '' OR j.location ILIKE '%' || filter_city || '%')
        AND (filter_contract_types IS NULL OR array_length(filter_contract_types, 1) IS NULL OR j.contract_type = ANY(filter_contract_types))
        AND (
            (filter_contract_types IS NOT NULL AND array_length(filter_contract_types, 1) IS NOT NULL AND 'freelance_service' = ANY(filter_contract_types))
            OR j.contract_type IS DISTINCT FROM 'freelance_service'
        )
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
        AND (
            auth.uid() IS NULL OR NOT EXISTS (
                SELECT 1 FROM public.job_interactions ji
                WHERE ji.user_id = auth.uid()
                  AND ji.job_id = j.id
                  AND ji.event_type = 'swipe_left'
            )
        )
    ORDER BY 
        (
            CASE
                WHEN search_term IS NOT NULL AND search_term != '' 
                THEN calculate_job_relevance_score(j.title, j.description, search_term)
                ELSE 0
            END
            + CASE WHEN p.top_contract_type IS NOT NULL AND j.contract_type = p.top_contract_type THEN 8 ELSE 0 END
            + CASE WHEN p.top_work_type IS NOT NULL AND j.work_type = p.top_work_type THEN 6 ELSE 0 END
            + CASE WHEN p.top_country_code IS NOT NULL AND j.country_code = p.top_country_code THEN 4 ELSE 0 END
        ) DESC,
        j.scraped_at DESC
    LIMIT limit_count
    OFFSET offset_val;
END;
$$ LANGUAGE plpgsql STABLE;

-- End of migration
