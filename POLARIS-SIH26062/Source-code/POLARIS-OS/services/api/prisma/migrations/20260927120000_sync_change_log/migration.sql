ALTER TABLE "expedition" ADD COLUMN "sync_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "expedition" ADD COLUMN "sync_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "transport_leg" ADD COLUMN "sync_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "cargo_item" ADD COLUMN "sync_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "inventory_stock" ADD COLUMN "sync_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "inventory_stock" ADD COLUMN "sync_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "personnel_assignment" ADD COLUMN "sync_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "incident" ADD COLUMN "sync_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "approval" ADD COLUMN "sync_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "approval" ADD COLUMN "sync_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "sync_change" (
    "cursor" BIGSERIAL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "entity_version" INTEGER NOT NULL,
    "station_ids" UUID[] NOT NULL DEFAULT '{}',
    "deleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "record" JSONB NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "sync_operation" ADD COLUMN "local_timestamp" TIMESTAMPTZ(6);
CREATE INDEX "sync_change_entity_idx" ON "sync_change" ("entity_type", "entity_id", "cursor");

CREATE OR REPLACE FUNCTION polaris_record_sync_change() RETURNS trigger AS $$
DECLARE
  row_data JSONB;
  record_id UUID;
  record_version INTEGER;
  station_ids UUID[] := '{}'::UUID[];
  deleted_flag BOOLEAN := TG_OP = 'DELETE';
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
    record_id := (row_data ->> TG_ARGV[1])::UUID;
    record_version := COALESCE((row_data ->> 'sync_version')::INTEGER, 0) + 1;
  ELSE
    IF TG_OP = 'INSERT' THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object(
        'sync_version', GREATEST(COALESCE((to_jsonb(NEW) ->> 'sync_version')::INTEGER, 0), 1),
        'sync_updated_at', CURRENT_TIMESTAMP
      ));
    ELSE
      NEW := jsonb_populate_record(NEW, jsonb_build_object(
        'sync_version', COALESCE((to_jsonb(OLD) ->> 'sync_version')::INTEGER, 0) + 1,
        'sync_updated_at', CURRENT_TIMESTAMP
      ));
    END IF;
    row_data := to_jsonb(NEW);
    record_id := (row_data ->> TG_ARGV[1])::UUID;
    record_version := (row_data ->> 'sync_version')::INTEGER;
  END IF;

  IF TG_ARGV[0] = 'inventory_stock' THEN
    IF NULLIF(row_data->>'station_id', '') IS NOT NULL THEN station_ids := ARRAY[(row_data->>'station_id')::UUID]; END IF;
  ELSIF TG_ARGV[0] = 'expedition' THEN
    SELECT COALESCE(array_agg(es."station_id"), '{}'::UUID[]) INTO station_ids FROM "expedition_station" es WHERE es."expedition_id" = record_id;
  ELSIF TG_ARGV[0] = 'transport_leg' THEN
    SELECT COALESCE(array_agg(es."station_id"), '{}'::UUID[]) INTO station_ids FROM "expedition_station" es WHERE es."expedition_id" = (row_data->>'expedition_id')::UUID;
  ELSIF TG_ARGV[0] = 'cargo_item' THEN
    SELECT COALESCE(array_agg(DISTINCT es."station_id"), '{}'::UUID[]) INTO station_ids FROM "transport_leg" l JOIN "expedition_station" es ON es."expedition_id" = l."expedition_id" WHERE l."leg_id" = (row_data->>'leg_id')::UUID;
  ELSIF TG_ARGV[0] IN ('personnel_assignment', 'incident') THEN
    SELECT COALESCE(array_agg(DISTINCT scoped.station_id), '{}'::UUID[]) INTO station_ids FROM (
      SELECT (row_data->>'station_id')::UUID AS station_id WHERE NULLIF(row_data->>'station_id', '') IS NOT NULL
      UNION ALL
      SELECT es."station_id" FROM "transport_leg" l JOIN "expedition_station" es ON es."expedition_id" = l."expedition_id" WHERE l."leg_id" = NULLIF(row_data->>'leg_id', '')::UUID
    ) scoped;
  ELSIF TG_ARGV[0] = 'approval' AND row_data->>'entity_type' = 'PersonnelAssignment' THEN
    SELECT COALESCE(array_agg(DISTINCT scoped.station_id), '{}'::UUID[]) INTO station_ids FROM (
      SELECT pa."station_id" FROM "personnel_assignment" pa WHERE pa."assignment_id" = (row_data->>'entity_id')::UUID AND pa."station_id" IS NOT NULL
      UNION ALL
      SELECT es."station_id" FROM "personnel_assignment" pa JOIN "transport_leg" l ON l."leg_id" = pa."leg_id" JOIN "expedition_station" es ON es."expedition_id" = l."expedition_id" WHERE pa."assignment_id" = (row_data->>'entity_id')::UUID
    ) scoped;
  END IF;

  INSERT INTO "sync_change" ("entity_type", "entity_id", "entity_version", "station_ids", "deleted", "record")
  VALUES (TG_ARGV[0], record_id, record_version, station_ids, deleted_flag, row_data);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION polaris_refresh_expedition_sync_change() RETURNS trigger AS $$
