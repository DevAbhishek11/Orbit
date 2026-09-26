import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";

export function Button({
  children,
  variant = "default",
  size = "md",
  ...props
}: {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn btn--${variant} btn--${size}`} {...props}>
      {children}
    </button>
  );
}

export function AsyncButton({
  busy,
  children,
  ...props
}: { busy?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="btn btn--primary"
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? "…" : null} {children}
    </button>
  );
}

export function SplitButton({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary: ReactNode;
}) {
  return (
    <div className="row" style={{ gap: 0 }}>
      <div className="btn-group">
        {primary}
        {secondary}
      </div>
    </div>
  );
}

export function ButtonGroup({ children }: { children: ReactNode }) {
  return <div className="btn-group row">{children}</div>;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

export function FloatingActionButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="fab"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "var(--accent)",
        color: "white",
        border: "none",
        fontSize: 24,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function DangerZone({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="panel"
      style={{
        borderColor: "var(--danger)",
        borderWidth: 1,
        borderStyle: "solid",
        padding: 16,
      }}
    >
      <h4 style={{ color: "var(--danger)", margin: "0 0 8px" }}>{title}</h4>
      {children}
    </div>
  );
}

export function UndoToast({
  message,
  onUndo,
  duration = 5000,
}: {
  message: string;
  onUndo: () => void;
  duration?: number;
}) {
  const [remaining, setRemaining] = useState(duration / 1000);
  useEffect(() => {
    const interval = setInterval(
      () => setRemaining((r) => Math.max(0, r - 1)),
      1000,
    );
    const timer = setTimeout(() => setRemaining(0), duration);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [duration]);

  if (remaining <= 0) return null;
  return (
    <div
      className="toast"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: "12px 16px",
        borderRadius: 8,
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        className="btn btn--sm btn--primary"
        onClick={onUndo}
      >
        Undo ({remaining}s)
      </button>
    </div>
  );
}

export function LeaveGuard({
  when,
  message,
}: {
  when: boolean;
  message?: string;
}) {
  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message ?? "You have unsaved changes";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when, message]);
  return null;
}

export function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const strength =
    value.length < 8 ? "weak" : value.length < 12 ? "medium" : "strong";
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <div className="row" style={{ gap: 8 }}>
        <input
          className="input grow"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setShow((s) => !s)}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <span className="faint" style={{ fontSize: 11 }}>
        Strength: {strength}
      </span>
    </label>
  );
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = options.filter((o) =>
    o.toLowerCase().includes(value.toLowerCase()),
  );
  return (
    <div style={{ position: "relative" }}>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div
          className="panel"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 10,
            maxHeight: 160,
            overflowY: "auto",
          }}
        >
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              className="btn btn--ghost btn--block"
              style={{ textAlign: "left" }}
              onMouseDown={() => onChange(o)}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MultiSelect({
  options,
  values,
  onChange,
}: {
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="row row--wrap" style={{ gap: 6 }}>
      {options.map((o) => {
        const selected = values.includes(o);
        return (
          <button
            key={o}
            type="button"
            className={`btn btn--sm ${selected ? "btn--primary" : "btn--ghost"}`}
            onClick={() =>
              onChange(
                selected ? values.filter((v) => v !== o) : [...values, o],
              )
            }
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function DateRangeField({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (s: string, e: string) => void;
}) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <input
        className="input"
        type="date"
        value={start}
        onChange={(e) => onChange(e.target.value, end)}
      />
      <span>—</span>
      <input
        className="input"
        type="date"
        value={end}
        onChange={(e) => onChange(start, e.target.value)}
      />
    </div>
  );
}

export function FileDropzone({ onFile }: { onFile: (f: File) => void }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className="panel"
      style={{
        border: dragOver
          ? "2px solid var(--accent)"
          : "2px dashed var(--border)",
        padding: 24,
        textAlign: "center",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      Drop file here or click to browse
      <input
        type="file"
        style={{ display: "none" }}
        id="dropzone-input"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <label
        htmlFor="dropzone-input"
        className="btn btn--sm"
        style={{ marginLeft: 12, cursor: "pointer" }}
      >
        Browse
      </label>
    </div>
  );
}

export function DropdownMenu({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className="panel"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            zIndex: 20,
            minWidth: 180,
            padding: 8,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function ContextMenu({
  children,
  menu,
}: {
  children: ReactNode;
  menu: ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setPos({ x: e.clientX, y: e.clientY });
      }}
      onClick={() => setPos(null)}
    >
      {children}
      {pos && (
        <div
          className="panel"
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            zIndex: 30,
            padding: 8,
          }}
        >
          {menu}
        </div>
      )}
    </div>
  );
}

export function Sheet({
  isOpen,
  onClose,
  children,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) {
  if (!isOpen) return null;
  return (
    <div
      className="modal-backdrop"
      style={{ justifyContent: "flex-end" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        style={{ width: 400, height: "100vh", borderRadius: 0, margin: 0 }}
      >
        <div className="modal__head">
          <div className="modal__title">{title}</div>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="row" style={{ gap: 6, fontSize: 13 }}>
      {items.map((item, idx) => (
        <span key={idx} className="row" style={{ gap: 6 }}>
          {idx > 0 && <span className="faint">/</span>}
          {item.href ? (
            <a href={item.href}>{item.label}</a>
          ) : (
            <span>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div
      className="row"
      style={{
        gap: 4,
        borderBottom: "1px solid var(--border)",
        paddingBottom: 4,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          className={`btn btn--sm ${active === t ? "btn--primary" : "btn--ghost"}`}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Record<string, ReactNode>>;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        className="table"
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12,
                  textTransform: "uppercase",
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {columns.map((c) => (
                <td
                  key={c}
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {row[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KanbanColumn({
  title,
  children,
  count,
}: {
  title: string;
  children: ReactNode;
  count?: number;
}) {
  return (
    <div
      className="panel"
      style={{ minWidth: 280, padding: 12, background: "var(--surface-muted)" }}
    >
      <div className="row row--between" style={{ marginBottom: 12 }}>
        <strong>{title}</strong>
        {count !== undefined && <span className="badge">{count}</span>}
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

export function CardTile({
  title,
  labels,
  assignees,
}: {
  title: string;
  labels?: string[];
  assignees?: string[];
}) {
  return (
    <div className="panel" style={{ padding: 12, cursor: "grab" }}>
      <div style={{ fontWeight: 500, fontSize: 13 }}>{title}</div>
      {labels && labels.length > 0 && (
        <div className="row row--wrap" style={{ gap: 4, marginTop: 8 }}>
          {labels.map((l) => (
            <span
              key={l}
              className="badge badge--accent"
              style={{ fontSize: 10 }}
            >
              {l}
            </span>
          ))}
        </div>
      )}
      {assignees && assignees.length > 0 && (
        <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>
          {assignees.length} assignees
        </div>
      )}
    </div>
  );
}

export function MessageBubble({
  author,
  body,
  time,
}: {
  author: string;
  body: string;
  time: string;
}) {
  return (
    <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
      <div
        className="avatar"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--accent-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
        }}
      >
        {author[0]?.toUpperCase()}
      </div>
      <div className="panel" style={{ padding: "8px 12px", maxWidth: 400 }}>
        <div className="row row--between" style={{ gap: 12 }}>
          <strong style={{ fontSize: 12 }}>{author}</strong>
          <span className="faint" style={{ fontSize: 10 }}>
            {time}
          </span>
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{body}</div>
      </div>
    </div>
  );
}

export function Timeline({
  items,
}: {
  items: Array<{ time: string; title: string; description?: string }>;
}) {
  return (
    <div
      className="stack"
      style={{
        gap: 16,
        borderLeft: "2px solid var(--border)",
        paddingLeft: 16,
      }}
    >
      {items.map((item, idx) => (
        <div key={idx}>
          <div className="faint" style={{ fontSize: 11 }}>
            {item.time}
          </div>
          <strong style={{ fontSize: 13 }}>{item.title}</strong>
          {item.description && (
            <div style={{ fontSize: 12 }}>{item.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="panel" style={{ padding: 16 }}>
      <div
        className="faint"
        style={{ fontSize: 11, textTransform: "uppercase" }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, margin: "4px 0" }}>
        {value}
      </div>
      {hint && (
        <div className="faint" style={{ fontSize: 11 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function BarChart({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="stack" style={{ gap: 6 }}>
      {data.map((d) => (
        <div
          key={d.label}
          className="row"
          style={{ gap: 8, alignItems: "center" }}
        >
          <span style={{ width: 80, fontSize: 12 }}>{d.label}</span>
          <div
            className="grow"
            style={{
              height: 12,
              background: "var(--surface-muted)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(d.value / max) * 100}%`,
                height: "100%",
                background: "var(--accent)",
              }}
            />
          </div>
          <span style={{ width: 40, fontSize: 12, textAlign: "right" }}>
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);
  const path = points
    .map(
      (v, i) => `${(i / (points.length - 1)) * 100},${100 - (v / max) * 100}`,
    )
    .join(" ");
  return (
    <div
      style={{
        height: 80,
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 8,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%" }}
      >
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          points={path}
        />
      </svg>
    </div>
  );
}

export function DonutChart({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div
      style={{
        width: 80,
        height: 80,
        borderRadius: "50%",
        background: `conic-gradient(var(--accent) ${pct}%, var(--surface-muted) ${pct}% 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        {Math.round(pct)}%
      </div>
    </div>
  );
}

export function Heatmap({ data }: { data: number[][] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${data[0]?.length ?? 7}, 1fr)`,
        gap: 2,
      }}
    >
      {data.flat().map((v, idx) => (
        <div
          key={idx}
          style={{
            aspectRatio: "1",
            background: `rgba(99,102,241,${Math.min(v / 10, 1)})`,
            borderRadius: 2,
          }}
          title={`${v}`}
        />
      ))}
    </div>
  );
}

export function BurndownChart({
  ideal,
  actual,
}: {
  ideal: number[];
  actual: number[];
}) {
  return (
    <div className="panel" style={{ padding: 12 }}>
      <div className="row row--between" style={{ marginBottom: 8 }}>
        <strong style={{ fontSize: 12 }}>Burndown</strong>
        <span className="faint" style={{ fontSize: 11 }}>
          Ideal vs Actual
        </span>
      </div>
      <LineChart points={actual} />
      <div className="faint" style={{ fontSize: 10, marginTop: 4 }}>
        Ideal: {ideal.join(" → ")}
      </div>
    </div>
  );
}

export function Skeleton({
  width,
  height,
}: {
  width?: string | number;
  height?: string | number;
}) {
  return (
    <div
      style={{
        width: width ?? "100%",
        height: height ?? 16,
        background: "var(--surface-muted)",
        borderRadius: 4,
        animation: "pulse 1.5s infinite",
      }}
    />
  );
}

export function Tooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 11,
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export function ProgressBar({
  value,
  max = 100,
}: {
  value: number;
  max?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      style={{
        height: 8,
        background: "var(--surface-muted)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "var(--accent)",
          transition: "width 0.3s",
        }}
      />
    </div>
  );
}

export function EmptyIllustration({
  icon,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <div style={{ textAlign: "center", padding: 32 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontWeight: 600 }}>{title}</div>
    </div>
  );
}
