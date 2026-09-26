import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

interface ToastContextValue {
  push: (kind: ToastKind, title: string, detail?: string) => void;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>");
  return value;
}

const KIND_STYLE: Record<ToastKind, { border: string; icon: ReactNode }> = {
  success: {
    border: "border-l-ok",
    icon: <CheckCircle2 size={16} className="text-ok" aria-hidden />,
  },
  error: {
    border: "border-l-danger",
    icon: <AlertTriangle size={16} className="text-danger" aria-hidden />,
  },
  info: {
    border: "border-l-info",
    icon: <Info size={16} className="text-info" aria-hidden />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, detail?: string) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [
        ...current.slice(-3),
        { id, kind, title, detail },
      ]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, detail) => push("success", title, detail),
      error: (title, detail) => push("error", title, detail),
      info: (title, detail) => push("info", title, detail),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line border-l-[3px] bg-surface px-3.5 py-3 shadow-md animate-slide-up ${KIND_STYLE[toast.kind].border}`}
          >
            <span className="mt-0.5 shrink-0">
              {KIND_STYLE[toast.kind].icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-ink">
                {toast.title}
              </div>
              {toast.detail ? (
                <div className="mt-0.5 text-[12px] leading-relaxed text-muted">
                  {toast.detail}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded p-0.5 text-faint hover:text-ink"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
