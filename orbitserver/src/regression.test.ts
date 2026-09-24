import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

beforeAll(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('JWT_SECRET', 'test-only-secret-with-at-least-32-characters');
  vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017/orbit_test');
  vi.stubEnv('CORS_ORIGINS', 'http://localhost:5173');
  vi.stubEnv('LOG_LEVEL', 'silent');
});

describe('HTTP regressions without database', () => {
  it('reports unavailable dependencies without buffering database requests', async () => {
    const { createApp } = await import('./app.js');
    const app = createApp();
    const live = await request(app).get('/health/live');
    expect(live.status).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'test@example.com', password: 'x' });
    expect(login.status).toBe(503);
    expect((login.body as { error: { code: string } }).error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(login.headers['x-request-id']).toBeTruthy();
  });
  it('requires bearer authentication on board and card detail routes', async () => {
    const express = (await import('express')).default;
    const { boardsRouter } = await import('./modules/boards/boards.routes.js');
    const { cardsRouter } = await import('./modules/cards/cards.routes.js');
    const { errorHandler } = await import('./middleware/errorHandler.js');
    const app = express();
    app.use(boardsRouter, cardsRouter, errorHandler);
    for (const resource of ['boards', 'cards']) {
      const result = await request(app).get(`/${resource}/507f1f77bcf86cd799439011`);
      expect(result.status).toBe(401);
    }
  });
  it('validates profile patches and preserves strict writable fields', async () => {
    const { updateProfileSchema } = await import('./modules/users/users.schema.js');
    expect(updateProfileSchema.safeParse({ name: 'Alice', status: 'active' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ preferences: { quietHoursStart: '25:00' } }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ preferences: { theme: 'dark' } }).success).toBe(true);
  });
  it('scopes session revocation to the authenticated user', async () => {
    const { RefreshTokenModel } = await import('./modules/auth/refreshtokens.model.js');
    const { revokeFamily } = await import('./modules/auth/tokens.service.js');
    const spy = vi.spyOn(RefreshTokenModel, 'updateMany').mockReturnValue({ exec: () => Promise.resolve({}) } as never);
    await revokeFamily('family', 'revoked_by_user', 'alice');
    expect(spy.mock.calls[0]?.[0]).toEqual({ familyId: 'family', revokedAt: null, userId: 'alice' });
    spy.mockRestore();
  });
});
