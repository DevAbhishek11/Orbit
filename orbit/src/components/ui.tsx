import { useEffect, useState, type ReactNode } from "react";

export function Spinner({ large = false }: { large?: boolean }) {
  return (
    <div
      className={large ? "spinner spinner--lg" : "spinner"}
      role="progressbar"
      aria-label="Loading"
    />
  );
}

export function CenterState({ children }: { children: ReactNode }) {
  return (
    <div className="center-state">
      <Spinner large />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  icon = "✦",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <h3>{title}</h3>
      {hint ? (
        <p className="faint" style={{ margin: "6px 0 0" }}>
          {hint}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

export function ErrorBox({
  message,
  requestId,
}: {
  message: string;
  requestId?: string;
}) {
  return (
    <div className="error-box" role="alert">
      <div>{message}</div>
      {requestId ? (
        <div className="mono" style={{ opacity: 0.75, marginTop: 4 }}>
          request {requestId}
        </div>
      ) : null}
    </div>
  );
}

export function Avatar({
  name,
  url,
  size,
}: {
  name: string;
  url?: string | null;
  size?: "sm" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={size === "lg" ? "avatar avatar--lg" : "avatar"}
      title={name}
    >
      {url ? <img src={url} alt="" /> : initials || "?"}
    </span>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}) {
  const suffix = tone === "default" ? "" : ` badge--${tone}`;
  return <span className={`badge${suffix}`}>{children}</span>;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && !error ? <span className="field__hint">{hint}</span> : null}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = true,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className={wide ? "modal" : "modal modal--sm"}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal__head">
          <div className="modal__title">{title}</div>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  danger = false,
  requireText,
  onConfirm,
  onClose,
  busy = false,
}: {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;

  requireText?: string;
  onConfirm: (typed: string) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const blocked = requireText ? typed !== requireText : false;

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide={false}
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={danger ? "btn btn--danger" : "btn btn--primary"}
            disabled={busy || blocked}
            onClick={() => onConfirm(typed)}
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="muted">{body}</div>
        {requireText ? (
          <>
            <p className="faint" style={{ margin: 0 }}>
              Type <code>{requireText}</code> to confirm.
            </p>
            <input
              className="input"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={requireText}
              autoFocus
            />
          </>
        ) : null}
      </div>
    </Modal>
  );
}
