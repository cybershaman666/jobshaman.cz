-- Azure-only migration: založení tabulky profiles podle aktuálního dumpu
-- Pozor: Tento kód čeká existenci tabulky auth.users s UUID id!

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'candidate',
  full_name text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  subscription_tier character varying DEFAULT 'free'::character varying,
  usage_stats jsonb DEFAULT '{"atcHacksUsed": 0, "cvOptimizationsUsed": 0, "coverLettersGenerated": 0}'::jsonb,
  has_assessment boolean DEFAULT false,
  welcome_email_sent boolean DEFAULT false,
  preferred_locale text,
  preferred_country_code text,
  daily_digest_enabled boolean DEFAULT true,
  daily_digest_last_sent_at timestamp with time zone,
  daily_digest_time time without time zone DEFAULT '07:30:00'::time without time zone,
  daily_digest_timezone text DEFAULT 'Europe/Prague'::text,
  daily_digest_push_enabled boolean DEFAULT true,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);
