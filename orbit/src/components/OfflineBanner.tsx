import { useEffect, useState } from 'react';
import { subscribeOffline } from '../lib/offline-sync';

export function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    return subscribeOffline((isOnline, count) => {
      setOnline(isOnline);
      setPending(count);
    });
  }, []);

  if (online && pending === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: online ? '#111827' : '#dc2626',
        color: '#fff',
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 13,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,.25)',
      }}
    >
      <span aria-hidden>{online ? '✓' : '◌'}</span>
      <span>{online ? (pending > 0 ? `Syncing… ${pending} pending` : 'Back online') : 'You are offline — changes will queue'}</span>
    </div>
  );
}
