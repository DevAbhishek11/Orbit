# Orbit — Notion + Trello + Slack in one workspace

Team workspace built with React/Vite, Express, Mongoose and Redis using npm workspaces.

- `orbit/`: frontend (Vite 6 + React 19 + TanStack Query + Dexie PWA outbox)
- `orbitserver/`: API and worker (Express 5 + Mongoose 8 + BullMQ + Socket.io + S3 presign)
- `shared/`: permissions, envelopes, pagination, ordering, error codes

## Start here

**[Complete run guide](Docs/RUNNING.md)** — Atlas or local Docker infra, env vars, secrets, demo accounts, production caveats.

**[Audit and verification status](Docs/AUDIT.md)** — fixes made, checks performed, remaining gaps.

**[Architecture](Docs/PROJECT_PLAN.md)** · **[Build prompt](Docs/BUILD_PROMPT.md)** · **[Progress](Docs/PROGRESS.md)** · **[OpenAPI](orbitserver/openapi.json)**

### Quickstart (local infra only, no Atlas needed)

```sh
npm ci
cp orbitserver/env.example orbitserver/.env   # edit if needed, defaults work for docker compose
npm run build:shared

# Option A: docker infra + host API/web (recommended for dev)
docker compose up -d mongo redis-cache redis-queue minio mailhog --wait
npm run check-db
npm run sync-indexes
npm run seed
npm run dev

# Option B: full stack in Docker
docker compose --profile app up -d --wait
# Web: http://localhost:3000  API: http://localhost:8010  MinIO: http://localhost:9001  MailHog: http://localhost:8025

# Option C: Atlas (set MONGODB_URI in orbitserver/.env)
npm run check-db
npm run sync-indexes
npm run seed
npm run dev
```

Web: http://localhost:5173 (vite) or http://localhost:3000 (nginx). API: http://localhost:8010. Browser requests use same-origin proxy (`/api/v1`, `/health`, `/socket.io`).

### Demo accounts (after seed)

`owner@orbit.dev`, `admin@orbit.dev`, `manager@orbit.dev`, `member@orbit.dev`, `viewer@orbit.dev` — password `Orbit@1234567`.

## Feature coverage (Phases 0–17)

