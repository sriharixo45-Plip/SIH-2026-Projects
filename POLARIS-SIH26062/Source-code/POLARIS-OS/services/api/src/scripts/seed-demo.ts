import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { randomUUID as uuidv4 } from 'node:crypto';
import * as argon2 from 'argon2';

export async function seedDemo() {
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('Set DEMO_PASSWORD to a value of at least 12 characters before seeding demo accounts.');
  }
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Alpha Station: reuse by unique code; create only if missing.
    const stationRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "station_id" FROM "station" WHERE "code" = 'STN-01' LIMIT 1;`,
    );
    const stationId = stationRows[0]?.station_id ?? uuidv4();

    if (!stationRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "station"
          ("station_id","name","code","type","location",
           "storage_capacity_weight","storage_capacity_volume","status","timezone")
         VALUES
          ($1::uuid,'Alpha Station','STN-01','antarctic'::station_type_enum,
           'POINT(0 0)'::geography,1000,1000,
           'active'::station_status_enum,'UTC');`,
        stationId,
      );
    }

    // 2. Demo user: reuse by email or employee code.
    const userRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "user_id" FROM "user"
       WHERE "email" = 'admin@polaris.org' OR "employee_code" = 'EMP-001'
       ORDER BY CASE WHEN "email" = 'admin@polaris.org' THEN 0 ELSE 1 END
       LIMIT 1;`,
    );
    const userId = userRows[0]?.user_id ?? uuidv4();

    if (!userRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "user"
          ("user_id","full_name","employee_code","email","status")
         VALUES ($1::uuid,'Admin User','EMP-001','admin@polaris.org',
                 'active'::user_status_enum);`,
        userId,
      );
    }

    // 2b. Demo Argon2id Credential for Admin User
    const demoPasswordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });
    await prisma.$executeRawUnsafe(
      `INSERT INTO "user_credential" ("credential_id", "user_id", "password_hash", "algorithm")
       VALUES ($1::uuid, $2::uuid, $3, 'argon2id')
       ON CONFLICT ("user_id") DO UPDATE SET "password_hash" = $3, "updated_at" = NOW();`,
      uuidv4(),
      userId,
      demoPasswordHash,
    );

    // Role-based API authorization is driven by the existing role/permission tables.
    const adminRoleRows = await prisma.$queryRawUnsafe<any[]>(`INSERT INTO "role" ("name", "description") VALUES ('HQ Administrator', 'Headquarters operational administration') ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description" RETURNING "role_id";`);
    const adminRoleId = adminRoleRows[0]?.role_id ?? (await prisma.$queryRawUnsafe<any[]>(`SELECT "role_id" FROM "role" WHERE "name" = 'HQ Administrator';`))[0]?.role_id;
    await prisma.$executeRawUnsafe(`INSERT INTO "permission" ("role_id", "entity", "action") VALUES ($1::uuid, '*', 'manage') ON CONFLICT ("role_id", "entity", "action") DO NOTHING;`, adminRoleId);
    const adminAssignment = await prisma.$queryRawUnsafe<any[]>(`SELECT "assignment_id" FROM "user_role_assignment" WHERE "user_id" = $1::uuid AND "role_id" = $2::uuid AND "station_id" IS NULL ORDER BY "is_primary" DESC, "valid_from" DESC LIMIT 1;`, userId, adminRoleId);
    if (adminAssignment.length) {
      // The demo HQ Administrator is intentionally active; do not leave a seeded
      // account with an expired primary role assignment after a previous demo run.
      await prisma.$executeRawUnsafe(`UPDATE "user_role_assignment" SET "valid_from" = NOW(), "valid_to" = NULL, "is_primary" = TRUE WHERE "assignment_id" = $1::uuid;`, adminAssignment[0].assignment_id);
    } else {
      await prisma.$executeRawUnsafe(`INSERT INTO "user_role_assignment" ("user_id", "role_id", "station_id", "valid_from", "is_primary") VALUES ($1::uuid, $2::uuid, NULL, NOW(), TRUE);`, userId, adminRoleId);
    }

    const operatorRoleRows = await prisma.$queryRawUnsafe<any[]>(`INSERT INTO "role" ("name", "description") VALUES ('Station Operator', 'Station-scoped field operations and synchronization') ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description" RETURNING "role_id";`);
    const operatorRoleId = operatorRoleRows[0]?.role_id ?? (await prisma.$queryRawUnsafe<any[]>(`SELECT "role_id" FROM "role" WHERE "name" = 'Station Operator';`))[0]?.role_id;
    for (const [entity, action] of [['sync-operations', 'read'], ['sync-operations', 'create'], ['sync-devices', 'create'], ['sync-conflicts', 'update'], ['auth', 'create']]) {
      await prisma.$executeRawUnsafe(`INSERT INTO "permission" ("role_id", "entity", "action") VALUES ($1::uuid, $2, $3) ON CONFLICT ("role_id", "entity", "action") DO NOTHING;`, operatorRoleId, entity, action);
    }
    const viewerRoleRows = await prisma.$queryRawUnsafe<any[]>(`INSERT INTO "role" ("name", "description") VALUES ('Read Only', 'Read-only headquarters operational access') ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description" RETURNING "role_id";`);
    const viewerRoleId = viewerRoleRows[0]?.role_id ?? (await prisma.$queryRawUnsafe<any[]>(`SELECT "role_id" FROM "role" WHERE "name" = 'Read Only';`))[0]?.role_id;
    for (const entity of ['stations', 'users', 'roles', 'permissions', 'user-role-assignments', 'expeditions', 'expedition-stations', 'plan-versions', 'transport-legs', 'transport-resources', 'cargo-items', 'cargo-movement-events', 'item-catalog', 'inventory-stocks', 'inventory-transactions', 'personnel', 'personnel-assignments', 'incidents', 'resource-requests', 'recommendations', 'approvals', 'sync-devices', 'sync-operations', 'sync-conflicts', 'audit-logs', 'weather-events', 'vessels']) {
      await prisma.$executeRawUnsafe(`INSERT INTO "permission" ("role_id", "entity", "action") VALUES ($1::uuid, $2, 'read') ON CONFLICT ("role_id", "entity", "action") DO NOTHING;`, viewerRoleId, entity);
    }
    const fieldRows = await prisma.$queryRawUnsafe<any[]>(`SELECT "user_id" FROM "user" WHERE "employee_code" = 'EMP-002' OR "email" = 'field@polaris.org' ORDER BY CASE WHEN "employee_code" = 'EMP-002' THEN 0 ELSE 1 END LIMIT 1;`);
    const fieldUserId = fieldRows[0]?.user_id ?? uuidv4();
    if (!fieldRows.length) await prisma.$executeRawUnsafe(`INSERT INTO "user" ("user_id", "full_name", "employee_code", "email", "status") VALUES ($1::uuid, 'Field Operator', 'EMP-002', 'field@polaris.org', 'active'::user_status_enum);`, fieldUserId);
    await prisma.$executeRawUnsafe(`INSERT INTO "user_credential" ("credential_id", "user_id", "password_hash", "algorithm") VALUES ($1::uuid, $2::uuid, $3, 'argon2id') ON CONFLICT ("user_id") DO UPDATE SET "password_hash" = $3, "updated_at" = NOW();`, uuidv4(), fieldUserId, demoPasswordHash);
    const fieldAssignment = await prisma.$queryRawUnsafe<any[]>(`SELECT 1 FROM "user_role_assignment" WHERE "user_id" = $1::uuid AND "role_id" = $2::uuid AND "station_id" = $3::uuid LIMIT 1;`, fieldUserId, operatorRoleId, stationId);
    if (!fieldAssignment.length) await prisma.$executeRawUnsafe(`INSERT INTO "user_role_assignment" ("user_id", "role_id", "station_id", "valid_from", "is_primary") VALUES ($1::uuid, $2::uuid, $3::uuid, NOW(), TRUE);`, fieldUserId, operatorRoleId, stationId);

    // 3. Expedition: reuse by unique code.
    const expeditionRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "expedition_id","created_by"
       FROM "expedition" WHERE "code" = 'EXP-01' LIMIT 1;`,
    );
    const expeditionId = expeditionRows[0]?.expedition_id ?? uuidv4();

    if (!expeditionRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "expedition"
          ("expedition_id","name","code","season","planned_start",
           "planned_end","status","created_by")
         VALUES
          ($1::uuid,'Mission Artemis','EXP-01','2026',CURRENT_DATE,
           CURRENT_DATE + 30,'planned'::expedition_status_enum,$2::uuid);`,
        expeditionId,
        userId,
      );
    }

    await prisma.$executeRawUnsafe(`INSERT INTO "expedition_station" ("expedition_id", "station_id") VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING;`, expeditionId, stationId);

    // 4. Plan Version 1: reuse by expedition + version number.
    const planRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "version_id"
       FROM "plan_version"
       WHERE "expedition_id" = $1::uuid AND "version_number" = 1
       LIMIT 1;`,
      expeditionId,
    );
    const planVersionId = planRows[0]?.version_id ?? uuidv4();

    if (!planRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "plan_version"
          ("version_id","expedition_id","version_number","created_by",
           "status","snapshot")
         VALUES
          ($1::uuid,$2::uuid,1,$3::uuid,
           'proposed'::plan_version_status_enum,'{}'::jsonb);`,
        planVersionId,
        expeditionId,
        userId,
      );
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "expedition"
       SET "current_plan_version_id" = $1::uuid
       WHERE "expedition_id" = $2::uuid
         AND "current_plan_version_id" IS NULL;`,
      planVersionId,
      expeditionId,
    );

    // 5. Transport Resource: reuse by registration code.
    const resourceRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "resource_id"
       FROM "transport_resource"
       WHERE "registration_code" = 'TR-01'
       LIMIT 1;`,
    );
    const transportResourceId = resourceRows[0]?.resource_id ?? uuidv4();

    if (!resourceRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "transport_resource"
          ("resource_id","name","type","registration_code",
           "max_capacity_weight","max_capacity_volume","max_seats_berths",
           "hazard_class_restrictions","status")
         VALUES
          ($1::uuid,'Apollo Transport Vessel','vessel','TR-01',
           50000,2000,100,ARRAY[]::integer[],
           'available'::transport_resource_status_enum);`,
        transportResourceId,
      );
    }

    // 6. Transport Leg: reuse by unique code.
    const legRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "leg_id"
       FROM "transport_leg" WHERE "code" = 'LEG-01' LIMIT 1;`,
    );
    const legId = legRows[0]?.leg_id ?? uuidv4();

    if (!legRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "transport_leg"
          ("leg_id","code","expedition_id","transport_resource_id","mode",
           "origin","origin_point","destination","destination_point",
           "planned_departure","planned_arrival","status","hazard_restrictions")
         VALUES
          ($1::uuid,'LEG-01',$2::uuid,$3::uuid,'ship',
           'Alpha Station','POINT(0 0)'::geography,
           'Beta Base','POINT(10 10)'::geography,
           NOW(),NOW()+INTERVAL '1 hour',
           'planned'::transport_leg_status_enum,ARRAY[]::integer[]);`,
        legId,
        expeditionId,
        transportResourceId,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE "transport_leg"
         SET "status" = 'planned'::transport_leg_status_enum
         WHERE "leg_id" = $1::uuid;`,
        legId,
      );
    }

    // 7. Cargo Item: reuse by unique tracking code.
    const cargoRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "cargo_id"
       FROM "cargo_item" WHERE "tracking_code" = 'TRK-001' LIMIT 1;`,
    );

    if (!cargoRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "cargo_item"
          ("cargo_id","tracking_code","leg_id","description","category",
           "weight","volume","status")
         VALUES
          ($1::uuid,'TRK-001',$2::uuid,'Supplies','food',10,5,
           'packed'::cargo_item_status_enum);`,
        uuidv4(),
        legId,
      );
    }

    // 8. Destination station: reuse by unique code.
    const destinationRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "station_id"
       FROM "station" WHERE "code" = 'STN-02' LIMIT 1;`,
    );
    const destinationStationId = destinationRows[0]?.station_id ?? uuidv4();

    if (!destinationRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "station"
          ("station_id","name","code","type","location",
           "storage_capacity_weight","storage_capacity_volume","status","timezone")
         VALUES
          ($1::uuid,'Beta Base','STN-02','antarctic'::station_type_enum,
           'POINT(10 10)'::geography,1000,1000,
           'active'::station_status_enum,'UTC');`,
        destinationStationId,
      );
    }

    // 9. Item Catalog: reuse by name/category.
    const itemRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "item_id"
       FROM "item_catalog"
       WHERE "name" = 'Scientific equipment' AND "category" = 'equipment'
       ORDER BY "item_id" LIMIT 1;`,
    );
    const itemId = itemRows[0]?.item_id ?? uuidv4();

    if (!itemRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "item_catalog"
          ("item_id","name","category","unit")
         VALUES ($1::uuid,'Scientific equipment','equipment','kg');`,
        itemId,
      );
    }

    // 10. Inventory: unique(station_id, item_catalog_id).
    const stockRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "stock_id"
       FROM "inventory_stock"
       WHERE "station_id" = $1::uuid AND "item_catalog_id" = $2::uuid
       LIMIT 1;`,
      destinationStationId,
      itemId,
    );

    if (!stockRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "inventory_stock"
          ("stock_id","station_id","item_catalog_id",
           "quantity","reorder_threshold","safety_stock_minimum")
         VALUES ($1::uuid,$2::uuid,$3::uuid,4,10,5);`,
        uuidv4(),
        destinationStationId,
        itemId,
      );
    }

    // 11. Personnel: rotation_window is required by the approved schema.
    const personnelRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "person_id"
       FROM "personnel"
       WHERE "name" = 'Jane Doe' AND "role_on_expedition" = 'engineer'
       ORDER BY "person_id" LIMIT 1;`,
    );
    const personnelId = personnelRows[0]?.person_id ?? uuidv4();

    if (!personnelRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "personnel"
          ("person_id","name","role_on_expedition","fitness_status","rotation_window")
         VALUES
          ($1::uuid,'Jane Doe','engineer',
           'fit-to-deploy'::personnel_fitness_status_enum,
           '[2026-01-01,2027-01-01)'::daterange);`,
        personnelId,
      );
    }

    // 12. Personnel Assignment: reuse the same logical assignment.
    const assignmentRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "assignment_id"
       FROM "personnel_assignment"
       WHERE "personnel_id" = $1::uuid
         AND "expedition_id" = $2::uuid
         AND "leg_id" = $3::uuid
       LIMIT 1;`,
      personnelId,
      expeditionId,
      legId,
    );

    if (!assignmentRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "personnel_assignment"
          ("assignment_id","personnel_id","expedition_id","leg_id",
           "status","start_date")
         VALUES
          ($1::uuid,$2::uuid,$3::uuid,$4::uuid,
           'proposed'::personnel_assignment_status_enum,CURRENT_DATE);`,
        uuidv4(),
        personnelId,
        expeditionId,
        legId,
      );
    }

    // 13. Incident: reuse by leg_id.
    const incidentRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "incident_id"
       FROM "incident"
       WHERE "leg_id" = $1::uuid AND "status" IN ('declared', 'active', 'resource_requested')
       LIMIT 1;`,
      legId,
    );

    if (!incidentRows[0]) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "incident"
          ("incident_id","station_id","leg_id","type","declared_by",
           "severity","status","description","location")
         VALUES
          ($1::uuid,$2::uuid,$3::uuid,'transport_disruption',$4::uuid,
           'critical'::incident_severity_enum,
           'declared'::incident_status_enum,
           'Transport leg LEG-01 disruption',
           'POINT(10 10)'::geography);`,
        uuidv4(),
        destinationStationId,
        legId,
        userId,
      );
    }

    console.log('Demo data seeded successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes('seed-demo')) {
  seedDemo().catch((e) => {
    console.error('Seed failed', e);
    process.exit(1);
  });
}
