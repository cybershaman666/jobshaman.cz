-- ============================================================================
-- INSTANT GIGS MODULE: Database Schema
-- Oddělená vrstva od klasických jobs, optimalizovaná na high-throughput
-- a legal compliance v CEE (CZ, SK, PL, etc.)
-- ============================================================================

-- Hlavní tabulka gigs (jednorázové práce)
CREATE TABLE IF NOT EXISTS instant_gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifikace
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  gig_type VARCHAR(50) NOT NULL, -- 'logistics', 'event', 'retail', 'hospitality', 'other'
  
  -- Lokace a čas
  location_name VARCHAR(255) NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  country_code VARCHAR(2) NOT NULL DEFAULT 'CZ', -- Geografická scope
  
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  estimated_hours INT NOT NULL,
  
  -- Kompenzace
  compensation_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'CZK',
  payment_type VARCHAR(20) NOT NULL, -- 'fixed', 'hourly'
  
  -- Payout timing - KLÍČOVÁ FEATURE pro trust
  payout_speed VARCHAR(20) NOT NULL DEFAULT 'instant', -- 'instant', '24h', '3days'
  
  -- State Machine
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open, matched, in_progress, completed, paid, cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  required_skills TEXT[],
  spot_count INT NOT NULL DEFAULT 1, -- Kolik lidí potřebujeme
  spots_filled INT NOT NULL DEFAULT 0,
  
  INDEX idx_company_status (company_id, status),
  INDEX idx_country_status (country_code, status),
  INDEX idx_location_geo (latitude, longitude),
  INDEX idx_start_time (start_time),
  UNIQUE (id)
);

-- Mapping mezi gigs a workery
CREATE TABLE IF NOT EXISTS instant_gig_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID NOT NULL REFERENCES instant_gigs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Assignment tracking
  status VARCHAR(20) NOT NULL DEFAULT 'offered', -- offered, accepted, started, completed, no_show, cancelled
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Actual hours worked (pro hourly gigs)
  hours_worked DECIMAL(5, 2),
  actual_amount_paid DECIMAL(10, 2),
  
  -- Rating - oboustranná (worker hodnotí firmu, firma hodnotí workera)
  worker_rating_given INT, -- 1-5 hvězd
  worker_rating_text TEXT,
  company_rating_given INT,
  company_rating_text TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_gig_status (gig_id, status),
  INDEX idx_worker_status (worker_id, status),
  UNIQUE (gig_id, worker_id) -- Jedna osoba nemůže být dvakrát na jednom gig
);

-- ============================================================================
-- COMPLIANCE LAYER: Tracking annual earnings pro limite
-- ============================================================================

CREATE TABLE IF NOT EXISTS casual_earnings_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL DEFAULT 'CZ',
  
  -- Agregované příjmy (aktualizované daily/weekly)
  annual_earnings_eur DECIMAL(12, 2) NOT NULL DEFAULT 0, -- Konvertujeme na EUR pro cross-border
  annual_earnings_local DECIMAL(12, 2) NOT NULL DEFAULT 0, -- Local currency (CZK, etc)
  
  -- Compliance status - automaticky nastaveno podle limitu
  compliance_status VARCHAR(30) NOT NULL DEFAULT 'casual', 
  -- Možnosti:
  --   'casual' = pod limitům (50k CZK / ~2000 EUR)
  --   'approaching' = 40-50k CZK
  --   'requires_ico' = nad limitem, potřebuje IČO
  --   'b2b_registered' = registrovaný s IČO/živnostenský list
  --   'dpp_contract' = DPP s firmou
  
  -- Metadata
  ico_number VARCHAR(20), -- Pokud má živnostenský list
  ico_verified_at TIMESTAMP, -- Kdy jsme ověřili v ARES
  has_active_dpp BOOLEAN DEFAULT FALSE, -- Zda má platnou DPP
  
  last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  calendar_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_worker_country (worker_id, country_code),
  INDEX idx_compliance_status (compliance_status),
  INDEX idx_calendar_year (calendar_year)
);

-- Tabulka pro tracking earnings per gig (pro audit trail a reporting)
CREATE TABLE IF NOT EXISTS casual_earnings_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gig_assignment_id UUID NOT NULL REFERENCES instant_gig_assignments(id) ON DELETE CASCADE,
  
  amount_earned DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'CZK',
  amount_eur DECIMAL(10, 2), -- Konvertovaná na EUR
  
  country_code VARCHAR(2) NOT NULL,
  gig_date DATE NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  calendar_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  
  INDEX idx_worker_year (worker_id, calendar_year),
  INDEX idx_gig_assignment (gig_assignment_id)
);

