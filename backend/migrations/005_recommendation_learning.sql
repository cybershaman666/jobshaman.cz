-- Up Migration
CREATE TABLE recommendation_personalized_weights (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    alpha_skill DOUBLE PRECISION NOT NULL DEFAULT 0.38,
    beta_evidence DOUBLE PRECISION NOT NULL DEFAULT 0.18,
    gamma_growth DOUBLE PRECISION NOT NULL DEFAULT 0.18,
    delta_values DOUBLE PRECISION NOT NULL DEFAULT 0.26,
    lambda_risk DOUBLE PRECISION NOT NULL DEFAULT 0.32,
    calibration DOUBLE PRECISION NOT NULL DEFAULT 8.0,
    source_event VARCHAR(255) NOT NULL DEFAULT 'system_default',
    meta_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_recommendation_personalized_weights_user_id ON recommendation_personalized_weights(user_id);
