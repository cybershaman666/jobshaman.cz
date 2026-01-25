-- Utility script to reset user roles if needed
-- Run this in Supabase SQL editor to reset a user's role to 'candidate'

-- Replace 'user-id-here' with the actual user ID
-- UPDATE public.profiles
-- SET role = 'candidate'
-- WHERE id = 'user-id-here';

-- To find users with recruiter role who might not have companies:
-- SELECT p.id, p.email, p.full_name, p.role
-- FROM public.profiles p
-- LEFT JOIN public.companies c ON p.id = c.owner_id
-- WHERE p.role = 'recruiter' AND c.id IS NULL;