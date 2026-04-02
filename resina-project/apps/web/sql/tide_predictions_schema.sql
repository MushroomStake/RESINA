-- Tide Predictions Table
-- Stores daily tide extremes (highs and lows) from StormGlass API
CREATE TABLE IF NOT EXISTS tide_predictions (
  id BIGSERIAL PRIMARY KEY,
  prediction_date DATE NOT NULL UNIQUE,
  -- JSON array of tide events: [{ type: "high"|"low", height: number, time: string (ISO 8601) }]
  tide_data JSONB NOT NULL,
  -- Metadata for cache management
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  api_credit_used BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for daily lookups and cache validity checks
CREATE INDEX IF NOT EXISTS idx_tide_predictions_date ON tide_predictions(prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_tide_predictions_fetched_at ON tide_predictions(fetched_at DESC);

-- Hourly tide interpolations (interpolated from extremes)
-- Optional: store computed hourly values to avoid recalculation on every request
CREATE TABLE IF NOT EXISTS tide_hourly (
  id BIGSERIAL PRIMARY KEY,
  prediction_date DATE NOT NULL,
  hour_of_day SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  estimated_height NUMERIC(5, 2) NOT NULL,
  confidence VARCHAR(50) DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(prediction_date, hour_of_day),
  FOREIGN KEY(prediction_date) REFERENCES tide_predictions(prediction_date) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tide_hourly_date ON tide_hourly(prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_tide_hourly_hour ON tide_hourly(hour_of_day);

-- RLS Policies
ALTER TABLE tide_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tide_hourly ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read tide data
CREATE POLICY "Allow read access to tide predictions"
  ON tide_predictions
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Allow read access to tide hourly"
  ON tide_hourly
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Allow service role (API) to insert/update tide data
CREATE POLICY "Allow service role to upsert tide predictions"
  ON tide_predictions
  FOR ALL
  TO service_role
  USING (TRUE);

CREATE POLICY "Allow service role to upsert tide hourly"
  ON tide_hourly
  FOR ALL
  TO service_role
  USING (TRUE);

-- Comments
COMMENT ON TABLE tide_predictions IS 'Daily tide extremes (highs/lows) from StormGlass API for Sta. Rita Bridge';
COMMENT ON TABLE tide_hourly IS 'Hourly interpolated tide heights derived from extremes using Rule of Twelfths';
COMMENT ON COLUMN tide_predictions.tide_data IS 'Array of { type: "high"|"low", height: meters, time: ISO 8601 }';
