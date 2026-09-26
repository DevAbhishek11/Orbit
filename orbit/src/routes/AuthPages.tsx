import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  Check,
  Eye,
  EyeOff,
  Kanban,
  LayoutGrid,
  MessagesSquare,
  Users,
  X,
} from "lucide-react";
import { ApiError } from "../api/client";
import { authApi, invitesApi } from "../api/endpoints";
import { Button, CheckItem, ErrorBox, Field, Input } from "../components/ui";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === "VALIDATION_ERROR" && err.details) {
      const issues = (
        err.details as { issues?: { path: string; message: string }[] }
      ).issues;
      if (issues?.length)
        return issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join(" · ");
    }
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

function passwordChecks(password: string, name: string, email: string) {
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;
  return [
    { label: "At least 12 characters", ok: password.length >= 12 },
    {
      label: "Two character classes (a-z, A-Z, 0-9, symbols)",
      ok: classes >= 2,
    },
    {
      label: "Does not contain your name or email",
      ok:
        password.length > 0 &&
        !name.toLowerCase().includes(password.toLowerCase()) &&
        (name.length < 3 ||
          !password.toLowerCase().includes(name.toLowerCase())) &&
        (email.length < 3 ||
          !password
            .toLowerCase()
            .includes(email.split("@")[0]?.toLowerCase() ?? "")),
    },
  ];
}

