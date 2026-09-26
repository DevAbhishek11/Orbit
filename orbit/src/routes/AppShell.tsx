import { useCallback, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronDown,
  Download,
  FileText,
  Folder,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sun,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { healthApi } from "../api/endpoints";
import { CommandPalette } from "../components/CommandPalette";
import { CreateWorkspaceModal } from "../components/CreateWorkspaceModal";
import { NotificationDrawer } from "../components/NotificationDrawer";
import { Avatar, Kbd, Menu as DropdownMenu, StatusDot } from "../components/ui";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

type Theme = "light" | "dark" | "system";

interface NavSection {
  title: string;
  items: {
    to: string;
    label: string;
    icon: ReactNode;
    roles?: string[];
  }[];
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return theme;
}

export function AppShell() {
  const { user, workspace, signOut, role } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem("orbit_theme") as Theme) || "dark",
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("orbit_sidebar_collapsed") === "true",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [apiState, setApiState] = useState<
    "checking" | "ok" | "degraded" | "down"
  >("checking");

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem("orbit_theme", next);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(theme);
  }, [theme]);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("orbit_sidebar_collapsed", String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "b") {
        event.preventDefault();
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
        if (!cancelled) {
          setApiState(
            status.status === "ok"
              ? "ok"
              : status.status === "unavailable"
                ? "down"
                : "degraded",
          );
        }
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
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `orbit-export-${user?.id ?? "user"}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Personal data exported");
    } catch {
      toast.error("Failed to export data");
    }
  };

  const navSections: NavSection[] = [
    {
      title: "Platform",
      items: [
        { to: "/", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
        { to: "/docs", label: "Docs", icon: <FileText size={17} /> },
        { to: "/chat", label: "Chat", icon: <MessageSquare size={17} /> },
        { to: "/files", label: "Files", icon: <Folder size={17} /> },
      ],
    },
    {
      title: "Insights & Team",
      items: [
        { to: "/analytics", label: "Analytics", icon: <BarChart3 size={17} /> },
        { to: "/members", label: "Members", icon: <Users size={17} /> },
      ],
    },
    {
      title: "Preferences",
      items: [
        { to: "/settings", label: "Settings", icon: <UserCog size={17} /> },
      ],
    },
  ];

  const sections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.roles || (role && item.roles.includes(role)),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-ink">
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-overlay lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={toggleSidebar}
        onCloseMobile={() => setMobileOpen(false)}
        sections={sections}
        apiState={apiState}
        onExport={handleExportData}
        onSignOut={() => void signOut(false)}
        onCreateWorkspace={() => setCreateWsOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-14 shrink-0 items-center gap-3 bg-surface/90 px-4 backdrop-blur">
          <button
            type="button"
            className="cursor-pointer rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 md:w-full max-w-md cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-sunken/70 px-3 text-[12.5px] text-faint transition-colors hover:border-line-strong hover:text-muted"
          >
            <Search size={14} aria-hidden />
            <span className="hidden md:block md:flex-1 truncate text-left">
              Search anything in {workspace?.name ?? "workspace"}…
            </span>
            <span className="hidden sm:block text-[11px] text-faint">
              <Kbd>⌘ + K</Kbd>
            </span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <div
              className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-sunken p-0.5"
              role="group"
              aria-label="Theme"
            >
              {(
                [
                  { value: "light", icon: Sun, title: "Light mode" },
                  { value: "dark", icon: Moon, title: "Dark mode" },
                  {
                    value: "system",
                    icon: Monitor,
                    title: "System preference",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.title}
                  onClick={() => setTheme(opt.value)}
                  className={`flex h-7 w-8 cursor-pointer items-center justify-center rounded-md transition-colors ${
                    theme === opt.value
                      ? "bg-surface text-brand shadow-sm"
                      : "text-faint hover:text-ink"
                  }`}
                >
                  <opt.icon size={14} aria-hidden />
                </button>
              ))}
            </div>

            <button
              type="button"
              className="relative cursor-pointer rounded-md p-2 text-muted transition-colors hover:bg-sunken hover:text-ink"
              onClick={() => setNotifOpen(true)}
              title="Notifications"
            >
              <Bell size={17} aria-hidden />
            </button>

            <DropdownMenu
              align="right"
              width="w-56"
              trigger={() => (
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-sunken"
                >
                  <Avatar
                    name={user?.name ?? "Orbit User"}
                    url={user?.avatarUrl}
                  />
                  <span className="hidden text-left sm:block">
                    <span className="block text-[12.5px] font-bold leading-4 text-ink">
                      {user?.name}
                    </span>
                    <span className="block text-[11px] capitalize leading-4 text-faint">
                      {role}
                    </span>
                  </span>
                  <ChevronDown size={13} className="text-faint" aria-hidden />
                </button>
              )}
              items={[
                {
                  id: "settings",
                  label: "Settings",
                  icon: UserCog,
                  onSelect: () => navigate("/settings"),
                },
                {
                  id: "export",
                  label: "Export my data",
                  icon: Download,
                  onSelect: handleExportData,
                },
                {
                  id: "signout",
                  label: "Sign out",
                  icon: LogOut,
                  danger: true,
                  onSelect: () => void signOut(false),
                },
              ]}
            />
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 border rounded-xl border-line bg-app mx-1">
          <Outlet />
        </main>

        <footer className="shrink-0 bg-surface px-5 py-[14px]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-faint">
            <span>
              © {new Date().getFullYear()} Orbit Technologies. Built for
              Enterprise Velocity.
            </span>
            <nav className="flex items-center gap-4">
              <button
                type="button"
                className="cursor-pointer hover:text-ink"
                onClick={() => navigate("/status")}
              >
                System Status
              </button>
              <button
                type="button"
                className="cursor-pointer hover:text-ink"
                onClick={() => navigate("/docs")}
              >
                Documentation
              </button>
              <button
                type="button"
                className="cursor-pointer hover:text-ink"
                onClick={() => navigate("/settings")}
              >
                Settings
              </button>
              <button
                type="button"
                className="cursor-pointer hover:text-ink"
                onClick={() => navigate("/chat")}
              >
                Support Chat
              </button>
            </nav>
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
      {createWsOpen ? (
        <CreateWorkspaceModal onClose={() => setCreateWsOpen(false)} />
      ) : null}
    </div>
  );
}

function Sidebar({
  collapsed,
  mobileOpen,
  onToggle,
  onCloseMobile,
  sections,
  apiState,
  onExport,
  onSignOut,
  onCreateWorkspace,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
  sections: NavSection[];
  apiState: "checking" | "ok" | "degraded" | "down";
  onExport: () => void;
  onSignOut: () => void;
  onCreateWorkspace: () => void;
}) {
  const { user, workspace, workspaces, selectWorkspace } = useAuth();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col bg-sidebar text-sidebar-ink transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } ${collapsed ? "lg:w-[68px]" : "lg:w-[248px]"}`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-3.5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-sm">
            <Kanban size={16} aria-hidden />
          </span>
          {!collapsed ? (
            <span className="leading-tight">
              <span className="block text-[13.5px] font-extrabold tracking-wide text-sidebar-strong">
                ORBIT
              </span>
              <span className="block text-[9.5px] font-bold tracking-[0.18em] text-brand">
                ENTERPRISE
              </span>
            </span>
          ) : null}
        </div>
        {collapsed ? null : (
          <button
            type="button"
            onClick={onToggle}
            title={
              collapsed
                ? "Expand sidebar (Ctrl+B)"
                : "Collapse sidebar (Ctrl+B)"
            }
            className="hidden h-7 w-7 cursor-pointer items-center justify-center rounded-md text-sidebar-ink hover:bg-sidebar-hover hover:text-sidebar-strong lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen size={15} />
            ) : (
              <PanelLeftClose size={15} />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onCloseMobile}
          className="cursor-pointer rounded-md p-1.5 text-sidebar-ink hover:bg-sidebar-hover lg:hidden"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>
      </div>

      {!collapsed ? (
        <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-lg border border-sidebar-line bg-sidebar-raised px-2.5 py-2">
          <Avatar name={user?.name ?? "Orbit User"} url={user?.avatarUrl} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[12.5px] font-bold text-sidebar-strong">
              {user?.name || "Orbit User"}
            </span>
            <span className="block truncate text-[11px] text-sidebar-ink">
              {user?.email}
            </span>
          </span>
        </div>
      ) : null}

      <div className="px-3 pt-3">
        <DropdownMenu
          width="w-[224px]"
          trigger={() => (
            <button
              type="button"
              title="Switch workspace"
              className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border border-sidebar-line bg-sidebar-raised px-2.5 py-2 text-left transition-colors hover:bg-sidebar-hover ${collapsed ? "justify-center" : ""}`}
            >
              <Building2
                size={14}
                className="shrink-0 text-brand"
                aria-hidden
              />
              {!collapsed ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-sidebar-strong">
                    {workspace?.name ?? "No workspace"}
                  </span>
                  <ChevronDown
                    size={13}
                    className="shrink-0 text-sidebar-ink"
                    aria-hidden
                  />
                </>
              ) : null}
            </button>
          )}
          header={
            !collapsed ? (
              <div className="border-b border-line px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-faint">
                Your workspaces
              </div>
            ) : undefined
          }
          items={[
            ...workspaces.map((w) => ({
              id: w.id,
              label: (
                <span className="flex items-center gap-2">
                  <span className="truncate">{w.name}</span>
                  {w.id === workspace?.id ? (
                    <Check
                      size={13}
                      className="ml-auto shrink-0 text-brand"
                      aria-hidden
                    />
                  ) : null}
                </span>
              ),
              onSelect: () => {
                if (w.id !== workspace?.id) void selectWorkspace(w.id);
              },
            })),
            {
              id: "__create__",
              label: "New workspace…",
              icon: Plus,
              onSelect: onCreateWorkspace,
            },
          ]}
        />
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed ? (
              <div className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-ink/70">
                {section.title}
              </div>
            ) : (
              <div className="mx-2 mb-1.5 border-t border-sidebar-line" />
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    title={collapsed ? item.label : undefined}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold transition-colors ${
                        collapsed ? "justify-center" : ""
                      } ${
                        isActive
                          ? "bg-brand/15 text-brand shadow-[inset_2px_0_0_0_var(--brand)]"
                          : "text-sidebar-ink hover:bg-sidebar-hover hover:text-sidebar-strong"
                      }`
                    }
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed ? (
                      <span className="truncate">{item.label}</span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {collapsed ? (
        <button
          type="button"
          onClick={onToggle}
          title={
            collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"
          }
          className="hidden h-7 w-full cursor-pointer items-center justify-center text-sidebar-ink hover:bg-sidebar-hover hover:text-sidebar-strong lg:flex border-t border-sidebar-line py-5"
        >
          {collapsed ? (
            <PanelLeftOpen size={15} />
          ) : (
            <PanelLeftClose size={15} />
          )}
        </button>
      ) : null}
      <div className="shrink-0 px-3 py-2.5">
        <div
          className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2`}
        >
          <span
            className={`flex items-center gap-2 text-[11px] font-semibold ${collapsed ? "hidden" : ""}`}
          >
            <StatusDot state={apiState} />
            <span className="capitalize text-sidebar-ink">API: {apiState}</span>
          </span>
          <span className={`lg:hidden ${collapsed ? "" : "hidden"}`}>
            <StatusDot state={apiState} />
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onExport}
              title="Export personal data"
              className="cursor-pointer rounded-md p-1.5 text-sidebar-ink hover:bg-sidebar-hover hover:text-sidebar-strong"
            >
              <Download size={14} />
            </button>
            <button
              type="button"
              onClick={onSignOut}
              title="Sign out"
              className="cursor-pointer rounded-md p-1.5 text-sidebar-ink hover:bg-sidebar-hover hover:text-sidebar-strong"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
