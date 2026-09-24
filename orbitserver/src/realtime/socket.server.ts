/* eslint-disable @typescript-eslint/require-await */
/**
 * Realtime gateway — Socket.io with Redis adapter (BUILD_PROMPT Phase 9).
 */
import type http from 'node:http';
import { Server as SocketServer, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { childLogger } from '../infrastructure/logger/index.js';
import { getCacheClient } from '../infrastructure/redis/cacheClient.js';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../modules/auth/tokens.service.js';
import { findMembership } from '../modules/workspaces/workspaces.repository.js';
import { findChannelById } from '../modules/chat/chat.repository.js';
import { findBoardById } from '../modules/boards/boards.repository.js';
import { findPageById } from '../modules/pages/pages.repository.js';

const log = childLogger({ module: 'socket' });

type AuthPayload = {
  userId: string;
  workspaceId?: string | null;
  role?: string | null;
  jti?: string;
};

let ioInstance: SocketServer | null = null;

const presenceMap = new Map<string, { lastSeen: number; workspaceId?: string }>();
const typingMap = new Map<string, number>();
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(socketId);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(socketId, { count: 1, resetAt: now + 10_000 });
    return true;
  }
  bucket.count += 1;
  if (bucket.count > 20) return false;
  return true;
}

function verifyToken(token: string): AuthPayload | null {
  try {
    const result = verifyAccessToken(token) as {
      ok: boolean;
      userId?: string;
      workspaceId?: string | null;
      role?: string | null;
      jti?: string;
    };
    if (!result.ok || !result.userId) return null;
    return {
      userId: result.userId,
      workspaceId: result.workspaceId ?? null,
      role: result.role ?? null,
      jti: result.jti,
    };
  } catch {
    return null;
  }
}

async function checkRoomPermission(
  room: string,
  auth: AuthPayload,
): Promise<{ allowed: boolean; reason?: string }> {
  if (room.startsWith('user:')) {
    const uid = room.slice(5);
    return { allowed: uid === auth.userId };
  }
  if (room.startsWith('workspace:')) {
    const wid = room.slice(10);
    if (!wid) return { allowed: false, reason: 'Invalid workspace room' };
    const member = await findMembership(wid, auth.userId).catch(() => null);
    return { allowed: Boolean(member) };
  }
  if (room.startsWith('board:')) {
    const boardId = room.slice(6);
    const board = await findBoardById(boardId).catch(() => null);
    if (!board) return { allowed: false, reason: 'Board not found' };
    if (board.visibility === 'private' && !board.memberIds?.includes(auth.userId)) {
      return { allowed: false, reason: 'Not a board member' };
    }
    return { allowed: true };
  }
  if (room.startsWith('channel:')) {
    const channelId = room.slice(8);
    const channel = await findChannelById(channelId).catch(() => null);
    if (!channel) return { allowed: false, reason: 'Channel not found' };
    if (channel.type !== 'public' && !channel.memberIds?.includes(auth.userId)) {
      return { allowed: false, reason: 'Not a channel member' };
    }
    return { allowed: true };
  }
  if (room.startsWith('page:')) {
    const pageId = room.slice(5);
    const page = await findPageById(pageId).catch(() => null);
    if (!page) return { allowed: false, reason: 'Page not found' };
    return { allowed: true };
  }
  return { allowed: false, reason: 'Unknown room type' };
}

