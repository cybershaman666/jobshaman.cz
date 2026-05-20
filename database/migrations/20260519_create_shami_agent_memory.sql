-- Vytvoření tabulky pro perzistenci chatů a osobnostních stavů Shami agenta navázané na konkrétního uživatele.
CREATE TABLE IF NOT EXISTS shami_agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    chat_history JSONB NOT NULL, -- Pole objektů (struktura: [{role: 'user'|'agent', message: '...'}])
    agent_state JSONB NULL,      -- Volitelné, např. osobnost, vektorové charakteristiky, atd.
    last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shami_agent_memory_user_id ON shami_agent_memory(user_id);