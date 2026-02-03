-- Migration: Enable PostGIS, add geom triggers and recommended RLS policies
-- Created: 2026-02-03

-- Ensure PostGIS is available
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry columns to freelancer_profiles and freelancer_services
ALTER TABLE IF EXISTS public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS geom geometry(Point,4326);

ALTER TABLE IF EXISTS public.freelancer_services
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS geom geometry(Point,4326);

-- Create function to update geom from lat/lng
CREATE OR REPLACE FUNCTION public.update_geom_from_latlng()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL) THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  ELSE
    NEW.geom := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- We will create geom triggers after populate triggers so that lat/lng
-- can be populated first (populate -> geom compute order).

-- Create index on geom for spatial queries
CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_geom_gist ON public.freelancer_profiles USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_freelancer_services_geom_gist ON public.freelancer_services USING GIST (geom);

-- Function to attempt to populate lat/lng from existing geocode_cache
CREATE OR REPLACE FUNCTION public.populate_latlng_from_geocode_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  g RECORD;
BEGIN
  IF (NEW.lat IS NULL OR NEW.lng IS NULL) AND NEW.address IS NOT NULL THEN
    -- Try exact match first
    SELECT lat, lon INTO g FROM public.geocode_cache WHERE address_normalized = NEW.address LIMIT 1;
    IF NOT FOUND THEN
      -- Fallback: partial match
      SELECT lat, lon INTO g FROM public.geocode_cache WHERE address_normalized ILIKE '%' || NEW.address || '%' LIMIT 1;
    END IF;
    IF FOUND THEN
      NEW.lat := COALESCE(NEW.lat, g.lat);
      NEW.lng := COALESCE(NEW.lng, g.lon);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freelancer_profiles_populate_geocode ON public.freelancer_profiles;
CREATE TRIGGER trg_freelancer_profiles_populate_geocode
BEFORE INSERT OR UPDATE ON public.freelancer_profiles
FOR EACH ROW
EXECUTE PROCEDURE public.populate_latlng_from_geocode_cache();

DROP TRIGGER IF EXISTS trg_freelancer_services_populate_geocode ON public.freelancer_services;
CREATE TRIGGER trg_freelancer_services_populate_geocode
BEFORE INSERT OR UPDATE ON public.freelancer_services
FOR EACH ROW
EXECUTE PROCEDURE public.populate_latlng_from_geocode_cache();

-- Now create geom triggers (after populate triggers) so geom is computed from populated lat/lng
DROP TRIGGER IF EXISTS trg_freelancer_profiles_geom ON public.freelancer_profiles;
CREATE TRIGGER trg_freelancer_profiles_geom
BEFORE INSERT OR UPDATE ON public.freelancer_profiles
FOR EACH ROW
EXECUTE PROCEDURE public.update_geom_from_latlng();

DROP TRIGGER IF EXISTS trg_freelancer_services_geom ON public.freelancer_services;
CREATE TRIGGER trg_freelancer_services_geom
BEFORE INSERT OR UPDATE ON public.freelancer_services
FOR EACH ROW
EXECUTE PROCEDURE public.update_geom_from_latlng();

-- Recommended RLS policies for freelancer tables

-- Enable RLS
ALTER TABLE IF EXISTS public.freelancer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.freelancer_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.freelancer_portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.freelancer_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_inquiries ENABLE ROW LEVEL SECURITY;

-- freelancer_profiles: public can SELECT, owner can INSERT/UPDATE/DELETE
CREATE POLICY "freelancer_profiles_select_public" ON public.freelancer_profiles
  FOR SELECT USING (true);

CREATE POLICY "freelancer_profiles_insert_own" ON public.freelancer_profiles
  FOR INSERT WITH CHECK (auth.uid() = NEW.id);

CREATE POLICY "freelancer_profiles_update_own" ON public.freelancer_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = NEW.id);

CREATE POLICY "freelancer_profiles_delete_own" ON public.freelancer_profiles
  FOR DELETE USING (auth.uid() = id);

-- freelancer_services: public can SELECT, owners manage their services
CREATE POLICY "freelancer_services_select_public" ON public.freelancer_services
  FOR SELECT USING (true);

CREATE POLICY "freelancer_services_insert_own" ON public.freelancer_services
  FOR INSERT WITH CHECK (auth.uid() = NEW.freelancer_id);

CREATE POLICY "freelancer_services_update_own" ON public.freelancer_services
  FOR UPDATE USING (auth.uid() = freelancer_id) WITH CHECK (auth.uid() = NEW.freelancer_id);

CREATE POLICY "freelancer_services_delete_own" ON public.freelancer_services
  FOR DELETE USING (auth.uid() = freelancer_id);

-- portfolio items: owners only
CREATE POLICY "freelancer_portfolio_select_public" ON public.freelancer_portfolio_items
  FOR SELECT USING (true);

CREATE POLICY "freelancer_portfolio_insert_own" ON public.freelancer_portfolio_items
  FOR INSERT WITH CHECK (auth.uid() = NEW.freelancer_id);

CREATE POLICY "freelancer_portfolio_update_own" ON public.freelancer_portfolio_items
  FOR UPDATE USING (auth.uid() = freelancer_id) WITH CHECK (auth.uid() = NEW.freelancer_id);

CREATE POLICY "freelancer_portfolio_delete_own" ON public.freelancer_portfolio_items
  FOR DELETE USING (auth.uid() = freelancer_id);

-- skills: owners only
CREATE POLICY "freelancer_skills_select_public" ON public.freelancer_skills
  FOR SELECT USING (true);

CREATE POLICY "freelancer_skills_insert_own" ON public.freelancer_skills
  FOR INSERT WITH CHECK (auth.uid() = NEW.freelancer_id);

CREATE POLICY "freelancer_skills_update_own" ON public.freelancer_skills
  FOR UPDATE USING (auth.uid() = freelancer_id) WITH CHECK (auth.uid() = NEW.freelancer_id);

CREATE POLICY "freelancer_skills_delete_own" ON public.freelancer_skills
  FOR DELETE USING (auth.uid() = freelancer_id);

-- service_inquiries: allow anonymous inserts (when from_user_id IS NULL) and authenticated inserts when from_user_id matches
CREATE POLICY "service_inquiries_insert_allowed" ON public.service_inquiries
  FOR INSERT WITH CHECK (
    (NEW.from_user_id IS NULL) OR (NEW.from_user_id = auth.uid())
  );

-- freelancers can select their inquiries; senders can select their own
CREATE POLICY "service_inquiries_select_owner_or_sender" ON public.service_inquiries
  FOR SELECT USING (
    freelancer_id = auth.uid() OR from_user_id = auth.uid()
  );

-- freelancers can update (e.g., mark responded) their inquiries
CREATE POLICY "service_inquiries_update_owner" ON public.service_inquiries
  FOR UPDATE USING (freelancer_id = auth.uid()) WITH CHECK (freelancer_id = auth.uid());

-- freelancers can delete their inquiries
CREATE POLICY "service_inquiries_delete_owner" ON public.service_inquiries
  FOR DELETE USING (freelancer_id = auth.uid());

-- Notes:
-- 1) These policies are recommendations. If you use Supabase with anonymous users sending inquiries, ensure your RLS and rate-limiting are appropriate.
-- 2) If you need server-side (service_role) inserts (e.g., for admin tasks), perform them from an RPC or server with the service key.
-- 3) Consider adding audit/logging for inquiry creation and abuse prevention (rate limits, CAPTCHA, email verification).

-- End of migration
