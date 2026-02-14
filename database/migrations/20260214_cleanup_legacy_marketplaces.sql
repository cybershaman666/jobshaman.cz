-- Cleanup legacy marketplace/education tables that are no longer part of Career OS.
-- Destructive migration by request.

-- Freelance marketplace
DROP TABLE IF EXISTS public.service_inquiries CASCADE;
DROP TABLE IF EXISTS public.freelancer_portfolio_items CASCADE;
DROP TABLE IF EXISTS public.freelancer_review_votes CASCADE;
DROP TABLE IF EXISTS public.freelancer_reviews CASCADE;
DROP TABLE IF EXISTS public.freelancer_services CASCADE;
DROP TABLE IF EXISTS public.freelancer_skills CASCADE;
DROP TABLE IF EXISTS public.freelancer_profiles CASCADE;

-- Education / course marketplace
DROP TABLE IF EXISTS public.course_review_votes CASCADE;
DROP TABLE IF EXISTS public.course_reviews CASCADE;
DROP TABLE IF EXISTS public.resource_reviews CASCADE;
DROP TABLE IF EXISTS public.career_tracks CASCADE;
DROP TABLE IF EXISTS public.learning_resources CASCADE;
DROP TABLE IF EXISTS public.marketplace_partners CASCADE;

-- Legacy experiments / matching artifacts no longer used in runtime
DROP TABLE IF EXISTS public.ab_test_conversions CASCADE;
DROP TABLE IF EXISTS public.ab_test_assignments CASCADE;
DROP TABLE IF EXISTS public.job_candidate_matches CASCADE;
DROP TABLE IF EXISTS public.recruiter_profiles CASCADE;