export function createSocketServer(httpServer: http.Server): SocketServer {
  const io = new SocketServer(httpServer, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 65_536,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    connectionStateRecovery: { maxDisconnectionDuration: 120_000 },
    cors: { origin: env.CORS_ORIGINS, credentials: true },
  });

  try {
    const cacheClient = getCacheClient();
    if (cacheClient && cacheClient.status === 'ready') {
      const pubClient = cacheClient;
      const subClient = pubClient.duplicate();
      subClient.connect().catch(() => {
        log.warn('socket redis sub client failed to connect — using in-memory adapter');
      });
      io.adapter(createAdapter(pubClient, subClient));
      log.info('socket.io redis adapter attached');
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'socket.io running without redis adapter');
  }

  io.use((socket, next) => {
    void (async () => {
      try {
        const token =
          (socket.handshake.auth?.token as string) ||
          (socket.handshake.headers.cookie
            ?.split(';')
            .find((c) => c.trim().startsWith('orbit_at='))
            ?.split('=')[1] as string) ||
          '';
        if (!token) return next(new Error('UNAUTHORIZED'));
        const payload = verifyToken(token);
        if (!payload) return next(new Error('UNAUTHORIZED'));
        (socket as unknown as { auth: AuthPayload }).auth = payload;
        next();
      } catch (err) {
        log.warn({ err: (err as Error).message }, 'socket handshake auth failed');
        next(new Error('UNAUTHORIZED'));
      }
    })();
  });

  io.on('connection', (socket: Socket) => {
    const auth = (socket as unknown as { auth: AuthPayload }).auth;
    if (!auth) {
      socket.disconnect();
      return;
    }

    log.info({ userId: auth.userId, socketId: socket.id }, 'socket connected');
    void socket.join(`user:${auth.userId}`);
    setPresence(auth.userId, auth.workspaceId ?? undefined);

    if (auth.workspaceId) {
      emitSafe(`workspace:${auth.workspaceId}`, 'presence:update', {
        userId: auth.userId,
        status: 'online',
      });
    }

    socket.on('room:join', (data: { room: string }, ack?: (res: unknown) => void) => {
      void (async () => {
        if (!checkRateLimit(socket.id)) {
          ack?.({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
          return;
        }
        const room = data?.room;
        if (!room || typeof room !== 'string') {
          ack?.({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'room required' } });
          return;
        }
        if (socket.rooms.size >= 50) {
          ack?.({ ok: false, error: { code: 'ROOM_LIMIT', message: 'Room limit reached (50)' } });
          socket.emit('error', { code: 'ROOM_LIMIT', message: 'Maximum 50 rooms per connection' });
          return;
        }
        const perm = await checkRoomPermission(room, auth);
        if (!perm.allowed) {
          ack?.({ ok: false, error: { code: 'FORBIDDEN_ROOM', message: perm.reason ?? 'Forbidden' } });
          socket.emit('error', { code: 'FORBIDDEN_ROOM', message: perm.reason ?? 'Forbidden' });
          return;
        }
        await socket.join(room);
        log.debug({ userId: auth.userId, room }, 'socket joined room');
        ack?.({ ok: true, data: { room } });
      })();
    });

    socket.on('room:leave', (data: { room: string }, ack?: (res: unknown) => void) => {
      void (async () => {
        const room = data?.room;
        if (room) {
          await socket.leave(room);
          ack?.({ ok: true });
        } else {
          ack?.({ ok: false, error: { message: 'room required' } });
        }
      })();
    });

    const typingThrottle = new Map<string, number>();

    socket.on('typing:start', (data: { channelId: string }, ack?: (res: unknown) => void) => {
      void (async () => {
        if (!checkRateLimit(socket.id)) {
          ack?.({ ok: false, error: { code: 'RATE_LIMITED' } });
          return;
        }
        const channelId = data?.channelId;
        if (!channelId) {
          ack?.({ ok: false, error: { message: 'channelId required' } });
          return;
        }
        const throttleKey = `${channelId}:${auth.userId}`;
        const lastTyped = typingThrottle.get(throttleKey) ?? 0;
        if (Date.now() - lastTyped < 2000) {
          ack?.({ ok: true, throttled: true });
          return;
        }
        typingThrottle.set(throttleKey, Date.now());
        setTyping(channelId, auth.userId);
        socket.to(`channel:${channelId}`).emit('typing:start', { channelId, userId: auth.userId });
        ack?.({ ok: true });
      })();
    });

    socket.on('typing:stop', (data: { channelId: string }, ack?: (res: unknown) => void) => {
      const channelId = data?.channelId;
      if (channelId) {
        clearTyping(channelId, auth.userId);
        socket.to(`channel:${channelId}`).emit('typing:stop', { channelId, userId: auth.userId });
      }
      ack?.({ ok: true });
    });

    socket.on(
      'message:send',
      (data: { channelId: string; body: string; clientId?: string; fileIds?: string[] }, ack?: (res: unknown) => void) => {
        void (async () => {
          if (!checkRateLimit(socket.id)) {
            ack?.({ ok: false, error: { code: 'RATE_LIMITED' } });
            return;
          }
          const { channelId, body, clientId, fileIds } = data ?? {};
          if (!channelId || !body) {
            ack?.({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'channelId and body required' } });
            return;
          }
          try {
            const { sendMessage } = await import('../modules/chat/chat.service.js');
            const { findChannelByIdScoped } = await import('../modules/chat/chat.repository.js');
            const channel = await findChannelByIdScoped(channelId, auth.workspaceId ?? '');
            if (!channel) {
              ack?.({ ok: false, error: { code: 'NOT_FOUND', message: 'Channel not found' } });
              return;
            }
            const message = await sendMessage(
              channelId,
              channel.workspaceId,
              { body, clientId, fileIds: fileIds ?? [] },
              auth.userId,
            );
            io.to(`channel:${channelId}`).emit('message:new', { message, clientId });
            ack?.({ ok: true, data: { message } });
          } catch (err) {
            log.warn({ err: (err as Error).message, userId: auth.userId, channelId }, 'socket message:send failed');
            ack?.({ ok: false, error: { code: 'SEND_FAILED', message: (err as Error).message } });
          }
        })();
      },
    );

    socket.on('presence:heartbeat', (_data: unknown, ack?: (res: unknown) => void) => {
      setPresence(auth.userId, auth.workspaceId ?? undefined);
      ack?.({ ok: true });
    });

    socket.on('sync:since', (data: { scope: string; updatedAt: string }, ack?: (res: unknown) => void) => {
      const since = data?.updatedAt ? new Date(data.updatedAt) : new Date(Date.now() - 120_000);
      log.debug({ userId: auth.userId, scope: data?.scope, since }, 'sync:since requested');
      ack?.({ ok: true, data: { since: since.toISOString(), changes: [] } });
    });

    socket.on('disconnect', (reason) => {
      log.info({ userId: auth.userId, socketId: socket.id, reason }, 'socket disconnected');
      rateBuckets.delete(socket.id);
      setTimeout(() => {
        const hasOtherSocket = Array.from(io.sockets.sockets.values()).some(
          (s) => (s as unknown as { auth?: AuthPayload }).auth?.userId === auth.userId,
        );
        if (!hasOtherSocket) {
          clearPresence(auth.userId);
          if (auth.workspaceId) {
            emitSafe(`workspace:${auth.workspaceId}`, 'presence:update', {
              userId: auth.userId,
              status: 'offline',
            });
          }
        }
      }, 5000);
    });
  });

  const presenceInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, expiry] of typingMap.entries()) {
      if (now > expiry) {
        const [channelId, userId] = key.split(':');
        typingMap.delete(key);
        io.to(`channel:${channelId}`).emit('typing:stop', { channelId, userId });
      }
    }
  }, 2000);
  presenceInterval.unref();

  ioInstance = io;
  return io;
}

