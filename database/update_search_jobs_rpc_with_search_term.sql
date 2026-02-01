-- Migration to update search_jobs_with_filters RPC to include search_term
-- This fixes the error: "Could not find the function public.search_jobs_with_filters(..., search_term, ...)"
-- Drop the existing function first because we are changing the return type (removing tags)
DROP FUNCTION IF EXISTS search_jobs_with_filters(
    double precision,
    double precision,
    double precision,
    text,
    text [],
    text [],
    integer,
    text,
    text [],
    integer,
    integer,
    character varying,
    text
);
CREATE OR REPLACE FUNCTION search_jobs_with_filters(
        -- Location & Distance
        user_lat DOUBLE PRECISION DEFAULT NULL,
        user_lng DOUBLE PRECISION DEFAULT NULL,
        radius_km DOUBLE PRECISION DEFAULT 50,
        filter_city TEXT DEFAULT NULL,
        -- Contract Type (array: HPP, IČO, Part-time)
        filter_contract_types TEXT [] DEFAULT NULL,
        -- Benefits (array of benefit names)
        filter_benefits TEXT [] DEFAULT NULL,
        -- Salary
        filter_min_salary INTEGER DEFAULT NULL,
        -- Date Posted
        filter_date_posted TEXT DEFAULT 'all',
        -- all, 24h, 3d, 7d, 14d
        -- Experience Level (array: Junior, Medior, Senior, Lead)
        filter_experience_levels TEXT [] DEFAULT NULL,
        -- Pagination
        limit_count INTEGER DEFAULT 50,
        offset_val INTEGER DEFAULT 0,
        -- Country
        filter_country_code VARCHAR(2) DEFAULT NULL,
        -- Search Term (NEW)
        search_term TEXT DEFAULT NULL
    ) RETURNS TABLE(
        id INTEGER,
        title TEXT,
        company TEXT,
        location TEXT,
        description TEXT,
        benefits TEXT [],
        contract_type TEXT,
        salary_from INTEGER,
        salary_to INTEGER,
        work_type TEXT,
        scraped_at TIMESTAMP,
        source TEXT,
        education_level TEXT,
        url TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        country_code VARCHAR(2),
        legality_status TEXT,
        verification_notes TEXT,
        -- REMOVED tags from return
        distance_km DOUBLE PRECISION,
        total_count BIGINT
    ) AS $$
DECLARE cutoff_date TIMESTAMP;
has_spatial_filter BOOLEAN;
BEGIN -- Determine date cutoff
CASE
    filter_date_posted
    WHEN '24h' THEN cutoff_date := NOW() - INTERVAL '24 hours';
