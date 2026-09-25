import { useEffect, useState, useCallback, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  FileText,
  LayoutDashboard,
  MessageSquare,
  Folder,
  BarChart3,
  Users,
  UserCog,
  Search,
  Bell,
  Sun,
  Moon,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  LogOut,
  Download,
  Kanban,
} from "lucide-react";
import { healthApi } from "../api/endpoints";
import { CommandPalette } from "../components/CommandPalette";
import { NotificationDrawer } from "../components/NotificationDrawer";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

interface NavSection {
  title: string;
  items: {
    to: string;
    label: string;
    icon: ReactNode;
    badge?: string | number;
    roles?: string[];
  }[];
}

export function AppShell() {
  const { user, workspace, workspaces, selectWorkspace, signOut, role } =
    useAuth();
  const [theme, setThemeState] = useState<"light" | "dark" | "system">(() => {
    return (
      (localStorage.getItem("orbit_theme") as "light" | "dark" | "system") ||
      "dark"
    );
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("orbit_sidebar_collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [apiState, setApiState] = useState<
    "checking" | "ok" | "degraded" | "down"
  >("checking");
  const navigate = useNavigate();
  const toast = useToast();

  const setTheme = (t: "light" | "dark" | "system") => {
    setThemeState(t);
    localStorage.setItem("orbit_theme", t);
    const resolved =
      t === "system"
        ? window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : t;
    document.documentElement.dataset.theme = resolved;
  };

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("orbit_sidebar_collapsed", String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await healthApi.ready();
        if (!cancelled)
          setApiState(
            status.status === "ok"
              ? "ok"
              : status.status === "unavailable"
                ? "down"
                : "degraded",
          );
      } catch {
        if (!cancelled) setApiState("down");
      }
    };
    void poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleExportData = () => {
    try {
      const blob = new Blob([JSON.stringify(user, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orbit-export-${user?.id ?? "user"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Personal data exported successfully");
    } catch {
      toast.error("Failed to export data");
    }
  };

  const navSections: NavSection[] = [
    {
      title: "PLATFORM",
      items: [
        { to: "/", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
        { to: "/docs", label: "Docs", icon: <FileText size={18} /> },
        { to: "/chat", label: "Chat", icon: <MessageSquare size={18} /> },
        { to: "/files", label: "Files", icon: <Folder size={18} /> },
      ],
    },
    {
      title: "INSIGHTS & TEAM",
      items: [
        { to: "/analytics", label: "Analytics", icon: <BarChart3 size={18} /> },
        { to: "/members", label: "Members", icon: <Users size={18} /> },
      ],
    },
    {
      title: "PREFERENCES",
      items: [
        { to: "/settings", label: "Settings", icon: <UserCog size={18} /> },
      ],
    },
  ];

  const filteredSections = navSections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter(
        (item) => !item.roles || (role && item.roles.includes(role)),
      ),
    }))
    .filter((sec) => sec.items.length > 0);

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <div className={`portal-layout ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div
        className={`portal-sidebar__backdrop ${mobileOpen ? "is-visible" : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`portal-sidebar ${mobileOpen ? "is-mobile-open" : ""}`}>
        <div className="portal-sidebar__brand">
          <div className="portal-sidebar__brand-meta">
            <div className="portal-sidebar__logo-mark">
              <Kanban size={20} color="#fff" />
            </div>
            {!collapsed && (
              <div className="portal-sidebar__brand-text">
                <span className="portal-sidebar__brand-title">ORBIT</span>
                <span className="portal-sidebar__brand-tag">ENTERPRISE</span>
              </div>
            )}
          </div>
          <button
            className="portal-sidebar__collapse-btn"
            onClick={toggleSidebar}
            title={
              collapsed
                ? "Expand sidebar (Ctrl+B)"
                : "Collapse sidebar (Ctrl+B)"
            }
          >
            {collapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="portal-user-badge">
            <div className="portal-user-badge__avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="portal-user-badge__info">
              <span className="portal-user-badge__name">
                {user?.name || "Orbit User"}
              </span>
              <span className="portal-user-badge__role">
                {user?.email || "admin@orbit.dev"}
              </span>
            </div>
          </div>
        )}

        <div className="portal-sidebar__workspace-selector">
          <select
            className="portal-sidebar__select"
            value={workspace?.id ?? ""}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                navigate("/workspaces/new");
              } else {
                void selectWorkspace(e.target.value);
              }
            }}
            title="Switch Workspace"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {collapsed ? w.name.slice(0, 3) : w.name}
              </option>
            ))}
            <option value="__new__">+ New Workspace...</option>
          </select>
        </div>

        <nav className="portal-sidebar__nav">
          {filteredSections.map((sec) => (
            <div key={sec.title} className="portal-sidebar__section">
              {!collapsed && (
                <span className="portal-sidebar__heading">{sec.title}</span>
              )}
              <ul className="portal-sidebar__list">
                {sec.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `portal-sidebar__item ${isActive ? "is-active" : ""}`
                      }
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="portal-sidebar__icon">{item.icon}</span>
                      {!collapsed && (
                        <span className="portal-sidebar__label">
                          {item.label}
                        </span>
                      )}
                      {!collapsed && item.badge !== undefined && (
                        <span className="portal-sidebar__badge">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="portal-sidebar__footer">
          {!collapsed && (
            <div className="portal-sidebar__health">
              <span className={`portal-health-dot ${apiState}`} />
              <span className="portal-health-label">API: {apiState}</span>
            </div>
          )}
          <div className="portal-sidebar__footer-actions">
            <button
              className="portal-sidebar__footer-btn"
              onClick={handleExportData}
              title="Export personal data"
            >
              <Download size={15} />
            </button>
            <button
              className="portal-sidebar__footer-btn"
              onClick={() => void signOut(false)}
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="portal-main">
        <header className="portal-header">
          <div className="portal-header__left">
            <button
              className="portal-header__menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>
            <button
              className="portal-header__search-bar"
              onClick={() => setPaletteOpen(true)}
            >
              <Search size={15} className="portal-header__search-icon" />
              <span>
                Search anything in {workspace?.name ?? "workspace"}...
              </span>
              <kbd className="portal-header__kbd">⌘K</kbd>
            </button>
          </div>

          <div className="portal-header__right">
            <div className="theme-switcher">
              <button
                type="button"
                className={`theme-switcher__btn ${theme === "light" ? "is-active" : ""}`}
                onClick={() => setTheme("light")}
                title="Light mode"
              >
                <Sun size={15} />
              </button>
              <button
                type="button"
                className={`theme-switcher__btn ${theme === "dark" ? "is-active" : ""}`}
                onClick={() => setTheme("dark")}
                title="Dark mode"
              >
                <Moon size={15} />
              </button>
              <button
                type="button"
                className={`theme-switcher__btn ${theme === "system" ? "is-active" : ""}`}
                onClick={() => setTheme("system")}
                title="System preference"
              >
                <Monitor size={15} />
              </button>
            </div>

            <button
              type="button"
              className="portal-header__icon-btn"
              onClick={() => setNotifOpen(true)}
              title="Notifications"
            >
              <Bell size={18} />
            </button>

            <div
              className="portal-header__profile"
              onClick={() => navigate("/settings")}
            >
              <div className="portal-header__avatar">{initial}</div>
              <div className="portal-header__meta">
                <span className="portal-header__user-name">{user?.name}</span>
                <span className="portal-header__user-role">{role}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="portal-content">
          <Outlet />
        </main>

        <footer className="portal-footer">
          <div className="portal-footer__inner">
            <div className="portal-footer__copy">
              © {new Date().getFullYear()} Orbit Technologies. Built for
              Enterprise Velocity.
            </div>
            <div className="portal-footer__links">
              <a
                href="#status"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/status");
                }}
              >
                System Status
              </a>
              <a
                href="#docs"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/docs");
                }}
              >
                Documentation
              </a>
              <a
                href="#settings"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/settings");
                }}
              >
                Settings
              </a>
              <a
                href="#chat"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/chat");
                }}
              >
                Support Chat
              </a>
            </div>
          </div>
        </footer>
      </div>

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
      <NotificationDrawer
        isOpen={notifOpen}
        onClose={() => setNotifOpen(false)}
      />
    </div>
  );
}
