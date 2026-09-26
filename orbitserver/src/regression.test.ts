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
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'x' });
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
    expect(
      updateProfileSchema.safeParse({ preferences: { quietHoursStart: '25:00' } }).success,
    ).toBe(false);
    expect(updateProfileSchema.safeParse({ preferences: { theme: 'dark' } }).success).toBe(true);
  });
  it('scopes session revocation to the authenticated user', async () => {
    const { RefreshTokenModel } = await import('./modules/auth/refreshtokens.model.js');
    const { revokeFamily } = await import('./modules/auth/tokens.service.js');
    const spy = vi
      .spyOn(RefreshTokenModel, 'updateMany')
      .mockReturnValue({ exec: () => Promise.resolve({}) } as never);
    await revokeFamily('family', 'revoked_by_user', 'alice');
    expect(spy.mock.calls[0]?.[0]).toEqual({
      familyId: 'family',
      revokedAt: null,
      userId: 'alice',
    });
    spy.mockRestore();
  });
  it('maps mongo connectivity errors and malformed URIs to typed API errors', async () => {
    const express = (await import('express')).default;
    const { errorHandler } = await import('./middleware/errorHandler.js');
    const app = express();
    app.get('/test-db-error', (_req, _res, next) => {
      const err = new Error('getaddrinfo ENOTFOUND cluster0.mongodb.net');
      err.name = 'MongoServerSelectionError';
      next(err);
    });
    app.get('/test-uri-error', (_req, _res, next) => {
      next(new URIError('URI malformed'));
    });
    app.use(errorHandler);

    const dbRes = await request(app).get('/test-db-error');
    expect(dbRes.status).toBe(503);
    expect((dbRes.body as { error: { code: string } }).error.code).toBe('DEPENDENCY_UNAVAILABLE');

    const uriRes = await request(app).get('/test-uri-error');
    expect(uriRes.status).toBe(400);
    expect((uriRes.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });
  it('requires authentication and validates input on pages, chat, notifications and search routes', async () => {
    const express = (await import('express')).default;
    const { pagesRouter } = await import('./modules/pages/pages.routes.js');
    const { chatRouter } = await import('./modules/chat/chat.routes.js');
    const { notificationsRouter } = await import('./modules/notifications/notifications.routes.js');
    const { searchRouter } = await import('./modules/search/search.routes.js');
    const { analyticsRouter } = await import('./modules/analytics/analytics.routes.js');
    const { filesRouter } = await import('./modules/files/files.routes.js');
    const { errorHandler } = await import('./middleware/errorHandler.js');

    const app = express();
    app.use(
      pagesRouter,
      chatRouter,
      notificationsRouter,
      searchRouter,
      analyticsRouter,
      filesRouter,
      errorHandler,
    );

    const pageRes = await request(app).get('/pages/507f1f77bcf86cd799439011');
    expect(pageRes.status).toBe(401);

    const channelRes = await request(app).get('/channels/507f1f77bcf86cd799439011');
    expect(channelRes.status).toBe(401);

    const notifRes = await request(app).get('/notifications');
    expect(notifRes.status).toBe(401);

    const searchRes = await request(app).get('/workspaces/507f1f77bcf86cd799439011/search?q=test');
    expect(searchRes.status).toBe(401);

    const analyticsRes = await request(app).get(
      '/analytics/workspaces/507f1f77bcf86cd799439011/overview',
    );
    expect(analyticsRes.status).toBe(401);

    const filesRes = await request(app).get('/files/507f1f77bcf86cd799439011');
    expect(filesRes.status).toBe(401);

    const filesListRes = await request(app).get('/files');
    expect(filesListRes.status).toBe(401);

    const fromMessageRes = await request(app).post('/cards/from-message').send({
      messageId: '507f1f77bcf86cd799439011',
      boardId: '507f1f77bcf86cd799439012',
    });
    expect(fromMessageRes.status).toBe(401);
  });
  it('validates files presign input and rejects executables', async () => {
    const { presignSchema } = await import('./modules/files/files.schema.js');
    expect(
      presignSchema.safeParse({
        fileName: 'test.exe',
        mimeType: 'application/octet-stream',
        size: 100,
      }).success,
    ).toBe(true);
    expect(
      presignSchema.safeParse({ fileName: '', mimeType: 'image/png', size: 100 }).success,
    ).toBe(false);
    expect(
      presignSchema.safeParse({ fileName: 'test.png', mimeType: 'image/png', size: 0 }).success,
    ).toBe(false);
    expect(
      presignSchema.safeParse({
        fileName: 'test.png',
        mimeType: 'image/png',
        size: 101 * 1024 * 1024,
      }).success,
    ).toBe(false);
  });
  it('validates createCardFromMessage schema', async () => {
    const { createCardFromMessageSchema } = await import('./modules/boards/boards.schema.js');
    expect(
      createCardFromMessageSchema.safeParse({
        messageId: 'invalid',
        boardId: '507f1f77bcf86cd799439011',
      }).success,
    ).toBe(false);
    expect(
      createCardFromMessageSchema.safeParse({
        messageId: '507f1f77bcf86cd799439011',
        boardId: '507f1f77bcf86cd799439012',
      }).success,
    ).toBe(true);
  });
});
