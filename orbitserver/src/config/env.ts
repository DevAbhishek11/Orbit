/**
 * Zod-validated environment (BUILD_PROMPT Phase 0, rule: env is read ONLY here).
 * The app REFUSES TO START on a missing/invalid value and prints every problem.
 */
import fs from 'node:fs';
import { z } from 'zod';

// Load .env when present (never overrides real environment variables).
const envFile = new URL('../../.env', import.meta.url);
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const commaList = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

const duration = z
  .string()
  .regex(/^\d+[smhd]$/, 'duration must look like 15m, 7d, 30s, 24h')
  .transform((v) => {
    const n = Number(v.slice(0, -1));
    const unit = v.slice(-1);
    const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return n * mult;
  });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8010),
  APP_NAME: z.string().min(1).default('Orbit'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:8010'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: booleanish.default('false'),
  GIT_SHA: z.string().optional().default(''),
  APP_VERSION: z.string().optional().default('0.1.0'),
  TRUST_PROXY: booleanish.default('true'),
  WEB_CONCURRENCY: z.coerce.number().int().min(1).optional(),

  // ── Auth ────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ALGORITHM: z.enum(['HS256']).default('HS256'),
  JWT_ISSUER: z.string().default('orbit'),
  JWT_AUDIENCE: z.string().default('orbit-web'),
  ACCESS_TOKEN_TTL: duration.default('15m'),
  REFRESH_TOKEN_TTL: duration.default('7d'),
  REFRESH_TOKEN_TTL_REMEMBER: duration.default('30d'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: booleanish.default('false'),
  CORS_ORIGINS: commaList,
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(8192).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(1).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).default(10),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(30),
  RATE_LIMIT_GLOBAL: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_AUTH: z.coerce.number().int().min(1).default(10),

  // ── MongoDB (Atlas) ─────────────────────────────────────────────────
  MONGODB_URI: z.string().min(10, 'MONGODB_URI is required'),
  MONGO_DB_NAME: z.string().default('orbit'),
  MONGO_MAX_POOL_SIZE: z.coerce.number().int().min(1).default(20),
  MONGO_MIN_POOL_SIZE: z.coerce.number().int().min(0).default(2),
  MONGO_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(500).default(10_000),
  MONGO_REQUIRE_TRANSACTIONS: booleanish.default('false'),
  MONGO_SLOW_QUERY_MS: z.coerce.number().int().min(0).default(200),

  // ── Redis (two instances, never mixed) ──────────────────────────────
  REDIS_CACHE_URL: z.string().optional().default(''),
  REDIS_QUEUE_URL: z.string().optional().default(''),
  REDIS_KEY_PREFIX: z.string().default('orbit:dev'),
  REDIS_CACHE_TTL_DEFAULT: z.coerce.number().int().min(1).default(300),
  CACHE_ENABLED: booleanish.default('true'),

  // ── Queues ──────────────────────────────────────────────────────────
  QUEUE_DISABLED: booleanish.default('true'),

  // ── Mail (stub until the mail queue lands in Phase 10) ─────────────
  MAIL_FROM: z.string().default('Orbit <no-reply@orbit.dev>'),
  SMTP_HOST: z.string().optional().default(''),

  // ── Health / metrics ────────────────────────────────────────────────
  METRICS_ENABLED: booleanish.default('true'),
  METRICS_TOKEN: z.string().default('internal-scrape-token'),
  HEALTH_DETAILED: booleanish.default('true'),

  // ── Seed (scripts/seed.ts) ──────────────────────────────────────────
  SEED_DEMO_PASSWORD: z.string().min(12).default('Orbit@1234567'),
});

export type Env = z.infer<typeof schema>;

function parseEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (parsed.success) return parsed.data;
  const lines = parsed.error.issues.map(
    (issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  // Plain stderr — the logger is not built yet (it needs env).
  process.stderr.write(
    `\n[orbit] Invalid environment configuration — refusing to start:\n${lines.join('\n')}\n` +
      `\nCopy env.example to .env and fill in the values.\n\n`,
  );
  process.exit(1);
}

/** Frozen, typed environment. Import this — never process.env. */
export const env: Env = Object.freeze(parseEnv());

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDev = env.NODE_ENV === 'development';
