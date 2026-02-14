-- Career OS: default guardrail configuration for matching recommendations

-- Ensure active matching model rows carry sane diversity/exploration defaults.
update model_registry
set config_json =
  coalesce(config_json, '{}'::jsonb)
  || case when not (coalesce(config_json, '{}'::jsonb) ? 'max_per_company') then '{"max_per_company":3}'::jsonb else '{}'::jsonb end
  || case when not (coalesce(config_json, '{}'::jsonb) ? 'new_job_window_days') then '{"new_job_window_days":7}'::jsonb else '{}'::jsonb end
  || case when not (coalesce(config_json, '{}'::jsonb) ? 'min_new_job_share') then '{"min_new_job_share":0.15}'::jsonb else '{}'::jsonb end
  || case when not (coalesce(config_json, '{}'::jsonb) ? 'exploration_rate') then '{"exploration_rate":0.12}'::jsonb else '{}'::jsonb end
  || case when not (coalesce(config_json, '{}'::jsonb) ? 'min_long_tail_share') then '{"min_long_tail_share":0.10}'::jsonb else '{}'::jsonb end
  || case when not (coalesce(config_json, '{}'::jsonb) ? 'long_tail_company_threshold') then '{"long_tail_company_threshold":2}'::jsonb else '{}'::jsonb end
where subsystem = 'matching'
  and feature = 'recommendations'
  and is_active = true;

-- If no active matching row exists yet, seed one with full guardrail defaults.
insert into model_registry(subsystem, feature, version, provider, model_name, is_primary, is_fallback, is_active, config_json)
select
  'matching',
  'recommendations',
  'career-os-v2',
  'internal',
  'hybrid-vector-structured-v2',
  true,
  false,
  true,
  '{
    "shortlist_size":220,
    "min_score":25,
    "weights":{"skill":0.35,"demand":0.15,"seniority":0.15,"salary":0.15,"geo":0.20},
    "max_per_company":3,
    "new_job_window_days":7,
    "min_new_job_share":0.15,
    "exploration_rate":0.12,
    "min_long_tail_share":0.10,
    "long_tail_company_threshold":2
  }'::jsonb
where not exists (
  select 1 from model_registry where subsystem = 'matching' and feature = 'recommendations' and is_active = true
);
