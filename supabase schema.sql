-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.ab_test_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  test_id character varying NOT NULL,
  variant_id character varying NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ab_test_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT ab_test_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.ab_test_conversions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid,
  conversion_event character varying NOT NULL,
  conversion_value numeric,
  converted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ab_test_conversions_pkey PRIMARY KEY (id),
  CONSTRAINT ab_test_conversions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.ab_test_assignments(id)
);
CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type character varying NOT NULL,
  user_id uuid,
  company_id uuid,
  feature character varying,
  tier character varying,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT analytics_events_pkey PRIMARY KEY (id),
  CONSTRAINT analytics_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT analytics_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.assessment_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  candidate_id uuid,
  assessment_id text NOT NULL,
  candidate_email text,
  status text DEFAULT 'pending'::text,
  invitation_token text UNIQUE,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  metadata jsonb,
  CONSTRAINT assessment_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT assessment_invitations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT assessment_invitations_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(id)
);
CREATE TABLE public.assessment_results (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  candidate_id uuid,
  job_id integer,
  score_percent double precision NOT NULL,
  ai_summary text,
  raw_responses jsonb,
  completed_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'completed'::text,
  company_id uuid,
  ai_evaluation jsonb,
  CONSTRAINT assessment_results_pkey PRIMARY KEY (id),
  CONSTRAINT assessment_results_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(id),
  CONSTRAINT assessment_results_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.benefit_valuations (
  benefit_name text NOT NULL,
  monthly_value_czk integer DEFAULT 0,
  description text,
  CONSTRAINT benefit_valuations_pkey PRIMARY KEY (benefit_name)
);
CREATE TABLE public.candidate_profiles (
  id uuid NOT NULL,
  cv_text text,
  cv_url text,
  address text,
  transport_mode text DEFAULT 'public'::text,
  skills ARRAY DEFAULT '{}'::text[],
  preferences jsonb DEFAULT '{"priorities": [], "financialGoals": 50, "workLifeBalance": 50, "commuteTolerance": 45}'::jsonb,
  work_history jsonb DEFAULT '[]'::jsonb,
  education jsonb DEFAULT '[]'::jsonb,
  lat double precision,
  lng double precision,
  phone text,
  job_title text,
  CONSTRAINT candidate_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT candidate_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id)
);
CREATE TABLE public.career_tracks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  candidate_id uuid NOT NULL,
  original_job_title text,
  original_salary_avg integer,
  resource_id uuid,
  status text DEFAULT 'in_progress'::text,
  new_job_id integer,
  salary_increase_percent double precision,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT career_tracks_pkey PRIMARY KEY (id),
  CONSTRAINT career_tracks_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(id),
  CONSTRAINT career_tracks_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.learning_resources(id),
  CONSTRAINT career_tracks_new_job_id_fkey FOREIGN KEY (new_job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  ico text UNIQUE,
  dic text,
  address text,
  description text,
  industry text,
  website text,
  logo_url text,
  tone text DEFAULT 'Professional'::text,
  values ARRAY DEFAULT '{}'::text[],
  philosophy text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  owner_id uuid,
  turnover_rate double precision DEFAULT 0,
  ghosting_rate double precision DEFAULT 0,
  lat double precision,
  lng double precision,
  created_by uuid,
  subscription_tier character varying DEFAULT 'basic'::character varying,
  usage_stats jsonb DEFAULT '{"activeJobsCount": 0, "aiAssessmentsUsed": 0, "adOptimizationsUsed": 0}'::jsonb,
  subscription_id uuid,
  contact_email text,
  contact_phone text,
  company_size character varying,
  founded_year integer,
  field_of_business character varying,
  contact_person character varying,
  CONSTRAINT companies_pkey PRIMARY KEY (id),
  CONSTRAINT companies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id),
  CONSTRAINT companies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT companies_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id)
);
CREATE TABLE public.company_members (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid,
  user_id uuid,
  role character varying DEFAULT 'recruiter'::character varying,
  invited_by uuid,
  invited_at timestamp with time zone DEFAULT now(),
  joined_at timestamp with time zone,
  is_active boolean DEFAULT true,
  CONSTRAINT company_members_pkey PRIMARY KEY (id),
  CONSTRAINT company_members_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT company_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT company_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.csrf_sessions (
  id bigint NOT NULL DEFAULT nextval('csrf_sessions_id_seq'::regclass),
  token text NOT NULL UNIQUE,
  user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  consumed_at timestamp with time zone,
  ip_address text,
  user_agent text,
  CONSTRAINT csrf_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cv_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  file_name text,
  original_name text,
  file_url text,
  file_size integer,
  content_type text,
  is_active boolean DEFAULT false,
  parsed_data jsonb,
  uploaded_at timestamp without time zone DEFAULT now(),
  last_used timestamp without time zone,
  CONSTRAINT cv_documents_pkey PRIMARY KEY (id),
  CONSTRAINT cv_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.enterprise_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_name character varying NOT NULL,
  contact_name character varying NOT NULL,
  contact_email character varying NOT NULL,
  contact_phone character varying,
  company_size character varying,
  industry character varying,
  current_challenges text,
  expected_hires character varying,
  timeline character varying,
  status character varying DEFAULT 'new'::character varying CHECK (status::text = ANY (ARRAY['new'::character varying, 'contacted'::character varying, 'qualified'::character varying, 'closed_won'::character varying, 'closed_lost'::character varying]::text[])),
  assigned_to uuid,
  notes text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT enterprise_leads_pkey PRIMARY KEY (id),
  CONSTRAINT enterprise_leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id)
);
CREATE TABLE public.filter_analytics (
  id bigint NOT NULL DEFAULT nextval('filter_analytics_id_seq'::regclass),
  user_id uuid,
  filter_city text,
  filter_contract_types ARRAY,
  filter_benefits ARRAY,
  filter_min_salary integer,
  filter_date_posted text,
  filter_experience_levels ARRAY,
  radius_km double precision,
  has_distance_filter boolean,
  result_count integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT filter_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT filter_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.freelancer_portfolio_items (
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
  CONSTRAINT freelancer_portfolio_items_freelancer_id_fkey FOREIGN KEY (freelancer_id) REFERENCES public.freelancer_profiles(id)
);
CREATE TABLE public.freelancer_profiles (
  id uuid NOT NULL,
  headline text,
  bio text,
  presentation text,
  hourly_rate integer,
  currency text DEFAULT 'CZK'::text,
  skills ARRAY DEFAULT '{}'::text[],
  tags ARRAY DEFAULT '{}'::text[],
  portfolio jsonb DEFAULT '[]'::jsonb,
  work_type text DEFAULT 'remote'::text CHECK (work_type = ANY (ARRAY['local'::text, 'remote'::text, 'hybrid'::text, 'onsite'::text])),
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
CREATE TABLE public.freelancer_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  price_min integer,
  price_max integer,
  currency text DEFAULT 'CZK'::text,
  is_active boolean DEFAULT true,
  category text,
  tags ARRAY DEFAULT '{}'::text[],
  views_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT freelancer_services_pkey PRIMARY KEY (id),
  CONSTRAINT freelancer_services_freelancer_id_fkey FOREIGN KEY (freelancer_id) REFERENCES public.freelancer_profiles(id)
);
CREATE TABLE public.freelancer_skills (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL,
  skill_name text NOT NULL,
  confidence integer DEFAULT 0,
  endorsements integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT freelancer_skills_pkey PRIMARY KEY (id),
  CONSTRAINT freelancer_skills_freelancer_id_fkey FOREIGN KEY (freelancer_id) REFERENCES public.freelancer_profiles(id)
);
CREATE TABLE public.geocode_cache (
  id bigint NOT NULL DEFAULT nextval('geocode_cache_id_seq'::regclass),
  address_normalized text NOT NULL UNIQUE,
  address_original text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  country character varying,
  cached_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT geocode_cache_pkey PRIMARY KEY (id)
);
CREATE TABLE public.job_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id bigint NOT NULL,
  candidate_id uuid,
  company_id uuid,
  applied_at timestamp with time zone DEFAULT now(),
  cover_letter text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'shortlisted'::text, 'rejected'::text, 'hired'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_applications_pkey PRIMARY KEY (id),
  CONSTRAINT job_applications_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.profiles(id),
  CONSTRAINT job_applications_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.job_candidate_matches (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  job_id integer,
  candidate_id uuid,
  match_score double precision,
  match_reasons ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_candidate_matches_pkey PRIMARY KEY (id),
  CONSTRAINT job_candidate_matches_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_candidate_matches_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(id)
);
CREATE TABLE public.jobs (
  id integer NOT NULL DEFAULT nextval('jobs_id_seq'::regclass),
  title text NOT NULL,
  url text UNIQUE,
  company text,
  location text,
  description text,
  benefits ARRAY,
  contract_type text,
  salary_from integer,
  salary_to integer,
  work_type text,
  education_level text,
  source text,
  scraped_at timestamp without time zone DEFAULT now(),
  company_id uuid,
  recruiter_id uuid,
  is_active boolean DEFAULT true,
  required_skills ARRAY DEFAULT '{}'::text[],
  currency text DEFAULT 'CZK'::text,
  lat double precision,
  lng double precision,
  legality_status text DEFAULT 'pending'::text,
  risk_score double precision DEFAULT 0,
  verification_notes text,
  posted_by uuid,
  geom USER-DEFINED,
  salary_min integer,
  salary_max integer,
  salary_currency character varying DEFAULT 'CZK'::character varying,
  contact_email character varying,
  contact_person character varying,
  workplace_address character varying,
  created_at timestamp with time zone DEFAULT now(),
  country_code character varying DEFAULT 'cs'::character varying CHECK (country_code::text = ANY (ARRAY['cs'::character varying, 'cz'::character varying, 'sk'::character varying, 'pl'::character varying, 'de'::character varying, 'at'::character varying]::text[])),
  ai_analysis jsonb,
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT jobs_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES public.profiles(id),
  CONSTRAINT jobs_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.learning_resources (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  skill_name ARRAY NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  provider text,
  price_estimate jsonb,
  relevance_score double precision DEFAULT 1.0,
  created_at timestamp with time zone DEFAULT now(),
  description text,
  duration_hours integer,
  difficulty text DEFAULT 'Beginner'::text,
  rating double precision DEFAULT 5.0,
  reviews_count integer DEFAULT 0,
  is_government_funded boolean DEFAULT false,
  funding_amount_czk integer DEFAULT 0,
  affiliate_url text,
  location text,
  lat double precision,
  lng double precision,
  status text DEFAULT 'active'::text,
  partner_id uuid,
  total_graduates_count integer DEFAULT 0,
  active_students_count integer DEFAULT 0,
  CONSTRAINT learning_resources_pkey PRIMARY KEY (id),
  CONSTRAINT learning_resources_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.marketplace_partners(id)
);
CREATE TABLE public.marketplace_partners (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  contact_email text,
  commission_rate double precision,
  partner_type text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT marketplace_partners_pkey PRIMARY KEY (id)
);
CREATE TABLE public.premium_access_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  feature character varying NOT NULL,
  endpoint character varying NOT NULL,
  ip_address inet,
  timestamp timestamp with time zone DEFAULT now(),
  subscription_tier character varying,
  result character varying,
  reason text,
  metadata jsonb,
  CONSTRAINT premium_access_logs_pkey PRIMARY KEY (id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  role USER-DEFINED DEFAULT 'candidate'::user_role,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  subscription_tier character varying DEFAULT 'free'::character varying,
  usage_stats jsonb DEFAULT '{"atcHacksUsed": 0, "cvOptimizationsUsed": 0, "coverLettersGenerated": 0}'::jsonb,
  has_assessment boolean DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.recruiter_profiles (
  id uuid NOT NULL,
  company_id uuid,
  CONSTRAINT recruiter_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT recruiter_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id),
  CONSTRAINT recruiter_profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.resource_reviews (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  resource_id uuid,
  candidate_id uuid,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  is_verified_graduate boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT resource_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT resource_reviews_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.learning_resources(id),
  CONSTRAINT resource_reviews_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(id)
);
CREATE TABLE public.saved_filter_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL,
  is_favorite boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  last_used_at timestamp without time zone DEFAULT now(),
  CONSTRAINT saved_filter_sets_pkey PRIMARY KEY (id),
  CONSTRAINT saved_filter_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.service_inquiries (
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
  CONSTRAINT service_inquiries_freelancer_id_fkey FOREIGN KEY (freelancer_id) REFERENCES public.freelancer_profiles(id),
  CONSTRAINT service_inquiries_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.freelancer_services(id),
  CONSTRAINT service_inquiries_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.subscription_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  active_jobs_count integer DEFAULT 0,
  ai_assessments_used integer DEFAULT 0,
  ad_optimizations_used integer DEFAULT 0,
  last_reset_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscription_usage_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  company_id uuid UNIQUE,
  tier character varying DEFAULT 'free'::character varying,
  status character varying DEFAULT 'inactive'::character varying,
  stripe_subscription_id character varying,
  stripe_customer_id character varying,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  canceled_at timestamp with time zone,
  ai_assessments_used integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  cancel_at_period_end boolean DEFAULT false,
  stripe_price_id text,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stripe_event_id character varying NOT NULL UNIQUE,
  event_type character varying NOT NULL,
  processed_at timestamp with time zone DEFAULT now(),
  status character varying DEFAULT 'processed'::character varying,
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id)
);
