/**
 * Health + metrics routes. Deliberately NOT under /api/v1 and NOT rate-limited
 * (orchestrator probes must never be throttled). /metrics is token-guarded.
 */
import { Router } from 'express';
import { env } from '../../config/env.js';
import { renderMetrics, startMetricsCollectors } from '../../infrastructure/metrics/index.js';
import { unauthenticated } from '../../infrastructure/errors/ApiError.js';
import { buildLiveReport, buildReadyReport } from './health.service.js';

export const healthRouter = Router();

healthRouter.get('/health/live', (_req, res) => {
  const { status, report } = buildLiveReport();
  res.status(status).json(report);
});

healthRouter.get('/health/ready', async (_req, res) => {
  const { status, report } = await buildReadyReport();
  res.status(status).json(report);
});

healthRouter.get('/metrics', async (req, res) => {
  if (!env.METRICS_ENABLED) {
    res.status(404).json({ error: 'metrics disabled' });
    return;
  }
  const provided = req.header('authorization');
  if (provided !== `Bearer ${env.METRICS_TOKEN}`) {
    throw unauthenticated('metrics require the scrape token');
  }
  startMetricsCollectors();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(await renderMetrics());
});

// A tiny route used by the middleware proof: throws on demand so the error
// envelope + requestId correlation can be verified end-to-end (Phase 2 AC).
if (env.NODE_ENV !== 'production') healthRouter.get('/debug/throw', () => {
  throw new Error('synthetic failure for error-envelope proof');
});
