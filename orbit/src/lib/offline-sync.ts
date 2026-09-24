import { flushOutbox, getOutboxCount } from './offline-db';

type OfflineListener = (online: boolean, pending: number) => void;
const listeners = new Set<OfflineListener>();
let onlineState = typeof navigator !== 'undefined' ? navigator.onLine : true;
let pendingCount = 0;

export function subscribeOffline(cb: OfflineListener): () => void {
  listeners.add(cb);
  cb(onlineState, pendingCount);
  return () => listeners.delete(cb);
}

function emit() {
  for (const l of listeners) l(onlineState, pendingCount);
}

async function refreshPending() {
  try {
    pendingCount = await getOutboxCount();
  } catch {
    pendingCount = 0;
  }
  emit();
}

export function initOfflineSync() {
  if (typeof window === 'undefined') return;

  const onOnline = async () => {
    onlineState = true;
    try {
      const res = await flushOutbox();
      console.info(`[offline] flushed ${res.flushed}, failed ${res.failed}`);
    } catch (e) {
      console.warn('[offline] flush failed', e);
    }
    await refreshPending();
  };

  const onOffline = () => {
    onlineState = false;
    emit();
  };

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  refreshPending();
  if (onlineState) {
    flushOutbox().then(refreshPending).catch(() => refreshPending());
  }

  // periodic retry
  setInterval(() => {
    if (onlineState) {
      flushOutbox().then(refreshPending).catch(() => {});
    } else {
      refreshPending();
    }
  }, 30_000);
}
