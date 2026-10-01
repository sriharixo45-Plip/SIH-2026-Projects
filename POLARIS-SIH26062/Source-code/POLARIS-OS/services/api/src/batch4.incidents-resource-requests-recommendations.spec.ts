import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { IncidentsService } from './incidents/incidents.service.js';
import { RecommendationsService } from './recommendations/recommendations.service.js';
import { ResourceRequestsService } from './resource-requests/resource-requests.service.js';

describe('Batch 4 incidents, resource requests, and recommendations', () => {
  function buildPrisma() {
    const state = {
      incidents: [] as any[],
      events: [] as any[],
      links: [] as any[],
      requests: [] as any[],
      requestLines: [] as any[],
      recommendations: [] as any[],
      approvals: [] as any[],
      people: [{ person_id: 'p-1', name: 'Dr. Aster' }],
      cargo: [{ cargo_id: 'c-1', description: 'Medical crate' }],
      legs: [{ leg_id: 'l-1', code: 'LEG-01' }],
      itemCatalog: [{ item_id: 'it-1', name: 'Antiseptic' }],
    };

    const prisma: any = {
      $queryRawUnsafe: vi.fn(async (sql: string, ...params: any[]) => {
        const text = sql.toLowerCase();

        if (text.includes('from "incident"')) {
          if (text.includes('insert into "incident"')) {
            const incident = {
              incident_id: 'i-1',
              station_id: params[0] ?? null,
              leg_id: params[1] ?? null,
              type: params[2],
              declared_at: new Date(),
              declared_by: params[3],
              severity: params[4],
              status: params[5] ?? 'declared',
              description: params[6] ?? null,
              location: null,
              sync_version: 0,
            };
            state.incidents.push(incident);
            return [{ ...incident }];
          }
          if (text.includes('where "incident_id" = $1')) {
            return state.incidents.filter((row) => row.incident_id === params[0]);
          }
          return state.incidents;
        }

        if (text.includes('from "incident_event"')) {
          if (text.includes('insert into "incident_event"')) {
            const event = {
              event_id: 'e-1',
              incident_id: params[0],
              event_type: params[1],
              timestamp_utc: new Date(),
              actor: params[2],
              notes: params[3] ?? null,
            };
            state.events.push(event);
            return [{ ...event }];
          }
          return state.events.filter((row) => row.incident_id === params[0]);
        }

        if (text.includes('from "incident_resource_link"')) {
          if (text.includes('insert into "incident_resource_link"')) {
            const link = {
              incident_id: params[0],
              target_entity_type: params[1],
              target_entity_id: params[2],
            };
            state.links.push(link);
            return [{ ...link }];
          }
          return state.links.filter((row) => row.incident_id === params[0]);
        }

        if (text.includes('from "resource_request"')) {
          if (text.includes('insert into "resource_request"')) {
            const request = {
              request_id: 'rr-1',
              incident_id: params[0],
              requested_at: new Date(),
              requested_by: params[1],
              status: params[2] ?? 'pending',
            };
            state.requests.push(request);
            return [{ ...request }];
          }
          if (text.includes('where "request_id" = $1')) {
            return state.requests.filter((row) => row.request_id === params[0]);
          }
          return state.requests;
        }

        if (text.includes('from "resource_request_line"')) {
          if (text.includes('insert into "resource_request_line"')) {
            const line = {
              line_id: 'rl-1',
              request_id: params[0],
              resource_type: params[1],
              quantity: params[2],
              item_reference: params[3] ?? null,
              item_reference_note: params[4] ?? null,
            };
            state.requestLines.push(line);
            return [{ ...line }];
          }
          return state.requestLines.filter((row) => row.request_id === params[0]);
        }

        if (text.includes('from "recommendation"')) {
          if (text.includes('insert into "recommendation"')) {
            const recommendation = {
              recommendation_id: 'r-1',
              trigger_type: params[0],
              trigger_id: params[1],
              generated_at: new Date(),
              recommendation_type: params[2],
              proposed_change: params[3],
              constraint_basis: params[4],
              status: params[5] ?? 'generated',
              approval_id: params[6] ?? null,
            };
            state.recommendations.push(recommendation);
            return [{ ...recommendation }];
          }
          if (text.includes('where "recommendation_id" = $1')) {
            return state.recommendations.filter((row) => row.recommendation_id === params[0]);
          }
          if (text.includes('update "recommendation"')) {
            const found = state.recommendations.find((row) => row.recommendation_id === params[params.length - 1]);
            if (found) {
              found.status = params[0];
              if (params[1] !== undefined) found.approval_id = params[1];
            }
            return found ? [{ ...found }] : [];
          }
          return state.recommendations;
        }

        if (text.includes('from "approval"')) {
          if (text.includes('insert into "approval"')) {
            const approval = {
              approval_id: 'a-1',
              entity_type: params[0],
              entity_id: params[1],
              requested_by: params[2],
              decision: 'pending',
              reason: params[3] ?? null,
            };
            state.approvals.push(approval);
            return [{ ...approval }];
          }
          if (text.includes('where "approval_id" = $1')) {
            return state.approvals.filter((row) => row.approval_id === params[0]);
          }
          return state.approvals;
        }

        if (text.includes('from "personnel"')) {
          return state.people.filter((row) => row.person_id === params[0]);
        }

        if (text.includes('from "cargo_item"')) {
          return state.cargo.filter((row) => row.cargo_id === params[0]);
        }

        if (text.includes('from "transport_leg"')) {
          return state.legs.filter((row) => row.leg_id === params[0]);
        }

        if (text.includes('from "item_catalog"')) {
          return state.itemCatalog.filter((row) => row.item_id === params[0]);
        }

        return [];
      }),
      $transaction: vi.fn(async (callback) => callback(prisma)),
    };

    return prisma;
  }

  it('creates an incident with a valid station or leg reference and appends a status event', async () => {
    const prisma = buildPrisma();
    const service = new IncidentsService(prisma as any);

    const incident = await service.create({
      station_id: 'st-1',
      type: 'medical',
      declared_by: 'u-1',
      severity: 'high',
      description: 'Supply issue',
    });

    const createdEvent = await service.createEvent(incident.incident_id, {
      event_type: 'declared',
      actor: 'u-1',
      notes: 'Initial declaration',
    });

    expect(incident.station_id).toBe('st-1');
    expect(createdEvent.event_type).toBe('declared');
  });

  it('rejects invalid incident resource targets and allows valid polymorphic links', async () => {
    const prisma = buildPrisma();
    const service = new IncidentsService(prisma as any);

    const incident = await service.create({
      station_id: 'st-1',
      type: 'medical',
      declared_by: 'u-1',
      severity: 'moderate',
    });

    await expect(service.createResourceLink(incident.incident_id, 'OtherType' as any, 'x-1')).rejects.toThrow(ConflictException);
    await expect(service.createResourceLink(incident.incident_id, 'Personnel', 'p-1')).resolves.toMatchObject({ target_entity_type: 'Personnel' });
  });

  it('creates a resource request with line validation for inventory references', async () => {
    const prisma = buildPrisma();
    const service = new ResourceRequestsService(prisma as any);

    const request = await service.create({
      incident_id: 'i-1',
      requested_by: 'u-1',
      lines: [
        { resource_type: 'inventory', quantity: '2', item_reference: 'it-1' },
      ],
    });

    expect(request.status).toBe('pending');
    expect(request.lines[0].resource_type).toBe('inventory');
  });

  it('enforces valid recommendation status transitions and can request approval without inventing approval rules', async () => {
    const prisma = buildPrisma();
    const service = new RecommendationsService(prisma as any);

    const recommendation = await service.create({
      trigger_type: 'incident',
      trigger_id: 'i-1',
      recommendation_type: 'escalate',
      proposed_change: { action: 'dispatch' },
      constraint_basis: 'safety',
    });

    await expect(service.updateStatus(recommendation.recommendation_id, 'decided')).rejects.toThrow(ConflictException);
    const reviewed = await service.updateStatus(recommendation.recommendation_id, 'under_review');
    expect(reviewed.status).toBe('under_review');
  });
});
