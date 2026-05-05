BEGIN;

ALTER TABLE IF EXISTS public.profiles
    ADD COLUMN IF NOT EXISTS location_public text;

COMMENT ON COLUMN public.profiles.location_public IS
    'Public-facing location string for candidate/recruiter profile cards.';

COMMIT;
