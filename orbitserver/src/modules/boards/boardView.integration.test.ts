import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startEmbeddedMongo, type EmbeddedMongo } from '../../testing/embeddedMongo.js';

let mongo: EmbeddedMongo;
let app: Express;
let disconnect: () => Promise<void>;

let accessToken = '';
let workspaceId = '';
let boardId = '';
let listId = '';
let cardId = '';

beforeAll(async () => {
  mongo = await startEmbeddedMongo(`orbit_board_${Date.now()}`);
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('JWT_SECRET', 'test-only-secret-with-at-least-32-characters');
  vi.stubEnv('MONGODB_URI', mongo.uri);
  vi.stubEnv('MONGO_DB_NAME', 'orbit_test');
  vi.stubEnv('MONGO_REQUIRE_TRANSACTIONS', 'false');
  vi.stubEnv('CORS_ORIGINS', 'http://localhost:5173');
  vi.stubEnv('LOG_LEVEL', 'silent');
  vi.stubEnv('RATE_LIMIT_AUTH', '500');
  vi.stubEnv('RATE_LIMIT_GLOBAL', '5000');
  vi.stubEnv('CACHE_ENABLED', 'false');
  vi.stubEnv('ARGON2_MEMORY_KIB', '8192');
  vi.stubEnv('ARGON2_TIME_COST', '1');

  const db = await import('../../infrastructure/db/mongoose.js');
  await db.connectDatabase();
  disconnect = db.disconnectDatabase;
  const { createApp } = await import('../../app.js');
  app = createApp();

  const registered = await request(app).post('/api/v1/auth/register').send({
    email: 'board.tester@orbit.test',
    password: 'Orbit-Board-1234',
    name: 'Board Tester',
  });
  accessToken = registered.body.data.accessToken;

  const workspace = await request(app)
    .post('/api/v1/workspaces')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Board Test Workspace', slug: `board-test-${Date.now()}` });
  workspaceId = workspace.body.data.workspace?.id ?? workspace.body.data.id;

  const scoped = await request(app)
    .post('/api/v1/auth/switch-workspace')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ workspaceId });
  accessToken = scoped.body.data.accessToken;

  const board = await request(app)
    .post(`/api/v1/workspaces/${workspaceId}/boards`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Delivery', visibility: 'workspace' });
  boardId = board.body.data.id ?? board.body.data.board?.id;

  const list = await request(app)
    .post(`/api/v1/boards/${boardId}/lists`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Backlog' });
  listId = list.body.data.id ?? list.body.data.list?.id;

  const card = await request(app)
    .post(`/api/v1/lists/${listId}/cards`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ title: 'Ship the fix' });
  cardId = card.body.data.id ?? card.body.data.card?.id;
}, 90_000);

afterAll(async () => {
  await disconnect?.();
  mongo?.stop();
});

describe('board view serialization', () => {
  it('bootstraps the fixture board', () => {
    expect(workspaceId).toBeTruthy();
    expect(boardId).toBeTruthy();
    expect(listId).toBeTruthy();
    expect(cardId).toBeTruthy();
  });

  it('returns plain cards with every array field the UI dereferences', async () => {
    const res = await request(app)
      .get(`/api/v1/boards/${boardId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const view = res.body.data as {
      board: { name: string };
      lists: {
        id: string;
        cardCount: number;
        cards: Record<string, unknown>[];
      }[];
    };

    expect(view.board.name).toBe('Delivery');
    expect(view.lists).toHaveLength(1);

    const card = view.lists[0]!.cards[0]!;
    expect(card.id).toBe(cardId);
    expect(Array.isArray(card.labels)).toBe(true);
    expect(Array.isArray(card.checklists)).toBe(true);
    expect(Array.isArray(card.assignees)).toBe(true);
    expect(Array.isArray(card.assigneeProfiles)).toBe(true);
    expect(card.checklistProgress).toEqual({ done: 0, total: 0 });
    expect(typeof card.commentCount).toBe('number');
    expect(typeof card.attachmentCount).toBe('number');
    expect(Object.keys(card)).not.toContain('$__');
    expect(Object.keys(card)).not.toContain('_doc');
  });

  it('never returns undefined arrays even for legacy documents', async () => {
    const { serializeBoardCard } = await import('./boards.service.js');
    const serialized = serializeBoardCard({ _id: 'abc' } as never);

    expect(serialized.labels).toEqual([]);
    expect(serialized.checklists).toEqual([]);
    expect(serialized.assigneeProfiles).toEqual([]);
    expect(serialized.checklistProgress).toEqual({ done: 0, total: 0 });
    expect(serialized.commentCount).toBe(0);
    expect(serialized.attachmentCount).toBe(0);
    expect(serialized.priority).toBe('none');
  });

  it('404s for an unknown board instead of crashing', async () => {
    const res = await request(app)
      .get('/api/v1/boards/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe('card attachments and file previews', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  let fileId = '';

  it('uploads a file attached to a card and bumps the attachment count', async () => {
    const presigned = await request(app)
      .post('/api/v1/files/presign')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fileName: 'screenshot.png',
        mimeType: 'image/png',
        size: png.length,
        entityType: 'card',
        entityId: cardId,
      });
    expect(presigned.status).toBe(201);
    fileId = presigned.body.data.file.id;

    const uploaded = await request(app)
      .post(`/api/v1/files/${fileId}/raw`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Content-Type', 'image/png')
      .send(png);
    expect(uploaded.status).toBe(200);

    const card = await request(app)
      .get(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(card.body.data.attachmentCount).toBe(1);
  });

  it('lists attachments filtered by the owning card', async () => {
    const res = await request(app)
      .get('/api/v1/files')
      .query({ entityType: 'card', entityId: cardId })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const files = res.body.data.files as { id: string; mimeType: string }[];
    expect(files).toHaveLength(1);
    expect(files[0]!.id).toBe(fileId);
    expect(files[0]!.mimeType).toBe('image/png');
  });

  it('streams the file inline for previews', async () => {
    const res = await request(app)
      .get(`/api/v1/files/${fileId}/download`)
      .query({ disposition: 'inline' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['content-disposition']).toContain('inline');
  });

  it('defaults to an attachment disposition for downloads', async () => {
    const res = await request(app)
      .get(`/api/v1/files/${fileId}/download`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('requires authentication to read file bytes', async () => {
    const res = await request(app).get(`/api/v1/files/${fileId}/download`);
    expect(res.status).toBe(401);
  });

  it('deletes the attachment and decrements the card counter', async () => {
    const res = await request(app)
      .delete(`/api/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(204);

    const card = await request(app)
      .get(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(card.body.data.attachmentCount).toBe(0);

    const remaining = await request(app)
      .get('/api/v1/files')
      .query({ entityType: 'card', entityId: cardId })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(remaining.body.data.files).toHaveLength(0);
  });
});
