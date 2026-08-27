import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.mjs';
import { ShelfLifeReplenishmentService } from '../src/domain.mjs';
import { MemoryStore, planner, replenishment } from './helpers.mjs';
const serviceApp = () => createApp(new ShelfLifeReplenishmentService(new MemoryStore()));
const headers = { 'x-actor-id': planner.id, 'x-actor-role': planner.role, 'x-request-id': 'http-create-871' };
describe('replenishment request HTTP transport', () => {
  it('returns the caller request identifier and a new draft replenishment request', async () => { const response = await request(serviceApp()).post('/replenishment-requests').set(headers).send(replenishment); expect(response.status).toBe(201); expect(response.headers['x-request-id']).toBe(headers['x-request-id']); expect(response.body).toMatchObject({ status: 'draft', productId: 'PRD-871' }); });
  it('returns structured invalid-input and forbidden errors', async () => { const app = serviceApp(); const invalid = await request(app).post('/replenishment-requests').set(headers).send({ ...replenishment, dailyDemandUnits: 0 }); const denied = await request(app).post('/replenishment-requests').set({ 'x-actor-id': 'reviewer-871', 'x-actor-role': 'inventory_replenishment_reviewer', 'x-request-id': 'forbidden-871' }).send(replenishment); expect(invalid.status).toBe(422); expect(invalid.body.error.code).toBe('invalid_input'); expect(denied.status).toBe(403); expect(denied.body.error.code).toBe('forbidden'); });
  it('returns structured not-found errors for missing requests and unsupported actions', async () => { const app = serviceApp(); const missing = await request(app).get('/replenishment-requests/missing-871'); const created = await request(app).post('/replenishment-requests').set(headers).send(replenishment); const action = await request(app).post(`/replenishment-requests/${created.body.id}/unknownAction`).set({ ...headers, 'x-request-id': 'unknown-action-871' }).send({ note: 'unknown action' }); expect(missing.status).toBe(404); expect(missing.body.error.code).toBe('not_found'); expect(action.status).toBe(404); expect(action.body.error.code).toBe('not_found'); });
});
