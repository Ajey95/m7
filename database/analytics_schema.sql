-- ============================================================================
-- FOOD RESCUE PLATFORM — ANALYTICS SCHEMA EXTENSIONS
-- Append to existing schema.sql (or run separately after schema.sql)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- US5: Sustainability Credits (Gamification)
-- One row per credit-earning event per donor
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sustainability_credits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id        UUID REFERENCES donors(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
    points_earned   INT NOT NULL DEFAULT 0,
    reason          VARCHAR(100),   -- e.g. 'DELIVERY_COMPLETE', 'STREAK_BONUS'
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credits_donor_id  ON sustainability_credits(donor_id);
CREATE INDEX idx_credits_task_id   ON sustainability_credits(task_id);

-- ---------------------------------------------------------------------------
-- US8: Fraud Flags (output of Isolation Forest model)
-- One row per flagged anomaly; re-run model periodically to refresh rows
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fraud_flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     VARCHAR(20) NOT NULL,   -- 'DONOR' | 'NGO' | 'VOLUNTEER'
    entity_id       UUID NOT NULL,
    anomaly_score   NUMERIC(6, 4),          -- Isolation Forest raw score
    reason          TEXT,
    is_reviewed     BOOLEAN DEFAULT FALSE,
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMP,
    flagged_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fraud_entity      ON fraud_flags(entity_type, entity_id);
CREATE INDEX idx_fraud_reviewed    ON fraud_flags(is_reviewed);

-- ---------------------------------------------------------------------------
-- US14: NGO Feedback Sentiments (VADER NLP, cached after each feedback write)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ngo_feedback_sentiments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
    donor_id        UUID REFERENCES donors(id),
    ngo_id          UUID REFERENCES ngos(id),
    raw_feedback    TEXT NOT NULL,
    compound_score  NUMERIC(5, 4),  -- VADER compound: -1.0 to 1.0
    label           VARCHAR(10),    -- 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
    analyzed_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sentiment_ngo_id  ON ngo_feedback_sentiments(ngo_id);
CREATE INDEX idx_sentiment_donor   ON ngo_feedback_sentiments(donor_id);

-- ---------------------------------------------------------------------------
-- US11: Nutritional Tags — static lookup seeded below
-- Stores avg nutrients per kg for each food_type
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nutritional_tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_type       VARCHAR(20) NOT NULL UNIQUE,   -- VEG / NON_VEG / VEGAN / MIXED
    calories_per_kg NUMERIC(8, 2),
    protein_g_per_kg NUMERIC(8, 2),
    carbs_g_per_kg  NUMERIC(8, 2),
    fat_g_per_kg    NUMERIC(8, 2),
    fiber_g_per_kg  NUMERIC(8, 2)
);

-- Seed nutritional data (FAO / ICMR estimates)
INSERT INTO nutritional_tags
    (food_type, calories_per_kg, protein_g_per_kg, carbs_g_per_kg, fat_g_per_kg, fiber_g_per_kg)
VALUES
    ('VEG',     800,  22,  150,  8,  18),
    ('NON_VEG', 1500, 80,   50, 60,   5),
    ('VEGAN',   700,  18,  160,  5,  22),
    ('MIXED',   1050, 48,  105, 32,  12)
ON CONFLICT (food_type) DO NOTHING;
