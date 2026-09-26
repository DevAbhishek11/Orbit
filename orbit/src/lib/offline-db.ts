import Dexie, { type Table } from "dexie";

export interface OutboxItem {
  id?: number;
  url: string;
  method: string;
  body: string;
  headers: Record<string, string>;
  createdAt: number;
  retries: number;
}

export interface CacheEntry {
  key: string;
  value: unknown;
  updatedAt: number;
}

class OrbitDB extends Dexie {
  outbox!: Table<OutboxItem, number>;
  cache!: Table<CacheEntry, string>;

  constructor() {
    super("orbit-offline");
    this.version(1).stores({
      outbox: "++id, url, createdAt",
      cache: "key, updatedAt",
    });
  }
}

export const offlineDb = new OrbitDB();

export async function enqueueOutbox(
  item: Omit<OutboxItem, "id" | "createdAt" | "retries">,
) {
  await offlineDb.outbox.add({ ...item, createdAt: Date.now(), retries: 0 });
}

export async function flushOutbox(): Promise<{
  flushed: number;
  failed: number;
}> {
  const items = await offlineDb.outbox.toArray();
  let flushed = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (!res.ok && res.status >= 500) throw new Error(`server ${res.status}`);
      if (item.id != null) await offlineDb.outbox.delete(item.id);
      flushed++;
    } catch {
      failed++;
      if (item.id != null) {
        await offlineDb.outbox.update(item.id, {
          retries: (item.retries ?? 0) + 1,
        });
      }
    }
  }
  return { flushed, failed };
}

export async function getOutboxCount(): Promise<number> {
  return offlineDb.outbox.count();
}
