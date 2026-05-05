-- Performance Optimization Indexes for JobShaman V2
-- Target table: jobs_nf (Scraped and imported jobs)

-- 1. Index for active jobs filtering
CREATE INDEX IF NOT EXISTS idx_jobs_nf_active_status ON jobs_nf (is_active, status) WHERE is_active = true;

-- 2. Index for country-based filtering
-- Note: country_code is often used, but sometimes it's in payload_json.
-- We index the explicit column first.
CREATE INDEX IF NOT EXISTS idx_jobs_nf_country ON jobs_nf (country_code);

-- 3. Composite index for the recommendation feed ordering
-- The feed often orders by the most recent of these three.
-- An index on the most common ordering columns helps.
CREATE INDEX IF NOT EXISTS idx_jobs_nf_recency ON jobs_nf (scraped_at DESC NULLS LAST, updated_at DESC NULLS LAST);

-- 4. GIN index for payload_json if we want to speed up JSONB queries
-- Assuming jobs_nf.payload_json is jsonb
CREATE INDEX IF NOT EXISTS idx_jobs_nf_payload_gin ON jobs_nf USING GIN (payload_json);

-- 5. Index for title/company for keyword searches
CREATE INDEX IF NOT EXISTS idx_jobs_nf_title_company ON jobs_nf (title, company);
