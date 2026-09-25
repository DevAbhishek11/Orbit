import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  requestId: string;
  userId?: string;
  workspaceId?: string;
  role?: string;
  ip?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(store: RequestContextStore, fn: () => T): T {
  return requestContextStorage.run(store, fn);
}

export function getRequestContext(): Partial<RequestContextStore> {
  return requestContextStorage.getStore() ?? {};
}

export function enrichRequestContext(patch: Partial<RequestContextStore>): void {
  const store = requestContextStorage.getStore();
  if (store) Object.assign(store, patch);
}