export function getSocketServer(): SocketServer | null {
  return ioInstance;
}

function setPresence(userId: string, workspaceId?: string): void {
  presenceMap.set(userId, { lastSeen: Date.now(), workspaceId });
  try {
    const client = getCacheClient();
    if (client?.status === 'ready') {
      const key = `presence:${workspaceId ?? 'global'}:${userId}`;
      client.set(key, 'online', 'EX', 60).catch(() => undefined);
    }
  } catch {
    // ignore
  }
}

function clearPresence(userId: string): void {
  presenceMap.delete(userId);
  try {
    const client = getCacheClient();
    if (client?.status === 'ready') {
      client.keys(`presence:*:${userId}`).then((keys) => {
        if (keys.length) void client.del(...keys).catch(() => undefined);
      }).catch(() => undefined);
    }
  } catch {
    // ignore
  }
}

function setTyping(channelId: string, userId: string): void {
  typingMap.set(`${channelId}:${userId}`, Date.now() + 4000);
  try {
    const client = getCacheClient();
    if (client?.status === 'ready') {
      const key = `typing:${channelId}:${userId}`;
      client.set(key, '1', 'EX', 4).catch(() => undefined);
    }
  } catch {
    // ignore
  }
}

function clearTyping(channelId: string, userId: string): void {
  typingMap.delete(`${channelId}:${userId}`);
  try {
    const client = getCacheClient();
    if (client?.status === 'ready') {
      client.del(`typing:${channelId}:${userId}`).catch(() => undefined);
    }
  } catch {
    // ignore
  }
}

export function emitSafe(room: string, event: string, payload: Record<string, unknown> = {}): void {
  try {
    if (ioInstance) {
      ioInstance.to(room).emit(event, payload);
      log.debug({ room, event }, 'socket emit');
    } else {
      log.debug({ room, event }, 'socket emit (no io instance — stub)');
    }
  } catch (err) {
    log.warn({ err: (err as Error).message, room, event }, 'socket emit failed — swallowed');
  }
}
