-- Migration: create RPC function for freelancer geo-search
-- Created: 2026-02-03

CREATE OR REPLACE FUNCTION public.freelancer_search_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision,
  p_skills text[] DEFAULT NULL,
  p_work_type text DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  headline text,
  bio text,
  presentation text,
  hourly_rate integer,
  currency text,
  skills text[],
  tags text[],
  portfolio jsonb,
  work_type text,
  availability text,
  address text,
  lat double precision,
  lng double precision,
  website text,
  contact_email text,
  contact_phone text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  distance_m double precision
) LANGUAGE sql STABLE AS $$
SELECT f.id, f.headline, f.bio, f.presentation, f.hourly_rate, f.currency, f.skills, f.tags, f.portfolio, f.work_type, f.availability, f.address, f.lat, f.lng, f.website, f.contact_email, f.contact_phone, f.created_at, f.updated_at,
  ST_Distance(f.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat),4326)) as distance_m
FROM public.freelancer_profiles f
WHERE
  (p_skills IS NULL OR array_length(p_skills,1) IS NULL OR p_skills = '{}' OR f.skills @> p_skills)
  AND (p_work_type IS NULL OR p_work_type = '' OR f.work_type = p_work_type)
  AND (p_q IS NULL OR p_q = '' OR (f.headline ILIKE '%'||p_q||'%' OR f.bio ILIKE '%'||p_q||'%' OR f.presentation ILIKE '%'||p_q||'%'))
  AND ST_DWithin(f.geom, ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326), p_radius_m)
ORDER BY distance_m ASC
LIMIT p_limit OFFSET p_offset;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.freelancer_search_nearby(double precision, double precision, double precision, text[], text, text, int, int) TO authenticated;

-- End of migration
