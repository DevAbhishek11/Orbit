/**
 * Express app FACTORY (BUILD_PROMPT Phase 2) — no listen() here so tests can
 * boot the exact same app via supertest.
 *
 * Pipeline order matters:
 *  trust proxy → security headers → CORS → compression → body parsers →
 *  sanitizers → request context → http logging → routes → 404 → error handler
 */
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './infrastructure/logger/index.js';
import { enrichRequestContext, getRequestContext } from './infrastructure/logger/requestContext.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestContextMiddleware } from './middleware/requestContext.js';
import { sanitizeNoSql } from './middleware/sanitize.js';
import { httpRequestsInFlight, httpRequestDuration, httpRequestsTotal } from './infrastructure/metrics/index.js';
import { healthRouter } from './modules/health/health.routes.js';
import { apiRouter } from './modules/api.routes.js';

export function createApp(): express.Express {
  const app = express();

  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.disable('etag'); // envelopes carry requestId; ETags add cost, not value

  // FIRST: every request gets a correlated id before anything can fail.
  app.use(requestContextMiddleware);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", ...env.CORS_ORIGINS],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginEmbedderPolicy: false,
      hsts: env.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin/curl (no Origin header) is allowed; browsers must match.
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After', 'Idempotency-Replay'],
      maxAge: 600,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(sanitizeNoSql);

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url.startsWith('/health'),
      },
      genReqId: (req) => (req as unknown as express.Request).id ?? '',
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
      customAttributeKeys: { reqId: 'requestId', res: 'response', err: 'error' },
    }),
  );

  // Metrics instrumentation around the routing layer.
  app.use((req, res, next) => {
    httpRequestsInFlight.inc();
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
      httpRequestsInFlight.dec();
      const routePath = (req.route as { path?: string } | undefined)?.path;
      const route = routePath ? `${req.baseUrl}${routePath}` : req.path;
      const labels = { method: req.method, route: normalizeRoute(route), status: String(res.statusCode) };
      end(labels);
      httpRequestsTotal.inc(labels);
    });
    next();
  });

  // Infrastructure endpoints (no /api/v1 prefix, no rate limit).
  app.use(healthRouter);

  // Business API.
  app.use('/api/v1', apiRouter);

  // Anything else → typed 404 envelope.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/** Collapse :id params so metrics cardinality stays bounded. */
function normalizeRoute(route: string): string {
  return route.replace(/\/[0-9a-fA-F]{24}/g, '/:id') || '/';
}

/** Correlate late logs with the current request (used by services). */
export { enrichRequestContext, getRequestContext };
