CREATE TABLE IF NOT EXISTS "vessel_position" (
  "mmsi" TEXT PRIMARY KEY CHECK ("mmsi" ~ '^[0-9]{9}$'),
  "ship_name" TEXT,
  "position" geography(Point, 4326) NOT NULL,
  "speed_over_ground" DOUBLE PRECISION,
  "course_over_ground" DOUBLE PRECISION,
  "true_heading" DOUBLE PRECISION,
  "source" TEXT NOT NULL DEFAULT 'aisstream',
  "received_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "vessel_position_received_at_idx" ON "vessel_position" ("received_at" DESC);
CREATE INDEX IF NOT EXISTS "vessel_position_geography_idx" ON "vessel_position" USING GIST ("position");

CREATE TABLE IF NOT EXISTS "vessel_position_history" (
  "history_id" BIGSERIAL PRIMARY KEY,
  "mmsi" TEXT NOT NULL CHECK ("mmsi" ~ '^[0-9]{9}$'),
  "ship_name" TEXT,
  "position" geography(Point, 4326) NOT NULL,
  "speed_over_ground" DOUBLE PRECISION,
  "course_over_ground" DOUBLE PRECISION,
  "true_heading" DOUBLE PRECISION,
  "received_at" TIMESTAMPTZ NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'aisstream',
  UNIQUE ("mmsi", "received_at")
);
CREATE INDEX IF NOT EXISTS "vessel_position_history_lookup_idx" ON "vessel_position_history" ("mmsi", "received_at" DESC);
CREATE INDEX IF NOT EXISTS "vessel_position_history_geography_idx" ON "vessel_position_history" USING GIST ("position");
