-- ASSESSMENT INVITATIONS SYSTEM
-- Enables invitation-only access to assessments (replaces interviews)
-- Run this in Supabase SQL Editor

-- ========================================
-- ASSESSMENT INVITATIONS TABLE
-- ========================================
-- Tracks which candidates are invited to take which assessments by companies

CREATE TABLE IF NOT EXISTS assessment_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    assessment_id VARCHAR(255) NOT NULL,
    candidate_id UUID,
    candidate_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, completed, expired, revoked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    invitation_token VARCHAR(255) UNIQUE NOT NULL,
    metadata JSONB, -- Additional data like job_title, assessment_name, etc
    
    -- Constraints
    CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_candidate FOREIGN KEY (candidate_id) REFERENCES profiles(id) ON DELETE SET NULL,
    CONSTRAINT check_candidate_info CHECK (
        -- Must have either candidate_id or candidate_email
        (candidate_id IS NOT NULL) OR (candidate_email IS NOT NULL)
    ),
    CONSTRAINT check_invitation_status CHECK (
        status IN ('pending', 'accepted', 'completed', 'expired', 'revoked')
    )
);

-- Create indexes for performance
CREATE INDEX idx_invitations_company ON assessment_invitations(company_id);
CREATE INDEX idx_invitations_candidate ON assessment_invitations(candidate_id);
CREATE INDEX idx_invitations_candidate_email ON assessment_invitations(candidate_email);
CREATE INDEX idx_invitations_status ON assessment_invitations(status);
CREATE INDEX idx_invitations_created ON assessment_invitations(created_at);
CREATE INDEX idx_invitations_token ON assessment_invitations(invitation_token);
CREATE INDEX idx_invitations_expires ON assessment_invitations(expires_at);

-- ========================================
-- ASSESSMENT RESULTS TABLE (if not exists)
-- ========================================
-- Tracks assessment completion and scores

CREATE TABLE IF NOT EXISTS assessment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    candidate_id UUID,
    invitation_id UUID,
    assessment_id VARCHAR(255) NOT NULL,
    role VARCHAR(255),
    difficulty VARCHAR(50),
    questions_total INTEGER,
    questions_correct INTEGER,
    score NUMERIC(5,2), -- 0-100
    time_spent_seconds INTEGER,
    answers JSONB, -- Detailed answer data
    feedback TEXT, -- AI-generated feedback
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_candidate FOREIGN KEY (candidate_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_invitation FOREIGN KEY (invitation_id) REFERENCES assessment_invitations(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_results_company ON assessment_results(company_id);
CREATE INDEX idx_results_candidate ON assessment_results(candidate_id);
CREATE INDEX idx_results_invitation ON assessment_results(invitation_id);
CREATE INDEX idx_results_assessment ON assessment_results(assessment_id);
CREATE INDEX idx_results_completed ON assessment_results(completed_at);

-- ========================================
-- ENABLE RLS (ROW LEVEL SECURITY)
-- ========================================

-- Invitations: Companies can manage own invitations, candidates can see their own
ALTER TABLE assessment_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies can view own invitations" ON assessment_invitations
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM companies WHERE id = company_id
    ));

CREATE POLICY "Candidates can view own invitations" ON assessment_invitations
    FOR SELECT USING (
        candidate_id = auth.uid() OR 
        candidate_email = (SELECT email FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Companies can create invitations" ON assessment_invitations
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT user_id FROM companies WHERE id = company_id
    ));

CREATE POLICY "Companies can update own invitations" ON assessment_invitations
    FOR UPDATE USING (auth.uid() IN (
        SELECT user_id FROM companies WHERE id = company_id
    ));

-- Results: Companies can view candidate results, candidates can view own
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies can view results" ON assessment_results
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM companies WHERE id = company_id
    ));

CREATE POLICY "Candidates can view own results" ON assessment_results
    FOR SELECT USING (candidate_id = auth.uid());

CREATE POLICY "Service can insert results" ON assessment_results
    FOR INSERT WITH CHECK (true);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- SELECT COUNT(*) FROM assessment_invitations;
-- SELECT COUNT(*) FROM assessment_results;
