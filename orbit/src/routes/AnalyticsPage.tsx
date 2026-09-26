import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/endpoints";
import { useAuth } from "../state/auth";
import { Badge, CenterState, ErrorBox, Spinner } from "../components/ui";

export function AnalyticsPage() {
  const { workspaceId, workspace } = useAuth();

  const overviewQuery = useQuery({
    queryKey: ["analytics-overview", workspaceId],
    queryFn: () => analyticsApi.workspaceOverview(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const kpis = overviewQuery.data?.kpis;

  return (
    <div className="page dashboard" style={{ padding: "24px 32px" }}>
      <div className="page__header">
        <div className="page__header-text">
          <span className="eyebrow">WORKSPACE INSIGHTS</span>
          <h1>Analytics & Metrics</h1>
          <p className="page__subtitle">
            Live metrics, card completion rates and activity trends for{" "}
            <strong>{workspace?.name}</strong>.
          </p>
        </div>
      </div>

      {overviewQuery.isLoading && (
        <CenterState>
          <Spinner large />
          <div>Aggregating metrics…</div>
        </CenterState>
      )}

      {overviewQuery.isError && (
        <ErrorBox message="Could not load analytics. Please try again." />
      )}

      {kpis && (
        <div className="stack" style={{ gap: 24 }}>
          {}
          <div
            className="grid grid--three"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <div className="panel" style={{ padding: 20 }}>
              <span
                className="faint"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Total Cards
              </span>
              <div style={{ fontSize: 32, fontWeight: 700, margin: "8px 0" }}>
                {kpis.totalCards}
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                {kpis.activeCards} active · {kpis.completedCards} completed
              </div>
            </div>

            <div className="panel" style={{ padding: 20 }}>
              <span
                className="faint"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Completion Rate
              </span>
              <div
                className="row"
                style={{ gap: 8, alignItems: "baseline", margin: "8px 0" }}
              >
                <span style={{ fontSize: 32, fontWeight: 700 }}>
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
              <div className="progress" style={{ height: 6 }}>
                <div
                  className="progress__bar"
                  style={{ width: `${kpis.completionRate}%` }}
                />
              </div>
            </div>

            <div className="panel" style={{ padding: 20 }}>
              <span
                className="faint"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Overdue Tasks
              </span>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  margin: "8px 0",
                  color: kpis.overdueCards > 0 ? "var(--danger)" : "inherit",
                }}
              >
                {kpis.overdueCards}
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                {kpis.overdueCards === 0
                  ? "No overdue items 🎉"
                  : "Needs attention"}
              </div>
            </div>

            <div className="panel" style={{ padding: 20 }}>
              <span
                className="faint"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Knowledge Base
              </span>
              <div style={{ fontSize: 32, fontWeight: 700, margin: "8px 0" }}>
                {kpis.pageCount}
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                Nested documents & wikis
              </div>
            </div>

            <div className="panel" style={{ padding: 20 }}>
              <span
                className="faint"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Communication
              </span>
              <div style={{ fontSize: 32, fontWeight: 700, margin: "8px 0" }}>
                {kpis.messageCount}
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                Across {kpis.channelCount} channel(s)
              </div>
            </div>

            <div className="panel" style={{ padding: 20 }}>
              <span
                className="faint"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Active Members
              </span>
              <div style={{ fontSize: 32, fontWeight: 700, margin: "8px 0" }}>
                {kpis.memberCount}
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                Workspace collaborators
              </div>
            </div>
          </div>

          {}
          <div className="panel" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>
              Workspace Pillar Health
            </h3>
            <div
              className="grid grid--two"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div>
                <div className="row row--between" style={{ marginBottom: 6 }}>
                  <span>Kanban Execution</span>
                  <strong>
                    {kpis.completedCards} / {kpis.totalCards} cards
                  </strong>
                </div>
                <div className="progress">
                  <div
                    className="progress__bar"
                    style={{ width: `${kpis.completionRate}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="row row--between" style={{ marginBottom: 6 }}>
                  <span>Collaboration Density</span>
                  <strong>
                    {kpis.channelCount > 0
                      ? Math.round(kpis.messageCount / kpis.channelCount)
                      : 0}{" "}
                    msgs/channel
                  </strong>
                </div>
                <div className="progress">
                  <div
                    className="progress__bar"
                    style={{
                      width: `${Math.min(kpis.messageCount * 5, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
