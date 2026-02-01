-- Migration: Add AI Evaluation to Assessment Results
-- 1. Add JSONB column for AI evaluation data
ALTER TABLE public.assessment_results
ADD COLUMN IF NOT EXISTS ai_evaluation JSONB;
-- 2. Create RPC function to safely save evaluation
-- Used by Recruiter Dashboard (Frontend)
CREATE OR REPLACE FUNCTION save_assessment_evaluation(p_result_id UUID, p_evaluation JSONB) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
UPDATE public.assessment_results
SET ai_evaluation = p_evaluation
WHERE id = p_result_id;
RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION save_assessment_evaluation TO authenticated,
    service_role;