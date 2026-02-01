-- Migration to update search_jobs_minimal RPC to support country_code filtering
CREATE OR REPLACE FUNCTION search_jobs_minimal(
        user_lat DOUBLE PRECISION,
        user_lng DOUBLE PRECISION,
        radius_km DOUBLE PRECISION,
        limit_count INTEGER,
        offset_val INTEGER,
        filter_country_code VARCHAR(2) DEFAULT NULL
    ) RETURNS SETOF jobs AS $$ BEGIN RETURN QUERY
SELECT *
FROM jobs
WHERE -- Ensure lat/lng are not null
    lat IS NOT NULL
    AND lng IS NOT NULL -- Spatial filter (convert km to meters for ST_DWithin)
    AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_km * 1000
    ) -- Country code filter (if provided)
    AND (
        filter_country_code IS NULL
        OR country_code = filter_country_code
    ) -- Only legal jobs
    AND legality_status = 'legal'
ORDER BY -- Order by distance
    ST_Distance(
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) ASC
LIMIT limit_count OFFSET offset_val;
END;
$$ LANGUAGE plpgsql;