DECLARE expedition_key UUID;
BEGIN
  expedition_key := CASE WHEN TG_OP = 'DELETE' THEN OLD."expedition_id" ELSE NEW."expedition_id" END;
  UPDATE "expedition" SET "sync_updated_at" = CURRENT_TIMESTAMP WHERE "expedition_id" = expedition_key;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION polaris_refresh_inventory_catalog_sync_change() RETURNS trigger AS $$
DECLARE item_key UUID;
BEGIN
  item_key := CASE WHEN TG_OP = 'DELETE' THEN OLD."item_id" ELSE NEW."item_id" END;
  UPDATE "inventory_stock" SET "last_updated" = CURRENT_TIMESTAMP WHERE "item_catalog_id" = item_key;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "sync_expedition_change" BEFORE INSERT OR UPDATE OR DELETE ON "expedition"
FOR EACH ROW EXECUTE FUNCTION polaris_record_sync_change('expedition', 'expedition_id');
CREATE TRIGGER "sync_transport_leg_change" BEFORE INSERT OR UPDATE OR DELETE ON "transport_leg"
FOR EACH ROW EXECUTE FUNCTION polaris_record_sync_change('transport_leg', 'leg_id');
CREATE TRIGGER "sync_cargo_item_change" BEFORE INSERT OR UPDATE OR DELETE ON "cargo_item"
FOR EACH ROW EXECUTE FUNCTION polaris_record_sync_change('cargo_item', 'cargo_id');
CREATE TRIGGER "sync_inventory_stock_change" BEFORE INSERT OR UPDATE OR DELETE ON "inventory_stock"
FOR EACH ROW EXECUTE FUNCTION polaris_record_sync_change('inventory_stock', 'stock_id');
CREATE TRIGGER "sync_personnel_assignment_change" BEFORE INSERT OR UPDATE OR DELETE ON "personnel_assignment"
FOR EACH ROW EXECUTE FUNCTION polaris_record_sync_change('personnel_assignment', 'assignment_id');
CREATE TRIGGER "sync_incident_change" BEFORE INSERT OR UPDATE OR DELETE ON "incident"
FOR EACH ROW EXECUTE FUNCTION polaris_record_sync_change('incident', 'incident_id');
CREATE TRIGGER "sync_approval_change" BEFORE INSERT OR UPDATE OR DELETE ON "approval"
FOR EACH ROW EXECUTE FUNCTION polaris_record_sync_change('approval', 'approval_id');
CREATE TRIGGER "sync_expedition_station_change" AFTER INSERT OR UPDATE OR DELETE ON "expedition_station"
FOR EACH ROW EXECUTE FUNCTION polaris_refresh_expedition_sync_change();
CREATE TRIGGER "sync_inventory_catalog_change" AFTER INSERT OR UPDATE OR DELETE ON "item_catalog"
FOR EACH ROW EXECUTE FUNCTION polaris_refresh_inventory_catalog_sync_change();

UPDATE "expedition" SET "sync_updated_at" = "sync_updated_at";
UPDATE "transport_leg" SET "sync_updated_at" = "sync_updated_at";
UPDATE "cargo_item" SET "sync_updated_at" = "sync_updated_at";
UPDATE "inventory_stock" SET "sync_updated_at" = "sync_updated_at";
UPDATE "personnel_assignment" SET "sync_updated_at" = "sync_updated_at";
UPDATE "incident" SET "sync_updated_at" = "sync_updated_at";
UPDATE "approval" SET "sync_updated_at" = "sync_updated_at";