-- ============================================================================
-- ESCROW & PAYMENT ORCHESTRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS instant_gig_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_assignment_id UUID NOT NULL UNIQUE REFERENCES instant_gig_assignments(id) ON DELETE CASCADE,
  
  -- Stav transakce
  status VARCHAR(30) NOT NULL DEFAULT 'pending', 
  -- pending -> held_in_escrow -> released -> completed
  
  -- Částky
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'CZK',
  platform_fee_pct DECIMAL(5, 2) NOT NULL DEFAULT 8.0, -- 8% je standard
  platform_fee_amount DECIMAL(10, 2),
  worker_payout_amount DECIMAL(10, 2),
  
  -- Stripe payment references
  stripe_charge_id VARCHAR(255), -- Charge ID od firmy
  stripe_transfer_id VARCHAR(255), -- Transfer ID do workera
  
  -- Timing
  held_at TIMESTAMP,
  released_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Audit trail
  company_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_status (status),
  INDEX idx_worker_payout (worker_id, status),
  INDEX idx_company_charges (company_id, status)
);

-- ============================================================================
-- REAL-TIME NOTIFICATIONS (pro push notifikace během párování)
-- ============================================================================

CREATE TABLE IF NOT EXISTS instant_gig_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gig_id UUID NOT NULL REFERENCES instant_gigs(id) ON DELETE CASCADE,
  
  notification_type VARCHAR(50) NOT NULL, -- 'gig_match', 'gig_accepted', 'gig_reminder', etc
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  
  -- Delivery tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  action_taken BOOLEAN DEFAULT FALSE,
  
  -- Push service identifiers
  fcm_token VARCHAR(500), -- Firebase Cloud Messaging
  
  INDEX idx_worker_read (worker_id, read_at),
  INDEX idx_gig_notifications (gig_id)
);

-- ============================================================================
-- ANALYTICS & MONITORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS instant_gig_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  country_code VARCHAR(2) NOT NULL,
  date DATE NOT NULL,
  
  -- Gig metrics
  gigs_posted INT DEFAULT 0,
  gigs_filled INT DEFAULT 0,
  gigs_cancelled INT DEFAULT 0,
  avg_time_to_fill INT, -- v minutách
  
  -- Worker metrics
  workers_active INT DEFAULT 0,
  avg_rating DECIMAL(3, 2),
  no_show_rate DECIMAL(5, 2),
  
  -- Payment metrics
  total_volume_paid DECIMAL(15, 2),
  avg_gig_value DECIMAL(10, 2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (country_code, date)
);

-- ============================================================================
-- AUDIT TRAIL (pro compliance a dispute resolution)
-- ============================================================================

CREATE TABLE IF NOT EXISTS instant_gig_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  resource_type VARCHAR(50) NOT NULL, -- 'gig', 'assignment', 'payment', 'worker'
  resource_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'accepted', 'completed', 'disputed', etc
  
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_type VARCHAR(20) NOT NULL, -- 'worker', 'company', 'admin'
  
  change_data JSONB,
  reason TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_actor (actor_id),
  INDEX idx_action (action)
);

-- ============================================================================
-- VIEWS pro common queries
-- ============================================================================

CREATE OR REPLACE VIEW active_gigs_available AS
SELECT 
  ig.id,
  ig.title,
  ig.location_name,
  ig.start_time,
  ig.compensation_amount,
  ig.spot_count - ig.spots_filled as spots_available,
  ig.country_code
FROM instant_gigs ig
WHERE ig.status = 'open'
  AND ig.start_time > CURRENT_TIMESTAMP
  AND ig.spots_filled < ig.spot_count
ORDER BY ig.start_time ASC;

CREATE OR REPLACE VIEW worker_compliance_status AS
SELECT 
  w.id,
  w.email,
  cet.compliance_status,
  cet.annual_earnings_local,
  cet.annual_earnings_eur,
  CASE 
    WHEN cet.compliance_status = 'casual' THEN 'Zelená'
    WHEN cet.compliance_status = 'approaching' THEN 'Oranžová'
    WHEN cet.compliance_status IN ('requires_ico', 'b2b_registered') THEN 'Červená'
    ELSE 'Neznámá'
  END as compliance_zone,
  (50000 - cet.annual_earnings_local)::INT as remaining_casual_limit_czk
FROM auth.users w
JOIN casual_earnings_tracker cet ON w.id = cet.worker_id
WHERE w.user_metadata->>'role' = 'worker' OR w.app_metadata->>'role' = 'worker';