function PasswordField({
  value,
  onChange,
  checks,
  label = "Password",
  autoFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  checks?: { label: string; ok: boolean }[];
  label?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={12}
          maxLength={128}
          autoFocus={autoFocus}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          title={visible ? "Hide password" : "Show password"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-faint hover:text-ink"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {checks ? (
        <div className="mt-2 space-y-1">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-1.5">
              {check.ok ? (
                <Check size={12} className="text-ok" aria-hidden />
              ) : (
                <X size={12} className="text-faint" aria-hidden />
              )}
              <span
                className={`text-[11.5px] ${check.ok ? "font-semibold text-ok" : "text-faint"}`}
              >
                {check.label}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Field>
  );
}

function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-app lg:flex-row">
      <section className="relative hidden flex-1 overflow-hidden bg-sidebar px-12 py-14 text-sidebar-strong lg:flex lg:flex-col lg:justify-center">
        <div
          className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-brand/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-info/20 blur-3xl"
          aria-hidden
        />
        <div className="relative max-w-md">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-md">
              <Kanban size={19} aria-hidden />
            </span>
            <span className="text-[20px] font-extrabold tracking-tight">
              orbit<span className="text-brand">.</span>
            </span>
          </div>
          <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.22em] text-brand">
            A little less chaos. A lot more clarity.
          </div>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">
            Great things start
            <br />
            with a shared space.
          </h1>
          <p className="mt-4 text-[13px] leading-relaxed text-sidebar-ink">
            Bring your team together. Organize the details. Give your next big
            idea room to grow.
          </p>
          <div className="mt-8 space-y-2.5 text-[12.5px] font-semibold text-sidebar-ink">
            <div className="flex items-center gap-2.5">
              <LayoutGrid size={14} className="text-brand" aria-hidden />{" "}
              Flexible boards
            </div>
            <div className="flex items-center gap-2.5">
              <Users size={14} className="text-brand" aria-hidden /> Shared
              workspaces
            </div>
            <div className="flex items-center gap-2.5">
              <MessagesSquare size={14} className="text-brand" aria-hidden />{" "}
              Realtime chat & docs
            </div>
          </div>
          <Link
            to="/status"
            className="mt-10 inline-flex items-center gap-1.5 text-[12px] font-semibold text-sidebar-ink hover:text-sidebar-strong"
          >
            <Activity size={13} className="text-brand" aria-hidden /> Check
            service status ↗
          </Link>
        </div>
      </section>

      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-7 shadow-md animate-slide-up">
          <div className="mb-1.5 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 text-white">
              <Kanban size={15} aria-hidden />
            </span>
            <span className="text-[16px] font-extrabold text-ink">
              orbit<span className="text-brand">.</span>
            </span>
          </div>
          <h2 className="text-[18px] font-extrabold tracking-tight text-ink">
            {title}
          </h2>
          <p className="mb-5 mt-1 text-[12.5px] text-muted">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function FooterLinks({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 text-center text-[12px] text-faint [&_a]:font-bold [&_a]:text-brand [&_a]:hover:underline">
      {children}
    </div>
  );
}

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checks = useMemo(
    () => passwordChecks(password, name, email),
    [password, name, email],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signUp({
        name,
        email,
        password,
        handle: handle.trim() ? handle.trim().toLowerCase() : undefined,
      });
      toast.success("Account created", "Create a workspace to get started.");
      navigate("/", { replace: true });
    } catch (err) {
      setError(describeError(err, "Could not create the account"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Docs, boards and chat in one workspace."
    >
      {error ? (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      ) : null}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            autoFocus
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <PasswordField
          value={password}
          onChange={setPassword}
          checks={checks}
        />
        <Field
          label="Handle"
          hint="Optional — lowercase letters, digits and underscores."
        >
          <Input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            pattern="[a-z0-9_]*"
            minLength={3}
            maxLength={30}
            placeholder="auto-generated from your email"
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={busy}
        >
          Create account
        </Button>
      </form>
      <FooterLinks>
        Already have an account? <Link to="/login">Sign in</Link>
      </FooterLinks>
    </AuthCard>
  );
}

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password, remember);
      navigate("/", { replace: true });
    } catch (err) {
      setError(describeError(err, "Sign in failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Sign in to Orbit" subtitle="Welcome back.">
      {error ? (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      ) : null}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />
        </Field>
        <PasswordField value={password} onChange={setPassword} />
        <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px] font-medium text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--brand)]"
          />
          Keep me signed in for 30 days
        </label>
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={busy}
        >
          Sign in
        </Button>
      </form>
      <FooterLinks>
        <Link to="/forgot-password">Forgot password?</Link>
        <span className="mx-1.5">·</span>
        <Link to="/register">Create an account</Link>
      </FooterLinks>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
      toast.success(
        "Reset requested",
        "Check the API server log for the reset link.",
      );
    } catch (err) {
      setError(describeError(err, "Could not request a reset"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We will send a single-use link, valid for 30 minutes."
    >
      {error ? (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      ) : null}
      {sent ? (
        <div className="mb-4 rounded-lg border border-info/30 bg-info-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-info">
          If an account exists for <strong>{email}</strong>, a reset link is on
          its way. SMTP is not wired yet, so the link is also written to the API
          server log as{" "}
          <code className="font-mono text-[11px]">[mail-stub]</code>.
        </div>
      ) : null}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={busy}
        >
          Send reset link
        </Button>
      </form>
      <FooterLinks>
        Have the token already? <Link to="/reset-password">Enter it</Link>
        <span className="mx-1.5">·</span>
        <Link to="/login">Back to sign in</Link>
      </FooterLinks>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checks = useMemo(() => passwordChecks(password, "", ""), [password]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword(token.trim(), password);
      toast.success("Password updated", "Sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(describeError(err, "Could not reset the password"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Resetting signs out every other session."
    >
      {error ? (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      ) : null}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Reset token" hint="From the reset link.">
          <Input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
            minLength={20}
            className="font-mono"
          />
        </Field>
        <PasswordField
          value={password}
          onChange={setPassword}
          checks={checks}
          label="New password"
        />
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={busy}
        >
          Update password
        </Button>
      </form>
      <FooterLinks>
        <Link to="/login">Back to sign in</Link>
      </FooterLinks>
    </AuthCard>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await authApi.verifyEmail(token.trim());
      setState("ok");
      setMessage(`${result.email} is verified.`);
    } catch (err) {
      setState("error");
      setMessage(describeError(err, "Verification failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Verify your email"
      subtitle="Paste the token from your verification link."
    >
      {state === "error" ? (
        <div className="mb-4">
          <ErrorBox message={message} />
        </div>
      ) : null}
      {state === "ok" ? (
        <div className="mb-4 rounded-lg border border-ok/30 bg-ok-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-ok">
          <CheckItem ok>{message}</CheckItem>
        </div>
      ) : null}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Verification token">
          <Input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
            minLength={20}
            className="font-mono"
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={busy}
        >
          Verify email
        </Button>
      </form>
      <FooterLinks>
        <Link to="/login">Back to sign in</Link>
      </FooterLinks>
    </AuthCard>
  );
}

export function InvitePage() {
  const { token = "" } = useParams();
  const { refreshWorkspaces, selectWorkspace } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [manualToken, setManualToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async (rawToken: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await invitesApi.accept(rawToken.trim());
      await refreshWorkspaces();
      await selectWorkspace(result.workspaceId);
      toast.success("Invitation accepted", `You joined as ${result.role}.`);
      navigate("/", { replace: true });
    } catch (err) {
      setError(describeError(err, "Could not accept the invitation"));
    } finally {
      setBusy(false);
    }
  };

  const decline = async (rawToken: string) => {
    setBusy(true);
    setError(null);
    try {
      await invitesApi.decline(rawToken.trim());
      toast.info("Invitation declined");
      navigate("/", { replace: true });
    } catch (err) {
      setError(describeError(err, "Could not decline the invitation"));
    } finally {
      setBusy(false);
    }
  };

  const activeToken = token || manualToken;

  return (
    <AuthCard
      title="Workspace invitation"
      subtitle="Accept to join the workspace and pick up your role."
    >
      {error ? (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      ) : null}
      {!token ? (
        <div className="mb-4">
          <Field label="Invite token" hint="From your invitation link.">
            <Input
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
              minLength={20}
              className="font-mono"
            />
          </Field>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-line bg-sunken px-3.5 py-2.5 text-[12px] text-muted">
          Token{" "}
          <code className="font-mono text-[11px]">{token.slice(0, 10)}…</code>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          className="flex-1"
          loading={busy}
          disabled={!activeToken}
          onClick={() => void accept(activeToken)}
        >
          Accept invite
        </Button>
        <Button
          loading={busy}
          disabled={!activeToken}
          onClick={() => void decline(activeToken)}
        >
          Decline
        </Button>
      </div>
    </AuthCard>
  );
}
