import { monitorEventLoopDelay } from 'node:perf_hooks';
import client from 'prom-client';
import { env } from '../../config/env.js';

export const registry = new client.Registry();
registry.setDefaultLabels({ service: 'orbit-api', env: env.NODE_ENV });
client.collectDefaultMetrics({ register: registry, prefix: 'orbit_' });

export const httpRequestsTotal = new client.Counter({
  name: 'orbit_http_requests_total',
  help: 'HTTP requests by method, route, status',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const httpRequestDuration = new client.Histogram({
  name: 'orbit_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsInFlight = new client.Gauge({
  name: 'orbit_http_requests_in_flight',
  help: 'HTTP requests currently being served',
  registers: [registry],
});

export const eventLoopLag = new client.Gauge({
  name: 'orbit_event_loop_lag_seconds',
  help: 'p99 event loop lag over the last interval',
  registers: [registry],
});

export const cacheOpsTotal = new client.Counter({
  name: 'orbit_cache_ops_total',
  help: 'Cache get operations by result',
  labelNames: ['result'] as const,
  registers: [registry],
});

export const cacheSetsTotal = new client.Counter({
  name: 'orbit_cache_sets_total',
  help: 'Cache set/invalidation operations',
  labelNames: ['op'] as const,
  registers: [registry],
});

export const authEventsTotal = new client.Counter({
  name: 'orbit_auth_events_total',
  help: 'Auth lifecycle events',
  labelNames: ['event'] as const,
  registers: [registry],
});

export const rateLimitHitsTotal = new client.Counter({
  name: 'orbit_rate_limit_hits_total',
  help: 'Requests rejected by the rate limiter, by tier',
  labelNames: ['tier'] as const,
  registers: [registry],
});

export const dbTransactionTotal = new client.Counter({
  name: 'orbit_db_transactions_total',
  help: 'Multi-document transactions by outcome',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

const loopMonitor = monitorEventLoopDelay({ resolution: 20 });
let loopTimer: NodeJS.Timeout | null = null;

export function startMetricsCollectors(): void {
  if (!env.METRICS_ENABLED || loopTimer) return;
  loopMonitor.enable();
  loopTimer = setInterval(() => {
    eventLoopLag.set(loopMonitor.percentile(99) / 1e9);
    loopMonitor.reset();
  }, 5_000);
  loopTimer.unref();
}

export function stopMetricsCollectors(): void {
  if (loopTimer) clearInterval(loopTimer);
  loopTimer = null;
  loopMonitor.disable();
}

export async function renderMetrics(): Promise<string> {
  return registry.metrics();
}
