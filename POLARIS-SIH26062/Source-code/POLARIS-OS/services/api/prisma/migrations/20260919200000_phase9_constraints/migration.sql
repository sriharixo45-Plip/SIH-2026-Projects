-- POLARIS-OS Phase 9 physical constraints not fully expressible in Prisma schema.
-- Apply through a Prisma migration after schema validation.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- UserRoleAssignment: at most one active primary role per user.
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_role_assignment_active_primary
ON user_role_assignment (user_id)
WHERE is_primary = true AND valid_to IS NULL;

ALTER TABLE user_role_assignment
  ADD CONSTRAINT ck_user_role_assignment_validity
  CHECK (valid_to IS NULL OR valid_from <= valid_to);

-- Station capacity.
ALTER TABLE station
  ADD CONSTRAINT ck_station_storage_capacity_weight_positive
  CHECK (storage_capacity_weight > 0),
  ADD CONSTRAINT ck_station_storage_capacity_volume_positive
  CHECK (storage_capacity_volume > 0);

-- Expedition dates.
ALTER TABLE expedition
  ADD CONSTRAINT ck_expedition_dates
  CHECK (planned_end >= planned_start);

-- Plan version number.
ALTER TABLE plan_version
  ADD CONSTRAINT ck_plan_version_number_positive
  CHECK (version_number > 0);

-- Transport resource capacities.
ALTER TABLE transport_resource
  ADD CONSTRAINT ck_transport_resource_weight_positive
  CHECK (max_capacity_weight > 0),
  ADD CONSTRAINT ck_transport_resource_volume_positive
  CHECK (max_capacity_volume > 0),
  ADD CONSTRAINT ck_transport_resource_seats_nonnegative
  CHECK (max_seats_berths >= 0),
  ADD CONSTRAINT ck_transport_resource_hazard_classes
  CHECK (hazard_class_restrictions IS NULL OR hazard_class_restrictions <@ ARRAY[1,2,3,4,5,6,7,8,9]);

-- Transport leg dates and hazard classes.
ALTER TABLE transport_leg
  ADD CONSTRAINT ck_transport_leg_dates
  CHECK (planned_arrival >= planned_departure),
  ADD CONSTRAINT ck_transport_leg_hazard_classes
  CHECK (hazard_restrictions IS NULL OR hazard_restrictions <@ ARRAY[1,2,3,4,5,6,7,8,9]);

-- Prevent overlapping use of a transport resource for active non-concurrent legs.
ALTER TABLE transport_leg
  ADD CONSTRAINT ex_transport_resource_active_leg_overlap
  EXCLUDE USING gist (
    transport_resource_id WITH =,
    tstzrange(planned_departure, planned_arrival, '[]') WITH &&
  )
  WHERE (
    status IN ('confirmed', 'departed', 'in-transit')
    AND NOT allow_concurrent_leg
  );

-- Cargo validation.
ALTER TABLE cargo_item
  ADD CONSTRAINT ck_cargo_item_weight_positive
  CHECK (weight > 0),
  ADD CONSTRAINT ck_cargo_item_volume_positive
  CHECK (volume > 0),
  ADD CONSTRAINT ck_cargo_item_hazard_class
  CHECK (hazard_class BETWEEN 1 AND 9 OR hazard_class IS NULL);

-- Item catalog hazard class.
ALTER TABLE item_catalog
  ADD CONSTRAINT ck_item_catalog_hazard_class
  CHECK (hazard_class BETWEEN 1 AND 9 OR hazard_class IS NULL);

-- Inventory stock.
ALTER TABLE inventory_stock
  ADD CONSTRAINT ck_inventory_quantity_nonnegative
  CHECK (quantity >= 0),
  ADD CONSTRAINT ck_inventory_reorder_threshold_nonnegative
  CHECK (reorder_threshold >= 0),
  ADD CONSTRAINT ck_inventory_safety_stock_nonnegative
  CHECK (safety_stock_minimum >= 0);

-- Inventory transaction.
ALTER TABLE inventory_transaction
  ADD CONSTRAINT ck_inventory_transaction_nonzero_delta
  CHECK (quantity_delta <> 0);

-- Personnel assignment: exactly one of station_id / leg_id.
ALTER TABLE personnel_assignment
  ADD CONSTRAINT ck_personnel_assignment_station_leg_xor
  CHECK (
    (station_id IS NOT NULL AND leg_id IS NULL)
    OR
    (station_id IS NULL AND leg_id IS NOT NULL)
  ),
  ADD CONSTRAINT ck_personnel_assignment_dates
  CHECK (end_date IS NULL OR end_date >= start_date);

-- Incident: at least one location reference.
ALTER TABLE incident
  ADD CONSTRAINT ck_incident_station_or_leg
  CHECK (station_id IS NOT NULL OR leg_id IS NOT NULL);

-- Resource request line: inventory requests must identify an ItemCatalog item.
ALTER TABLE resource_request_line
  ADD CONSTRAINT ck_resource_request_inventory_reference
  CHECK (resource_type <> 'inventory' OR item_reference IS NOT NULL);

-- Transport waypoint ordering is already represented by @@unique([leg_id, sequence_number]) in Prisma.

-- Spatial indexes.
CREATE INDEX IF NOT EXISTS ix_station_location_gist
ON station USING gist (location);

CREATE INDEX IF NOT EXISTS ix_transport_leg_origin_point_gist
ON transport_leg USING gist (origin_point);

CREATE INDEX IF NOT EXISTS ix_transport_leg_destination_point_gist
ON transport_leg USING gist (destination_point);

CREATE INDEX IF NOT EXISTS ix_incident_location_gist
ON incident USING gist (location);

CREATE INDEX IF NOT EXISTS ix_transport_leg_waypoint_location_gist
ON transport_leg_waypoint USING gist (location);

-- NOTE:
-- The following remain application/service-level rules because the approved
-- Phase 9 model does not finalize them as DB constraints:
-- * Inventory running-balance non-negativity / transfer-pair atomicity.
-- * Personnel same-type assignment overlap prevention.
-- * Cargo parent_shipment cycle prevention.
-- * Approval self-approval prevention.
-- * Conditional permanent Attachment deletion.
-- * Expedition.current_plan_version_id same-expedition integrity.
-- * Polymorphic target validation.
-- * Transport/Cargo status coupling (F-02 unresolved).
-- * ResourceRequest.status lifecycle (F-07 unresolved).
