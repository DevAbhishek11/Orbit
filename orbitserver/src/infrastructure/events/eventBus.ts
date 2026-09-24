/**
 * Post-commit event bus (BUILD_PROMPT Phase 9):
 * Delegates to realtime socket server when available, otherwise logs.
 * Services MUST call emitSafe AFTER transaction commits — never inside it.
 */
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
  /** Echoed so the acting client can ignore its own event. */
  clientMutationId?: string;
  [key: string]: unknown;
}

let emitImpl: ((room: string, event: string, payload: Record<string, unknown>) => void) | null = null;

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
      // Lazy import to avoid circular deps — fallback to dynamic socket server
      import('../../realtime/socket.server.js')
        .then((mod) => {
          mod.emitSafe(room, event, payload);
        })
        .catch(() => {
          log.debug({ room, event, requestId: ctx.requestId }, 'socket emit (no impl)');
        });
    }
  } catch (err) {
    log.warn({ err: (err as Error).message, room, event, requestId: ctx.requestId }, 'emitSafe failed — swallowed');
  }
}
