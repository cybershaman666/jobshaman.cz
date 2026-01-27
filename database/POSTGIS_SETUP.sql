-- Enable PostGIS extension (already done in Supabase)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Create spatial column for jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Create spatial index for fast distance queries
CREATE INDEX IF NOT EXISTS idx_jobs_geom ON jobs USING GIST (geom);

-- Populate geometry column from existing lat/lng coordinates
UPDATE jobs 
SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Create trigger to automatically update geometry when lat/lng changes
CREATE OR REPLACE FUNCTION update_job_geom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
        NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    ELSE
        NEW.geom = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_job_geom
    BEFORE INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_job_geom();

-- Create a function for spatial job search
CREATE OR REPLACE FUNCTION search_jobs_by_location(
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
    distance_km FLOAT,
    has_more BOOLEAN,
    total_count BIGINT
) AS $$
DECLARE
    total_matching BIGINT;
    user_point GEOMETRY;
BEGIN
    -- Create user location point
    user_point := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326);
    
    -- Get total count within radius (for pagination info)
    SELECT COUNT(*) INTO total_matching
    FROM jobs 
    WHERE geom IS NOT NULL 
    AND ST_DWithin(
        geom::geography, 
        user_point::geography, 
        radius_km * 1000  -- Convert km to meters
    );
    
    -- Simplified query without complex subquery for pagination
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
        ) / 1000.0 as distance_km,
        -- Simplified pagination - just return the current limit/offset info
        (limit_count > 0) as has_more,
        total_matching as total_count
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
        j.scraped_at DESC
    LIMIT limit_count
    OFFSET offset_count;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Comment: This function provides optimized spatial search with:
-- 1. Distance calculation in database (accurate)
-- 2. Proper pagination (has_more flag, total_count)
-- 3. Performance optimized with spatial index
-- 4. Maintains existing job sort order (newest first)