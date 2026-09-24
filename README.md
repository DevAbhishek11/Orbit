<div align="center">

# 🛰️ Orbit

**Docs. Boards. Chat. One workspace.**

A production-grade, multi-tenant mini-SaaS that unifies the three primitives modern teams run on —
**Notion-style docs**, **Trello-style Kanban boards** and **Slack-style team chat** — under one data model,
one permission system, one search box and one notification centre.


</div>

---

## 📖 Table of Contents

- [What is Orbit?](#-what-is-orbit)
- [The three pillars](#-the-three-pillars)
- [Cross-pillar features](#-cross-pillar-features)
- [Tech stack](#-tech-stack)
- [Quickstart (60 seconds)](#-quickstart-60-seconds)
- [Project structure](#-project-structure)
- [Environment variables](#-environment-variables)
- [Scripts](#-scripts)
- [Architecture](#-architecture)
- [API documentation](#-api-documentation)
- [Testing](#-testing)
- [Performance](#-performance)
- [Security](#-security)
- [Observability](#-observability)
- [Deployment](#-deployment)
- [Documentation index](#-documentation-index)
- [Roadmap / what's deliberately not built](#-roadmap--whats-deliberately-not-built)
- [License](#-license)

---

## 🚀 What is Orbit?

Orbit is a **multi-tenant team workspace**. A company creates a **Workspace**, invites **Members** with
**Roles**, and gets three linked surfaces inside one application:

| Surface | Inspired by | Description |
|---|---|---|
| 📄 **Docs** | Notion | Infinitely nested pages with a block editor, autosave, version history, backlinks and trash |
| 🗂️ **Boards** | Trello | Kanban boards with drag & drop, labels, assignees, checklists, due dates and per-card activity |
| 💬 **Chat** | Slack | Channels, DMs, threads, reactions, mentions, presence, typing indicators and unread counts |

The three surfaces are not separate demos stapled together — they share **one permission model, one search
index, one notification feed and one audit trail**, and they can reference each other (a chat message can
become a card; a card can own a doc; a doc can open a discussion channel).

**Built to be operated, not just demonstrated.** Orbit runs as a clustered Node service behind Nginx, with a
MongoDB replica set, two purpose-configured Redis instances, a separate BullMQ worker fleet, presigned S3
uploads, structured logs with request correlation, Prometheus metrics and a 5-workflow CI/CD pipeline.

---

## 🧩 The three pillars

### 📄 Docs (Notion-style)
- Infinitely nested page tree (materialized path + `$graphLookup` subtree fetch)
- Block editor: paragraph, H1–H3, bullet, numbered, todo, quote, code, divider, image, callout
- Slash-command insert, drag-handle block reordering, inline formatting
- **Autosave with version conflict detection** (409 + merge prompt — edits are never silently lost)
- Version snapshots every 5 minutes (repeatable job, only dirty pages), preview and restore
- Backlinks, page mentions, favourites, private/link visibility, trash + restore (30-day window)

### 🗂️ Boards (Trello-style)
- Boards → Lists → Cards, with `workspace` or `private` visibility
- **Drag & drop ordering via fractional string keys** — a move is one document write, not a full renumber
- Every move runs inside a **MongoDB transaction**: card + list counters + activity + audit
- Labels, assignees, due dates, priorities, checklists with progress, attachments, covers
- Per-card comments with mentions, watchers, and a full activity timeline
- Archive instead of delete, filters by assignee/label/due date, WIP limits, optimistic concurrency (`409` on stale version)

### 💬 Chat (Slack-style)
- Public/private channels, 1:1 DMs (deduplicated), threads, reactions, mentions, pins
- Cursor-paginated, virtualized message timeline (10k messages, 50 per page)
- **Optimistic send** reconciled by `clientId` — a retried send creates exactly one message
- Unread counts and mention badges cached in Redis, pushed live over the socket
- Presence (Redis TTL keys) and throttled typing indicators (never persisted)
- Edit/delete with tombstones so thread structure survives

---

## 🔗 Cross-pillar features

1. **Message → Card** — turn any chat message into a Kanban card; the card, the thread reply with its permalink,
   the activity entry and the notification are **one atomic transaction**.
2. **Card → Page** — a card can own a document, linked both ways and previewed inside the card modal.
3. **Page → Channel** — a doc can open a linked discussion channel.
4. **Unified search** — one query returns pages, cards, messages and files, grouped by type, ranked with
   weighted text scores, permission-filtered **before** ranking, each result with a highlighted snippet and breadcrumb.
5. **Unified notifications** — mentions, assignments, comments and due dates in one feed, with grouping,
   per-channel/per-board mute rules and quiet hours.
6. **Unified audit & activity** — every entity answers "who changed what, when"; admins get a filterable audit
   log with streamed CSV export.

---

## 🛠 Tech stack

| Layer | Technologies |
|---|---|
| **Backend** | Node.js 20 · TypeScript (strict) · Express 5 · Mongoose 8 · MongoDB 7 (replica set) · Zod |
| **Cache / queues** | Redis 7.2 (×2: cache + queue) · ioredis · BullMQ · BullBoard |
| **Realtime** | Socket.io 4 · `@socket.io/redis-adapter` |
| **Auth & security** | argon2id · JWT (HS256/RS256) · rotating refresh tokens · Helmet · CSRF double-submit · Lua rate limiting |
| **Files** | S3-compatible storage (MinIO in dev) · presigned uploads · sharp thumbnails |
| **Frontend** | React 18 · Vite 5 · TanStack Query · Zustand · React Hook Form · Tailwind CSS · Radix UI · dnd-kit · TipTap · Recharts · Workbox + Dexie (offline) |
| **Testing** | Jest + Supertest + mongodb-memory-server · Vitest + Testing Library + MSW · Playwright + axe-core · k6 |
| **DevOps** | Docker (multi-stage) · Docker Compose · Nginx · GitHub Actions (5 workflows) · Prometheus · Grafana · Loki · Sentry |
| **Tooling** | pnpm workspaces · Turborepo · ESLint · Prettier · Husky · lint-staged · commitlint |

---

## ⚡ Quickstart (60 seconds)

**Prerequisites:** Docker 24+ with Compose v2, Node.js 20+, pnpm 9+. That's it — MongoDB, Redis, MinIO,
Nginx and MailHog all run in containers.

```bash
# 1. Clone and configure
git clone https://github.com/your-org/orbit-workspace.git
cd orbit-workspace
cp .env.example .env          # sane defaults for local development

# 2. Boot the entire stack (Mongo replica set · 2 Redis · MinIO · 2 API containers ·
#    worker · web · Nginx · MailHog) — first run builds images
docker compose up -d --build

# 3. Seed demo data (3 workspaces, 12 users covering every role, boards, pages, channels)
pnpm install
pnpm seed

# 4. Open the app
open http://localhost            # Orbit web app (via Nginx)
```

**Local URLs**

| Service | URL | Notes |
|---|---|---|
| 🌐 Web app | http://localhost | Served through Nginx |
| 📚 Swagger UI | http://localhost:4000/api/docs | OpenAPI 3.1, generated from Zod schemas |
| 📊 BullBoard (queues) | http://localhost:3100 | `docker compose --profile tools up -d` |
| 📧 MailHog (dev email) | http://localhost:8025 | Verification, invites, resets |
| 🗄 MinIO console | http://localhost:9001 | `orbit` / value of `MINIO_PASSWORD` |
| ❤️ Health | http://localhost:4000/health/ready | Per-dependency status |
| 📈 Metrics | http://localhost:4000/metrics | Prometheus format (internal only) |
| 📉 Grafana | http://localhost:3000 | `docker compose --profile observability up -d` |

**Demo credentials** (after `pnpm seed`) — all accounts use the password `Orbit@12345`:

| Role | Email | What to try |
|---|---|---|
| Owner | `owner@orbit.dev` | Everything, including workspace deletion |
| Admin | `admin@orbit.dev` | Members, audit log, analytics |
| Manager | `manager@orbit.dev` | Boards, pages, channels |
| Member | `member@orbit.dev` | Move cards, chat, edit pages |
| Viewer | `viewer@orbit.dev` | Read-only: write actions are hidden and rejected server-side |

---

## 📁 Project structure

```
orbit-workspace/
├── apps/
│   ├── api/          # Express + Socket.io API (clustered runtime)
│   ├── worker/       # BullMQ consumers (own cluster, own scaling curve)
│   └── web/          # React + Vite dashboard UI
├── packages/
│   ├── shared/       # Zod schemas, types, permission matrix, error codes — shared by API & web
│   └── config/       # Shared tsconfig, ESLint, Prettier, Tailwind preset
├── infra/
│   ├── docker/       # Compose files, redis-*.conf, nginx.conf, mongo-init.js
│   ├── observability/# Prometheus, alerts, Grafana dashboards, Loki, Jaeger
│   └── k8s/          # Optional Kubernetes manifests
├── scripts/          # migrate · syncIndexes · seed · generateOpenApi · redisReport
├── tests/load/       # k6 scenarios (board-read, auth-flow, chat-write, search, dnd-storm)
├── migrations/       # Numbered, reversible database migrations
├── docs/             # architecture · er-diagram · api · security · performance · scaling ·
│                     # runbook · troubleshooting · demo-script · adr/
├── docker-compose.yml
├── .env.example
└── README.md
```

**Inside `apps/api/src`:** `cluster.ts` (primary) · `server.ts` (worker) · `app.ts` (Express factory) ·
`config/` · `middleware/` · `infrastructure/` (db, redis, cache, queue, socket, storage, mailer, logger, metrics) ·
`modules/` (one vertical slice per feature) · `jobs/` · `shared/`.

---

## 🔧 Environment variables

All variables are documented in [`.env.example`](.env.example) and validated at boot with Zod — **the app
refuses to start with a missing or invalid variable** rather than failing at 2 a.m.

The most important groups:

| Group | Key variables |
|---|---|
| Runtime | `NODE_ENV`, `PORT`, `WEB_CONCURRENCY` (`0` = auto-detect vCPUs), `LOG_LEVEL`, `TRUST_PROXY` |
| Security | `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `CSRF_ENABLED`, `CORS_ORIGINS` |
| Data | `MONGODB_URI` (**must include `replicaSet=rs0`** — transactions depend on it), `MONGO_MAX_POOL_SIZE` |
| Redis | `REDIS_CACHE_URL`, `REDIS_QUEUE_URL` (**two separate instances** — see below) |
| Storage | `S3_ENDPOINT`, `S3_BUCKET_PRIVATE`, `S3_BUCKET_PUBLIC`, `UPLOAD_MAX_SIZE_BYTES`, `STORAGE_QUOTA_BYTES` |
| Queues | `QUEUE_DISABLED` (runs jobs in-process for tests/demos), `QUEUE_MAX_BACKPRESSURE` |
| Realtime | `SOCKET_PATH`, `SOCKET_MAX_BUFFER`, `PRESENCE_TTL_SECONDS` |
| Frontend | `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_APP_VERSION`, `VITE_FEATURE_OFFLINE` |

> **Why two Redis instances?**
> `redis-cache` uses `allkeys-lru` (it holds only reproducible data: cache, rate-limit counters, presence,
> pub/sub, idempotency keys). `redis-queue` uses **`noeviction`** with AOF persistence because BullMQ jobs
> must never be evicted — a single shared instance under memory pressure will silently evict job keys, which
> looks exactly like an application bug. See [ADR-006](docs/adr/ADR-006-two-redis-instances.md).

---

## 📜 Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run API, worker and web in watch mode (turbo, parallel) |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | Static quality gates |
| `pnpm test` | All unit + integration tests |
| `pnpm test:unit` · `pnpm test:integration` · `pnpm test:e2e` | Targeted suites |
| `pnpm test:coverage` | Coverage report with the 60% CI gate |
| `pnpm test:all` | Everything CI runs, in order |
| `pnpm db:migrate` · `pnpm db:rollback` | Apply / revert migrations |
| `pnpm db:sync-indexes` | Reconcile MongoDB indexes from schemas (never automatic in production) |
| `pnpm seed` · `pnpm seed:large` | Demo data · large dataset (100k messages, 5k cards) for load tests |
| `pnpm db:reset` | Drop and recreate the database (asks for confirmation) |
| `pnpm openapi:generate` · `pnpm openapi:check` | Regenerate OpenAPI · fail if docs drift from schemas |
| `pnpm perf:k6` | Run the k6 load scenario |
| `pnpm docker:up` · `pnpm docker:logs` · `pnpm docker:scale` | Stack helpers (`docker:scale` = `--scale api=4`) |

---

## 🏗 Architecture

```
        Browser (React SPA + PWA + offline outbox)
                        │  HTTPS / WSS
                        ▼
        ┌──────────────────────────────────────────┐
        │  Nginx — TLS · brotli · rate limits ·     │
        │  security headers · least_conn upstream   │
        └───────────────┬──────────────────────────┘
                        │
        ┌───────────────▼─────────────────────────────────────────┐
        │  API CLUSTER (Docker service, N containers)             │
        │  Node primary → forks WEB_CONCURRENCY workers           │
        │  stateless · graceful drain · SIGUSR2 rolling reload    │
        └───┬─────────────┬──────────────┬───────────────┬────────┘
            │             │              │               │
            ▼             ▼              ▼               ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────────┐
     │ MongoDB 7  │ │redis-cache │ │redis-queue │ │ S3 / MinIO  │
     │ replica set│ │ allkeys-lru│ │ noeviction │ │ presigned   │
     │ tx support │ │ cache·pubsub│ │ BullMQ+AOF │ │ uploads     │
     └────────────┘ └────────────┘ └─────┬──────┘ └─────────────┘
                                        │
                          ┌─────────────▼───────────────┐
                          │  WORKER FLEET (BullMQ)      │
                          │  mail · notifications ·     │
                          │  search-index · files ·     │
                          │  analytics · cleanup ·      │
                          │  pages · reminders · dlq    │
                          └─────────────────────────────┘
```

- **Stateless API** — no in-process session state, so any worker serves any request.
- **Cluster inside the container** for CPU utilization; **containers horizontally** for throughput.
- **Socket.io with the Redis adapter** so a message published by one container reaches sockets on another;
  Nginx `ip_hash` only for the WebSocket upgrade handshake.
- **Repeatable jobs are registered only in the worker service**, never in API workers (otherwise every worker
  would fire the same schedule).
- Full details, ADRs and sequence diagrams: [`docs/architecture.md`](docs/architecture.md) ·
  [`docs/er-diagram.md`](docs/er-diagram.md).

---

## 📚 API documentation

- **Interactive Swagger UI:** http://localhost:4000/api/docs
- **OpenAPI 3.1 spec:** http://localhost:4000/api/openapi.json (also committed at `docs/openapi.json`)
- **Human-readable reference:** [`docs/api.md`](docs/api.md)
- **Postman collection:** [`docs/postman.json`](docs/postman.json)

**Conventions** (applied to every endpoint):

```jsonc
// success
{ "success": true, "data": { /* ... */ }, "meta": { "requestId": "01J...", "nextCursor": "eyJ...", "cached": false } }
// error
{ "success": false, "error": { "code": "VERSION_CONFLICT", "message": "...", "details": {}, "requestId": "01J..." } }
```

- Auth: `Authorization: Bearer <access>` **or** the `orbit_at` httpOnly cookie (+ CSRF header for cookie auth)
- Pagination: `?limit=25&cursor=<opaque>&sort=-updatedAt&filter[x]=y&q=term` (**cursor-based, never `skip`**)
- Idempotency: send `Idempotency-Key` on side-effecting POSTs to make retries safe
- Tracing: every response carries `X-Request-Id`, matching the server log line and Sentry event

**Coverage:** 40 primary REST endpoints (auth 8 · users 4 · workspaces 8 · boards/lists/cards 16 · pages 7 ·
chat 9 · files 3 · search 2 · notifications 3 · analytics 2 · admin 2) plus 24 supporting endpoints, and
**22 Socket.io events**.

---

## 🧪 Testing

```bash
pnpm test:all          # typecheck → lint → unit → integration → e2e (what CI runs)
pnpm test:coverage     # coverage with the 60% CI gate
k6 run tests/load/board-read.js   # load scenario with pass/fail thresholds
```

| Layer | Tooling | What it proves |
|---|---|---|
| Unit | Jest | Services, permission matrix, fractional indexing, pagination, cache logic |
| Integration | Supertest + mongodb-memory-server (replica set) + Redis | HTTP → DB → cache → queue, transactions, RBAC, security |
| E2E | Playwright + axe-core | Board drag & drop, chat round-trip, offline flush, dark mode, a11y |
| Load | k6 | p95 latency, error rate, concurrent drags with zero lost updates |

**Coverage:** ≥60% enforced in CI, **~75%** actual. Targets: services ≥90%, middleware ≥85%, controllers ≥80%,
jobs ≥75%. Tests worth reading: `transactions.spec.ts` (fail a transaction mid-way and assert **zero** partial
writes), `refresh-rotation.spec.ts` (refresh-token reuse revokes the whole family), `cache.spec.ts`
(20 concurrent misses → exactly one database call), `security/` (60+ IDOR/JWT/injection/CSRF assertions).

---

## ⚡ Performance

Budgets are measured, not claimed (see [`docs/load-test-report.md`](docs/load-test-report.md)):

| Metric | Budget | Achieved |
|---|---|---|
| API p95 — cached read | ≤ 80 ms | ✅ |
| API p95 — uncached read | ≤ 200 ms | ✅ |
| Board render (500 cards) | ≤ 300 ms server | ✅ |
| Search p95 (100k messages) | ≤ 400 ms | ✅ |
| Socket fan-out to 200 listeners | ≤ 150 ms | ✅ |
| Initial JS bundle (gzip) | ≤ 250 KB | ✅ |

**Why it's fast:** cursor pagination everywhere · compound indexes matched to query + sort (verified with
`explain()`) · Redis cache-aside with tag invalidation, stale-while-revalidate and single-flight stampede
protection · denormalized counters maintained inside transactions · `$facet` to collapse dashboard queries
into one round trip · nightly rollups so analytics never scans raw data · presigned uploads that bypass the API
· BullMQ offloading of every slow side-effect · virtualized lists and route-level code splitting in the UI.

---

## 🔒 Security

- **Passwords:** argon2id (19 MiB, t=2, p=1) · **refresh tokens:** SHA-256 hashed at rest, rotated on use,
  with family revocation and reuse detection · access tokens in memory (web) / 15-minute TTL
- **RBAC:** 5 workspace roles × resource-scoped permissions, enforced in **four** layers (route middleware,
  service re-check, repository query guard, socket room check); cross-tenant reads return `404`
- **Hardening:** Helmet + CSP, CORS allowlist, CSRF double-submit for cookie auth, Redis Lua sliding-window
  rate limits per tier (auth endpoints fail **closed**), input validation with Zod, NoSQL-injection
  sanitization, HTML sanitization, SSRF-guarded outbound fetches, magic-byte file sniffing, signed short-lived
  download URLs, and secret/PII redaction in every log line
- **Evidence:** `tests/security/` (IDOR, privilege escalation, JWT tampering, injection, XSS, path traversal,
  SSRF, mass assignment) + Trivy and gitleaks in CI. Details: [`docs/security.md`](docs/security.md)

---

## 📈 Observability

- **Logs:** structured JSON (Pino) with a `requestId` on every entry, propagated into jobs and socket events —
  paste a `requestId` from any error toast and you get the full server-side story
- **Metrics:** Prometheus at `/metrics` — request rate/latency/errors, cache hit ratio, queue depth and
  failures, socket connections, event-loop lag, Mongo pool, Redis evictions; Grafana dashboards included
- **Health:** `/health/live` · `/health/ready` (Mongo + both Redis + queue + disk) · `/health/startup`
- **Errors:** Sentry (API, worker, browser) with release = git SHA and PII scrubbing
- **Traces:** optional OpenTelemetry → Jaeger (`--profile observability`)
- **Alerts:** 9 documented rules (5xx rate, p95 latency, queue backlog, job failure spike, **queue-Redis
  evictions**, low cache hit ratio, event-loop lag, Mongo pool saturation, disk)
- **Runbook:** 13 incident procedures with RPO 5 min / RTO 30 min — [`docs/runbook.md`](docs/runbook.md)

---

## 🐳 Deployment

```bash
# Production profile
docker compose -f docker-compose.yml -f infra/docker/compose.prod.yml up -d --build

# Horizontal scale (no config change required — the API is stateless)
docker compose up -d --scale api=4 --scale worker=2

# Zero-downtime config reload inside a container
docker compose exec api sh -c 'kill -USR2 1'
```

Production requirements: a MongoDB **replica set** (transactions), two Redis instances (or a managed
equivalent), an S3-compatible bucket, TLS termination at Nginx or a load balancer, and secrets supplied via a
secret manager rather than a committed `.env`. Migrations run as a pre-deploy step
(`docker compose run --rm migrate`). Scaling math and the growth path (read replicas, Redis Cluster with hash
tags, sharding by `workspaceId`) are in [`docs/scaling.md`](docs/scaling.md).

---

## 📂 Documentation index

| Document | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System diagram, request lifecycle, cluster and Redis topology, sequence flows |
| [`docs/er-diagram.md`](docs/er-diagram.md) | All 18 collections, relationships, and every index with its purpose |
| [`docs/api.md`](docs/api.md) | Endpoint reference with request/response examples and the error catalogue |
| [`docs/security.md`](docs/security.md) | OWASP mapping, threat model, control-by-control evidence |
| [`docs/performance.md`](docs/performance.md) | Budgets, index cheat-sheet, `explain()` results, optimization rationale |
| [`docs/scaling.md`](docs/scaling.md) | Capacity math (100k users), bottlenecks, growth path |
| [`docs/runbook.md`](docs/runbook.md) | Incident procedures and the backup/restore drill |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | 15 failure scenarios with the first diagnostic command for each |
| [`docs/demo-script.md`](docs/demo-script.md) | The 12-minute walkthrough |
| [`docs/adr/`](docs/adr/) | 15 Architecture Decision Records (context → options → decision → consequences) |

---

## 🗺 Roadmap / what's deliberately not built

Planned next, in priority order:
1. **CRDT collaborative editing** (Yjs) for simultaneous editing with live cursors
2. **Read replicas** for analytics + **Redis Cluster with hash tags** for >10k concurrent sockets
3. **Billing & plans** (Stripe) with real seat/storage enforcement
4. **Public API tokens + webhooks** for third-party integrations
5. **Email digests** with user-configurable schedules

Deliberately out of scope (and why): video/voice calls, end-to-end encryption, SSO/SAML, native mobile
apps and an app marketplace — each adds significant surface area without exercising the skills this project
is meant to demonstrate. Notion-style nested block forests were replaced with a flattened block model plus
fractional ordering: the same UX with far simpler sync, and a drag engine shared with Kanban.

---

## 📄 License

[MIT](LICENSE) © Your Name

---

<div align="center">

**Built with** Node · TypeScript · MongoDB · Redis · BullMQ · Socket.io · React — and a lot of tests.

*Docs, boards and chat in one workspace. Instead of three subscriptions and a copy-paste ritual.*

</div>
