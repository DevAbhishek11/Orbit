/**
 * AsyncLocalStorage request context — every log line and every service call
 * can be correlated to {requestId, userId, workspaceId} without threading
 * the values through parameters (BUILD_PROMPT Phase 2).
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  requestId: string;
  userId?: string;
  workspaceId?: string;
  role?: string;
  ip?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

/** Run `fn` inside a fresh request context. */
export function runWithRequestContext<T>(store: RequestContextStore, fn: () => T): T {
  return requestContextStorage.run(store, fn);
}

/** Current context, or an empty fallback (background jobs, boot). */
export function getRequestContext(): Partial<RequestContextStore> {
  return requestContextStorage.getStore() ?? {};
}

/** Patch the running context after authentication resolved the user. */
export function enrichRequestContext(patch: Partial<RequestContextStore>): void {
  const store = requestContextStorage.getStore();
  if (store) Object.assign(store, patch);
}
