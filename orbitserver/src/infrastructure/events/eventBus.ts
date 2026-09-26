import { childLogger } from '../logger/index.js';
import { getRequestContext } from '../logger/requestContext.js';

const log = childLogger({ module: 'event-bus' });

export type SocketRoom =
  | `user:${string}`
  | `workspace:${string}`
  | `board:${string}`
  | `channel:${string}`
  | `page:${string}`
  | `typing:${string}`;

export interface EmitPayload {
  clientMutationId?: string;
  [key: string]: unknown;
}

let emitImpl: ((room: string, event: string, payload: Record<string, unknown>) => void) | null =
  null;

export function setEmitImplementation(
  impl: (room: string, event: string, payload: Record<string, unknown>) => void,
): void {
  emitImpl = impl;
}

export function emitSafe(room: SocketRoom, event: string, payload: EmitPayload = {}): void {
  const ctx = getRequestContext();
  try {
    if (emitImpl) {
      emitImpl(room, event, payload);
    } else {
      import('../../realtime/socket.server.js')
        .then((mod) => {
          mod.emitSafe(room, event, payload);
        })
        .catch(() => {
          log.debug({ room, event, requestId: ctx.requestId }, 'socket emit (no impl)');
        });
    }
  } catch (err) {
    log.warn(
      { err: (err as Error).message, room, event, requestId: ctx.requestId },
      'emitSafe failed — swallowed',
    );
  }
}
