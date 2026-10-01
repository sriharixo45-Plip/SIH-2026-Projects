// demo-flow/e2e.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../services/api/src/app.module.js';
import { seedDemo } from '../services/api/src/scripts/seed-demo.js';

describe('Full endâ€‘toâ€‘end demo flow', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await seedDemo();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should seed demo data, update transport leg status via API, and verify disruption impact analysis', async () => {
    // 1. Query transport legs via API to find the planned leg LEG-01
    const legsRes = await request(app.getHttpServer()).get('/transport-legs');
    expect(legsRes.status).toBe(200);
    const leg = legsRes.body.find((l: any) => l.code === 'LEG-01');
    expect(leg).toBeDefined();
    expect(leg.status).toBe('planned');

    // 2. Update the leg status to "cancelled" via PATCH /transport-legs/:id/status
    // This exercises Controller -> TransportLegsService.updateStatus() -> analyzeDisruption() -> Recommendation/Incident persistence
    const patchRes = await request(app.getHttpServer())
      .patch(`/transport-legs/${leg.leg_id}/status`)
      .send({ status: 'cancelled' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.status).toBe('cancelled');

    // 3. Query disruption impact via GET /transport-legs/:id/impact to verify persistence & analysis results
    const impactRes = await request(app.getHttpServer())
      .get(`/transport-legs/${leg.leg_id}/impact`);

    expect(impactRes.status).toBe(200);
    const impact = impactRes.body;
    console.log('=== DEMO IMPACT RESPONSE ===');
    console.dir(impact, { depth: null });
    console.log('============================');

    expect(impact.disruption_status).toBe('cancelled');
    expect(impact.transport_leg).toBeDefined();
    expect(impact.transport_leg.leg_id).toBe(leg.leg_id);

    // Assert recommendation was created and persisted
    expect(impact.recommendation).toBeDefined();
    expect(impact.recommendation).not.toBeNull();
    expect(impact.recommendation.trigger_id).toBe(leg.leg_id);

    // Assert incident was created and persisted (cancelled leg triggers high severity incident)
    expect(impact.incident).toBeDefined();
    expect(impact.incident).not.toBeNull();
    expect(impact.incident.leg_id).toBe(leg.leg_id);

    // Assert affected entities chain (cargo, personnel, inventory stock)
    expect(impact.affected_cargo.length).toBeGreaterThan(0);
    expect(impact.affected_personnel_assignments.length).toBeGreaterThan(0);
    expect(impact.affected_inventory.length).toBeGreaterThan(0);
  });
});

