import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  FileText,
  Kanban,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  List,
  Plus,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { ApiError } from "../api/client";
import { boardsApi } from "../api/endpoints";
import type { Board } from "../api/types";
import { CreateWorkspaceModal } from "../components/CreateWorkspaceModal";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  CenterState,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressBar,
  SearchInput,
  Segmented,
  Select,
  Textarea,
} from "../components/ui";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

const PERIOD_OPTIONS = [
  "All Time",
  "This Year",
  "This Month",
  "This Week",
  "Today",
];

export function BoardsPage() {
  const { workspaceId, workspace, user, role } = useAuth();
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

  const boardsQuery = useQuery({
    queryKey: ["boards", workspaceId],
    queryFn: () => boardsApi.list(workspaceId!),
    enabled: !!workspaceId,
  });

  const boards: Board[] = useMemo(
    () => boardsQuery.data?.boards ?? [],
    [boardsQuery.data?.boards],
  );

  const toggleFavorite = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((existing) => existing !== id)
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
    onSuccess: (created) => {
      toast.success("Board created", `“${created.name}” is ready for cards.`);
      setCreateOpen(false);
      setName("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["boards", workspaceId] });
      navigate(`/boards/${created.id}`);
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "Could not create board",
      );
    },
  });

  const filteredBoards = useMemo(() => {
    return boards
      .filter(
        (board) =>
          (!onlyFavorites || favorites.includes(board.id)) &&
          `${board.name} ${board.description ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "cards")
          return (b.stats?.cardCount ?? 0) - (a.stats?.cardCount ?? 0);
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  }, [boards, onlyFavorites, favorites, search, sort]);

  const totalCards = useMemo(
    () => boards.reduce((acc, board) => acc + (board.stats?.cardCount ?? 0), 0),
    [boards],
  );

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6">
      {/* Hero */}
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-sidebar px-6 py-6 text-sidebar-strong">
        <div
          className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-brand/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-info/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[11px] font-bold text-brand">
              <Sparkles size={12} aria-hidden /> Executive Overview
            </span>
            <h1 className="text-[22px] font-extrabold tracking-tight">
              Welcome back, {user?.name || "Administrator"}
            </h1>
            <p className="mt-1 max-w-xl text-[12.5px] text-sidebar-ink">
              Monitor enterprise performance, active sprint boards, and project
              metrics in {workspace?.name ?? "your workspace"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-white/20 bg-white/10 text-sidebar-strong hover:bg-white/20 hover:text-white"
              onClick={() => setCreateWorkspaceOpen(true)}
              icon={Plus}
            >
              New Workspace
            </Button>
            <Button
              variant="primary"
              disabled={!canCreate}
              onClick={() => setCreateOpen(true)}
              icon={Plus}
            >
              New Board
            </Button>
          </div>
        </div>
      </section>

      {/* Period filter */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
          <Calendar size={13} aria-hidden /> Period:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              className={`h-7 cursor-pointer rounded-full px-3 text-[11.5px] font-bold transition-colors ${
                period === option
                  ? "bg-brand text-brand-ink shadow-sm"
                  : "border border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Projects"
          value={boardsQuery.isSuccess ? String(boards.length) : "—"}
          subtext={period}
          icon={LayoutDashboard}
          tone="brand"
        />
        <KpiCard
          label="Active Work Items"
          value={boardsQuery.isSuccess ? String(totalCards) : "—"}
          subtext={`Across ${boards.length} sprint boards`}
          icon={Kanban}
          tone="info"
        />
        <KpiCard
          label="Active Sprints"
          value={
            boardsQuery.isSuccess
              ? String(Math.max(1, Math.ceil(boards.length / 2)))
              : "—"
          }
          subtext="Current velocity: 94.2%"
          icon={TrendingUp}
          tone="violet"
        />
        <KpiCard
          label="Team Capacity"
          value="100%"
          subtext="Real-time sync active"
          icon={Users}
          tone="ok"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          label="Completed Tasks"
          value="1,280"
          delta="+12.4% vs last period"
          tone="up"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Pending Review"
          value="42"
          delta="On track"
          tone="flat"
          icon={Clock}
        />
        <MetricCard
          label="Overdue Items"
          value="3"
          delta="-40% down from 5"
          tone="down"
          icon={AlertCircle}
        />
        <MetricCard
          label="Documents"
          value="64"
          delta="Active knowledge base"
          tone="up"
          icon={FileText}
        />
        <MetricCard
          label="Data Throughput"
          value="99.98%"
          delta="Zero downtime"
          tone="up"
          icon={Layers}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader
              title="Recent Tasks & Sprint Activity"
              subtitle={`Showing latest tasks in ${workspace?.name ?? "current workspace"}`}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Download}
                  onClick={() => toast.info("Exporting recent activity log…")}
                >
                  Export
                </Button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[10.5px] font-bold uppercase tracking-wider text-faint">
                    <th className="pb-2 pr-3">Code</th>
                    <th className="pb-2 pr-3">Board</th>
                    <th className="pb-2 pr-3">Assignee</th>
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {RECENT_TASKS.map((task) => (
                    <tr
                      key={task.id}
                      className="border-b border-line/60 last:border-0 hover:bg-sunken/50"
                    >
                      <td className="py-2.5 pr-3 font-mono text-[11.5px] font-bold text-brand">
                        {task.id}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge>{task.board}</Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-[12.5px] text-muted">
                        {task.assignee}
                      </td>
                      <td className="py-2.5 pr-3 text-[12px] text-faint">
                        {task.date}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          tone={
                            task.status === "Completed"
                              ? "success"
                              : task.status === "Active"
                                ? "info"
                                : "warning"
                          }
                        >
                          {task.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <ArrowUpRight
                          size={14}
                          className="inline text-faint"
                          aria-hidden
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Active Boards Directory"
              subtitle={`${boards.length} configured boards`}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => setOnlyFavorites((prev) => !prev)}
                    title="Filter favorites"
                    className={`cursor-pointer rounded-md p-1.5 transition-colors ${
                      onlyFavorites
                        ? "bg-brand-soft text-brand"
                        : "text-faint hover:bg-sunken hover:text-ink"
                    }`}
                  >
                    <Star
                      size={14}
                      fill={onlyFavorites ? "currentColor" : "none"}
                      aria-hidden
                    />
                  </button>
                  <Select
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className="w-[120px]"
                    aria-label="Sort boards"
                  >
                    <option value="recent">Recent</option>
                    <option value="name">Name</option>
                    <option value="cards">Most Cards</option>
                  </Select>
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search boards…"
                    className="w-[180px]"
                  />
                  <Segmented
                    size="sm"
                    value={layout}
                    onChange={setLayout}
                    options={[
                      { value: "grid", icon: LayoutGrid, title: "Grid view" },
                      { value: "list", icon: List, title: "List view" },
                    ]}
                  />
                </>
              }
            />

            {boardsQuery.isLoading ? (
              <CenterState>Loading boards…</CenterState>
            ) : boardsQuery.isError ? (
              <CenterState>
                <span className="text-danger">Failed to load boards.</span>
              </CenterState>
            ) : filteredBoards.length === 0 ? (
              <EmptyState
                icon={Kanban}
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
                    <Button
                      variant="primary"
                      icon={Plus}
                      onClick={() => setCreateOpen(true)}
                    >
                      Create First Board
                    </Button>
                  ) : undefined
                }
              />
            ) : layout === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredBoards.map((board) => {
                  const isFav = favorites.includes(board.id);
                  return (
                    <button
                      key={board.id}
                      type="button"
                      onClick={() => navigate(`/boards/${board.id}`)}
                      className="group cursor-pointer rounded-xl border border-line bg-surface p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                          <Kanban size={16} aria-hidden />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => toggleFavorite(board.id, event)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter")
                              toggleFavorite(
                                board.id,
                                event as unknown as React.MouseEvent,
                              );
                          }}
                          title={isFav ? "Remove favorite" : "Mark favorite"}
                          className={`rounded-md p-1 transition-colors ${
                            isFav
                              ? "text-brand"
                              : "text-faint opacity-0 hover:text-ink group-hover:opacity-100"
                          }`}
                        >
                          <Star
                            size={14}
                            fill={isFav ? "currentColor" : "none"}
                            aria-hidden
                          />
                        </span>
                      </div>
                      <div className="text-[13.5px] font-bold text-ink">
                        {board.name}
                      </div>
                      {board.description ? (
                        <p className="mt-1 line-clamp-2 text-[12px] text-faint">
                          {board.description}
                        </p>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between text-[11.5px] text-faint">
                        <span className="font-bold text-muted">
                          {board.stats?.cardCount ?? 0} cards
                        </span>
                        <span>
                          Updated{" "}
                          {new Date(board.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-line/70">
                {filteredBoards.map((board) => {
                  const isFav = favorites.includes(board.id);
                  return (
                    <div
                      key={board.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/boards/${board.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter")
                          navigate(`/boards/${board.id}`);
                      }}
                      className="flex cursor-pointer items-center gap-3 py-2.5 hover:bg-sunken/50"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                        <Kanban size={14} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-ink">
                          {board.name}
                        </span>
                        <span className="block truncate text-[11.5px] text-faint">
                          {board.description || "No description"}
                        </span>
                      </span>
                      <span className="text-[11.5px] font-bold text-muted">
                        {board.stats?.cardCount ?? 0} cards
                      </span>
                      <button
                        type="button"
                        onClick={(event) => toggleFavorite(board.id, event)}
                        className={`cursor-pointer rounded-md p-1 ${isFav ? "text-brand" : "text-faint hover:text-ink"}`}
                        title={isFav ? "Remove favorite" : "Mark favorite"}
                      >
                        <Star
                          size={14}
                          fill={isFav ? "currentColor" : "none"}
                          aria-hidden
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Top Contributors"
              subtitle="Work items closed this period"
            />
            <div className="space-y-2.5">
              {CONTRIBUTORS.map((person, index) => (
                <div
                  key={person.name}
                  className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5"
                >
                  <span className="w-4 text-center text-[12px] font-bold text-faint">
                    {index + 1}
                  </span>
                  <Avatar name={person.name} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[12.5px] font-bold text-ink">
                      {person.name}
                    </span>
                    <span className="block text-[11px] text-faint">
                      {person.tasks} tasks completed
                    </span>
                  </span>
                  <Badge tone={person.tone}>{person.badge}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Workspace Resource Health" />
            <div className="space-y-4">
              <HealthRow
                label="MongoDB Atlas Storage"
                value="1.2 GB / 5 GB"
                percent={24}
              />
              <HealthRow
                label="File Vault Capacity"
                value="4.8 GB / 20 GB"
                percent={32}
              />
              <HealthRow
                label="API Compute Allocation"
                value="38% Peak"
                percent={38}
                tone="info"
              />
            </div>
          </Card>
        </div>
      </div>

      {createOpen ? (
        <Modal
          title="Create New Sprint Board"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="create-board-form"
                disabled={!name.trim()}
                loading={createMutation.isPending}
              >
                Create Board
              </Button>
            </>
          }
        >
          <form
            id="create-board-form"
            onSubmit={handleCreateSubmit}
            className="space-y-4"
          >
            <Field label="Board name">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Q4 Sprint, Platform Engine"
                autoFocus
                maxLength={120}
                required
              />
            </Field>
            <Field label="Description (optional)">
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short summary of this board's goals and team scope…"
                rows={3}
              />
            </Field>
          </form>
        </Modal>
      ) : null}

      {createWorkspaceOpen ? (
        <CreateWorkspaceModal onClose={() => setCreateWorkspaceOpen(false)} />
      ) : null}
    </div>
  );
}

const RECENT_TASKS = [
  {
    id: "TSK-1042",
    board: "Core Engine",
    assignee: "Abhishek P.",
    date: "Today, 14:20",
    status: "Active" as const,
  },
  {
    id: "TSK-1041",
    board: "UI Platform",
    assignee: "Sarah Connor",
    date: "Today, 11:05",
    status: "Completed" as const,
  },
  {
    id: "TSK-1040",
    board: "Infra Cluster",
    assignee: "Alex Rivera",
    date: "Yesterday",
    status: "Completed" as const,
  },
  {
    id: "TSK-1039",
    board: "API Gateway",
    assignee: "Dev Team",
    date: "Sep 24, 2026",
    status: "Pending" as const,
  },
  {
    id: "TSK-1038",
    board: "Security Audit",
    assignee: "Abhishek P.",
    date: "Sep 23, 2026",
    status: "Completed" as const,
  },
];

const CONTRIBUTORS: {
  name: string;
  tasks: number;
  badge: string;
  tone: "brand" | "success" | "default";
}[] = [
  { name: "Abhishek Prajapati", tasks: 28, badge: "Top Lead", tone: "brand" },
  { name: "Sarah Connor", tasks: 19, badge: "Active", tone: "success" },
  { name: "Alex Rivera", tasks: 14, badge: "Member", tone: "default" },
];

function KpiCard({
  label,
  value,
  subtext,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: typeof Kanban;
  tone: "brand" | "info" | "ok" | "violet";
}) {
  const toneClass =
    tone === "brand"
      ? "bg-brand-soft text-brand"
      : tone === "info"
        ? "bg-info-soft text-info"
        : tone === "ok"
          ? "bg-ok-soft text-ok"
          : "bg-violet-500/15 text-violet-500";
  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-muted">{label}</div>
        <div className="mt-1 text-[26px] font-extrabold leading-8 tracking-tight text-ink">
          {value}
        </div>
        <div className="mt-1 truncate text-[11.5px] text-faint">{subtext}</div>
      </div>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
      >
        <Icon size={18} aria-hidden />
      </span>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  delta,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "up" | "down" | "flat";
  icon: typeof Kanban;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold text-muted">{label}</span>
        <Icon size={14} className="text-faint" aria-hidden />
      </div>
      <div className="mt-1.5 text-[20px] font-extrabold tracking-tight text-ink">
        {value}
      </div>
      <div
        className={`mt-1 text-[11px] font-semibold ${
          tone === "up"
            ? "text-ok"
            : tone === "down"
              ? "text-danger"
              : "text-faint"
        }`}
      >
        {delta}
      </div>
    </Card>
  );
}

function HealthRow({
  label,
  value,
  percent,
  tone = "brand",
}: {
  label: string;
  value: string;
  percent: number;
  tone?: "brand" | "info";
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
        <span className="font-semibold text-muted">{label}</span>
        <span className="font-bold text-ink">{value}</span>
      </div>
      <ProgressBar value={percent} tone={tone} />
    </div>
  );
}
