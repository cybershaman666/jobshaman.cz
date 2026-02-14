-- Add AI-guided profile fields and AI-generated CV text

alter table candidate_profiles
  add column if not exists story text,
  add column if not exists hobbies text[],
  add column if not exists volunteering text[],
  add column if not exists leadership text[],
  add column if not exists strengths text[],
  add column if not exists values text[],
  add column if not exists inferred_skills text[],
  add column if not exists awards text[],
  add column if not exists certifications text[],
  add column if not exists side_projects text[],
  add column if not exists motivations text[],
  add column if not exists work_preferences text[],
  add column if not exists cv_ai_text text;
