-- Add partner profile fields for marketplace registration
ALTER TABLE public.marketplace_partners
    ADD COLUMN IF NOT EXISTS owner_id uuid,
    ADD COLUMN IF NOT EXISTS contact_name text,
    ADD COLUMN IF NOT EXISTS contact_phone text,
    ADD COLUMN IF NOT EXISTS website text,
    ADD COLUMN IF NOT EXISTS address text,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS offer text,
    ADD COLUMN IF NOT EXISTS course_categories text[],
    ADD COLUMN IF NOT EXISTS lat double precision,
    ADD COLUMN IF NOT EXISTS lng double precision;

ALTER TABLE public.marketplace_partners
    ADD CONSTRAINT marketplace_partners_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES public.profiles(id);
