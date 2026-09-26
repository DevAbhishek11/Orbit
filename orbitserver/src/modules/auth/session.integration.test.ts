import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startEmbeddedMongo, type EmbeddedMongo } from '../../testing/embeddedMongo.js';

let mongo: EmbeddedMongo;
let app: Express;
let disconnect: () => Promise<void>;

const EMAIL = 'session.tester@orbit.test';
const PASSWORD = 'Orbit-Session-1234';

function cookieFrom(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = (raw ?? []).find((value) => value.startsWith('orbit_rt='));
  return cookie ? cookie.split(';')[0]! : '';
}

beforeAll(async () => {
  mongo = await startEmbeddedMongo(`orbit_session_${Date.now()}`);
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('JWT_SECRET', 'test-only-secret-with-at-least-32-characters');
  vi.stubEnv('MONGODB_URI', mongo.uri);
  vi.stubEnv('MONGO_DB_NAME', 'orbit_test');
  vi.stubEnv('MONGO_REQUIRE_TRANSACTIONS', 'false');
  vi.stubEnv('CORS_ORIGINS', 'http://localhost:5173');
  vi.stubEnv('LOG_LEVEL', 'silent');
  vi.stubEnv('RATE_LIMIT_AUTH', '500');
  vi.stubEnv('RATE_LIMIT_GLOBAL', '5000');
  vi.stubEnv('ARGON2_MEMORY_KIB', '8192');
  vi.stubEnv('ARGON2_TIME_COST', '1');

  const db = await import('../../infrastructure/db/mongoose.js');
  await db.connectDatabase();
  disconnect = db.disconnectDatabase;
  const { createApp } = await import('../../app.js');
  app = createApp();
}, 90_000);

afterAll(async () => {
  await disconnect?.();
  mongo?.stop();
});

describe('session lifecycle', () => {
  let rememberCookie = '';

  it('registers an account and returns an access token plus refresh cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: EMAIL, password: PASSWORD, name: 'Session Tester' });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(cookieFrom(res)).toContain('orbit_rt=');
  });

  it('honours "remember me" with a long-lived refresh cookie', async () => {
    const short = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD, remember: false });
    const long = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD, remember: true });

    expect(short.status).toBe(200);
    expect(long.status).toBe(200);
    rememberCookie = cookieFrom(long);

    const expiry = (header: request.Response) => {
      const raw = (header.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith('orbit_rt='),
      )!;
      return new Date(/expires=([^;]+)/i.exec(raw)![1]!).getTime();
    };
    expect(expiry(long) - expiry(short)).toBeGreaterThan(10 * 24 * 3_600 * 1000);
  });

  it('keeps the remembered lifetime after a rotation', async () => {
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', rememberCookie)
      .send({});

    expect(refreshed.status).toBe(200);
    const raw = (refreshed.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('orbit_rt='),
    )!;
    const expiresAt = new Date(/expires=([^;]+)/i.exec(raw)![1]!).getTime();
    expect(expiresAt - Date.now()).toBeGreaterThan(20 * 24 * 3_600 * 1000);
    rememberCookie = cookieFrom(refreshed);
  });

  it('allows concurrent refreshes from multiple tabs without killing the session', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD, remember: true });
    const cookie = cookieFrom(login);

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).send({}),
      ),
    );

    for (const result of results) {
      expect(result.status).toBe(200);
      expect(result.body.data.accessToken).toBeTruthy();
    }

    const latest = cookieFrom(results[results.length - 1]!);
    const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', latest).send({});
    expect(after.status).toBe(200);
  });

  it('still detects genuine refresh token reuse outside the grace window', async () => {
    const { RefreshTokenModel } = await import('./refreshtokens.model.js');
    const { REFRESH_ROTATION_GRACE_MS } = await import('./tokens.service.js');

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    const cookie = cookieFrom(login);
    const rawToken = cookie.split('=')[1]!;

    const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).send({});
    expect(first.status).toBe(200);

    const { createHash } = await import('node:crypto');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await RefreshTokenModel.updateOne(
      { tokenHash },
      { $set: { rotatedAt: new Date(Date.now() - REFRESH_ROTATION_GRACE_MS - 5_000) } },
    ).exec();

    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).send({});
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSED');
  });

  it('rejects refresh attempts without a token', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(401);
  });
});

describe('password management', () => {
  const email = 'password.tester@orbit.test';
  const original = 'Orbit-Password-1234';
  const updated = 'Orbit-Password-5678';
  let accessToken = '';

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: original, name: 'Password Tester' });
    accessToken = res.body.data.accessToken;
  });

  it('rejects a wrong current password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'definitely-wrong', newPassword: updated });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a new password that is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: original, newPassword: 'short' });

    expect(res.status).toBe(422);
  });

  it('rejects reusing the current password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: original, newPassword: original });

    expect(res.status).toBe(422);
  });

  it('changes the password, keeps this device signed in and invalidates the old one', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: original, newPassword: updated });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(cookieFrom(res)).toContain('orbit_rt=');

    const stale = await request(app).post('/api/v1/auth/login').send({ email, password: original });
    expect(stale.status).toBe(401);

    const fresh = await request(app).post('/api/v1/auth/login').send({ email, password: updated });
    expect(fresh.status).toBe(200);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: original, newPassword: updated });
    expect(res.status).toBe(401);
  });
});

describe('avatar upload', () => {
  const email = 'avatar.tester@orbit.test';
  let accessToken = '';
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'Orbit-Avatar-1234', name: 'Avatar Tester' });
    accessToken = res.body.data.accessToken;
  });

  it('stores an uploaded avatar and serves it without authentication', async () => {
    const upload = await request(app)
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Content-Type', 'image/png')
      .send(png);

    expect(upload.status).toBe(200);
    const avatarUrl = upload.body.data.avatarUrl as string;
    expect(avatarUrl).toMatch(/^\/api\/v1\/users\/avatars\/[a-f0-9]{24}-[a-f0-9]{12}\.png$/);

    const fetched = await request(app).get(avatarUrl);
    expect(fetched.status).toBe(200);
    expect(fetched.headers['content-type']).toContain('image/png');
  });

  it('rejects unsupported avatar types', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Content-Type', 'image/tiff')
      .send(Buffer.from('nope'));

    expect(res.status).toBe(422);
  });

  it('removes the avatar again', async () => {
    const res = await request(app)
      .delete('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.avatarUrl).toBeNull();
  });

  it('refuses path traversal in avatar file names', async () => {
    const res = await request(app).get('/api/v1/users/avatars/..%2F..%2Fpackage.json');
    expect(res.status).toBe(404);
  });
});
