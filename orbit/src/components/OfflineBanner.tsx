import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { subscribeOffline } from "../lib/offline-sync";

export function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
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
      className={`fixed bottom-4 left-1/2 z-[110] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-bold text-white shadow-lg animate-slide-up ${
        online ? "bg-sidebar" : "bg-danger"
      }`}
    >
      {online ? (
        <RefreshCw size={13} className="animate-spin text-brand" aria-hidden />
      ) : (
        <WifiOff size={13} aria-hidden />
      )}
      <span>
        {online
          ? pending > 0
            ? `Syncing… ${pending} pending`
            : "Back online"
          : "You are offline — changes will queue"}
      </span>
    </div>
  );
}
