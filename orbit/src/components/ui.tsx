import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  FileText,
  Folder,
  Inbox,
  Loader2,
  MessageSquare,
  PanelLeft,
  Search,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

const NAMED_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "file-text": FileText,
  file: FileText,
  book: BookOpen,
  folder: Folder,
  inbox: Inbox,
  message: MessageSquare,
  chat: MessageSquare,
  calendar: Calendar,
  search: Search,
};

export function AppIcon({
  name,
  size = 16,
  className,
}: {
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const Icon = (name && NAMED_ICONS[name]) || FileText;
  return <Icon size={size} className={className} aria-hidden />;
}

export type ButtonVariant = "primary" | "outline" | "ghost" | "soft" | "danger";
export type ButtonSize = "md" | "sm" | "xs" | "icon" | "icon-sm";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-ink hover:bg-brand-hover border border-transparent shadow-sm font-semibold",
  outline:
    "bg-surface text-ink border border-line-strong/70 hover:bg-sunken font-medium",
  ghost:
    "bg-transparent text-muted hover:bg-sunken hover:text-ink border border-transparent font-medium",
  soft: "bg-brand-soft text-brand hover:bg-brand/20 border border-transparent font-semibold",
  danger:
    "bg-danger text-white hover:opacity-90 border border-transparent font-semibold",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "h-9 px-3.5 text-[13px] gap-2 rounded-md",
  sm: "h-8 px-3 text-[12.5px] gap-1.5 rounded-md",
  xs: "h-7 px-2.5 text-[12px] gap-1.5 rounded-[7px]",
  icon: "h-9 w-9 rounded-md",
  "icon-sm": "h-7 w-7 rounded-[7px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
}

export function Button({
  variant = "outline",
  size = "md",
  loading = false,
  icon: Icon,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon size={size === "md" ? 15 : 14} aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

export const inputClass =
  "w-full h-9 rounded-md border border-line-strong/60 bg-surface px-3 text-[13px] text-ink placeholder:text-faint transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60 disabled:cursor-not-allowed";

export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} ${className}`} {...rest} />;
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${inputClass} h-auto min-h-[72px] py-2 leading-relaxed ${className}`}
      {...rest}
    />
  );
}

