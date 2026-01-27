-- Simplified PostGIS spatial search function
-- This version avoids potential SQL conflicts and complex subqueries

CREATE OR REPLACE FUNCTION search_jobs_by_location_simple(
    user_lat FLOAT,
    user_lng FLOAT,
    radius_km INTEGER DEFAULT 50,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    id BIGINT,
    title TEXT,
    company TEXT,
    location TEXT,
    description TEXT,
    benefits TEXT[],
    contract_type TEXT,
    salary_from NUMERIC,
    salary_to NUMERIC,
    work_type TEXT,
    scraped_at TIMESTAMPTZ,
    source TEXT,
    education_level TEXT,
    url TEXT,
    lat FLOAT,
    lng FLOAT,
    distance_km FLOAT
) AS $$
DECLARE
    user_point GEOMETRY;
BEGIN
    -- Create user location point
    user_point := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326);
    
    -- Simple spatial query with distance calculation
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
        -- Calculate actual distance in km
        ST_Distance(
            j.geom::geography, 
            user_point::geography
        ) / 1000.0 as distance_km
    FROM jobs j
    WHERE j.geom IS NOT NULL 
    AND ST_DWithin(
        j.geom::geography, 
        user_point::geography, 
        radius_km * 1000
    )
    ORDER BY 
        CASE 
            WHEN j.scraped_at IS NULL THEN 0 
            ELSE 1 
        END DESC,
        j.scraped_at DESC,
        distance_km ASC
    LIMIT limit_count
    OFFSET offset_count;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Optional: Drop the old complex function if it exists
-- DROP FUNCTION IF EXISTS search_jobs_by_location(
--     user_lat FLOAT,
--     user_lng FLOAT,
--     radius_km INTEGER,
--     limit_count INTEGER,
--     offset_count INTEGER
-- );