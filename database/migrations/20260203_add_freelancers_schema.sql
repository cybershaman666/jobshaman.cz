-- Migration: add freelancer schema and service inquiries
-- Created: 2026-02-03

-- Table: freelancer_profiles
CREATE TABLE IF NOT EXISTS public.freelancer_profiles (
  id uuid NOT NULL,
  headline text,
  bio text,
  presentation text,
  hourly_rate integer,
  currency text DEFAULT 'CZK',
  skills text[] DEFAULT '{}'::text[],
  tags text[] DEFAULT '{}'::text[],
  portfolio jsonb DEFAULT '[]'::jsonb,
  work_type text DEFAULT 'remote', -- allowed: local, remote, hybrid, onsite
  availability text,
  address text,
  lat double precision,
  lng double precision,
  website text,
  contact_email text,
  contact_phone text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT freelancer_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT freelancer_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id)
);

-- Work type constraint
ALTER TABLE IF EXISTS public.freelancer_profiles
  ADD CONSTRAINT freelancer_profiles_work_type_check
    CHECK (work_type IN ('local','remote','hybrid','onsite'));

-- Table: freelancer_services (individual service offers/listings)
CREATE TABLE IF NOT EXISTS public.freelancer_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  price_min integer,
  price_max integer,
  currency text DEFAULT 'CZK',
  is_active boolean DEFAULT true,
  category text,
  tags text[] DEFAULT '{}'::text[],
  views_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT freelancer_services_pkey PRIMARY KEY (id),
  CONSTRAINT freelancer_services_freelancer_id_fkey FOREIGN KEY (freelancer_id) REFERENCES public.freelancer_profiles(id) ON DELETE CASCADE
);

-- Table: freelancer_portfolio_items
CREATE TABLE IF NOT EXISTS public.freelancer_portfolio_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL,
  title text,
  description text,
  media_url text,
  media_type text,
  ordering integer DEFAULT 0,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT freelancer_portfolio_items_pkey PRIMARY KEY (id),
  CONSTRAINT freelancer_portfolio_items_freelancer_id_fkey FOREIGN KEY (freelancer_id) REFERENCES public.freelancer_profiles(id) ON DELETE CASCADE
);

-- Table: freelancer_skills (normalized skill entries per freelancer)
CREATE TABLE IF NOT EXISTS public.freelancer_skills (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL,
  skill_name text NOT NULL,
  confidence integer DEFAULT 0,
  endorsements integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT freelancer_skills_pkey PRIMARY KEY (id),
  CONSTRAINT freelancer_skills_freelancer_id_fkey FOREIGN KEY (freelancer_id) REFERENCES public.freelancer_profiles(id) ON DELETE CASCADE
);

-- Table: service_inquiries (persist messages from companies / users to freelancers or service listings)
CREATE TABLE IF NOT EXISTS public.service_inquiries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  freelancer_id uuid,
  service_id uuid,
  from_user_id uuid,
  from_email text,
  subject text,
  message text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT service_inquiries_pkey PRIMARY KEY (id),
  CONSTRAINT service_inquiries_freelancer_id_fkey FOREIGN KEY (freelancer_id) REFERENCES public.freelancer_profiles(id) ON DELETE SET NULL,
  CONSTRAINT service_inquiries_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.freelancer_services(id) ON DELETE SET NULL,
  CONSTRAINT service_inquiries_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes for search and filtering
CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_skills_gin ON public.freelancer_profiles USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_tags_gin ON public.freelancer_profiles USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_freelancer_services_tags_gin ON public.freelancer_services USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_freelancer_services_category ON public.freelancer_services (category);

-- Optional: text search index for title/description on services
-- You can enable this later if you add a tsvector column; leaving commented for now
-- CREATE INDEX IF NOT EXISTS idx_freelancer_services_search ON public.freelancer_services USING GIN (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')));

-- Grant simple privileges for authenticated role (adjust per your RLS policies)
-- NOTE: Supabase typically uses role "authenticated" for logged-in clients; if you use RLS, create policies instead.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freelancer_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freelancer_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freelancer_portfolio_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freelancer_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_inquiries TO authenticated;

-- End of migration
