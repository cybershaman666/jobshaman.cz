-- Tax profile and personalized JHI preferences for candidate profiles.
SET lock_timeout = '5s';
SET statement_timeout = '5min';
SET idle_in_transaction_session_timeout = '2min';

ALTER TABLE public.candidate_profiles
    ADD COLUMN IF NOT EXISTS tax_profile jsonb;

ALTER TABLE public.candidate_profiles
    ADD COLUMN IF NOT EXISTS jhi_preferences jsonb DEFAULT '{
      "pillarWeights": {"financial": 0.3, "timeCost": 0.25, "mentalLoad": 0.2, "growth": 0.15, "values": 0.1},
      "hardConstraints": {"mustRemote": false, "maxCommuteMinutes": null, "minNetMonthly": null, "excludeShift": false, "growthRequired": false},
      "workStyle": {"peopleIntensity": 50, "careerGrowthPreference": 50, "homeOfficePreference": 50}
    }'::jsonb;

UPDATE public.candidate_profiles cp
SET tax_profile = COALESCE(
    cp.tax_profile,
    jsonb_build_object(
        'countryCode', COALESCE(p.preferred_country_code, 'CZ'),
        'taxYear', 2026,
        'employmentType', 'employee',
        'maritalStatus', 'single',
        'spouseAnnualIncome', 0,
        'childrenCount', 0,
        'isSingleParent', false,
        'specialReliefs', jsonb_build_array()
    )
)
FROM public.profiles p
WHERE p.id = cp.id;

UPDATE public.candidate_profiles AS cp
SET jhi_preferences = COALESCE(
    cp.jhi_preferences,
    jsonb_build_object(
        'pillarWeights', jsonb_build_object(
            'financial', GREATEST(0.1, LEAST(0.6, COALESCE((cp.preferences ->> 'financialGoals')::numeric, 50) / 100)),
            'timeCost', GREATEST(0.1, LEAST(0.6, COALESCE((cp.preferences ->> 'workLifeBalance')::numeric, 50) / 100)),
            'mentalLoad', 0.2,
            'growth', 0.15,
            'values', 0.1
        ),
        'hardConstraints', jsonb_build_object(
            'mustRemote', false,
            'maxCommuteMinutes', null,
            'minNetMonthly', NULLIF((cp.preferences ->> 'minNetMonthly'), '')::numeric,
            'excludeShift', false,
            'growthRequired', false
        ),
        'workStyle', jsonb_build_object(
            'peopleIntensity', CASE
                WHEN COALESCE(to_jsonb(cp) ->> 'work_preferences', '') ~* '(office|team|people|onsite|on-site)' THEN 70
                WHEN COALESCE(to_jsonb(cp) ->> 'work_preferences', '') ~* '(remote|async|quiet|focus)' THEN 35
                ELSE 50
            END,
            'careerGrowthPreference', 50,
            'homeOfficePreference', CASE
                WHEN COALESCE(to_jsonb(cp) ->> 'work_preferences', '') ~* '(remote|home office|home-office)' THEN 80
                WHEN COALESCE(to_jsonb(cp) ->> 'work_preferences', '') ~* '(onsite|on-site|office)' THEN 30
                ELSE 50
            END
        )
    )
);
