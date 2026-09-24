/**
 * Authenticated layout: sidebar (workspace switcher + navigation), top bar
 * (workspace name, API status, user menu) and the routed page outlet.
 */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { healthApi, usersApi } from '../api/endpoints';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { Avatar, Badge, Modal, Spinner } from '../components/ui';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { CommandPalette } from '../components/CommandPalette';
import { NotificationDrawer } from '../components/NotificationDrawer';

const NAV = [
  { to: '/docs', label: 'Docs', icon: '📄' },
  { to: '/', label: 'Boards', icon: '▦', end: true },
  { to: '/chat', label: 'Chat', icon: '💬' },
  { to: '/files', label: 'Files', icon: '📁' },
  { to: '/analytics', label: 'Analytics', icon: '📊' },
  { to: '/members', label: 'Members', icon: '◍' },
  { to: '/invitations', label: 'Invitations', icon: '✉' },
  { to: '/workspace', label: 'Workspace', icon: '⚙' },
  { to: '/status', label: 'Service status', icon: '◉' },
  { to: '/settings', label: 'My settings', icon: '☺' },
];

export function AppShell() {
  const { user, workspace, workspaces, role, signOut, selectWorkspace, bootError } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [apiState, setApiState] = useState<'checking' | 'ok' | 'degraded' | 'down'>('checking');
  const navigate = useNavigate();
  const toast = useToast();

  // ⌘K keyboard shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Live dependency status from the API's own readiness probe.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await healthApi.ready();
        if (!cancelled) setApiState(status.status === 'ok' ? 'ok' : status.status === 'unavailable' ? 'down' : 'degraded');
      } catch {
        if (!cancelled) setApiState('down');
      }
    };
    void poll();
    const timer = window.setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const onSignOut = async (allDevices: boolean) => {
    setUserMenuOpen(false);
    await signOut(allDevices);
    navigate('/login', { replace: true });
  };

  const onSwitch = async (workspaceId: string) => {
    setSwitcherOpen(false);
    try {
      await selectWorkspace(workspaceId);
      toast.success('Workspace switched');
      navigate('/');
    } catch {
      toast.error('Could not switch workspace');
    }
  };

  if (bootError) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2 className="auth-card__title">Cannot reach the Orbit API</h2>
          <p className="auth-card__subtitle">{bootError}</p>
          <p className="faint" style={{ fontSize: 13 }}>
            Start the API with <code>npm run dev:server</code> (see <code>Docs/RUNNING.md</code>), then reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${mobileOpen ? 'mobile-nav-open' : ''}`}>
      {mobileOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo">O</span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Orbit</div>
            <div className="faint" style={{ fontSize: 11.5 }}>
              docs · boards · chat
            </div>
          </div>
        </div>

        <div className="sidebar__scroll">
          <button type="button" className="workspace-switcher" onClick={() => setSwitcherOpen(true)}>
            <span className="workspace-switcher__avatar">{workspace?.name?.[0]?.toUpperCase() ?? 'O'}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {workspace?.name ?? 'No workspace'}
              </span>
              <span className="faint" style={{ fontSize: 11.5, textTransform: 'capitalize' }}>
                {role ?? '—'}
              </span>
            </span>
            <span className="faint">▾</span>
          </button>

          <nav className="stack" style={{ gap: 2 }}>
            <div className="sidebar__section-title">Workspace</div>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
              >
                <span className="nav-link__icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {workspaces.length === 0 ? (
            <div className="info-box" style={{ fontSize: 12.5 }}>
              You are not in a workspace yet. Create one from the <strong>Boards</strong> page.
            </div>
          ) : null}
        </div>

        <div className="sidebar__footer">
          <Avatar name={user?.name ?? '?'} url={user?.avatarUrl} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div className="faint" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => setUserMenuOpen(true)} aria-label="Account menu">
            ⋯
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn mobile-menu" aria-expanded={mobileOpen} aria-label="Toggle navigation" onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
          <span className="breadcrumb">Workspace <span>/</span> {NAV.find((item) => item.to === location.pathname)?.label ?? 'Board'}</span>
          <strong>{workspace?.name ?? 'Orbit'}</strong>
          <Badge tone={apiState === 'ok' ? 'success' : apiState === 'degraded' ? 'warning' : 'danger'}>
            {apiState === 'checking' ? 'checking…' : apiState === 'ok' ? 'API healthy' : apiState === 'degraded' ? 'API degraded' : 'API unreachable'}
          </Badge>
          <div className="topbar__spacer" />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ gap: 6, fontSize: 12.5 }}
            onClick={() => setPaletteOpen(true)}
          >
            <span>🔍 Search</span>
            <kbd style={{ fontSize: 10, opacity: 0.6, background: 'var(--surface-muted)', padding: '2px 4px', borderRadius: 4 }}>
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            title="Notifications"
            onClick={() => setNotifOpen(true)}
          >
            🔔
          </button>
          <ThemeToggle />
        </header>
        <ErrorBoundary key={location.pathname} name="Page View">
          <Outlet />
        </ErrorBoundary>
      </div>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <NotificationDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />

      {switcherOpen ? (
        <Modal title="Switch workspace" onClose={() => setSwitcherOpen(false)} wide={false}>
          <div className="stack" style={{ gap: 6 }}>
            {workspaces.length === 0 ? <p className="muted">You have no workspaces yet.</p> : null}
            {workspaces.map((item) => (
              <button
                key={item.id}
                type="button"
                className="workspace-switcher"
                onClick={() => void onSwitch(item.id)}
                disabled={item.id === workspace?.id}
              >
                <span className="workspace-switcher__avatar">{item.name[0]?.toUpperCase()}</span>
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>{item.name}</span>
                  <span className="faint" style={{ fontSize: 11.5 }}>
                    {item.slug} · {item.stats.memberCount} member{item.stats.memberCount === 1 ? '' : 's'}
                  </span>
                </span>
                {item.id === workspace?.id ? <Badge tone="accent">current</Badge> : null}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {userMenuOpen ? (
        <Modal title="Account" onClose={() => setUserMenuOpen(false)} wide={false}>
          <div className="stack">
            <div className="row" style={{ gap: 12 }}>
              <Avatar name={user?.name ?? '?'} url={user?.avatarUrl} size="lg" />
              <div>
                <div style={{ fontWeight: 600 }}>{user?.name}</div>
                <div className="faint" style={{ fontSize: 12.5 }}>
                  @{user?.handle} · {user?.email}
                </div>
                {user?.emailVerified ? <Badge tone="success">email verified</Badge> : <Badge tone="warning">email not verified</Badge>}
              </div>
            </div>
            <button type="button" className="btn btn--block" onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}>
              Open settings
            </button>
            <button type="button" className="btn btn--block" onClick={() => void onSignOut(false)}>
              Sign out of this device
            </button>
            <button type="button" className="btn btn--danger btn--block" onClick={() => void onSignOut(true)}>
              Sign out everywhere
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function ThemeToggle() {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const theme = user?.preferences.theme ?? 'system';

  const cycle = async () => {
    if (!user) return;
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    setBusy(true);
    try {
      const updated = await usersApi.updateMe({ preferences: { theme: next } });
      setUser(updated);
    } finally {
      setBusy(false);
    }
  };

  const label = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥';
  return (
    <button type="button" className="btn btn--ghost btn--icon" onClick={() => void cycle()} disabled={busy} title={`Theme: ${theme}`}>
      {busy ? <Spinner /> : label}
    </button>
  );
}