WHEN '3d' THEN cutoff_date := NOW() - INTERVAL '3 days';
WHEN '7d' THEN cutoff_date := NOW() - INTERVAL '7 days';
WHEN '14d' THEN cutoff_date := NOW() - INTERVAL '14 days';
ELSE cutoff_date := NULL;
END CASE
;
-- Check if we have spatial filter requirements
has_spatial_filter := (
    user_lat IS NOT NULL
    AND user_lng IS NOT NULL
);
RETURN QUERY WITH filtered_jobs AS (
    SELECT j.*,
        CASE
            WHEN has_spatial_filter THEN ST_Distance(
                ST_SetSRID(ST_MakePoint(j.lng, j.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
            ) / 1000.0
            ELSE NULL
        END AS dist_km
    FROM jobs j
    WHERE -- Only legal jobs
        j.legality_status = 'legal' -- Country filter
        AND (
            filter_country_code IS NULL
            OR j.country_code = filter_country_code
        ) -- City/Location text filter
        AND (
            filter_city IS NULL
            OR LOWER(j.location) LIKE '%' || LOWER(filter_city) || '%'
        ) -- Search Term text filter (NEW)
        AND (
            search_term IS NULL
            OR search_term = ''
            OR (
                j.title ILIKE '%' || search_term || '%'
                OR j.company ILIKE '%' || search_term || '%'
                OR j.description ILIKE '%' || search_term || '%' -- Removed tag search
            )
        ) -- Spatial distance filter (if coordinates provided)
        AND (
            NOT has_spatial_filter
            OR (
                j.lat IS NOT NULL
                AND j.lng IS NOT NULL
                AND ST_DWithin(
                    ST_SetSRID(ST_MakePoint(j.lng, j.lat), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
                    radius_km * 1000
                )
            )
        ) -- Salary filter
        AND (
            filter_min_salary IS NULL
            OR (
                j.salary_from IS NOT NULL
                AND j.salary_from >= filter_min_salary
            )
        ) -- Date posted filter
        AND (
            cutoff_date IS NULL
            OR j.scraped_at >= cutoff_date
        ) -- Contract type filter
        AND (
            filter_contract_types IS NULL
            OR filter_contract_types = '{}'
            OR (
                -- IČO detection
                (
                    'IČO' = ANY(filter_contract_types)
                    AND (
                        j.contract_type ILIKE '%ičo%'
                        OR j.contract_type ILIKE '%fakturace%'
                        OR j.title ILIKE '%ičo%'
                        OR j.description ILIKE '%fakturace%'
                    )
                )
                OR -- Part-time detection
                (
                    'Part-time' = ANY(filter_contract_types)
                    AND (
                        j.contract_type ILIKE '%part%time%'
                        OR j.contract_type ILIKE '%zkrácený%'
                        OR j.contract_type ILIKE '%brigáda%'
                    )
                )
                OR -- HPP detection (neither IČO nor Part-time)
                (
                    'HPP' = ANY(filter_contract_types)
                    AND NOT (
                        j.contract_type ILIKE '%ičo%'
                        OR j.contract_type ILIKE '%fakturace%'
                        OR j.title ILIKE '%ičo%'
                        OR j.contract_type ILIKE '%part%time%'
                        OR j.contract_type ILIKE '%zkrácený%'
                        OR j.contract_type ILIKE '%brigáda%'
                    )
                )
            )
        ) -- Benefits filter (check if job has ALL requested benefits)
        AND (
            filter_benefits IS NULL
            OR filter_benefits = '{}'
            OR (
                SELECT COUNT(*) = array_length(filter_benefits, 1)
                FROM unnest(filter_benefits) AS required_benefit
                WHERE EXISTS (
                        SELECT 1
                        FROM unnest(j.benefits) AS job_benefit
                        WHERE LOWER(job_benefit) LIKE '%' || LOWER(required_benefit) || '%'
                    )
            )
        ) -- Experience level filter
        AND (
            filter_experience_levels IS NULL
            OR filter_experience_levels = '{}'
            OR (
                SELECT bool_or(
                        LOWER(j.title) LIKE '%' || LOWER(level) || '%'
                        OR LOWER(j.description) LIKE '%' || LOWER(level) || '%'
                    )
                FROM unnest(filter_experience_levels) AS level
            )
        )
),
job_count AS (
    SELECT COUNT(*) AS total
    FROM filtered_jobs
)
SELECT fj.id,
    fj.title,
    fj.company,
    fj.location,
    fj.description,
    fj.benefits,
    fj.contract_type,
    fj.salary_from,
    fj.salary_to,
    fj.work_type,
    fj.scraped_at,
    fj.source,
    fj.education_level,
    fj.url,
    fj.lat,
    fj.lng,
    fj.country_code,
    fj.legality_status,
    fj.verification_notes,
    -- Removed tags select
    fj.dist_km AS distance_km,
    jc.total AS total_count
FROM filtered_jobs fj
    CROSS JOIN job_count jc
ORDER BY CASE
        WHEN has_spatial_filter
        AND fj.dist_km IS NOT NULL THEN fj.dist_km
        ELSE 999999
    END ASC,
    fj.scraped_at DESC
LIMIT limit_count OFFSET offset_val;
END;
$$ LANGUAGE plpgsql;