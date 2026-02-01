-- Filter Analytics & Saved Filter Sets Migration
-- Creates tables to track filter usage and allow users to save their searches
-- ===== FILTER ANALYTICS TABLE =====
-- Track which filters are being used most frequently
CREATE TABLE IF NOT EXISTS filter_analytics (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE
    SET NULL,
        filter_city TEXT,
        filter_contract_types TEXT [],
        filter_benefits TEXT [],
        filter_min_salary INTEGER,
        filter_date_posted TEXT,
        filter_experience_levels TEXT [],
        radius_km DOUBLE PRECISION,
        has_distance_filter BOOLEAN DEFAULT false,
        result_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_filter_analytics_created ON filter_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_filter_analytics_user ON filter_analytics(user_id)
WHERE user_id IS NOT NULL;
-- RLS Policies for analytics (admin-only read access)
ALTER TABLE filter_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read all analytics" ON filter_analytics FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM auth.users
            WHERE auth.uid() = id
                AND raw_user_meta_data->>'role' = 'admin'
        )
    );
-- Anyone can insert analytics (for tracking)
CREATE POLICY "Anyone can insert analytics" ON filter_analytics FOR
INSERT WITH CHECK (true);
-- ===== SAVED FILTER SETS TABLE =====
-- Allow users to save and reload their favorite filter combinations
CREATE TABLE IF NOT EXISTS saved_filter_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    filters JSONB NOT NULL,
    is_favorite BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT name_length CHECK (char_length(name) <= 100)
);
-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filter_sets(user_id, last_used_at DESC);
-- RLS Policies for saved filters
ALTER TABLE saved_filter_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own saved filters" ON saved_filter_sets FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved filters" ON saved_filter_sets FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved filters" ON saved_filter_sets FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved filters" ON saved_filter_sets FOR DELETE USING (auth.uid() = user_id);
-- ===== RPC FUNCTIONS =====
-- Get popular filter combinations from last 30 days
CREATE OR REPLACE FUNCTION get_popular_filter_combinations(limit_count INTEGER DEFAULT 5) RETURNS TABLE(
        combination_key TEXT,
        usage_count BIGINT,
        avg_results INTEGER,
        filters JSONB
    ) AS $$ BEGIN RETURN QUERY WITH recent_filters AS (
        SELECT *
        FROM filter_analytics
        WHERE created_at >= NOW() - INTERVAL '30 days'
            AND result_count > 0 -- Only count successful searches
    ),
    combinations AS (
        SELECT -- Create unique key for each combination
            CONCAT_WS(
                '|',
                COALESCE(filter_city, ''),
                COALESCE(array_to_string(filter_contract_types, ','), ''),
                COALESCE(array_to_string(filter_benefits, ','), ''),
                COALESCE(filter_min_salary::TEXT, '')
            ) AS combo_key,
            COUNT(*) AS uses,
            AVG(result_count)::INTEGER AS avg_res,
            -- Build JSONB with the most common values for this combination
            jsonb_build_object(
                'filterCity',
                (
                    array_agg(
                        filter_city
                        ORDER BY created_at DESC
                    )
                ) [1],
                'filterContractTypes',
                (
                    array_agg(
                        filter_contract_types
                        ORDER BY created_at DESC
                    )
                ) [1],
                'filterBenefits',
                (
                    array_agg(
                        filter_benefits
                        ORDER BY created_at DESC
                    )
                ) [1],
                'filterMinSalary',
                (
                    array_agg(
                        filter_min_salary
                        ORDER BY created_at DESC
                    )
                ) [1]
            ) AS filter_data
        FROM recent_filters
        WHERE filter_city IS NOT NULL
            OR filter_contract_types IS NOT NULL
            OR filter_benefits IS NOT NULL
        GROUP BY combo_key
        HAVING COUNT(*) > 2 -- At least 3 uses
        ORDER BY uses DESC
        LIMIT limit_count
    )
SELECT combo_key,
    uses,
    avg_res,
    filter_data
FROM combinations;
END;
$$ LANGUAGE plpgsql;
-- Increment usage count for saved filter
CREATE OR REPLACE FUNCTION increment_filter_usage(filter_id UUID) RETURNS VOID AS $$ BEGIN
UPDATE saved_filter_sets
SET usage_count = usage_count + 1,
    last_used_at = NOW()
WHERE id = filter_id
    AND user_id = auth.uid();
-- Security: only update own filters
END;
$$ LANGUAGE plpgsql;