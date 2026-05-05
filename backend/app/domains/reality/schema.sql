-- Schema for Reality Domain (V2)

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    industry TEXT,
    tone TEXT,
    philosophy TEXT,
    address TEXT,
    legal_address TEXT,
    values_json TEXT DEFAULT '[]',
    profile_data TEXT DEFAULT '{}',
    logo_url TEXT,
    hero_image TEXT,
    narrative TEXT,
    website_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT,
    description TEXT,
    salary_from INTEGER,
    salary_to INTEGER,
    currency TEXT DEFAULT 'CZK',
    work_model TEXT DEFAULT 'Hybrid', -- Remote, Hybrid, On-site
    location TEXT,
    skills_required TEXT DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'published',
    source_kind TEXT DEFAULT 'native_challenge',
    challenge_format TEXT DEFAULT 'standard',
    assessment_tasks JSONB DEFAULT '[]',
    handshake_blueprint_v1 JSONB DEFAULT '{}',
    capacity_policy JSONB DEFAULT '{}',
    editor_state JSONB DEFAULT '{}',
    published_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_opportunities_company_id ON opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_is_active ON opportunities(is_active);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
