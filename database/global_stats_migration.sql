-- RPC to fetch real-time global statistics for the landing page/blog
CREATE OR REPLACE FUNCTION get_global_stats() RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_total_legal BIGINT;
v_with_salary BIGINT;
v_transparency_rate INT;
v_avg_jhi INT := 78;
-- Market average
BEGIN -- 1. Count active legal jobs
SELECT count(*) INTO v_total_legal
FROM jobs
WHERE legality_status = 'legal';
-- 2. Calculate transparency rate (jobs with salary info)
SELECT count(*) INTO v_with_salary
FROM jobs
WHERE legality_status = 'legal'
    AND (
        salary_from IS NOT NULL
        OR salary_to IS NOT NULL
    );
IF v_total_legal > 0 THEN v_transparency_rate := (v_with_salary * 100) / v_total_legal;
ELSE v_transparency_rate := 0;
END IF;
-- Return as JSON object
RETURN jsonb_build_object(
    'active_jobs',
    v_total_legal,
    'transparency_rate',
    v_transparency_rate,
    'avg_jhi',
    v_avg_jhi
);
END;
$$;
-- Grant permissions
GRANT EXECUTE ON FUNCTION get_global_stats TO anon,
    authenticated,
    service_role;