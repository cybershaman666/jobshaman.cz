-- Comprehensive RPC function for filtering jobs with all supported filters
-- Supports: location/city, distance radius, contract type, benefits, salary, date, experience, pagination, search term
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
RETURN QUERY WITH base_filtered AS (
    -- STEP 1: Fast filtering (indexed or simple columns)
    SELECT j.*
    FROM jobs j
    WHERE j.legality_status = 'legal'
        AND (
            filter_country_code IS NULL
            OR j.country_code = filter_country_code
        )
        AND (
            cutoff_date IS NULL
            OR j.scraped_at >= cutoff_date
        )
        AND (
            filter_min_salary IS NULL
            OR (
                j.salary_from IS NOT NULL
                AND j.salary_from >= filter_min_salary
            )
        )
        AND (
            search_term IS NULL
            OR search_term = ''
            OR (
                j.title ILIKE '%' || search_term || '%'
                OR j.company ILIKE '%' || search_term || '%'
            )
        )
),
deduplicated AS (
    -- STEP 2: Early deduplication to reduce row count for expensive checks
    -- DISTINCT ON is faster than window functions for simple top-1 per group
    SELECT DISTINCT ON (d.title, d.company, d.location) d.*
    FROM base_filtered d
    ORDER BY d.title,
        d.company,
        d.location,
        d.scraped_at DESC
),
final_filtered AS (
    -- STEP 3: Expensive filtering (PostGIS, complex text search, subqueries)
    -- Only run these on the unique set of jobs
    SELECT fj_in.*,
        CASE
            WHEN has_spatial_filter THEN ST_Distance(
                ST_SetSRID(ST_MakePoint(fj_in.lng, fj_in.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
            ) / 1000.0
            ELSE NULL
        END AS dist_km
    FROM deduplicated fj_in
    WHERE -- City/Location text filter (only if not using spatial)
        (
            filter_city IS NULL
            OR has_spatial_filter
            OR LOWER(fj_in.location) LIKE '%' || LOWER(filter_city) || '%'
        ) -- Spatial distance filter (Calculated once per unique job)
        AND (
            NOT has_spatial_filter
            OR (
                fj_in.lat IS NOT NULL
                AND fj_in.lng IS NOT NULL
                AND ST_DWithin(
                    ST_SetSRID(ST_MakePoint(fj_in.lng, fj_in.lat), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
                    radius_km * 1000
                )
            )
        ) -- Contract type filter
        AND (
            filter_contract_types IS NULL
            OR filter_contract_types = '{}'
            OR (
                (
                    'IČO' = ANY(filter_contract_types)
                    AND (
                        fj_in.contract_type ILIKE '%ičo%'
                        OR fj_in.contract_type ILIKE '%fakturace%'
                        OR fj_in.contract_type ILIKE '%živnost%'
                        OR fj_in.title ILIKE '%ičo%'
                        OR fj_in.title ILIKE '%živnost%'
                    )
                )
                OR (
                    'Part-time' = ANY(filter_contract_types)
                    AND (
                        fj_in.contract_type ILIKE '%part%time%'
                        OR fj_in.contract_type ILIKE '%zkrácený%'
                        OR fj_in.contract_type ILIKE '%brigáda%'
                    )
                )
                OR (
                    'HPP' = ANY(filter_contract_types)
                    AND NOT (
                        fj_in.contract_type ILIKE '%ičo%'
                        OR fj_in.contract_type ILIKE '%fakturace%'
                        OR fj_in.contract_type ILIKE '%živnost%'
                        OR fj_in.title ILIKE '%ičo%'
                        OR fj_in.title ILIKE '%živnost%'
                        OR fj_in.contract_type ILIKE '%part%time%'
                        OR fj_in.contract_type ILIKE '%zkrácený%'
                        OR fj_in.contract_type ILIKE '%brigáda%'
                    )
                )
            )
        ) -- Benefits filter (Expensive subquery per unique job)
        AND (
            filter_benefits IS NULL
            OR filter_benefits = '{}'
            OR (
                SELECT COUNT(*) = array_length(filter_benefits, 1)
                FROM unnest(filter_benefits) AS required_benefit
                WHERE EXISTS (
                        SELECT 1
                        FROM unnest(fj_in.benefits) AS job_benefit
                        WHERE regexp_replace(LOWER(job_benefit), '[- ]', '', 'g') LIKE '%' || regexp_replace(LOWER(required_benefit), '[- ]', '', 'g') || '%'
                    )
            )
        ) -- Experience level filter (Expensive subquery per unique job)
        AND (
            filter_experience_levels IS NULL
            OR filter_experience_levels = '{}'
            OR (
                SELECT bool_or(
                        LOWER(fj_in.title) LIKE '%' || LOWER(level) || '%'
                        OR LOWER(fj_in.description) LIKE '%' || LOWER(level) || '%'
                    )
                FROM unnest(filter_experience_levels) AS level
            )
        )
),
job_count AS (
    SELECT COUNT(*) AS total
    FROM final_filtered
)
SELECT ff.id,
    ff.title,
    ff.company,
    ff.location,
    ff.description,
    ff.benefits,
    ff.contract_type,
    ff.salary_from,
    ff.salary_to,
    ff.work_type,
    ff.scraped_at,
    ff.source,
    ff.education_level,
    ff.url,
    ff.lat,
    ff.lng,
    ff.country_code,
    ff.legality_status,
    ff.verification_notes,
    ff.dist_km AS distance_km,
    jc.total AS total_count
FROM final_filtered ff
    CROSS JOIN job_count jc
ORDER BY CASE
        WHEN has_spatial_filter
        AND ff.dist_km IS NOT NULL THEN ff.dist_km
        ELSE 999999
    END ASC,
    ff.scraped_at DESC
LIMIT limit_count OFFSET offset_val;
END;
$$ LANGUAGE plpgsql;