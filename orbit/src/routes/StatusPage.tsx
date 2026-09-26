import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { healthApi } from "../api/endpoints";
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  PageHeader,
  StatusDot,
} from "../components/ui";

const DEPENDENCY_LABELS: Record<string, string> = {
  mongo: "MongoDB database",
  redisCache: "Redis cache",
  redisQueue: "Redis queue",
};

const DEPENDENCY_HINTS: Record<string, string> = {
  mongo: "Persistent workspace data and transactions.",
  redisCache: "Caching, throttling and session token denylist.",
  redisQueue: "Queue infrastructure for background jobs.",
};

export function StatusPage() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: healthApi.ready,
    refetchInterval: 30_000,
    retry: false,
  });
  const report = query.data;

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 py-8">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft size={13} aria-hidden /> Back to workspace
      </Link>

      <PageHeader
        title="Service status"
        subtitle="Live dependency checks, refreshed every 30 seconds."
        actions={
          <Button
            icon={RefreshCw}
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Check now
          </Button>
        }
      />

      {query.isError ? (
        <ErrorBox message="The API could not be reached. Check that the backend is running and the proxy is configured." />
      ) : null}

      <Card className="mb-5 flex items-center gap-3.5">
        <StatusDot
          state={
            !report
              ? "checking"
              : report.status === "ok"
                ? "ok"
                : report.status === "unavailable"
                  ? "down"
                  : "degraded"
          }
        />
        <div>
          <h2 className="text-[14.5px] font-bold text-ink">
            {!report
              ? "Awaiting health report"
              : report.status === "ok"
                ? "All configured services operational"
                : report.status === "unavailable"
                  ? "Some services are unavailable"
                  : "Running with reduced functionality"}
          </h2>
          <p className="text-[12px] text-muted">
            {report
              ? `API version ${report.version} · Up for ${Math.floor(report.uptimeSeconds / 60)} minutes`
              : "No service status is assumed until the API responds."}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Object.entries(report?.dependencies ?? {}).map(([name, state]) => (
          <Card key={name}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-bold text-ink">
                {DEPENDENCY_LABELS[name] ?? name}
              </h2>
              <Badge
                tone={
                  state === "up"
                    ? "success"
                    : state === "down"
                      ? "danger"
                      : "warning"
                }
              >
                {state}
              </Badge>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">
              {DEPENDENCY_HINTS[name] ?? "Supporting service."}
            </p>
          </Card>
        ))}
      </div>

      {report?.runtime ? (
        <Card className="mt-5">
          <h2 className="mb-3 text-[13px] font-bold text-ink">
            Database runtime
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12.5px] sm:grid-cols-4">
            <div>
              <dt className="text-faint">Topology</dt>
              <dd className="font-semibold capitalize text-ink">
                {report.runtime.topology}
              </dd>
            </div>
            <div>
              <dt className="text-faint">Transactions</dt>
              <dd className="font-semibold text-ink">
                {report.runtime.transactionsSupported
                  ? "Supported"
                  : "Not verified"}
              </dd>
            </div>
            <div>
              <dt className="text-faint">Database</dt>
              <dd className="font-semibold text-ink">
                {report.runtime.dbName}
              </dd>
            </div>
            <div>
              <dt className="text-faint">Mongo version</dt>
              <dd className="font-semibold text-ink">
                {report.runtime.mongoServerVersion}
              </dd>
            </div>
          </dl>
        </Card>
      ) : null}
    </div>
  );
}
