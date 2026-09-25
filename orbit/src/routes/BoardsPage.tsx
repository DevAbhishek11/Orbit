import { useState, useMemo, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Kanban,
  Users,
  Star,
  Search,
  Plus,
  LayoutGrid,
  List,
  ArrowUpRight,
  Sparkles,
  FileText,
  X,
  TrendingUp,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
} from "lucide-react";
import { ApiError } from "../api/client";
import { boardsApi, workspacesApi } from "../api/endpoints";
import type { Board } from "../api/types";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import {
  Badge,
  CenterState,
  EmptyState,
  Field,
  Spinner,
} from "../components/ui";

const PERIOD_OPTIONS = [
  "All Time",
  "This Year",
  "This Month",
  "This Week",
  "Today",
];

interface RecentTaskRow {
  id: string;
  board: string;
  assignee: string;
  date: string;
  status: "Completed" | "Active" | "Pending";
}

const sampleRecentTasks: RecentTaskRow[] = [
  {
    id: "TSK-1042",
    board: "Core Engine",
    assignee: "Abhishek P.",
    date: "Today, 14:20",
    status: "Active",
  },
  {
    id: "TSK-1041",
    board: "UI Platform",
    assignee: "Sarah Connor",
    date: "Today, 11:05",
    status: "Completed",
  },
  {
    id: "TSK-1040",
    board: "Infra Cluster",
    assignee: "Alex Rivera",
    date: "Yesterday",
    status: "Completed",
  },
  {
    id: "TSK-1039",
    board: "API Gateway",
    assignee: "Dev Team",
    date: "Sep 24, 2026",
    status: "Pending",
  },
  {
    id: "TSK-1038",
    board: "Security Audit",
    assignee: "Abhishek P.",
    date: "Sep 23, 2026",
    status: "Completed",
  },
];

