import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileText,
  Kanban,
  MessageSquare,
  Timer,
  Users,
} from "lucide-react";
import { analyticsApi } from "../api/endpoints";
import {
  Badge,
  Card,
  CardHeader,
  CenterState,
  ErrorBox,
  PageHeader,
  ProgressBar,
} from "../components/ui";
import { useAuth } from "../state/auth";

export function AnalyticsPage() {
  const { workspaceId, workspace } = useAuth();

  const overviewQuery = useQuery({
    queryKey: ["analytics-overview", workspaceId],
    queryFn: () => analyticsApi.workspaceOverview(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const kpis = overviewQuery.data?.kpis;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-6">
      <PageHeader
        title="Analytics & Metrics"
        subtitle={
          <>
            Live metrics, card completion rates and activity trends for{" "}
            <strong className="text-ink">{workspace?.name}</strong>.
          </>
        }
      />

      {overviewQuery.isLoading ? (
        <CenterState>Aggregating metrics…</CenterState>
      ) : null}

      {overviewQuery.isError ? (
        <ErrorBox message="Could not load analytics. Please try again." />
      ) : null}

      {kpis ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={Kanban}
              label="Total Cards"
              value={String(kpis.totalCards)}
              hint={`${kpis.activeCards} active · ${kpis.completedCards} completed`}
            />
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-faint">
                  Completion Rate
                </span>
                <CheckCircle2 size={14} className="text-faint" aria-hidden />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-extrabold tracking-tight text-ink">
                  {kpis.completionRate}%
                </span>
                <Badge
                  tone={
                    kpis.completionRate >= 70
                      ? "success"
                      : kpis.completionRate >= 40
                        ? "warning"
                        : "default"
                  }
                >
                  {kpis.completionRate >= 70 ? "On Track" : "In Progress"}
                </Badge>
              </div>
              <div className="mt-3">
                <ProgressBar
                  value={kpis.completionRate}
                  tone={kpis.completionRate >= 70 ? "ok" : "warn"}
                />
              </div>
            </Card>
            <StatCard
              icon={Timer}
              label="Overdue Tasks"
              value={String(kpis.overdueCards)}
              hint={
                kpis.overdueCards === 0 ? "No overdue items" : "Needs attention"
              }
              danger={kpis.overdueCards > 0}
            />
            <StatCard
              icon={FileText}
              label="Knowledge Base"
              value={String(kpis.pageCount)}
              hint="Nested documents & wikis"
            />
            <StatCard
              icon={MessageSquare}
              label="Communication"
              value={String(kpis.messageCount)}
              hint={`Across ${kpis.channelCount} channel(s)`}
            />
            <StatCard
              icon={Users}
              label="Active Members"
              value={String(kpis.memberCount)}
              hint="Workspace collaborators"
            />
          </div>

          <Card>
            <CardHeader title="Workspace Pillar Health" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-muted">
                    Kanban Execution
                  </span>
                  <strong className="text-ink">
                    {kpis.completedCards} / {kpis.totalCards} cards
                  </strong>
                </div>
                <ProgressBar value={kpis.completionRate} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-muted">
                    Collaboration Density
                  </span>
                  <strong className="text-ink">
                    {kpis.channelCount > 0
                      ? Math.round(kpis.messageCount / kpis.channelCount)
                      : 0}{" "}
                    msgs/channel
                  </strong>
                </div>
                <ProgressBar
                  value={Math.min(kpis.messageCount * 5, 100)}
                  tone="info"
                />
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  danger = false,
}: {
  icon: typeof Kanban;
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-faint">
          {label}
        </div>
        <div
          className={`mt-1.5 text-[28px] font-extrabold tracking-tight ${danger ? "text-danger" : "text-ink"}`}
        >
          {value}
        </div>
        <div className="mt-1 text-[11.5px] text-faint">{hint}</div>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Icon size={17} aria-hidden />
      </span>
    </Card>
  );
}
