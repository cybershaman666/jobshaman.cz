SET lock_timeout = '5s';
SET statement_timeout = '5min';

INSERT INTO public.job_role_profiles
  (title, d1, d2, d3, d4, d5, d6, salary_range, growth_potential, ai_impact, ai_intensity, remote_friendly)
SELECT
  seed.title,
  seed.d1,
  seed.d2,
  seed.d3,
  seed.d4,
  seed.d5,
  seed.d6,
  seed.salary_range,
  seed.growth_potential,
  seed.ai_impact,
  seed.ai_intensity,
  seed.remote_friendly
FROM (
  VALUES
    ('QA Engineer', 5.60, 3.90, 5.10, 4.40, 4.90, 5.40, '65-120k CZK', 'Medium', 'Augmentation', 'medium', 'Hybrid'),
    ('Site Reliability Engineer', 5.90, 4.00, 5.20, 5.10, 4.90, 6.00, '95-180k CZK', 'High', 'Augmentation', 'high', 'Hybrid'),
    ('Business Analyst', 5.40, 5.20, 5.00, 4.40, 5.10, 5.00, '60-110k CZK', 'Medium', 'Augmentation', 'medium', 'Hybrid'),
    ('Customer Support Specialist', 3.90, 6.10, 4.60, 4.20, 5.20, 4.20, '35-60k CZK', 'Medium', 'Augmentation', 'medium', 'Hybrid'),
    ('Customer Success Manager', 4.50, 6.20, 5.10, 4.70, 5.40, 4.90, '55-100k CZK', 'High', 'Augmentation', 'medium', 'Hybrid'),
    ('Content Specialist', 4.50, 4.80, 4.90, 4.20, 5.20, 5.00, '40-75k CZK', 'Medium', 'Transformation', 'medium', 'Hybrid'),
    ('Copywriter', 4.30, 4.70, 4.90, 4.00, 5.30, 5.10, '40-80k CZK', 'Medium', 'Transformation', 'high', 'Remote'),
    ('Graphic Designer', 4.30, 4.60, 4.80, 4.10, 5.40, 4.80, '40-80k CZK', 'Medium', 'Transformation', 'medium', 'Hybrid'),
    ('Recruiter', 4.20, 6.20, 5.10, 4.60, 5.30, 4.60, '45-85k CZK', 'Medium', 'Transformation', 'medium', 'Hybrid'),
    ('Office Manager', 4.20, 5.60, 4.70, 4.60, 5.00, 4.40, '40-70k CZK', 'Medium', 'Augmentation', 'low', 'Onsite'),
    ('Legal Counsel', 5.80, 4.80, 5.00, 4.20, 5.70, 4.60, '90-180k CZK', 'High', 'Augmentation', 'medium', 'Hybrid'),
    ('Paralegal', 5.20, 4.60, 4.70, 4.10, 5.40, 4.40, '45-80k CZK', 'Medium', 'Augmentation', 'medium', 'Hybrid'),
    ('Pharmacist', 5.20, 5.00, 4.80, 4.20, 5.80, 4.40, '55-95k CZK', 'High', 'Augmentation', 'medium', 'Onsite'),
    ('Physiotherapist', 4.40, 6.00, 4.90, 4.60, 5.70, 4.20, '45-80k CZK', 'High', 'Augmentation', 'low', 'Onsite'),
    ('Laboratory Technician', 5.10, 4.10, 4.60, 4.30, 5.20, 4.50, '40-70k CZK', 'Medium', 'Augmentation', 'medium', 'Onsite'),
    ('Dentist', 5.50, 5.20, 5.10, 4.80, 5.80, 4.50, '90-220k CZK', 'High', 'Augmentation', 'medium', 'Onsite'),
    ('Electrician', 4.80, 3.90, 4.60, 4.80, 4.90, 4.10, '45-85k CZK', 'Medium', 'Augmentation', 'low', 'Onsite'),
    ('Plumber', 4.50, 4.10, 4.60, 4.90, 4.80, 3.90, '40-80k CZK', 'Medium', 'Augmentation', 'low', 'Onsite'),
    ('Welder', 4.20, 3.60, 4.40, 4.90, 4.60, 3.80, '40-75k CZK', 'Medium', 'At Risk', 'low', 'Onsite'),
    ('CNC Operator', 4.70, 3.50, 4.50, 4.70, 4.70, 4.10, '40-70k CZK', 'Medium', 'Transformation', 'medium', 'Onsite'),
    ('Forklift Operator', 3.90, 3.70, 4.30, 4.60, 4.40, 3.60, '35-55k CZK', 'Low', 'Transformation', 'low', 'Onsite'),
    ('Dispatcher', 4.60, 4.90, 4.80, 5.00, 4.90, 4.50, '40-75k CZK', 'Medium', 'Augmentation', 'medium', 'Onsite'),
    ('Procurement Specialist', 4.80, 5.10, 4.90, 4.50, 4.90, 4.80, '50-90k CZK', 'Medium', 'Transformation', 'medium', 'Hybrid'),
    ('Supply Chain Analyst', 5.30, 4.80, 4.90, 4.60, 4.90, 5.20, '60-110k CZK', 'High', 'Augmentation', 'medium', 'Hybrid')
) AS seed(title, d1, d2, d3, d4, d5, d6, salary_range, growth_potential, ai_impact, ai_intensity, remote_friendly)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.job_role_profiles existing
  WHERE lower(existing.title) = lower(seed.title)
);