export function BoardsPage() {
  const {
    workspaceId,
    workspace,
    user,
    role,
    refreshWorkspaces,
    selectWorkspace,
  } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [period, setPeriod] = useState("All Time");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("orbit.favorites") ?? "[]",
      );
      return Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });

  const canCreate = ["owner", "admin", "manager"].includes(role ?? "");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [wsName, setWsName] = useState("");

  const boardsQuery = useQuery({
    queryKey: ["boards", workspaceId],
    queryFn: () => boardsApi.list(workspaceId!),
    enabled: !!workspaceId,
  });

  const boards: Board[] = useMemo(
    () => boardsQuery.data?.boards ?? [],
    [boardsQuery.data?.boards],
  );

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      localStorage.setItem("orbit.favorites", JSON.stringify(next));
      return next;
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      boardsApi.create(workspaceId!, {
        name: data.name,
        description: data.description,
      }),
    onSuccess: (newBoard) => {
      toast.success("Board created successfully");
      setCreateOpen(false);
      setName("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["boards", workspaceId] });
      navigate(`/boards/${newBoard.id}`);
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "Could not create board",
      );
    },
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: (wName: string) => {
      const slug =
        wName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "workspace";
      return workspacesApi.create({ name: wName, slug });
    },
    onSuccess: async (createdWs) => {
      toast.success("Workspace created successfully");
      setCreateWorkspaceOpen(false);
      setWsName("");
      await refreshWorkspaces();
      await selectWorkspace(createdWs.id);
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "Could not create workspace",
      );
    },
  });

  const filteredBoards = useMemo(() => {
    return boards
      .filter(
        (board: Board) =>
          (!onlyFavorites || favorites.includes(board.id)) &&
          `${board.name} ${board.description ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      .sort((a: Board, b: Board) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "cards")
          return (b.stats?.cardCount ?? 0) - (a.stats?.cardCount ?? 0);
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  }, [boards, onlyFavorites, favorites, search, sort]);

  const totalCards = useMemo(() => {
    return boards.reduce(
      (acc: number, b: Board) => acc + (b.stats?.cardCount ?? 0),
      0,
    );
  }, [boards]);

  const activeSprints = boards.length > 0 ? Math.ceil(boards.length / 2) : 1;

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  const handleCreateWorkspace = (e: FormEvent) => {
    e.preventDefault();
    if (!wsName.trim()) return;
    createWorkspaceMutation.mutate(wsName.trim());
  };

  return (
    <div className="portal-dashboard">
      <div className="portal-hero">
        <div className="portal-hero__meta">
          <div className="portal-hero__badge">
            <Sparkles size={14} style={{ marginRight: 6 }} /> Executive Overview
          </div>
          <h1 className="portal-hero__title">
            Welcome back, {user?.name || "Administrator"}
          </h1>
          <p className="portal-hero__desc">
            Monitor enterprise performance, active sprint boards, and project
            metrics in {workspace?.name ?? "Workspace"}.
          </p>
        </div>
        <div className="portal-hero__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setCreateWorkspaceOpen(true)}
          >
            <Plus size={15} style={{ marginRight: 6 }} /> New Workspace
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canCreate}
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={15} style={{ marginRight: 6 }} /> New Board
          </button>
        </div>
      </div>

      <div className="period-bar">
        <span className="period-bar__label">
          <Calendar size={13} style={{ marginRight: 6 }} /> Period:
        </span>
        <div className="period-bar__pills">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`period-pill ${period === opt ? "is-active" : ""}`}
              onClick={() => setPeriod(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-row kpi-row--primary">
        <div className="kpi-card">
          <div className="kpi-card__body">
            <span className="kpi-card__label">Total Projects</span>
            <div className="kpi-card__value">
              {boardsQuery.isSuccess ? boards.length : "—"}
            </div>
            <span className="kpi-card__subtext">{period}</span>
          </div>
          <span className="kpi-card__icon kpi-card__icon--orange">
            <LayoutDashboard size={20} />
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__body">
            <span className="kpi-card__label">Active Work Items</span>
            <div className="kpi-card__value">
              {boardsQuery.isSuccess ? totalCards : "—"}
            </div>
            <span className="kpi-card__subtext">
              Across {boards.length} sprint boards
            </span>
          </div>
          <span className="kpi-card__icon kpi-card__icon--teal">
            <Kanban size={20} />
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__body">
            <span className="kpi-card__label">Active Sprints</span>
            <div className="kpi-card__value">
              {boardsQuery.isSuccess ? activeSprints : "—"}
            </div>
            <span className="kpi-card__subtext">Current velocity: 94.2%</span>
          </div>
          <span className="kpi-card__icon kpi-card__icon--blue">
            <TrendingUp size={20} />
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__body">
            <span className="kpi-card__label">Team Capacity</span>
            <div className="kpi-card__value">100%</div>
            <span className="kpi-card__subtext">Real-time sync active</span>
          </div>
          <span className="kpi-card__icon kpi-card__icon--green">
            <Users size={20} />
          </span>
        </div>
      </div>

      <div className="kpi-row kpi-row--secondary">
        <div className="kpi-metric-card">
          <div className="kpi-metric-card__header">
            <span className="kpi-metric-card__label">Completed Tasks</span>
            <CheckCircle2 size={16} className="faint" />
          </div>
          <div className="kpi-metric-card__value">1,280</div>
          <span className="kpi-metric-card__delta is-positive">
            +12.4% vs last period
          </span>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-metric-card__header">
            <span className="kpi-metric-card__label">Pending Review</span>
            <Clock size={16} className="faint" />
          </div>
          <div className="kpi-metric-card__value">42</div>
          <span className="kpi-metric-card__delta is-neutral">On track</span>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-metric-card__header">
            <span className="kpi-metric-card__label">Overdue Items</span>
            <AlertCircle size={16} className="faint" />
          </div>
          <div className="kpi-metric-card__value">3</div>
          <span className="kpi-metric-card__delta is-negative">
            -40% down from 5
          </span>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-metric-card__header">
            <span className="kpi-metric-card__label">Documents</span>
            <FileText size={16} className="faint" />
          </div>
          <div className="kpi-metric-card__value">64</div>
          <span className="kpi-metric-card__delta is-positive">
            Active knowledge base
          </span>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-metric-card__header">
            <span className="kpi-metric-card__label">Data Throughput</span>
            <Layers size={16} className="faint" />
          </div>
          <div className="kpi-metric-card__value">99.98%</div>
          <span className="kpi-metric-card__delta is-positive">
            Zero downtime
          </span>
        </div>
      </div>

      <div className="portal-grid">
        <div className="portal-grid__main">
          <div className="portal-card">
            <div className="portal-card__header">
              <div>
                <h3 className="portal-card__title">
                  Recent Tasks & Sprint Activity
                </h3>
                <span className="portal-card__subtitle">
                  Showing latest tasks in{" "}
                  {workspace?.name ?? "current workspace"}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => toast.info("Exporting recent activity log...")}
              >
                <Download size={14} style={{ marginRight: 4 }} /> Export
              </button>
            </div>

            <div className="portal-table-container">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>CODE</th>
                    <th>BOARD</th>
                    <th>ASSIGNEE</th>
                    <th>DATE</th>
                    <th>STATUS</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sampleRecentTasks.map((task) => (
                    <tr key={task.id} className="portal-table__row">
                      <td className="portal-table__code">{task.id}</td>
                      <td>
                        <span className="portal-badge-pill">{task.board}</span>
                      </td>
                      <td className="portal-table__party">{task.assignee}</td>
                      <td className="faint" style={{ fontSize: 12 }}>
                        {task.date}
                      </td>
                      <td>
                        <Badge
                          tone={
                            task.status === "Completed"
                              ? "success"
                              : task.status === "Active"
                                ? "accent"
                                : "warning"
                          }
                        >
                          {task.status}
                        </Badge>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <ArrowUpRight size={14} className="faint" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="portal-card" style={{ marginTop: 24 }}>
            <div className="portal-card__header">
              <div>
                <h3 className="portal-card__title">Active Boards Directory</h3>
                <span className="portal-card__subtitle">
                  {boards.length} configured boards
                </span>
              </div>
              <div className="portal-toolbar-actions">
                <button
                  type="button"
                  className={`btn btn--sm ${onlyFavorites ? "btn--accent" : "btn--ghost"}`}
                  onClick={() => setOnlyFavorites((prev) => !prev)}
                  title="Filter favorites"
                  style={{ height: 32, padding: "0 8px" }}
                >
                  <Star
                    size={13}
                    fill={onlyFavorites ? "currentColor" : "none"}
                  />
                </button>
                <select
                  className="portal-table__select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  style={{
                    height: 32,
                    padding: "0 8px",
                    fontSize: 12,
                    borderRadius: 6,
                  }}
                >
                  <option value="recent">Recent</option>
                  <option value="name">Name</option>
                  <option value="cards">Most Cards</option>
                </select>
                <label className="search-box">
                  <Search size={14} className="search-box__icon" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search boards..."
                  />
                  {search && (
                    <button onClick={() => setSearch("")}>
                      <X size={13} />
                    </button>
                  )}
                </label>
                <div className="view-toggle">
                  <button
                    className={layout === "grid" ? "active" : ""}
                    onClick={() => setLayout("grid")}
                    title="Grid view"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    className={layout === "list" ? "active" : ""}
                    onClick={() => setLayout("list")}
                    title="List view"
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>

            {boardsQuery.isLoading && (
              <CenterState>
                <Spinner large />
              </CenterState>
            )}

            {boardsQuery.isError && (
              <CenterState>
                <p className="danger">Failed to load boards.</p>
              </CenterState>
            )}

            {boardsQuery.isSuccess && filteredBoards.length === 0 && (
              <EmptyState
                icon="▦"
                title={
                  boards.length === 0
                    ? "No boards in this workspace"
                    : "No boards match your filter"
                }
                hint={
                  boards.length === 0
                    ? "Sprint boards help your team organize tasks, track work in progress, and hit milestones."
                    : "Try clearing your search query or removing the favorites filter."
                }
                action={
                  boards.length === 0 && canCreate ? (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setCreateOpen(true)}
                    >
                      <Plus size={15} style={{ marginRight: 6 }} /> Create First
                      Board
                    </button>
                  ) : undefined
                }
              />
            )}

            {boardsQuery.isSuccess && filteredBoards.length > 0 && (
              <div
                className={layout === "grid" ? "boards-grid" : "boards-list"}
              >
                {filteredBoards.map((board: Board) => {
                  const isFav = favorites.includes(board.id);
                  return (
                    <div
                      key={board.id}
                      className="board-card"
                      onClick={() => navigate(`/boards/${board.id}`)}
                    >
                      <div className="board-card__header">
                        <div className="board-card__icon-box">
                          <Kanban size={18} />
                        </div>
                        <button
                          type="button"
                          className={`board-card__star ${isFav ? "is-favorited" : ""}`}
                          onClick={(e) => toggleFavorite(board.id, e)}
                          title={isFav ? "Remove favorite" : "Mark favorite"}
                        >
                          <Star
                            size={15}
                            fill={isFav ? "currentColor" : "none"}
                          />
                        </button>
                      </div>

                      <div className="board-card__body">
                        <h4 className="board-card__name">{board.name}</h4>
                        {board.description && (
                          <p className="board-card__desc">
                            {board.description}
                          </p>
                        )}
                      </div>

                      <div className="board-card__footer">
                        <div className="board-card__metric">
                          <span className="board-card__count">
                            {board.stats?.cardCount ?? 0}
                          </span>{" "}
                          cards
                        </div>
                        <div className="board-card__date">
                          Updated{" "}
                          {new Date(board.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="portal-grid__sidebar">
          <div className="portal-card">
            <div className="portal-card__header">
              <div>
                <h3 className="portal-card__title">Top Contributors</h3>
                <span className="portal-card__subtitle">
                  Work items closed this period
                </span>
              </div>
            </div>
            <div className="portal-contributors">
              <div className="portal-contributor">
                <div className="portal-contributor__rank">1</div>
                <div className="portal-contributor__avatar">AP</div>
                <div className="portal-contributor__meta">
                  <span className="portal-contributor__name">Abhishek P.</span>
                  <span className="portal-contributor__tasks">
                    28 tasks completed
                  </span>
                </div>
                <Badge tone="accent">Top Lead</Badge>
              </div>

              <div className="portal-contributor">
                <div className="portal-contributor__rank">2</div>
                <div className="portal-contributor__avatar">SC</div>
                <div className="portal-contributor__meta">
                  <span className="portal-contributor__name">Sarah Connor</span>
                  <span className="portal-contributor__tasks">
                    19 tasks completed
                  </span>
                </div>
                <Badge tone="success">Active</Badge>
              </div>

              <div className="portal-contributor">
                <div className="portal-contributor__rank">3</div>
                <div className="portal-contributor__avatar">AR</div>
                <div className="portal-contributor__meta">
                  <span className="portal-contributor__name">Alex Rivera</span>
                  <span className="portal-contributor__tasks">
                    14 tasks completed
                  </span>
                </div>
                <Badge tone="default">Member</Badge>
              </div>
            </div>
          </div>

          <div className="portal-card" style={{ marginTop: 24 }}>
            <div className="portal-card__header">
              <h3 className="portal-card__title">Workspace Resource Health</h3>
            </div>
            <div className="portal-health-list">
              <div className="portal-health-item">
                <div className="portal-health-item__header">
                  <span>MongoDB Atlas Storage</span>
                  <span className="bold">1.2 GB / 5 GB</span>
                </div>
                <div className="portal-progress">
                  <div
                    className="portal-progress__bar"
                    style={{ width: "24%" }}
                  />
                </div>
              </div>

              <div className="portal-health-item">
                <div className="portal-health-item__header">
                  <span>File Vault Capacity</span>
                  <span className="bold">4.8 GB / 20 GB</span>
                </div>
                <div className="portal-progress">
                  <div
                    className="portal-progress__bar"
                    style={{ width: "32%" }}
                  />
                </div>
              </div>

              <div className="portal-health-item">
                <div className="portal-health-item__header">
                  <span>API Compute Allocation</span>
                  <span className="bold">38% Peak</span>
                </div>
                <div className="portal-progress">
                  <div
                    className="portal-progress__bar"
                    style={{ width: "38%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <h3 className="modal-card__title">Create New Sprint Board</h3>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setCreateOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-card__body">
                <Field label="Board Name *">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Q4 Sprint, Platform Engine"
                    autoFocus
                    required
                  />
                </Field>
                <Field label="Description (optional)">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short summary of this board goals and team scope..."
                    rows={3}
                  />
                </Field>
              </div>
              <div className="modal-card__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!name.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Board"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createWorkspaceOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setCreateWorkspaceOpen(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <h3 className="modal-card__title">Create New Workspace</h3>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setCreateWorkspaceOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateWorkspace}>
              <div className="modal-card__body">
                <Field label="Workspace Name *">
                  <input
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    placeholder="e.g. Engineering, APAC Operations"
                    autoFocus
                    required
                  />
                </Field>
              </div>
              <div className="modal-card__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setCreateWorkspaceOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!wsName.trim() || createWorkspaceMutation.isPending}
                >
                  {createWorkspaceMutation.isPending
                    ? "Creating..."
                    : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
