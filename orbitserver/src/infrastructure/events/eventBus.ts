/**
 * Post-commit event bus (BUILD_PROMPT Phase 9 seam).
 *
 * Services call `emitSafe(room, event, payload)` AFTER their transaction
 * commits — never inside it. Until the Socket.io gateway lands (Phase 9),
 * this is a logged no-op; swapping in the real gateway touches only this file.
 */
import { childLogger } from '../logger/index.js';
import { getRequestContext } from '../logger/requestContext.js';

const log = childLogger({ module: 'event-bus' });

export type SocketRoom =
  | `user:${string}`
  | `workspace:${string}`
  | `board:${string}`
  | `channel:${string}`
  | `page:${string}`;

export interface EmitPayload {
  /** Echoed so the acting client can ignore its own event. */
  clientMutationId?: string;
  [key: string]: unknown;
}

export function emitSafe(room: SocketRoom, event: string, payload: EmitPayload = {}): void {
  const ctx = getRequestContext();
  // Phase 9: io.to(room).emit(event, payload) wrapped in try/catch + metrics.
  log.debug({ room, event, requestId: ctx.requestId, keys: Object.keys(payload) }, 'socket emit (stub)');
}
