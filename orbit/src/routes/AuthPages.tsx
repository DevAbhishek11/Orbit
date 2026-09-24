/**
 * Public auth screens: register, login, forgot/reset password, email
 * verification and invite acceptance.
 *
 * SMTP is not wired in the API yet (the mailer is a logging stub), so the
 * token-carrying links for reset/verify/invite are printed to the API log.
 * Each screen therefore also accepts a pasted token so the flows are usable
 * end to end without an inbox.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { authApi, invitesApi } from '../api/endpoints';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { ErrorBox, Field, Spinner } from '../components/ui';

function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'VALIDATION_ERROR' && err.details) {
      const issues = (err.details as { issues?: { path: string; message: string }[] }).issues;
      if (issues?.length) return issues.map((i) => `${i.path}: ${i.message}`).join(' · ');
    }
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="auth-page auth-layout">
      <section className="auth-intro"><div className="brand-wordmark"><span className="sidebar__logo">O</span> orbit<span className="brand-dot">.</span></div><span className="eyebrow">A LITTLE LESS CHAOS. A LOT MORE CLARITY.</span><h1>Great things start<br />with a shared space.</h1><p>Bring your team together. Organize the details.<br />Give your next big idea room to grow.</p><div className="auth-feature-row"><span>▦ Flexible boards</span><span>◍ Shared workspaces</span><span>✓ Clear priorities</span></div><Link className="status-link" to="/status">◉ Check service status ↗</Link></section>
      <div className="auth-card">
        <div className="auth-card__brand">
          <span className="sidebar__logo">O</span>
          <div>
            <div className="auth-card__title">{title}</div>
          </div>
        </div>
        <p className="auth-card__subtitle">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

// ── Register ─────────────────────────────────────────────────────────────────

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      toast.success('Account created', 'Create a workspace to get started.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(describeError(err, 'Could not create the account'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Create your account" subtitle="Docs, boards and chat in one workspace.">
      {error ? <ErrorBox message={error} /> : null}
      <form onSubmit={submit}>
        <Field label="Full name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoFocus />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field
          label="Password"
          hint="At least 12 characters, mixing two of: lowercase, uppercase, digits, symbols. It must not contain your name or email."
        >
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            maxLength={128}
          />
        </Field>
        <Field label="Handle" hint="Optional — lowercase letters, digits and underscores.">
          <input
            className="input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            pattern="[a-z0-9_]*"
            minLength={3}
            maxLength={30}
            placeholder="auto-generated from your email"
          />
        </Field>
        <button className="btn btn--primary btn--block" disabled={busy} type="submit">
          {busy ? <Spinner /> : null}
          Create account
        </button>
      </form>
      <div className="auth-card__footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </AuthCard>
  );
}

// ── Login ────────────────────────────────────────────────────────────────────

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password, remember);
      navigate('/', { replace: true });
    } catch (err) {
      setError(describeError(err, 'Sign in failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Sign in to Orbit" subtitle="Welcome back.">
      {error ? <ErrorBox message={error} /> : null}
      <form onSubmit={submit}>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Password">
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <label className="checkbox" style={{ marginBottom: 16 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Keep me signed in for 30 days
        </label>
        <button className="btn btn--primary btn--block" disabled={busy} type="submit">
          {busy ? <Spinner /> : null}
          Sign in
        </button>
      </form>
      <div className="auth-card__footer">
        <Link to="/forgot-password">Forgot password?</Link>
        <span className="faint"> · </span>
        <Link to="/register">Create an account</Link>
      </div>
    </AuthCard>
  );
}

// ── Forgot / reset password ──────────────────────────────────────────────────

export function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
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
      toast.success('Reset requested', 'Check the API server log for the reset link.');
    } catch (err) {
      setError(describeError(err, 'Could not request a reset'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Reset your password" subtitle="We will send a single-use link, valid for 30 minutes.">
      {error ? <ErrorBox message={error} /> : null}
      {sent ? (
        <div className="info-box">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. SMTP is not wired
          yet, so the link is also written to the API server log as <code>[mail-stub]</code>.
        </div>
      ) : null}
      <form onSubmit={submit}>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <button className="btn btn--primary btn--block" disabled={busy} type="submit">
          {busy ? <Spinner /> : null}
          Send reset link
        </button>
      </form>
      <div className="auth-card__footer">
        Have the token already? <Link to="/reset-password">Enter it</Link>
        <span className="faint"> · </span>
        <Link to="/login">Back to sign in</Link>
      </div>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword(token.trim(), password);
      toast.success('Password updated', 'Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(describeError(err, 'Could not reset the password'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Choose a new password" subtitle="Resetting signs out every other session.">
      {error ? <ErrorBox message={error} /> : null}
      <form onSubmit={submit}>
        <Field label="Reset token" hint="From the reset link.">
          <input className="input mono" value={token} onChange={(e) => setToken(e.target.value)} required minLength={20} />
        </Field>
        <Field label="New password" hint="At least 12 characters, mixing two character classes.">
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            maxLength={128}
          />
        </Field>
        <button className="btn btn--primary btn--block" disabled={busy} type="submit">
          {busy ? <Spinner /> : null}
          Update password
        </button>
      </form>
      <div className="auth-card__footer">
        <Link to="/login">Back to sign in</Link>
      </div>
    </AuthCard>
  );
}

// ── Verify email ─────────────────────────────────────────────────────────────

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [state, setState] = useState<'idle' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await authApi.verifyEmail(token.trim());
      setState('ok');
      setMessage(`${result.email} is verified.`);
    } catch (err) {
      setState('error');
      setMessage(describeError(err, 'Verification failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Verify your email" subtitle="Paste the token from your verification link.">
      {state === 'error' ? <ErrorBox message={message} /> : null}
      {state === 'ok' ? <div className="info-box">{message}</div> : null}
      <form onSubmit={submit}>
        <Field label="Verification token">
          <input className="input mono" value={token} onChange={(e) => setToken(e.target.value)} required minLength={20} />
        </Field>
        <button className="btn btn--primary btn--block" disabled={busy} type="submit">
          {busy ? <Spinner /> : null}
          Verify email
        </button>
      </form>
      <div className="auth-card__footer">
        <Link to="/login">Back to sign in</Link>
      </div>
    </AuthCard>
  );
}

// ── Invite acceptance ────────────────────────────────────────────────────────

export function InvitePage() {
  const { token = '' } = useParams();
  const { refreshWorkspaces, selectWorkspace } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [manualToken, setManualToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async (rawToken: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await invitesApi.accept(rawToken.trim());
      await refreshWorkspaces();
      await selectWorkspace(result.workspaceId);
      toast.success('Invitation accepted', `You joined as ${result.role}.`);
      navigate('/', { replace: true });
    } catch (err) {
      setError(describeError(err, 'Could not accept the invitation'));
    } finally {
      setBusy(false);
    }
  };

  const decline = async (rawToken: string) => {
    setBusy(true);
    setError(null);
    try {
      await invitesApi.decline(rawToken.trim());
      toast.info('Invitation declined');
      navigate('/', { replace: true });
    } catch (err) {
      setError(describeError(err, 'Could not decline the invitation'));
    } finally {
      setBusy(false);
    }
  };

  const activeToken = token || manualToken;

  return (
    <AuthCard title="Workspace invitation" subtitle="Accept to join the workspace and pick up your role.">
      {error ? <ErrorBox message={error} /> : null}
      {!token ? (
        <Field label="Invite token" hint="From your invitation link.">
          <input className="input mono" value={manualToken} onChange={(e) => setManualToken(e.target.value)} minLength={20} />
        </Field>
      ) : (
        <div className="info-box">
          Token <code>{token.slice(0, 10)}…</code>
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--primary grow" disabled={busy || !activeToken} onClick={() => accept(activeToken)}>
          {busy ? <Spinner /> : null}
          Accept invite
        </button>
        <button className="btn" disabled={busy || !activeToken} onClick={() => decline(activeToken)}>
          Decline
        </button>
      </div>
    </AuthCard>
  );
}
