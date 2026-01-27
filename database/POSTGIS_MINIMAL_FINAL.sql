-- MINIMAL PostGIS Spatial Search Function
-- This version removes all SQL conflicts and provides clean spatial search

DROP FUNCTION IF EXISTS search_jobs_minimal(double precision, double precision, integer, integer, integer);

CREATE OR REPLACE FUNCTION search_jobs_minimal(
    user_lat FLOAT,
    user_lng FLOAT,
    radius_km INTEGER DEFAULT 50,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    id INTEGER,
    title TEXT,
    company TEXT,
    location TEXT,
    description TEXT,
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
    distance_km FLOAT,
    has_more BOOLEAN,
    total_count BIGINT
) AS $$
DECLARE
    user_point GEOMETRY;
    total_jobs BIGINT;
    has_more_result BOOLEAN;
BEGIN
    -- Create user location point
    user_point := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326);
    
    -- Get total count from jobs table (all jobs, not just spatial ones)
    SELECT COUNT(*) INTO total_jobs
    FROM jobs;
    
    -- Calculate if there are more results based on total jobs
    has_more_result := (offset_count + limit_count) < total_jobs;
    
    -- Simple spatial query with distance calculation
    RETURN QUERY
    SELECT 
        j.id,
        j.title,
        j.company,
        j.location,
        j.description,
        j.contract_type,
        j.salary_from::NUMERIC,
        j.salary_to::NUMERIC,
        j.work_type,
        j.scraped_at::TIMESTAMPTZ,
        j.source,
        j.education_level,
        j.url,
        j.lat,
        j.lng,
        (ST_Distance(
                j.geom::geography, 
                user_point::geography
            ) / 1000.0
        ) as distance_km,
        has_more_result as has_more,
        total_jobs as total_count
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
        distance_km ASC
    LIMIT limit_count
    OFFSET offset_count;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;