| Pillar | Status | Details |
|---|---|---|
| **Auth** | ✅ | argon2id, JWT access + rotating refresh (reuse detection), sessions, lockout, verify/reset |
| **Workspaces** | ✅ | T1 bootstrap tx (workspace + owner + #general + Getting Started board + Welcome page), members, invites, RBAC 4-layer |
| **Boards / Lists / Cards** | ✅ | Fractional order keys, T2 move tx, filters, activity, comments, labels, assignees, watchers, soft delete + undo |
| **Docs / Pages** | ✅ | Nested tree (materialized path + depth), blocks, autosave conflict 409, versions, backlinks, favourites, trash |
| **Chat** | ✅ | Channels (public/private/dm deduped), messages, threads, reactions, unread (Redis hash + reconciliation), typing, presence |
| **Realtime** | ✅ | Socket.io 4 + Redis adapter, permissioned rooms (user/workspace/board/channel/page), token bucket rate limit, emitSafe after commit |
| **Queues** | ✅ | 9 BullMQ queues (mail/notifications/search-index/files/analytics/cleanup/pages/reminders/webhooks) + DLQ + BullBoard /admin/queues |
| **Files** | ✅ | Presign PUT/GET via S3/MinIO, magic-byte sniff, quota, thumbnails job |
| **Search** | ✅ | Faceted search (pages/cards/messages/files), permission-filtered, cursor pagination |
| **Notifications** | ✅ | Grouped (groupKey/groupCount), mute prefs, quiet hours, socket push |
| **Analytics** | ✅ | Overview (A2 facet), burndown (A7 rollup), heatmap, leaderboard, SWR cache |
| **Web foundation** | ✅ | App shell, tokens (light/dark), 60+ component design system, /dev/components gallery, ⌘K palette |
| **Web features** | ✅ | Boards Kanban (dnd-kit), Docs tree+editor, Chat virtualized, Search, Notifications, Files, Analytics, Settings, Members |
| **Web hardening** | ✅ | PWA (vite-plugin-pwa), offline outbox (Dexie FIFO + idempotency), dark mode zero-flash, 3-level error boundaries, OfflineBanner |
| **DevOps** | ✅ | Multi-stage Dockerfiles (api/worker/web nginx), docker-compose (mongo replica rs0, dual Redis LRU/noeviction, MinIO, MailHog, observability), migrations runner, OpenAPI generator, k6 load tests, 5 CI workflows |

## Stack

| Layer | Tech |
|---|---|
| API | Node 22, Express 5, Mongoose 8, Zod, Pino, Helmet, BullMQ 5, Socket.io 4, prom-client |
| Worker | BullMQ consumers (9 queues), repeatable jobs (snapshots/purge/rollup/reconcile/reminders/rebalance) |
| DB | MongoDB 7 replica set, Redis cache (allkeys-lru) + Redis queue (noeviction AOF) |
| Storage | S3 / MinIO presign, sharp thumbnails |
| Web | Vite 6, React 19, React Router 7, TanStack Query 5, Zustand, dnd-kit, TipTap, Recharts, Dexie, vite-plugin-pwa |
| Infra | Docker multi-stage, Nginx edge, MinIO, MailHog, Prometheus + Grafana, GitHub Actions 5 workflows |

## Scripts

```sh
npm run verify              # typecheck + lint + test + build
npm run typecheck
npm run lint
npm run test                # shared + server + web
npm run build
npm run dev                 # api :8010 + web :5173
docker compose up -d --wait # infra
docker compose --profile app up -d --wait   # full stack
docker compose --profile observability up -d # + prometheus/grafana

# orbitserver
npm run sync-indexes -w orbitserver
npm run seed -w orbitserver
npm run migrate -w orbitserver
npm run migrate:status -w orbitserver
npm run gen:openapi -w orbitserver

# load tests
k6 run load-tests/k6-board.js
k6 run load-tests/k6-chat.js
```

## Env vars (see orbitserver/env.example)

Core: `MONGODB_URI`, `MONGO_DB_NAME`, `REDIS_CACHE_URL`, `REDIS_QUEUE_URL`, `JWT_SECRET`, `PORT=8010`, `CORS_ORIGIN`, `FRONTEND_URL`.

Storage: `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`.

Mail: `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`.

Metrics: `METRICS_ENABLED`, `METRICS_TOKEN`.

See `Docs/RUNNING.md` for full table and production caveats.

## Failure modes verified (BUILD_PROMPT §26)

1. Worker kill → cluster respawns, zero dropped
2. SIGUSR2 rolling reload → zero dropped
3. redis-cache down → reads fallback to Mongo, auth fails closed
4. redis-queue down → 503 JOB_BACKEND_UNAVAILABLE, AOF no loss
5. mongo primary down → /health/ready unhealthy, 503
6. Duplicate Idempotency-Key → cached replay, one side-effect
7. Reused refresh token → family revoked
8. Concurrent card move → one wins, other 409 + current doc
9. Order key exhausted → rebalance job enqueued
10. Spoofed MIME upload → quarantined
11. Two browsers, two containers → sockets sync via Redis adapter
12. Offline → queued → reconnect → exactly once (Dexie outbox)
13. Worker crash mid-job → retry/DLQ
14. Widget throw → error boundary, shell intact
15. Rate limit → 429 + Retry-After, UI countdown

## Docs

- `Docs/RUNNING.md` — run, env, troubleshooting
- `Docs/AUDIT.md` — audit fixes + remaining gaps
- `Docs/PROGRESS.md` — phase checklist
- `Docs/PROJECT_PLAN.md` — engineering plan
- `Docs/BUILD_PROMPT.md` — phase-by-phase build instructions
- `orbitserver/openapi.json` — OpenAPI 3.1
- `load-tests/` — k6 scenarios
- `infra/observability/` — prometheus.yml + grafana dashboard
- `orbit/src/routes/ComponentsGallery.tsx` — /dev/components (60+ components)
