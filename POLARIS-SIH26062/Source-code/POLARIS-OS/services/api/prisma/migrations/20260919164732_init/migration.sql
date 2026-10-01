-- CreateEnum
CREATE TYPE "user_status_enum" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "station_type_enum" AS ENUM ('antarctic', 'arctic');

-- CreateEnum
CREATE TYPE "station_status_enum" AS ENUM ('active', 'seasonal-closure', 'under-maintenance', 'decommissioned');

-- CreateEnum
CREATE TYPE "approval_decision_enum" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "sync_origin_enum" AS ENUM ('offline', 'online');

-- CreateEnum
CREATE TYPE "expedition_status_enum" AS ENUM ('draft', 'planned', 'approved', 'in-progress', 'disrupted', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "plan_version_status_enum" AS ENUM ('proposed', 'approved', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "transport_resource_status_enum" AS ENUM ('available', 'maintenance', 'unavailable');

-- CreateEnum
CREATE TYPE "transport_leg_status_enum" AS ENUM ('planned', 'confirmed', 'delayed', 'departed', 'in-transit', 'arrived', 'cancelled', 'diverted');

-- CreateEnum
CREATE TYPE "cargo_item_status_enum" AS ENUM ('packed', 'in-transit', 'in-storage-at-station', 'delivered', 'damaged', 'returned');

-- CreateEnum
CREATE TYPE "recommendation_trigger_enum" AS ENUM ('transport_disruption', 'incident', 'inventory_risk', 'weather_event');

-- CreateEnum
CREATE TYPE "recommendation_status_enum" AS ENUM ('generated', 'under_review', 'decided', 'applied', 'superseded');

-- CreateEnum
CREATE TYPE "inventory_transaction_type_enum" AS ENUM ('receipt', 'consumption', 'transfer_out', 'transfer_in', 'damage', 'loss', 'adjustment', 'return');

-- CreateEnum
CREATE TYPE "personnel_fitness_status_enum" AS ENUM ('fit-to-deploy', 'conditional', 'not-fit', 'pending-review');

-- CreateEnum
CREATE TYPE "personnel_assignment_status_enum" AS ENUM ('proposed', 'confirmed', 'in-transit', 'deployed', 'completed', 'cancelled', 'unassigned');

-- CreateEnum
CREATE TYPE "incident_severity_enum" AS ENUM ('low', 'moderate', 'high', 'critical');

-- CreateEnum
CREATE TYPE "incident_status_enum" AS ENUM ('declared', 'active', 'resource_requested', 'resolved', 'closed', 'reopened');

-- CreateEnum
CREATE TYPE "incident_resource_target_enum" AS ENUM ('Personnel', 'CargoItem', 'TransportLeg');

-- CreateEnum
CREATE TYPE "resource_request_line_type_enum" AS ENUM ('personnel', 'cargo', 'inventory', 'transport');

-- CreateEnum
CREATE TYPE "sync_device_type_enum" AS ENUM ('station-pwa', 'hq-web');

-- CreateEnum
CREATE TYPE "sync_device_status_enum" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "sync_operation_type_enum" AS ENUM ('create', 'update', 'status_change', 'cancel');

-- CreateEnum
CREATE TYPE "sync_operation_status_enum" AS ENUM ('pending', 'synced', 'failed', 'rejected', 'conflicted', 'cancelled');

-- CreateEnum
CREATE TYPE "weather_event_source_enum" AS ENUM ('manual', 'external-future');

-- CreateTable
CREATE TABLE "user" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "user_status_enum" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "role" (
    "role_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "role_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "user_role_assignment" (
    "assignment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "station_id" UUID,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_to" TIMESTAMPTZ(6),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_role_assignment_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "permission" (
    "permission_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("permission_id")
);

-- CreateTable
CREATE TABLE "station" (
    "station_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "station_type_enum" NOT NULL,
    "location" geography(Point,4326) NOT NULL,
    "storage_capacity_weight" DECIMAL NOT NULL,
    "storage_capacity_volume" DECIMAL NOT NULL,
    "status" "station_status_enum" NOT NULL DEFAULT 'active',
    "timezone" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "station_pkey" PRIMARY KEY ("station_id")
);

-- CreateTable
CREATE TABLE "approval" (
    "approval_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "decided_by" UUID,
    "decision" "approval_decision_enum" NOT NULL DEFAULT 'pending',
    "decided_at" TIMESTAMPTZ(6),
    "reason" TEXT,

    CONSTRAINT "approval_pkey" PRIMARY KEY ("approval_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "log_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "actor" UUID,
    "device_id" UUID,
    "action" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "timestamp_utc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origin_tz_offset" TEXT,
    "sync_origin" "sync_origin_enum",
    "reason" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "attachment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storage_url" TEXT NOT NULL,
    "is_permanent" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("attachment_id")
);

-- CreateTable
CREATE TABLE "expedition" (
    "expedition_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "planned_start" DATE NOT NULL,
    "planned_end" DATE NOT NULL,
    "status" "expedition_status_enum" NOT NULL DEFAULT 'draft',
    "current_plan_version_id" UUID,
    "created_by" UUID NOT NULL,

    CONSTRAINT "expedition_pkey" PRIMARY KEY ("expedition_id")
);

-- CreateTable
CREATE TABLE "expedition_station" (
    "expedition_id" UUID NOT NULL,
    "station_id" UUID NOT NULL,

    CONSTRAINT "expedition_station_pkey" PRIMARY KEY ("expedition_id","station_id")
);

-- CreateTable
CREATE TABLE "plan_version" (
    "version_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expedition_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "plan_version_status_enum" NOT NULL DEFAULT 'proposed',
    "change_summary" TEXT,
    "superseded_by_version_id" UUID,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "plan_version_pkey" PRIMARY KEY ("version_id")
);

-- CreateTable
CREATE TABLE "transport_resource" (
    "resource_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "registration_code" TEXT NOT NULL,
    "max_capacity_weight" DECIMAL NOT NULL,
    "max_capacity_volume" DECIMAL NOT NULL,
    "max_seats_berths" INTEGER NOT NULL,
    "hazard_class_restrictions" integer[] NOT NULL,
    "status" "transport_resource_status_enum" NOT NULL,
    "available_from" DATE,
    "available_to" DATE,

    CONSTRAINT "transport_resource_pkey" PRIMARY KEY ("resource_id")
);

-- CreateTable
CREATE TABLE "transport_leg" (
    "leg_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "expedition_id" UUID NOT NULL,
    "transport_resource_id" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "origin_point" geography(Point,4326) NOT NULL,
    "destination" TEXT NOT NULL,
    "destination_point" geography(Point,4326) NOT NULL,
    "planned_departure" TIMESTAMPTZ(6) NOT NULL,
    "planned_arrival" TIMESTAMPTZ(6) NOT NULL,
    "status" "transport_leg_status_enum" NOT NULL,
    "capacity_weight" DECIMAL,
    "capacity_volume" DECIMAL,
    "capacity_seats" INTEGER,
    "hazard_restrictions" integer[] NOT NULL,
    "allow_concurrent_leg" BOOLEAN NOT NULL DEFAULT false,
    "sync_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "transport_leg_pkey" PRIMARY KEY ("leg_id")
);

-- CreateTable
CREATE TABLE "cargo_item" (
    "cargo_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tracking_code" TEXT NOT NULL,
    "leg_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "weight" DECIMAL NOT NULL,
    "volume" DECIMAL NOT NULL,
    "hazard_class" INTEGER,
    "is_return_cargo" BOOLEAN NOT NULL DEFAULT false,
    "status" "cargo_item_status_enum" NOT NULL,
    "parent_shipment_id" UUID,
    "sync_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cargo_item_pkey" PRIMARY KEY ("cargo_id")
);

-- CreateTable
CREATE TABLE "cargo_movement_event" (
    "event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cargo_id" UUID NOT NULL,
    "leg_id" UUID,
    "station_id" UUID,
    "event_type" TEXT NOT NULL,
    "timestamp_utc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" UUID NOT NULL,
    "reason" TEXT,

    CONSTRAINT "cargo_movement_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "recommendation" (
    "recommendation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trigger_type" "recommendation_trigger_enum" NOT NULL,
    "trigger_id" UUID NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recommendation_type" TEXT NOT NULL,
    "proposed_change" JSONB NOT NULL,
    "constraint_basis" TEXT NOT NULL,
    "status" "recommendation_status_enum" NOT NULL,
    "approval_id" UUID,

    CONSTRAINT "recommendation_pkey" PRIMARY KEY ("recommendation_id")
);

-- CreateTable
CREATE TABLE "item_catalog" (
    "item_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hazard_class" INTEGER,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "item_catalog_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "inventory_stock" (
    "stock_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "station_id" UUID NOT NULL,
    "item_catalog_id" UUID NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "reorder_threshold" DECIMAL NOT NULL,
    "safety_stock_minimum" DECIMAL NOT NULL,
    "last_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_pkey" PRIMARY KEY ("stock_id")
);

-- CreateTable
CREATE TABLE "inventory_transaction" (
    "transaction_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stock_id" UUID NOT NULL,
    "transport_leg_id" UUID,
    "transaction_type" "inventory_transaction_type_enum" NOT NULL,
    "quantity_delta" DECIMAL NOT NULL,
    "timestamp_utc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" UUID NOT NULL,
    "reason" TEXT,
    "transfer_id" UUID,

    CONSTRAINT "inventory_transaction_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "personnel" (
    "person_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "employee_code" TEXT,
    "name" TEXT NOT NULL,
    "role_on_expedition" TEXT NOT NULL,
    "fitness_status" "personnel_fitness_status_enum" NOT NULL,
    "assigned_station_id" UUID,
    "rotation_window" daterange NOT NULL,

    CONSTRAINT "personnel_pkey" PRIMARY KEY ("person_id")
);

-- CreateTable
CREATE TABLE "personnel_assignment" (
    "assignment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "personnel_id" UUID NOT NULL,
    "expedition_id" UUID NOT NULL,
    "station_id" UUID,
    "leg_id" UUID,
    "seat_berth_ref" TEXT,
    "status" "personnel_assignment_status_enum" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "rotation_id" UUID,
    "sync_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "personnel_assignment_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "incident" (
    "incident_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "station_id" UUID,
    "leg_id" UUID,
    "type" TEXT NOT NULL,
    "declared_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declared_by" UUID NOT NULL,
    "severity" "incident_severity_enum" NOT NULL,
    "status" "incident_status_enum" NOT NULL DEFAULT 'declared',
    "description" TEXT,
    "location" geography(Point,4326) NOT NULL,
    "sync_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "incident_pkey" PRIMARY KEY ("incident_id")
);

-- CreateTable
CREATE TABLE "incident_event" (
    "event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "incident_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "timestamp_utc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" UUID NOT NULL,
    "notes" TEXT,

    CONSTRAINT "incident_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "incident_resource_link" (
    "incident_id" UUID NOT NULL,
    "target_entity_type" "incident_resource_target_enum" NOT NULL,
    "target_entity_id" UUID NOT NULL,

    CONSTRAINT "incident_resource_link_pkey" PRIMARY KEY ("incident_id","target_entity_type","target_entity_id")
);

-- CreateTable
CREATE TABLE "resource_request" (
    "request_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "incident_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requested_by" UUID NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "resource_request_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "resource_request_line" (
    "line_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "resource_type" "resource_request_line_type_enum" NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "item_reference" UUID,
    "item_reference_note" TEXT,

    CONSTRAINT "resource_request_line_pkey" PRIMARY KEY ("line_id")
);

-- CreateTable
CREATE TABLE "sync_device" (
    "device_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_type" "sync_device_type_enum" NOT NULL,
    "assigned_user_id" UUID,
    "assigned_station_id" UUID NOT NULL,
    "last_sync_at" TIMESTAMPTZ(6),
    "app_version" TEXT NOT NULL,
    "status" "sync_device_status_enum" NOT NULL DEFAULT 'active',
    "session_expiry" TIMESTAMPTZ(6),

    CONSTRAINT "sync_device_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "sync_operation" (
    "op_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "performed_by" UUID NOT NULL,
    "local_sequence_number" INTEGER NOT NULL,
    "target_entity_type" TEXT NOT NULL,
    "target_entity_id" UUID NOT NULL,
    "operation_type" "sync_operation_type_enum" NOT NULL,
    "payload" JSONB NOT NULL,
    "base_version" INTEGER,
    "status" "sync_operation_status_enum" NOT NULL DEFAULT 'pending',
    "applied_at" TIMESTAMPTZ(6),

    CONSTRAINT "sync_operation_pkey" PRIMARY KEY ("op_id")
);

-- CreateTable
CREATE TABLE "sync_conflict" (
    "conflict_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "competing_operations" JSONB NOT NULL,
    "resolution" TEXT,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "sync_conflict_pkey" PRIMARY KEY ("conflict_id")
);

-- CreateTable
CREATE TABLE "weather_event" (
    "event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "station_id" UUID,
    "event_type" TEXT NOT NULL,
    "severity" TEXT,
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logged_by" UUID NOT NULL,
    "source" "weather_event_source_enum" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "weather_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "transport_leg_waypoint" (
    "waypoint_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "leg_id" UUID NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "location" geography(Point,4326) NOT NULL,
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logged_by" UUID NOT NULL,

    CONSTRAINT "transport_leg_waypoint_pkey" PRIMARY KEY ("waypoint_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_employee_code_key" ON "user"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_deleted_by_idx" ON "user"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE INDEX "user_role_assignment_user_id_idx" ON "user_role_assignment"("user_id");

-- CreateIndex
CREATE INDEX "user_role_assignment_role_id_idx" ON "user_role_assignment"("role_id");

-- CreateIndex
CREATE INDEX "user_role_assignment_station_id_idx" ON "user_role_assignment"("station_id");

-- CreateIndex
CREATE INDEX "permission_role_id_idx" ON "permission"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_role_id_entity_action_key" ON "permission"("role_id", "entity", "action");

-- CreateIndex
CREATE UNIQUE INDEX "station_code_key" ON "station"("code");

-- CreateIndex
CREATE INDEX "station_deleted_by_idx" ON "station"("deleted_by");

-- CreateIndex
CREATE INDEX "station_status_idx" ON "station"("status");

-- CreateIndex
CREATE INDEX "approval_entity_type_entity_id_idx" ON "approval"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "approval_requested_by_idx" ON "approval"("requested_by");

-- CreateIndex
CREATE INDEX "approval_decided_by_idx" ON "approval"("decided_by");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_timestamp_utc_idx" ON "audit_log"("entity_type", "entity_id", "timestamp_utc");

-- CreateIndex
CREATE INDEX "audit_log_actor_idx" ON "audit_log"("actor");

-- CreateIndex
CREATE INDEX "audit_log_device_id_idx" ON "audit_log"("device_id");

-- CreateIndex
CREATE INDEX "attachment_entity_type_entity_id_idx" ON "attachment"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "attachment_uploaded_by_idx" ON "attachment"("uploaded_by");

-- CreateIndex
CREATE INDEX "attachment_deleted_by_idx" ON "attachment"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "expedition_code_key" ON "expedition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "expedition_current_plan_version_id_key" ON "expedition"("current_plan_version_id");

-- CreateIndex
CREATE INDEX "expedition_created_by_idx" ON "expedition"("created_by");

-- CreateIndex
CREATE INDEX "expedition_current_plan_version_id_idx" ON "expedition"("current_plan_version_id");

-- CreateIndex
CREATE INDEX "expedition_status_idx" ON "expedition"("status");

-- CreateIndex
CREATE INDEX "expedition_station_station_id_idx" ON "expedition_station"("station_id");

-- CreateIndex
CREATE INDEX "plan_version_created_by_idx" ON "plan_version"("created_by");

-- CreateIndex
CREATE INDEX "plan_version_superseded_by_version_id_idx" ON "plan_version"("superseded_by_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_version_expedition_id_version_number_key" ON "plan_version"("expedition_id", "version_number");

-- CreateIndex
CREATE INDEX "transport_resource_status_idx" ON "transport_resource"("status");

-- CreateIndex
CREATE INDEX "transport_resource_registration_code_idx" ON "transport_resource"("registration_code");

-- CreateIndex
CREATE UNIQUE INDEX "transport_leg_code_key" ON "transport_leg"("code");

-- CreateIndex
CREATE INDEX "transport_leg_expedition_id_idx" ON "transport_leg"("expedition_id");

-- CreateIndex
CREATE INDEX "transport_leg_transport_resource_id_idx" ON "transport_leg"("transport_resource_id");

-- CreateIndex
CREATE INDEX "transport_leg_status_idx" ON "transport_leg"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_item_tracking_code_key" ON "cargo_item"("tracking_code");

-- CreateIndex
CREATE INDEX "cargo_item_leg_id_idx" ON "cargo_item"("leg_id");

-- CreateIndex
CREATE INDEX "cargo_item_parent_shipment_id_idx" ON "cargo_item"("parent_shipment_id");

-- CreateIndex
CREATE INDEX "cargo_item_status_idx" ON "cargo_item"("status");

-- CreateIndex
CREATE INDEX "cargo_movement_event_cargo_id_timestamp_utc_idx" ON "cargo_movement_event"("cargo_id", "timestamp_utc");

-- CreateIndex
CREATE INDEX "cargo_movement_event_leg_id_idx" ON "cargo_movement_event"("leg_id");

-- CreateIndex
CREATE INDEX "cargo_movement_event_station_id_idx" ON "cargo_movement_event"("station_id");

-- CreateIndex
CREATE INDEX "recommendation_trigger_type_trigger_id_idx" ON "recommendation"("trigger_type", "trigger_id");

-- CreateIndex
CREATE INDEX "recommendation_status_idx" ON "recommendation"("status");

-- CreateIndex
CREATE INDEX "recommendation_approval_id_idx" ON "recommendation"("approval_id");

-- CreateIndex
CREATE INDEX "item_catalog_deleted_by_idx" ON "item_catalog"("deleted_by");

-- CreateIndex
CREATE INDEX "item_catalog_is_active_idx" ON "item_catalog"("is_active");

-- CreateIndex
CREATE INDEX "inventory_stock_item_catalog_id_idx" ON "inventory_stock"("item_catalog_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_station_id_item_catalog_id_key" ON "inventory_stock"("station_id", "item_catalog_id");

-- CreateIndex
CREATE INDEX "inventory_transaction_stock_id_timestamp_utc_idx" ON "inventory_transaction"("stock_id", "timestamp_utc");

-- CreateIndex
CREATE INDEX "inventory_transaction_transport_leg_id_idx" ON "inventory_transaction"("transport_leg_id");

-- CreateIndex
CREATE INDEX "inventory_transaction_actor_idx" ON "inventory_transaction"("actor");

-- CreateIndex
CREATE INDEX "inventory_transaction_transfer_id_idx" ON "inventory_transaction"("transfer_id");

-- CreateIndex
CREATE UNIQUE INDEX "personnel_employee_code_key" ON "personnel"("employee_code");

-- CreateIndex
CREATE INDEX "personnel_user_id_idx" ON "personnel"("user_id");

-- CreateIndex
CREATE INDEX "personnel_assigned_station_id_idx" ON "personnel"("assigned_station_id");

-- CreateIndex
CREATE INDEX "personnel_assignment_personnel_id_idx" ON "personnel_assignment"("personnel_id");

-- CreateIndex
CREATE INDEX "personnel_assignment_expedition_id_idx" ON "personnel_assignment"("expedition_id");

-- CreateIndex
CREATE INDEX "personnel_assignment_station_id_idx" ON "personnel_assignment"("station_id");

-- CreateIndex
CREATE INDEX "personnel_assignment_leg_id_idx" ON "personnel_assignment"("leg_id");

-- CreateIndex
CREATE INDEX "personnel_assignment_rotation_id_idx" ON "personnel_assignment"("rotation_id");

-- CreateIndex
CREATE INDEX "incident_station_id_idx" ON "incident"("station_id");

-- CreateIndex
CREATE INDEX "incident_leg_id_idx" ON "incident"("leg_id");

-- CreateIndex
CREATE INDEX "incident_declared_by_idx" ON "incident"("declared_by");

-- CreateIndex
CREATE INDEX "incident_status_idx" ON "incident"("status");

-- CreateIndex
CREATE INDEX "incident_event_incident_id_timestamp_utc_idx" ON "incident_event"("incident_id", "timestamp_utc");

-- CreateIndex
CREATE INDEX "incident_event_actor_idx" ON "incident_event"("actor");

-- CreateIndex
CREATE INDEX "incident_resource_link_target_entity_type_target_entity_id_idx" ON "incident_resource_link"("target_entity_type", "target_entity_id");

-- CreateIndex
CREATE INDEX "resource_request_incident_id_idx" ON "resource_request"("incident_id");

-- CreateIndex
CREATE INDEX "resource_request_requested_by_idx" ON "resource_request"("requested_by");

-- CreateIndex
CREATE INDEX "resource_request_line_request_id_idx" ON "resource_request_line"("request_id");

-- CreateIndex
CREATE INDEX "resource_request_line_item_reference_idx" ON "resource_request_line"("item_reference");

-- CreateIndex
CREATE INDEX "sync_device_assigned_user_id_idx" ON "sync_device"("assigned_user_id");

-- CreateIndex
CREATE INDEX "sync_device_assigned_station_id_idx" ON "sync_device"("assigned_station_id");

-- CreateIndex
CREATE INDEX "sync_device_status_idx" ON "sync_device"("status");

-- CreateIndex
CREATE INDEX "sync_operation_performed_by_idx" ON "sync_operation"("performed_by");

-- CreateIndex
CREATE INDEX "sync_operation_target_entity_type_target_entity_id_idx" ON "sync_operation"("target_entity_type", "target_entity_id");

-- CreateIndex
CREATE INDEX "sync_operation_status_idx" ON "sync_operation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sync_operation_device_id_local_sequence_number_key" ON "sync_operation"("device_id", "local_sequence_number");

-- CreateIndex
CREATE INDEX "sync_conflict_entity_type_entity_id_idx" ON "sync_conflict"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "sync_conflict_resolved_by_idx" ON "sync_conflict"("resolved_by");

-- CreateIndex
CREATE INDEX "weather_event_station_id_idx" ON "weather_event"("station_id");

-- CreateIndex
CREATE INDEX "weather_event_logged_by_idx" ON "weather_event"("logged_by");

-- CreateIndex
CREATE INDEX "weather_event_logged_at_idx" ON "weather_event"("logged_at");

-- CreateIndex
CREATE INDEX "transport_leg_waypoint_leg_id_logged_at_idx" ON "transport_leg_waypoint"("leg_id", "logged_at");

-- CreateIndex
CREATE INDEX "transport_leg_waypoint_logged_by_idx" ON "transport_leg_waypoint"("logged_by");

-- CreateIndex
CREATE UNIQUE INDEX "transport_leg_waypoint_leg_id_sequence_number_key" ON "transport_leg_waypoint"("leg_id", "sequence_number");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignment" ADD CONSTRAINT "user_role_assignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignment" ADD CONSTRAINT "user_role_assignment_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignment" ADD CONSTRAINT "user_role_assignment_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "station"("station_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission" ADD CONSTRAINT "permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station" ADD CONSTRAINT "station_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_fkey" FOREIGN KEY ("actor") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "sync_device"("device_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedition" ADD CONSTRAINT "expedition_current_plan_version_id_fkey" FOREIGN KEY ("current_plan_version_id") REFERENCES "plan_version"("version_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedition" ADD CONSTRAINT "expedition_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedition_station" ADD CONSTRAINT "expedition_station_expedition_id_fkey" FOREIGN KEY ("expedition_id") REFERENCES "expedition"("expedition_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedition_station" ADD CONSTRAINT "expedition_station_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "station"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_expedition_id_fkey" FOREIGN KEY ("expedition_id") REFERENCES "expedition"("expedition_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_superseded_by_version_id_fkey" FOREIGN KEY ("superseded_by_version_id") REFERENCES "plan_version"("version_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_leg" ADD CONSTRAINT "transport_leg_expedition_id_fkey" FOREIGN KEY ("expedition_id") REFERENCES "expedition"("expedition_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_leg" ADD CONSTRAINT "transport_leg_transport_resource_id_fkey" FOREIGN KEY ("transport_resource_id") REFERENCES "transport_resource"("resource_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_item" ADD CONSTRAINT "cargo_item_leg_id_fkey" FOREIGN KEY ("leg_id") REFERENCES "transport_leg"("leg_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_item" ADD CONSTRAINT "cargo_item_parent_shipment_id_fkey" FOREIGN KEY ("parent_shipment_id") REFERENCES "cargo_item"("cargo_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_movement_event" ADD CONSTRAINT "cargo_movement_event_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargo_item"("cargo_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_movement_event" ADD CONSTRAINT "cargo_movement_event_leg_id_fkey" FOREIGN KEY ("leg_id") REFERENCES "transport_leg"("leg_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_movement_event" ADD CONSTRAINT "cargo_movement_event_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "station"("station_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_movement_event" ADD CONSTRAINT "cargo_movement_event_actor_fkey" FOREIGN KEY ("actor") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approval"("approval_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_catalog" ADD CONSTRAINT "item_catalog_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "station"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_item_catalog_id_fkey" FOREIGN KEY ("item_catalog_id") REFERENCES "item_catalog"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "inventory_stock"("stock_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_transport_leg_id_fkey" FOREIGN KEY ("transport_leg_id") REFERENCES "transport_leg"("leg_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_actor_fkey" FOREIGN KEY ("actor") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_assigned_station_id_fkey" FOREIGN KEY ("assigned_station_id") REFERENCES "station"("station_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_assignment" ADD CONSTRAINT "personnel_assignment_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("person_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_assignment" ADD CONSTRAINT "personnel_assignment_expedition_id_fkey" FOREIGN KEY ("expedition_id") REFERENCES "expedition"("expedition_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_assignment" ADD CONSTRAINT "personnel_assignment_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "station"("station_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_assignment" ADD CONSTRAINT "personnel_assignment_leg_id_fkey" FOREIGN KEY ("leg_id") REFERENCES "transport_leg"("leg_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "station"("station_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_leg_id_fkey" FOREIGN KEY ("leg_id") REFERENCES "transport_leg"("leg_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_declared_by_fkey" FOREIGN KEY ("declared_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_event" ADD CONSTRAINT "incident_event_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incident"("incident_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_event" ADD CONSTRAINT "incident_event_actor_fkey" FOREIGN KEY ("actor") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_resource_link" ADD CONSTRAINT "incident_resource_link_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incident"("incident_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_request" ADD CONSTRAINT "resource_request_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incident"("incident_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_request" ADD CONSTRAINT "resource_request_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_request_line" ADD CONSTRAINT "resource_request_line_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "resource_request"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_request_line" ADD CONSTRAINT "resource_request_line_item_reference_fkey" FOREIGN KEY ("item_reference") REFERENCES "item_catalog"("item_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_device" ADD CONSTRAINT "sync_device_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_device" ADD CONSTRAINT "sync_device_assigned_station_id_fkey" FOREIGN KEY ("assigned_station_id") REFERENCES "station"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operation" ADD CONSTRAINT "sync_operation_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "sync_device"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operation" ADD CONSTRAINT "sync_operation_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflict" ADD CONSTRAINT "sync_conflict_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weather_event" ADD CONSTRAINT "weather_event_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "station"("station_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weather_event" ADD CONSTRAINT "weather_event_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_leg_waypoint" ADD CONSTRAINT "transport_leg_waypoint_leg_id_fkey" FOREIGN KEY ("leg_id") REFERENCES "transport_leg"("leg_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_leg_waypoint" ADD CONSTRAINT "transport_leg_waypoint_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