export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select
        className={`${inputClass} appearance-none pr-8 cursor-pointer`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint"
        aria-hidden
      />
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <input
        className={`${inputClass} pl-8 ${value ? "pr-8" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-faint hover:text-ink cursor-pointer"
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-muted">
        {label}
      </span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 block text-[12px] text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-[12px] text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label?: string; icon?: LucideIcon; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-7" : "h-8";
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-[9px] border border-line bg-sunken p-0.5`}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.title ?? opt.label}
            onClick={() => onChange(opt.value)}
            className={`${h} inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-2.5 text-[12px] font-semibold transition-colors ${
              active
                ? "bg-surface text-ink shadow-sm border border-line"
                : "text-muted hover:text-ink border border-transparent"
            }`}
          >
            {Icon ? <Icon size={13} aria-hidden /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export type BadgeTone =
  "default" | "brand" | "info" | "success" | "warning" | "danger";

const BADGE_TONES: Record<BadgeTone, string> = {
  default: "bg-sunken text-muted border-line",
  brand: "bg-brand-soft text-brand border-transparent",
  info: "bg-info-soft text-info border-transparent",
  success: "bg-ok-soft text-ok border-transparent",
  warning: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

export function Badge({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-surface shadow-sm ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[14px] font-bold text-ink">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] text-faint">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function Spinner({ large = false }: { large?: boolean }) {
  return (
    <Loader2
      className={`animate-spin text-brand ${large ? "h-7 w-7" : "h-4 w-4"}`}
      role="progressbar"
      aria-label="Loading"
    />
  );
}

export function CenterState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 p-8 text-[13px] text-muted">
      <Spinner large />
      <div className="text-center">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-sunken text-faint">
        <Icon size={22} aria-hidden />
      </div>
      <h3 className="text-[14px] font-bold text-ink">{title}</h3>
      {hint ? (
        <p className="max-w-sm text-[12.5px] text-faint">{hint}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
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
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-3 text-[13px] text-danger"
    >
      <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <div className="font-semibold">{message}</div>
        {requestId ? (
          <div className="mt-0.5 font-mono text-[11px] opacity-75">
            request {requestId}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const AVATAR_HUES = [
  "bg-orange-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
];

export function Avatar({
  name,
  url,
  size = "md",
}: {
  name: string;
  url?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const hue = useMemo(() => {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
    return AVATAR_HUES[hash % AVATAR_HUES.length];
  }, [name]);
  const dims =
    size === "lg"
      ? "h-10 w-10 text-[14px]"
      : size === "sm"
        ? "h-6 w-6 text-[10px]"
        : "h-8 w-8 text-[11.5px]";
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white ${dims} ${url ? "" : hue}`}
      title={name}
    >
      {url ? (
        <img
          src={url}
          alt={name}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        initials || "?"
      )}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
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

  const width =
    size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-sm" : "max-w-md";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-overlay p-3 pt-[6vh] animate-fade-in sm:p-4 sm:pt-[12vh]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${width} rounded-xl border border-line bg-surface shadow-lg animate-pop-in`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="text-[14px] font-bold text-ink">{title}</div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={15} />
          </Button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-line bg-sunken/60 px-5 py-3">
            {footer}
          </div>
        ) : null}
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
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={busy || blocked}
            loading={busy}
            onClick={() => onConfirm(typed)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-[13px] text-muted">{body}</div>
        {requireText ? (
          <>
            <p className="text-[12px] text-faint">
              Type{" "}
              <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[11px]">
                {requireText}
              </code>{" "}
              to confirm.
            </p>
            <Input
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

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: LucideIcon;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export function Menu({
  trigger,
  items,
  header,
  align = "left",
  width = "w-60",
}: {
  trigger: (open: boolean) => ReactNode;
  items: MenuItem[];
  header?: ReactNode;
  align?: "left" | "right";
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <div onClick={() => setOpen((prev) => !prev)}>{trigger(open)}</div>
      {open ? (
        <div
          role="menu"
          className={`absolute z-[70] mt-1.5 ${width} ${align === "right" ? "right-0" : "left-0"} overflow-hidden rounded-lg border border-line bg-surface shadow-md animate-pop-in`}
        >
          {header}
          <div className="max-h-72 overflow-y-auto p-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
                    item.danger
                      ? "text-danger hover:bg-danger-soft"
                      : "text-ink hover:bg-sunken"
                  }`}
                >
                  {Icon ? (
                    <Icon
                      size={14}
                      className={item.danger ? "" : "text-muted"}
                      aria-hidden
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint ? (
                    <span className="text-[11px] text-faint">{item.hint}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "brand",
}: {
  value: number;
  tone?: "brand" | "ok" | "warn" | "danger" | "info";
}) {
  const color =
    tone === "ok"
      ? "bg-ok"
      : tone === "warn"
        ? "bg-warn"
        : tone === "danger"
          ? "bg-danger"
          : tone === "info"
            ? "bg-info"
            : "bg-brand";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 items-center rounded border border-line bg-sunken px-1.5 font-mono text-[10.5px] font-semibold text-faint">
      {children}
    </kbd>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[19px] font-extrabold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[12.5px] text-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function StatusDot({
  state,
}: {
  state: "ok" | "degraded" | "down" | "checking";
}) {
  const color =
    state === "ok"
      ? "bg-ok"
      : state === "degraded"
        ? "bg-warn"
        : state === "down"
          ? "bg-danger"
          : "bg-faint animate-pulse";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function CheckItem({
  ok,
  children,
}: {
  ok: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${ok ? "text-ok" : "text-faint"}`}
    >
      <Check size={13} aria-hidden />
      {children}
    </span>
  );
}

export function SubSidebar({
  open,
  onClose,
  width = "w-[264px]",
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: string;
  children: ReactNode;
}) {
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close panel"
          className="fixed inset-0 z-30 bg-overlay md:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex ${width} max-w-[85vw] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface p-3 transition-transform duration-200 md:static md:z-auto md:max-w-none md:translate-x-0 md:bg-surface/60 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}

export function SubSidebarToggle({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="cursor-pointer rounded-md border border-line p-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink md:hidden"
    >
      <PanelLeft size={16} aria-hidden />
    </button>
  );
}
