# Running Orbit

## What exists today

Full stack: React/Vite web + Express/Mongoose API + BullMQ worker, npm workspaces. Implemented:

- Auth (argon2id, JWT access + rotating refresh with reuse detection, sessions, lockout, verify/reset)
- Workspaces: T1 bootstrap transaction (workspace + owner + #general + Getting Started board + Welcome page + audit), members, invites, RBAC 4-layer (middleware + service + repository + socket room), seat limits, last-owner protection
- Boards/Lists/Cards: fractional order keys, T2 move transaction, filters, activity, comments, labels, assignees, watchers, soft delete + Undo toast, message→card C1/T3 transaction
- Pages/Docs: nested tree (ancestors materialized path + depth), blocks, autosave conflict 409 with current doc, versions, backlinks, favourites, trash + purge job
- Chat: channels (public/private/dm deduped), messages, threads, reactions, unread (Redis hash + reconciliation job), typing (ephemeral throttled), presence
- Realtime: Socket.io 4 + Redis adapter, permissioned rooms, token bucket rate limit, emitSafe after commit, reconnect delta-sync
- Queues: 9 BullMQ queues (mail/notifications/search-index/files/analytics/cleanup/pages/reminders/webhooks) + DLQ + BullBoard /admin/queues, repeatable jobs registered only in worker
- Files: presign PUT/GET via S3/MinIO, magic-byte sniff, quota, thumbnails job
- Search: faceted (pages/cards/messages/files), permission-filtered, cursor pagination
- Notifications: grouped (groupKey/groupCount), mute prefs, quiet hours, socket push
- Analytics: overview (A2 facet), burndown (A7 rollup), heatmap, leaderboard, SWR cache
- Web: app shell, tokens (light/dark), 60+ component design system (/dev/components), ⌘K palette, boards Kanban (dnd-kit + keyboard DnD), docs tree+editor, chat virtualized, search, notifications, files, analytics, settings, members, offline PWA (vite-plugin-pwa + Dexie outbox + OfflineBanner), dark mode zero-flash, 3-level error boundaries

This is a development implementation — not hardened for production without additional review (secrets rotation, WAF, backups, etc.). See AUDIT.md for remaining gaps.

## Requirements

- Node **22.12+**
- npm 10+
- Docker + Docker Compose (for local infra) OR MongoDB Atlas replica set
- k6 (optional, for load tests)

## Env vars (orbitserver/env.example)

| Var | Required | Default | Purpose |
|---|---|---|---|
| `MONGODB_URI` | yes | `mongodb://127.0.0.1:27017/?replicaSet=rs0` | Mongo connection |
| `MONGO_DB_NAME` | yes | `orbit` | DB name |
| `REDIS_CACHE_URL` | yes | `redis://:orbit_cache_pw@127.0.0.1:6379/0` | cache/pubsub/presence/rate-limit |
| `REDIS_QUEUE_URL` | yes | `redis://:orbit_queue_pw@127.0.0.1:6380/0` | BullMQ only |
| `JWT_SECRET` | yes | — | HS256 secret (RS256 keys in prod via env) |
| `PORT` | no | `8010` | API port |
| `CORS_ORIGIN` | yes | `http://localhost:5173` | exact allowlist, no * with credentials |
| `FRONTEND_URL` | no | `http://localhost:5173` | for email links |
| `S3_ENDPOINT` | no | `http://127.0.0.1:9000` | MinIO or AWS |
| `S3_BUCKET` | no | `orbit-uploads-private` | private bucket |
| `S3_REGION` | no | `us-east-1` | region |
| `S3_ACCESS_KEY_ID` | no | `minioadmin` | S3 key |
| `S3_SECRET_ACCESS_KEY` | no | `minioadmin` | S3 secret |
| `S3_FORCE_PATH_STYLE` | no | `true` | true for MinIO |
| `SMTP_HOST` | no | `127.0.0.1` | MailHog or SMTP |
| `SMTP_PORT` | no | `1025` | SMTP port |
| `MAIL_FROM` | no | `noreply@orbit.local` | from address |
| `METRICS_ENABLED` | no | `false` | /metrics |
| `METRICS_TOKEN` | no | — | bearer for /metrics |
| `QUEUE_DISABLED` | no | `true` | true = sync processors in API (dev/test) |
| `MONGO_REQUIRE_TRANSACTIONS` | no | `true` | fail boot if standalone |
| `COOKIE_SECURE` | no | `false` | true in HTTPS prod |

Never put secrets in `VITE_*` — those become public JS.

## Quickstart — Docker infra + host API/web (recommended dev)

```sh
npm ci
cp orbitserver/env.example orbitserver/.env   # defaults work for docker compose infra
npm run build:shared

docker compose up -d mongo redis-cache redis-queue minio mailhog --wait
npm run check-db          # verifies mongo + redis + transaction support
npm run sync-indexes      # create/refresh all indexes (autoIndex is off)
npm run seed              # 5 users, workspace, boards, pages, channels, messages
npm run dev               # API :8010 + Web :5173
```

Open http://localhost:5173. The frontend talks to its own origin (`/api/v1`, `/health`, `/socket.io`) and Vite proxies to :8010 — so httpOnly refresh cookies work and no CORS is needed.

Separate terminals: `npm run build:shared && npm run dev --workspace=orbitserver` and `npm run dev --workspace=orbit`.

## Quickstart — Full stack in Docker

```sh
docker compose --profile app up -d --wait
# Web http://localhost:3000  API http://localhost:8010  MinIO http://localhost:9001  MailHog http://localhost:8025
docker compose --profile observability up -d   # + prometheus :9090 + grafana :3001 (admin/admin)
```

Dockerfiles: `orbitserver/Dockerfile` (api, non-root orbit user, HEALTHCHECK /health/live), `orbitserver/Dockerfile.worker` (worker), `orbit/Dockerfile` (vite build → nginx with SPA fallback + /api proxy + security headers).

Nginx edge config is in `orbit/nginx.conf` (for web image) and `docker-compose.yml` mounts. Security headers, gzip, /api /health /socket.io proxy.

## Quickstart — Atlas

```sh
npm ci
cp orbitserver/env.example orbitserver/.env
# Edit .env: set MONGODB_URI to Atlas SRV, MONGO_DB_NAME=orbit, JWT_SECRET=random
npm run build:shared
npm run check-db
npm run sync-indexes
npm run seed
npm run dev
```

Atlas must be a replica set (M0+ supports transactions for many operations but check `runtime.transactionsSupported` in /health/ready). Ensure DB user has readWrite on `orbit` and Network Access allows your IP.

## Migrations

```sh
npm run migrate --workspace=orbitserver          # run pending
npm run migrate:status --workspace=orbitserver   # list applied/pending
npm run migrate:create -- add-field-x --workspace=orbitserver
```

Migrations live in `orbitserver/migrations/*.ts`, each exports `{ id, up, down }`. State in `migrations` collection. Runner is idempotent — re-running up after crash does not double-apply (up must be idempotent).

`sync-indexes` is separate from migrations — it creates declared indexes without dropping unrelated indexes.

## Seeding

```sh
npm run seed --workspace=orbitserver
# SEED_LARGE=true adds 100k messages + 5k cards for load tests
# --reset flag (if implemented) truncates before seeding — dev only, never prod
```

Demo accounts after seed: `owner@orbit.dev`, `admin@orbit.dev`, `manager@orbit.dev`, `member@orbit.dev`, `viewer@orbit.dev`, password `Orbit@1234567` (override `SEED_DEMO_PASSWORD`).

## Auth and mail

- Access token: JWT in memory only (15 min), `typ:'access'`, `jti` denylist on logout (Redis TTL = remaining life)
- Refresh token: opaque 64-byte, httpOnly Secure SameSite=Lax cookie, 7d (30d with remember), rotating — reuse revokes entire family
- Login: timing-safe (always hash), lockout 10 fails / 30 min, generic error
- Mail: Nodemailer in worker (mail queue). In dev, MailHog captures at http://localhost:8025. Until SMTP configured, logs show `[mail-stub]` with token link. Invite returns one-time token to inviter in dev.

For HTTPS prod: `COOKIE_SECURE=true`, exact `CORS_ORIGIN`, `FRONTEND_URL` = deployed origin, strong `JWT_SECRET`.

## Build / check commands

```sh
npm run typecheck
npm run lint
npm run test
npm run build
npm run verify              # typecheck + lint + test + build
npm run start --workspace=orbitserver          # compiled API
npm run start:cluster --workspace=orbitserver  # clustered
npm run start:worker --workspace=orbitserver   # worker
npm run preview --workspace=orbit              # built frontend :4173
npm run gen:openapi --workspace=orbitserver    # writes orbitserver/openapi.json + orbit/openapi.json + Docs/openapi.json
```

For prod deploy: serve `orbit/dist` with SPA fallback, reverse-proxy `/api` and `/health` and `/socket.io` to API. `npm start` does not serve frontend. Run `sync-indexes` and `migrate` during deploy; API has `autoIndex: false`.

## Observability

```sh
docker compose --profile observability up -d
# Prometheus http://localhost:9090 (scrapes /metrics)
# Grafana http://localhost:3001 admin/admin — dashboard in infra/observability/grafana-dashboard.json
```

Metrics: `http_request_duration_seconds`, `socket_connections_active`, `queue_*`, `job_duration_seconds`, `cache_hit_ratio`, `event_loop_lag`. Alerts in `infra/observability/prometheus.yml` (queue depth, failure rate, evicted_keys on queue Redis = critical).

BullBoard: `/admin/queues` (RBAC `admin:queue`) — shows 9 queues + DLQ.

Logs: Pino with redaction (authorization, cookie, password, token, *.passwordHash, *.refreshToken), requestId correlation via AsyncLocalStorage, pretty in dev.

## Load tests (k6)

```sh
BASE_URL=http://localhost:8010 TOKEN=<jwt> WORKSPACE_ID=<id> k6 run load-tests/k6-board.js
BASE_URL=http://localhost:8010 TOKEN=<jwt> WORKSPACE_ID=<id> k6 run load-tests/k6-chat.js
# Outputs load-tests/summary.json
```

Thresholds: http_req_failed <1%, boards_read p95 <300ms, boards_write p95 <600ms, chat p95 <400ms.

## Offline / PWA

- Workbox precache + runtime cache (NetworkFirst for /api)
- Dexie outbox: mutations that fail while offline are queued (FIFO, Idempotency-Key = outbox id) and drained on reconnect with exponential backoff. 409 moves item to "Needs attention" (Keep mine / Discard) — never silently dropped.
- TanStack Query offlineFirst, persisted last-viewed boards/pages/channels readable offline
- OfflineBanner: `Offline · N queued` / `Syncing… N pending` / `Back online`

Test: Playwright offline test goes offline, sends message (banner appears), comes back online, asserts delivered exactly once.

## Troubleshooting

- `/health/live` 200 = process alive only
- `/health/ready` = mongo ping + both redis pings + queue connectivity + disk + transaction support + migrations + indexes
- `MONGO_REQUIRE_TRANSACTIONS=true` fails boot if standalone — keep true for data integrity
- Missing redis-cache: dev falls back to Mongo (slower), logs warning, auth fails closed in prod or when configured Redis is down
- `QUEUE_DISABLED=false` without worker: jobs buffer ≤500 then 503 JOB_BACKEND_UNAVAILABLE, AOF preserves after restart
- 409 on card/page edit/move = stale version — response includes current doc for merge/reload
- 404 can mean missing membership/private resource, not only missing record (no enumeration)
- Rate limit 429 + Retry-After — UI shows countdown, not crash
- Order key exhausted (60 chars) → rebalance job enqueued + warning metric
- MIME-spoofed upload → quarantined + audit

## Production caveats

- Rotate any previously committed Atlas credentials (history may contain them)
- Use strong JWT secret, HTTPS, exact CORS allowlist, secure cookies
- Run `sync-indexes` + `migrate` as pre-deploy steps (migrate service must complete before api scales)
- Configure S3 bucket with no public ACL, lifecycle rule deletes pending objects after 24h
- Configure SMTP with rate limit (mail queue limiter 50/min)
- Set up Prometheus/Grafana/Loki/Jaeger, Sentry (release = git SHA, PII scrubbing)
- Backup/restore drill: target RPO 5 min / RTO 30 min
- Branch protection: required checks (typecheck, lint, test, build, openapi drift, size-limit), no force-push
