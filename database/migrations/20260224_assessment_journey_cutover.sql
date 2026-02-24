SET lock_timeout = '5s';
SET statement_timeout = '5min';
SET idle_in_transaction_session_timeout = '2min';

ALTER TABLE public.assessment_results
  ADD COLUMN IF NOT EXISTS journey_version text NOT NULL DEFAULT 'journey-v1',
  ADD COLUMN IF NOT EXISTS journey_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS decision_pattern jsonb,
  ADD COLUMN IF NOT EXISTS energy_balance jsonb,
  ADD COLUMN IF NOT EXISTS cultural_orientation jsonb,
  ADD COLUMN IF NOT EXISTS transferable_strengths text[],
  ADD COLUMN IF NOT EXISTS risk_zones text[],
  ADD COLUMN IF NOT EXISTS amplify_environments text[],
  ADD COLUMN IF NOT EXISTS drain_environments text[],
  ADD COLUMN IF NOT EXISTS legacy_mapped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS journey_quality_index double precision;

UPDATE public.assessment_results ar
SET
  journey_version = COALESCE(ar.journey_version, 'journey-v1'),
  journey_payload = CASE
    WHEN jsonb_typeof(ar.journey_payload) = 'object' AND ar.journey_payload <> '{}'::jsonb THEN ar.journey_payload
    WHEN jsonb_typeof(ar.answers) = 'object' THEN ar.answers
    WHEN jsonb_typeof(ar.raw_responses) = 'object' THEN ar.raw_responses
    ELSE jsonb_build_object(
      'journey_version', 'journey-v1',
      'technical', COALESCE(ar.answers, '{}'::jsonb),
      'psychometric', '{}'::jsonb,
      'decision_pattern', jsonb_build_object(
        'structured_vs_improv', 50,
        'risk_tolerance', 50,
        'sequential_vs_parallel', 50,
        'stakeholder_orientation', 50,
        'uncertainty_markers', jsonb_build_array()
      ),
      'behavioral_consistency', jsonb_build_object(
        'recurring_motifs', jsonb_build_array('Legacy record mapped to Journey format.'),
        'consistency_pairs', jsonb_build_array(),
        'preference_scenario_tensions', jsonb_build_array()
      ),
      'energy_balance', jsonb_build_object(
        'enthusiasm_markers', jsonb_build_array(),
        'exhaustion_markers', jsonb_build_array(),
        'must_vs_want_ratio', 1,
        'locus_of_control', 'mixed',
        'monthly_energy_hours_left', 80
      ),
      'cultural_orientation', jsonb_build_object(
        'transparency', 'Legacy mapping',
        'conflict_response', 'Legacy mapping',
        'hierarchy_vs_autonomy', 'Legacy mapping',
        'process_vs_outcome', 'Legacy mapping',
        'stability_vs_dynamics', 'Legacy mapping'
      ),
      'journey_trace', jsonb_build_object('phase_events', jsonb_build_array(), 'micro_insights', jsonb_build_array(), 'mode_switches', jsonb_build_array()),
      'final_profile', jsonb_build_object(
        'transferable_strengths', jsonb_build_array('Legacy mapping'),
        'risk_zones', jsonb_build_array(),
        'amplify_environments', jsonb_build_array(),
        'drain_environments', jsonb_build_array()
      ),
      'ai_disclaimer', jsonb_build_object('text', 'AI poskytuje interpretaci vzorců. Rozhodnutí je na vás.', 'shown_at_phase', jsonb_build_array(1,2,3,4,5)),
      'assessment_mode_used', 'classic',
      'mode_switch_count', 0,
      'mode_switch_timestamps', jsonb_build_array()
    )
  END,
  decision_pattern = COALESCE(ar.decision_pattern, ar.journey_payload -> 'decision_pattern'),
  energy_balance = COALESCE(ar.energy_balance, ar.journey_payload -> 'energy_balance'),
  cultural_orientation = COALESCE(ar.cultural_orientation, ar.journey_payload -> 'cultural_orientation'),
  transferable_strengths = COALESCE(ar.transferable_strengths, ARRAY(SELECT jsonb_array_elements_text(COALESCE(ar.journey_payload -> 'final_profile' -> 'transferable_strengths', '[]'::jsonb)))),
  risk_zones = COALESCE(ar.risk_zones, ARRAY(SELECT jsonb_array_elements_text(COALESCE(ar.journey_payload -> 'final_profile' -> 'risk_zones', '[]'::jsonb)))),
  amplify_environments = COALESCE(ar.amplify_environments, ARRAY(SELECT jsonb_array_elements_text(COALESCE(ar.journey_payload -> 'final_profile' -> 'amplify_environments', '[]'::jsonb)))),
  drain_environments = COALESCE(ar.drain_environments, ARRAY(SELECT jsonb_array_elements_text(COALESCE(ar.journey_payload -> 'final_profile' -> 'drain_environments', '[]'::jsonb)))),
  legacy_mapped = CASE
    WHEN (ar.journey_payload -> 'decision_pattern') IS NULL THEN true
    ELSE COALESCE(ar.legacy_mapped, false)
  END,
  journey_quality_index = COALESCE(
    ar.journey_quality_index,
    ROUND(
      (
        (
          COALESCE((ar.journey_payload -> 'decision_pattern' ->> 'structured_vs_improv')::numeric, 50) +
          COALESCE((ar.journey_payload -> 'decision_pattern' ->> 'risk_tolerance')::numeric, 50) +
          COALESCE((ar.journey_payload -> 'decision_pattern' ->> 'sequential_vs_parallel')::numeric, 50) +
          COALESCE((ar.journey_payload -> 'decision_pattern' ->> 'stakeholder_orientation')::numeric, 50)
        ) / 4.0
      ) * 0.5 +
      LEAST(100, COALESCE((ar.journey_payload -> 'energy_balance' ->> 'monthly_energy_hours_left')::numeric, 80)) * 0.3 +
      (
        (CASE WHEN COALESCE(ar.journey_payload -> 'cultural_orientation' ->> 'transparency', '') <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(ar.journey_payload -> 'cultural_orientation' ->> 'conflict_response', '') <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(ar.journey_payload -> 'cultural_orientation' ->> 'hierarchy_vs_autonomy', '') <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(ar.journey_payload -> 'cultural_orientation' ->> 'process_vs_outcome', '') <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(ar.journey_payload -> 'cultural_orientation' ->> 'stability_vs_dynamics', '') <> '' THEN 1 ELSE 0 END)
      ) * 20 * 0.2
    , 2)
  )
WHERE true;

CREATE INDEX IF NOT EXISTS idx_assessment_results_completed_at ON public.assessment_results (completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_results_company_id ON public.assessment_results (company_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_journey_version ON public.assessment_results (journey_version);
CREATE INDEX IF NOT EXISTS idx_assessment_results_journey_quality_index ON public.assessment_results (journey_quality_index DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_results_journey_payload_gin ON public.assessment_results USING gin (journey_payload);
