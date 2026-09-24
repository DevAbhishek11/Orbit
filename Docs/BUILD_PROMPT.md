# 🛰️ MASTER BUILD PROMPT — **ORBIT** (Mini SaaS: Notion + Trello + Slack)

> **What this file is:** a complete, self-contained build instruction set. Paste it into your AI coding agent
> (Claude Code, Cursor, Codex, Windsurf, Cline) — or hand it to a developer — and the project can be built
> phase by phase without further clarification. Every phase has: goal, files, requirements, acceptance
> criteria, proof commands, and the commit message to use.
>
> **Companion file:** `PROJECT_PLAN.md` (the full engineering plan: diagrams, ADRs, data model, budgets,
> debugging playbook, interview prep). This prompt is the **execution** view of that plan.

---

## 0. HOW TO USE THIS PROMPT

| Step | Instruction |
|---|---|
| 1 | Paste **§1–§4** (context, stack, structure, conventions) at the start of every session — they are the permanent context. |
| 2 | Then paste **one phase** (§5 onward). Do **not** ask the agent to do multiple phases in one go. |
| 3 | After each phase: run the **proof commands**, then commit with the **exact commit message** given. |
| 4 | If a phase fails, paste the failing output back and ask for a targeted fix — never let the agent rewrite unrelated code. |
| 5 | Track progress in `PROGRESS.md` (checkbox per phase). A phase is only "done" when its acceptance criteria pass. |
| 6 | Never skip a phase to "come back later" — every later phase depends on the earlier ones compiling and passing tests. |

**Session opener (copy-paste):**
```
You are building "Orbit". Read the context, stack, structure and conventions sections below.
Rules: implement only the requested phase, keep the existing architecture, write tests for new
behaviour, keep files under 300 lines, never use `any`, never leave TODOs, and end your reply with
(a) files created/changed, (b) proof commands I should run, (c) the exact commit message to use.
Ask me before making any decision that changes a public API contract or a database schema.

[PASTE §1–§4]
[PASTE ONE PHASE FROM §5+]
```

---

## 1. MISSION & CONTEXT

**You are a senior full-stack engineer building "Orbit"** — a production-grade, multi-tenant mini-SaaS that
combines three product families in one coherent application:

| Pillar | Inspired by | What Orbit delivers |
|---|---|---|
| 📄 **Docs / Wiki** | **Notion** | Infinitely nested pages, block editor, autosave with version history, backlinks, favourites, trash + restore |
| 🗂️ **Kanban Boards** | **Trello** | Boards → Lists → Cards, drag & drop with fractional indexing, labels, assignees, checklists, due dates, comments, activity |
| 💬 **Team Chat** | **Slack** | Channels, DMs, threads, reactions, mentions, presence, typing indicators, unread counts, infinite message history |

**Unifying layer (this is what makes it one product, not three demos):** workspace + RBAC, unified search,
unified notification centre, unified audit/activity, file uploads, analytics dashboards, and background jobs.

**Six cross-pillar features that must work:**
1. **Message → Card** — create a Kanban card from a chat message; the card + the thread reply + the audit entry are **one MongoDB transaction**.
2. **Card → Page** — a card can own a doc page, linked both ways and previewed in the card modal.
3. **Page → Channel** — a doc can link to a discussion channel.
4. **Unified search** — one query returns pages + cards + messages + files, ranked and permission-filtered.
5. **Unified notifications** — mentions, assignments, due dates in one feed with per-channel/per-board mute rules.
6. **Unified audit/activity** — every entity answers "who changed what, when", and admins get a filterable audit log with CSV export.

**Grading reality (the assignment's weights):** live debugging 20% · architecture 20% · code quality 15% ·
performance 10% · code review 10% · system design 10% · git history 10% · communication 5%.
Therefore: **every phase must produce something explainable**, and the repo must contain evidence
(tests, diagrams, benchmarks, ADRs) — not just working code.

---

## 2. NON-NEGOTIABLE RULES FOR THE AGENT

These rules are absolute. If a rule conflicts with a shortcut, follow the rule.

**Architecture**
1. **Layered, strictly:** `route → controller → service → repository → model`. Controllers contain **no** business logic and **no** Mongoose calls. Services never touch `req`/`res`. Repositories are the only place with Mongoose queries.
2. **Vertical feature modules.** All files for a feature live in `modules/<feature>/`. One question, one path.
3. **Stateless API.** No in-process session state. Any worker must be able to serve any request. Shared state lives in Redis or Mongo.
4. **Contract-first.** Zod schema per endpoint is the single source of truth for validation, TypeScript types, OpenAPI docs, and (via `packages/shared`) frontend forms. Docs can never drift from code.
5. **Two Redis instances always.** `redis-cache` (`allkeys-lru`, cache/pubsub/presence/rate-limit) and `redis-queue` (`noeviction`, AOF, BullMQ only). Never mix them.

**Data**
6. **Every tenant document carries `workspaceId`**, and every query is filtered by it in the repository layer. A cross-tenant read must return `404`, never `403` (no resource enumeration).
7. **Transactions for multi-document writes.** Use `session.withTransaction` and retry on `TransientTransactionError`. Requires the Mongo **replica set** (never standalone).
8. **Soft delete** (`deletedAt`) for user content, with a 30-day trash + purge job. Hard delete only via explicit `force=true` + typed confirmation.
9. **Ordering uses fractional string keys** (`order: "a0G4z"`), never integer positions. Include a rebalance job for exhausted keys.
10. **Every new query gets an index**, and a test asserting the plan uses `IXSCAN`. No unindexed query ships.
11. **Optimistic concurrency** via `version` (`__v`). Conflicts return `409` **with the current document** in the response body.

**Security**
12. **RBAC is enforced in four layers:** route middleware, service re-check, repository query guard, and socket room check. Never rely on the frontend to hide privileged actions.
13. **Never log secrets or PII.** Pino redaction list is mandatory; tokens are hashed at rest (argon2id for passwords, SHA-256 for refresh tokens).
14. **Validate every input** with Zod; sanitize NoSQL operators; sanitize rich text; SSRF-guard any outbound fetch.
15. **Rate-limit every route** per the tier table; fail **closed** on auth endpoints, fail **open** on reads.

**Quality**
16. **TypeScript strict** — no `any` (use `unknown` + Zod parse), no `@ts-ignore` without a written reason.
17. **No file over 300 lines** (services 400). No God files, no `utils.ts` dumping grounds.
18. **Every mutation has:** validation, permission check, transaction (if multi-doc), audit entry, cache invalidation, socket emit (if others must see it live), and a BullMQ job (if it has async side-effects).
19. **Tests with every feature.** Unit for logic, integration for HTTP→DB, security for access control. Coverage gate 60% minimum, target 75%.
20. **No TODOs, no `console.log`, no commented-out code, no `.only`/`.skip` in committed tests.**
21. **Errors are typed** (`ApiError` with a code from the catalogue). Never throw a bare `Error`; never match on error message strings.
22. **Everything documented as you go** — OpenAPI auto-generated, ADR for any non-obvious decision, README kept in sync.

**Process**
23. **One phase at a time.** Finish, prove, commit, then continue.
24. **Conventional Commits**, one logical change per commit, no "wip"/"fix typo".
25. **Ask before:** changing an API contract, changing a schema, adding a dependency, or deviating from this prompt.
26. **End every response with:** files changed · proof commands · commit message · anything you deviated on and why.

---

## 3. TECH STACK (pin these)

**Backend (`apps/api`, `apps/worker`)**
`Node.js 20 LTS` · `TypeScript 5.4+ (strict)` · `Express 5` · `Mongoose 8` · `MongoDB 7 (replica set)` ·
`Redis 7.2` · `ioredis` · `BullMQ` + `@bull-board/express` · `Socket.io 4` + `@socket.io/redis-adapter` ·
`Zod` + `@asteasolutions/zod-to-openapi` · `argon2` · `jsonwebtoken` · `pino` + `pino-http` + `pino-pretty` ·
`helmet` · `cors` · `compression` · `cookie-parser` · `express-mongo-sanitize` · `multer` (never proxies bytes;
presigned uploads are the path) · `sanitize-html` · `sharp` · `nodemailer` + `MJML` · `@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner` · `prom-client` · `@sentry/node` · `uuid` (v7) · `nanoid` · `dayjs` (TZ) ·
`jest` + `supertest` + `mongodb-memory-server` + `redis-memory-server` · `k6` (load).

**Frontend (`apps/web`)**
`React 18` · `Vite 5` · `TypeScript strict` · `React Router 6.4+ (data router)` · `TanStack Query v5` ·
`Zustand` (+ `persist`) · `React Hook Form` + `@hookform/resolvers` + `Zod` · `Tailwind CSS` + CSS variables ·
`Radix UI` primitives (behaviour only — visuals are ours) · `lucide-react` · `@dnd-kit` · `@tanstack/react-virtual` ·
`framer-motion` (sparingly) · `TipTap` · `Recharts` · `sonner` · `date-fns` · `i18next` · `dexie` (IndexedDB outbox) ·
`vite-plugin-pwa` (Workbox) · `Vitest` + `@testing-library/react` + `msw` · `Playwright` + `axe-core`.

**Infra**
`Docker` multi-stage · `Docker Compose` (dev + prod profile) · `Nginx` (edge, rate limits, socket upgrade) ·
`MinIO` (S3-compatible dev) · `GitHub Actions` (5 workflows) · `Prometheus` + `Grafana` + `Loki` (observability profile) ·
`MailHog` (dev email) · `pnpm workspaces` + `Turborepo` · `ESLint` + `Prettier` + `Husky` + `lint-staged` + `commitlint`.

---

## 4. REPOSITORY STRUCTURE & CONVENTIONS

```
orbit-workspace/
├── apps/
│   ├── api/          # Express + TS, cluster runtime, HTTP + Socket.io
│   ├── worker/       # BullMQ consumers (own cluster, own scaling curve)
│   └── web/          # React + Vite dashboard UI
├── packages/
│   ├── shared/       # zod schemas · types · permission matrix · error codes · constants
│   └── config/       # eslint · tsconfig · prettier · tailwind preset
├── infra/
│   ├── docker/       # compose files, redis-cache.conf, redis-queue.conf, nginx.conf, mongo-init.js
│   ├── observability/# prometheus.yml, alerts.yml, grafana dashboards, loki, jaeger
│   └── k8s/          # optional manifests (deployment, service, hpa, ingress)
├── scripts/          # migrate.ts · syncIndexes.ts · seed.ts · reset.ts · generateOpenApi.ts · redisReport.ts
├── tests/load/       # k6 scenarios
├── migrations/       # numbered, versioned, reversible
├── docs/             # architecture.md · er-diagram.md · api.md · security.md · performance.md ·
│                     # scaling.md · runbook.md · troubleshooting.md · demo-script.md · adr/
├── .github/          # workflows/ · pull_request_template.md · CODEOWNERS · dependabot.yml
├── docker-compose.yml · .env.example · turbo.json · pnpm-workspace.yaml · README.md · PROGRESS.md
```

**File naming inside a module** (`modules/cards/`):
`cards.routes.ts` · `cards.controller.ts` · `cards.service.ts` · `cards.repository.ts` · `cards.model.ts` ·
`cards.schema.ts` · `cards.types.ts` · `cards.test.ts` · `cards.integration.test.ts`.

**Naming law**
- `camelCase` variables/functions · `PascalCase` types & React components · `SCREAMING_SNAKE_CASE` constants.
- Mongoose collections: lowercase plural (`cards`, `messages`, `workspacemembers`→`workspace_members`).
- Permissions: `resource:action` (`card:move`, `page:restore`, `admin:queue`).
- Socket events: `entity:action` (`card:moved`, `message:new`, `presence:update`).
- Env vars: `SCREAMING_SNAKE_CASE`, only read through `config/env.ts` (lint-enforced; `process.env` banned elsewhere).

**Response envelopes (never deviate)**
```ts
// success
{ "success": true, "data": { ... }, "meta": { "requestId": "...", "nextCursor": "...", "cached": false } }
// error
{ "success": false, "error": { "code": "VERSION_CONFLICT", "message": "...", "details": {}, "requestId": "..." } }
```
**Status codes:** 200 · 201 · 202 (async accepted) · 204 · 400 malformed · 401 unauthenticated · 403 forbidden ·
404 not-found-or-hidden · 409 conflict · 410 gone · 413 too large · 422 validation · 429 rate-limited · 500 · 503 dependency down.

**Error codes (shared enum):** `VALIDATION_ERROR`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`,
`TOKEN_REUSED`, `FORBIDDEN_ROLE`, `FORBIDDEN_SCOPE`, `RESOURCE_NOT_FOUND`, `VERSION_CONFLICT`, `ORDER_CONFLICT`,
`DUPLICATE_RESOURCE`, `QUOTA_EXCEEDED`, `FILE_TYPE_REJECTED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`,
`LOCK_BUSY`, `CYCLE_DETECTED`, `NOT_A_MEMBER`, `LAST_OWNER_PROTECTED`.

**Pagination contract (all list endpoints):** `?limit=25&cursor=<opaque>&sort=-updatedAt&filter[x]=y&q=term`.
Cursor = base64 of `{sortValue, _id}`. **Never `skip`.** Max `limit` 100.

---

## 5. PHASE 0 — Monorepo bootstrap

**Goal:** an empty but *correct* monorepo that typechecks, lints, and boots a health endpoint.

**Build**
1. `pnpm-workspace.yaml`, root `package.json`, `turbo.json` with pipelines: `dev`, `build`, `typecheck`, `lint`, `test`, `test:unit`, `test:integration`.
2. `packages/config`: base `tsconfig.json` (`strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, path aliases), ESLint flat config, Prettier config (+ `prettier-plugin-tailwindcss`).
3. `packages/shared`: `errorCodes.ts`, `permissions.ts` (permission list + `ROLE_PERMISSIONS` matrix for `owner|admin|manager|member|viewer`), `constants.ts` (limits, tiers, TTLs), `types/`.
4. `apps/api` skeleton: `src/config/env.ts` — **Zod-validated env that exits the process on invalid config**, typed and frozen, plus `.env.example` with every variable documented.
5. `ESLint` custom rules: `no-mongoose-in-controllers`, `no-req-in-services`, `require-zod-validation-on-mutation`, `no-console`, `no-skip-tests`.
6. `Husky` + `lint-staged` (pre-commit: prettier + eslint on staged + `tsc --noEmit` on affected) + `commitlint` (Conventional Commits).
7. `PROGRESS.md` with the phase checklist from this document.

**Acceptance criteria:** `pnpm install && pnpm typecheck && pnpm lint` pass on a clean clone; invalid env produces a readable error listing the missing variables; `.env.example` documents every variable.

**Proof:** `pnpm typecheck && pnpm lint && pnpm build`
**Commit:** `chore: bootstrap pnpm monorepo with turbo, strict tsconfig, eslint presets and shared package`

---

## 6. PHASE 1 — Infrastructure: Docker, MongoDB replica set, dual Redis, MinIO, Nginx

**Goal:** `docker compose up -d` brings up a complete local stack that the app can talk to.

**Build**
1. `docker-compose.yml` services: `mongo` (7.0, `--replSet rs0`), `mongo-init` (one-shot: `rs.initiate` + app user), `redis-cache` (6379), `redis-queue` (6380), `minio` + `minio-init` (buckets `orbit-uploads-private`, `orbit-public-assets`), `api` (replicas: 2), `worker`, `web`, `nginx`, `mailhog`. Profiles: `tools` (BullBoard), `observability` (Prometheus/Grafana/Loki/Jaeger).
2. `infra/docker/redis-cache.conf`: `maxmemory 1gb`, `maxmemory-policy allkeys-lru`, `lazyfree-*` on, `save 900 1`, `appendonly no`, `requirepass`, **ACL**: `user default off`, `user cache_app` limited to `~orbit:*` + read/write/keyspace/pubsub, `user health` ping-only, `notify-keyspace-events "Ex"`, `slowlog`, `latency-monitor-threshold 100`, `timeout 300` (idle client reaping), `maxclients`.
3. `infra/docker/redis-queue.conf`: `maxmemory-policy noeviction`, `appendonly yes`, `appendfsync everysec`, `auto-aof-rewrite` tuned, own ACL user restricted to `~bull:*` and lock/idempotency prefixes.
4. `infra/docker/nginx.conf`: `upstream orbit_api { least_conn; ... keepalive 64; }`, `map $http_upgrade $connection_upgrade`, `limit_req_zone` for `api` (20 r/s) and `auth` (2 r/s), `/socket.io` upgrade block with 75 s read timeout, `/metrics` IP-restricted, `/health` unlogged, SPA fallback to `web`, security headers, brotli/gzip.
5. `infra/docker/mongo-init.js`: initiate `rs0` with the container hostname; create `orbit_app` user with `readWrite` on `orbit`.
6. Healthchecks with `start_period` for **every** service; `deploy.resources.limits` on mongo/redis/api/worker; json-file log rotation (`max-size 10m`, `max-file 3`).

**Acceptance criteria:** all containers report `healthy`; `redis-cli -p 6380 info persistence` shows AOF enabled; `redis-cli -p 6379 config get maxmemory-policy` → `allkeys-lru` and `-p 6380` → `noeviction`; `docker compose exec mongo mongosh --eval "rs.status().myState"` → `1` (primary); both MinIO buckets exist; `curl localhost/nginx-health` → `ok`.

**Proof:**
```bash
docker compose up -d --wait && docker compose ps
docker compose exec redis-cache redis-cli -a $PW CONFIG GET maxmemory-policy
docker compose exec redis-queue redis-cli -a $PW INFO persistence | grep aof_enabled
docker compose exec mongo mongosh --quiet --eval "rs.status().myState"
```
**Commit:** `feat(infra): add docker compose stack with mongo replica set, dual redis, minio, nginx and mailhog`

---

## 7. PHASE 2 — Core plumbing: logger, errors, DB, Redis clients, cluster runtime, health

**Goal:** every request is traceable, every failure is typed, the server uses all vCPUs and shuts down gracefully.

**Build**
1. `infrastructure/logger/`: Pino with `base {service, env, pid, worker, version, commit}`, **redaction** of `authorization`, `cookie`, `password`, `token`, `*.passwordHash`, `*.refreshToken`; `pretty` in dev only. `requestContext.ts` with `AsyncLocalStorage` carrying `{requestId, userId, workspaceId}`; a `child()` logger helper so every log line is correlated.
2. `shared/ApiError.ts` + `errorHandler.ts`: map `ApiError` → status + code + message + details; unknown errors → 500 + Sentry capture + log with stack (never leak internals to the client). `notFound` middleware. Response helpers `ok()` / `fail()`.
3. `middleware/requestContext.ts`: generate uuid-v7 `requestId`, set `X-Request-Id` response header, bind ALS store.
4. `app.ts`: Express app **factory** (no `listen`) with helmet (CSP, HSTS, nosniff, frameguard), CORS allowlist from env (no `*` with credentials), `compression`, `cookie-parser`, JSON body limit 1 MB, `express-mongo-sanitize`, `pino-http`, `trust proxy`.
5. `infrastructure/db/mongoose.ts`: connection with `maxPoolSize`/`minPoolSize`, **boot guard that refuses to start when `MONGO_REQUIRE_TRANSACTIONS=true` and the deployment is standalone**, `syncIndexes` only via explicit script, connection event logging, slow-query logging via Mongoose middleware.
6. `infrastructure/redis/`: `cacheClient.ts` (`enableOfflineQueue: false`, `maxRetriesPerRequest: 1`, retry strategy with capped backoff + jitter, `lazyConnect`), `queueClient.ts` (`maxRetriesPerRequest: null` — required by BullMQ), dedicated pub/sub connections, `ping()` health helpers, `metrics.ts` counters for hit/miss/evictions.
7. `cluster.ts`: primary forks `WEB_CONCURRENCY` workers (staggered 750 ms), listens for `ready` messages, restarts crashed workers with **exponential backoff and crash-loop detection** (exit primary after 10 rapid crashes), implements **zero-downtime rolling reload on `SIGUSR2`** (graceful drain then respawn, staggered), graceful shutdown on `SIGTERM` (SIGKILL after 15 s).
8. `server.ts`: HTTP server + Socket.io bootstrap (adapter wired in Phase 8), `listen(PORT, '0.0.0.0')`, `process.send({type:'ready'})`, graceful shutdown that closes HTTP → sockets → Mongo → Redis in order with a hard deadline; `unhandledRejection`/`uncaughtException` handlers that log `fatal` and exit non-zero.
9. `modules/health/`: `/health/live` (process only), `/health/ready` (Mongo ping + both Redis pings + queue connectivity + disk), `/health/startup` (migrations applied + indexes present). Detailed JSON body gated by `HEALTH_DETAILED`.
10. `metrics/`: `prom-client` registry + HTTP duration/count/in-flight histograms, `event_loop_lag`, `process_memory_bytes`, exposed at `/metrics` behind token/IP allowlist.

**Acceptance criteria:** `/health/ready` returns per-dependency status; killing a worker respawns it within 2 s; `kill -USR2 <primary pid>` reloads workers **with zero dropped requests** (prove with a loop of `curl` and assert no non-2xx); a forced `throw` in a test route returns the error envelope with `requestId` matching the log line.

**Proof:**
```bash
docker compose up -d --scale api=2
for i in $(seq 1 200); do curl -sf localhost/api/v1/health/live || echo FAIL; done & \
  docker compose exec api sh -c 'kill -USR2 1'; wait
curl -s localhost:4000/health/ready | jq
```
**Commit:** `feat(api): add logger with request context, error taxonomy, mongo/redis clients and clustered runtime`

---

## 8. PHASE 3 — Authentication & Identity (8 endpoints)

**Goal:** production-grade auth: argon2id, access + rotating refresh, reuse detection, sessions, verification, reset.

**Endpoints:** `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` ·
`POST /auth/forgot-password` · `POST /auth/reset-password` · `POST /auth/verify-email` · `GET /auth/sessions`.

**Build**
1. `users` model: unique lowercased email, `passwordHash` (`select: false`), name, handle, timezone, avatar, status, `tokenVersion`, preferences (theme, notification prefs, quiet hours), `failedLoginCount`, `lockedUntil`. Indexes: unique email (partial, non-deleted), handle, text index on name/email.
2. `refreshtokens` model: `tokenHash` (unique, SHA-256 — **never store the raw token**), `familyId`, device/UA/IP, `expiresAt` (TTL index), `rotatedAt`, `replacedBy`, `revokedAt`.
3. Password hashing: argon2id (`memoryCost 19456`, `timeCost 2`, `parallelism 1`), parameters from env. Password policy enforced in the Zod schema (min 12 chars, not in a common-password list, no email substring).
4. Login: **timing-safe** (always run a hash comparison even for unknown emails), lockout after 10 failures for 30 min, generic error message for both wrong-email and wrong-password.
5. Access token: JWT with `{sub, wid, role, ver, jti, typ:'access', iss, aud}`, TTL 15 min, HS256 in dev / RS256 in prod (keys from env).
6. Refresh token: opaque 64-byte random, returned as `httpOnly; Secure; SameSite=Lax` cookie; 7 d (30 d with `remember`). On refresh: **rotate** (mark `rotatedAt`, link `replacedBy`, issue new). If an already-rotated token is presented → **revoke the entire `familyId`**, audit `auth.refresh_reuse_detected`, return 401.
7. Logout: add `jti` to a Redis denylist with TTL equal to the token's remaining life; `?allDevices=true` bumps `tokenVersion` and revokes all families.
8. Email verification + password reset: single-use hashed tokens with TTL; enqueue mail jobs (Phase 10 wires the real mailer — until then use a stub that logs in dev); reset revokes all sessions.
9. Rate limiting hooks: auth tier limits applied here (`10 / 15 min` per IP+email), returning `429` + `Retry-After`.
10. Tests: `auth.unit.test.ts` (hashing, token helpers), `auth.integration.test.ts` (full flows), `refresh-rotation.test.ts` (**rotation, reuse detection, family revocation, parallel-refresh race → exactly one winner**), lockout test, timing test.

**Acceptance criteria:** refresh rotation proven; reused refresh kills the family; logout invalidates the access token immediately (denylist); login response time differs <10% between unknown email and wrong password; all 8 endpoints appear in Swagger with examples.

**Proof:** `pnpm --filter @orbit/api test -- auth` and manual `curl` sequence in `docs/api.md`.
**Commit:** `feat(auth): add jwt auth with rotating refresh tokens, reuse detection and session management`

---

## 9. PHASE 4 — Cross-cutting middleware: RBAC, rate limiting, idempotency, validation, audit

**Goal:** the security and correctness spine that every later module depends on.

**Build**
1. `middleware/authenticate.ts`: extract bearer **or** `orbit_at` cookie → verify JWT (signature, exp, `iss`, `aud`, `typ`) → check `jti` denylist → load cached session (15 min Redis) → check `tokenVersion` and account status → attach `req.auth {id, workspaceId, role, jti}`.
2. `middleware/authorize.ts`: `authorize(permission, { load?, scope?: 'own' | 'any', allowOwner? })`.
   - Level 1: role has the permission (`ROLE_PERMISSIONS`).
   - Level 2: resource scope — `load()` returns `{workspaceId, memberIds, assignees, allowedUserIds, createdBy, visibility}`; private resources with no access return **404**.
   - Level 3: repositories auto-inject `workspaceId` + `deletedAt: null` via a base repository (no query can forget).
3. `middleware/validate.ts`: `validate({params, query, body})` with Zod, strict objects, `limit` capped at 100, unknown keys stripped, `422` with per-field `path`+`message`.
4. `middleware/rateLimit.ts`: Redis **Lua sliding window** (`ZREMRANGEBYSCORE` + `ZCARD` + `ZADD` + `PEXPIRE` in one round trip) returning `{allowed, remaining, retryAfterMs}`; tier table (`global`, `auth` fail-closed, `write`, `search`, `upload`, `socketMsg`); key by IP, `userId`, or `ip+email`; emit `RateLimit-*` headers and `Retry-After` on 429; **fail-open with a logged warning** if Redis is unreachable (except `auth`).
5. `middleware/idempotency.ts`: for POSTs carrying `Idempotency-Key`, store `{status, body}` in Redis for 24 h keyed by `userId+key`; a repeat replays the stored response verbatim; concurrent duplicates get `409 LOCK_BUSY` with a short retry hint.
6. `shared/pagination.ts`: cursor encode/decode, `limit` validation, sort allowlist per endpoint, `$or` seek query builder.
7. `services/audit.service.ts` + `auditlogs` model (append-only, indexes on `{workspaceId, at}`, `{actorId, at}`, `{action, at}`, TTL 365 d): `record({actorId, actorRole, action, entityType, entityId, before, after, ip, userAgent, requestId})`. **Audit writes must never block the response** — fire-and-forget with error capture, or write inside the caller's session when atomicity matters.
8. CSRF: `csrf.ts` — double-submit token (`orbit_csrf` cookie + `X-CSRF-Token` header compared with `timingSafeEqual`) + `Origin`/`Referer` allowlist for cookie-authenticated mutations. Header/Bearer clients skip CSRF (document the reasoning in the ADR).
9. Plugin: `plugins/softDelete.ts` (Mongoose plugin adding `deletedAt`, auto-filtering finds, `restore()`/`purge()` helpers).

**Acceptance criteria:** table-driven test sweeping **all roles × all permissions** against sample endpoints (≈120 generated cases) proves the matrix; a cross-tenant read returns 404; a second identical `Idempotency-Key` POST returns the cached response without a second DB write; the limiter allows exactly N then 429s and recovers after the window; audit entries appear for every mutation with `requestId`.

**Proof:** `pnpm --filter @orbit/api test -- rbac rateLimit idempotency audit`
**Commit:** `feat(api): add rbac authorization, lua rate limiter, idempotency, validation, audit service and soft delete`

---

## 10. PHASE 5 — Workspaces, members, invitations (8 endpoints + supporting)

**Goal:** multi-tenant foundation with a transactional bootstrap.

**Endpoints:** `POST /workspaces` · `GET /workspaces` · `GET /workspaces/:id` · `PATCH /workspaces/:id` ·
`DELETE /workspaces/:id` · `POST /workspaces/:id/invites` · `GET /workspaces/:id/members` ·
`PATCH /workspaces/:id/members/:userId` + supporting: `DELETE /members/:userId`, `POST /invites/:token/accept`,
`POST /invites/:token/decline`, `POST /workspaces/:id/leave`, `POST /workspaces/:id/transfer-ownership`.

**Build**
1. Models: `workspaces` (name, unique slug, logo, plan, seatLimit, storageQuotaBytes, settings{timezone, weekStart, defaultRole}, **denormalized `stats`**, archivedAt, deletedAt) · `workspace_members` (unique `{workspaceId, userId}`, role, status, invitedBy, joinedAt, notificationPrefs) · `invitations` (email, role, **hashed** single-use token, `expiresAt` 72 h + TTL index, acceptedAt/declinedAt).
2. **Transaction T1 — workspace bootstrap:** create workspace + owner membership + default `#general` channel + default "Getting Started" board (with 3 lists) + default "Welcome" page + audit entry. Wrap in `session.withTransaction` with transient-error retry.
3. Listing is **aggregated**: my workspaces with my role + unread totals in one pipeline; cached 60 s.
4. Invite: enforce `seatLimit`; dedupe existing members/pending invites; enqueue invitation mail; `invitations` are hashed at rest.
5. Accept invite (T6): mark accepted + upsert membership + bump `stats.memberCount` + notify the inviter + audit — all in one transaction; **idempotent** (double accept cannot create two memberships).
6. Remove member (T4): delete membership + decrement `stats.memberCount` + **prune the user from card `assignees`** + audit. A user being removed loses access immediately (membership cache invalidated).
7. Role change: validate against the matrix; **cannot demote/remove the last owner** (`LAST_OWNER_PROTECTED`); invalidate the member's cached session so permissions apply instantly.
8. Leave workspace (non-owner), transfer ownership (owner-only, requires typed confirmation in UI), archive/soft-delete workspace (owner-only).
9. Tests: tenant isolation suite (20 cross-tenant read/write attempts → all 404/403 as designed), T1 rollback test (inject failure at step 4 → assert **zero** documents created), invite expiry, seat limit, last-owner protection.

**Acceptance criteria:** T1 is atomic under injected failure; T6 is idempotent; role changes take effect within one request; every mutation audited.
**Proof:** `pnpm --filter @orbit/api test -- workspaces transactions`
**Commit:** `feat(workspaces): add transactional workspace bootstrap, membership, invitations and rbac enforcement`

---

## 11. PHASE 6 — Boards, Lists & Cards (16 endpoints) — the Trello pillar

**Goal:** the flagship feature: O(1) drag & drop inside a transaction.

**Endpoints:** `POST /workspaces/:wid/boards` · `GET /workspaces/:wid/boards` · `GET /boards/:id` · `PATCH /boards/:id` ·
`DELETE /boards/:id` · `POST /boards/:id/lists` · `PATCH /lists/:id` · `PATCH /lists/reorder` · `DELETE /lists/:id` ·
`GET /boards/:id/cards` · `POST /lists/:id/cards` · `PATCH /cards/:id` · `PATCH /cards/:id/move` · `DELETE /cards/:id` ·
`POST /cards/:id/comments` · `GET /cards/:id/activity` + supporting: `POST /cards/:id/assignees`, `POST /cards/:id/attachments`,
`POST /cards/:id/watch`, `POST /cards/:id/checklist`, `POST /cards/from-message`.

**Build**
1. Models:
   - `boards`: workspaceId, name, description, visibility (`workspace|private` + `memberIds`), background, createdBy, archivedAt, deletedAt.
   - `lists`: boardId, name, **`order` fractional key**, color, wipLimit, denormalized `cardCount`, archivedAt, deletedAt.
   - `cards`: boardId, listId, title, description (sanitized rich text), **`order`**, **embedded** labels[] and checklist[] (bounded, always read with the card), assignees[], dueAt/startAt/completedAt, priority, coverColor/coverFileId, attachments[] (bounded refs), denormalized `commentCount`/`attachmentCount`/`checklistProgress`, watcherIds[], `sourceMessageId?`, `pageId?`, `version` (optimistic concurrency), archivedAt, deletedAt.
2. **Indexes (mandatory, with a test proving `IXSCAN`):** `{listId:1, order:1}`, `{boardId:1, archivedAt:1, dueAt:1}`, `{workspaceId:1, assignees:1, completedAt:1}`, `{dueAt:1}` **partial** on `{completedAt:null, deletedAt:null}`, `{sourceMessageId:1}` sparse, text `{title, description}`.
3. `shared/fractionalIndex.ts`: `keyBetween(prev, next)` producing a strictly-between base-62 string; `increment`/`decrement`; throws `ORDER_CONFLICT` if neighbours are out of order. Unit-test with property-based cases (10k random insert sequences always sort correctly and never collide).
4. **T2 — card move (`PATCH /cards/:id/move`)**: body `{targetListId, beforeCardId?, afterCardId?, version}`. Inside one transaction: recompute order key, update the card (`listId`, `order`, `version` guard), decrement source list `cardCount`, increment target list `cardCount`, write `activities`, write `auditlogs`. **After commit** (never inside): invalidate the `board:{id}` cache tag, emit `card:moved` to `board:{id}` (including `clientMutationId` so the actor ignores its own echo), enqueue the notification job. Retry on `TransientTransactionError`; return `409 VERSION_CONFLICT` **with the current card** when the version is stale; return `409 ORDER_KEY_EXHAUSTED` when the generated key exceeds 60 chars (and enqueue the rebalance job).
5. **T5 — list reorder (bulk)**: validate the full ordered set, write all keys + board `updatedAt` + activity in one transaction.
6. `GET /boards/:id` uses **aggregation A1**: `$match` → `$facet` (lists + counts) → `$lookup` users → `$project` trimmed fields; cached 5 min under tag `board:{id}`, first page of cards cached 60 s.
7. `GET /boards/:id/cards` supports filters (`listId`, `assignee`, `label`, `due=overdue|today|week`, `q`) with cursor pagination and a sort allowlist.
8. Card comments reuse a **unified `comments` collection** (`entityType: card|page|message`) with mentions; mentions enqueue notification jobs; comment create bumps `commentCount` in the same transaction as the comment insert.
9. **C1 + T3 — create card from message** (`POST /cards/from-message`): creates the card, adds an activity, posts a **thread reply** in the source channel with a card permalink (`replyCount++`, `lastReplyAt`), and creates the notification — one transaction, then sockets/queue after commit.
10. `DELETE /cards/:id` = soft delete (trash) with an `UndoToast`-friendly restore endpoint; `DELETE /lists/:id` with cards requires `force=true`.
11. Tests: move ordering invariants, concurrent double-move → exactly one wins + one 409, counter drift check (sum of `cardCount` equals real counts after 500 random moves), T2 rollback test (inject failure after the card write → nothing persists), fractional-key property tests, index-plan assertions.

**Acceptance criteria:** 500 random moves leave counters and ordering perfectly consistent; concurrent moves never duplicate/lose a card; two clients always derive the same order; `explain()` shows `IXSCAN` for the board render query.
**Proof:** `pnpm --filter @orbit/api test -- cards boards` + the concurrency test output.
**Commit:** `feat(cards): add boards, lists and cards with fractional-order drag and drop inside mongodb transactions`

---

## 12. PHASE 7 — Pages / Docs (7 endpoints) — the Notion pillar

**Goal:** nested wiki with blocks, autosave, versions, backlinks and trash.

**Endpoints:** `POST /workspaces/:wid/pages` · `GET /pages` · `GET /pages/:id` · `PATCH /pages/:id` ·
`DELETE /pages/:id` (+ restore) · `GET /pages/:id/versions` · `POST /pages/:id/versions/:versionId/restore`
+ supporting: `GET /pages/:id/backlinks`, `POST /pages/:id/favourite`, `GET /pages/tree`.

**Build**
1. `pages` model: title, icon, cover, `parentId`, **`ancestors: [ObjectId]`** (materialized path) + `depth`, `order` (fractional), **flattened `blocks[]`** with types (`paragraph, h1, h2, h3, bullet, numbered, todo, quote, code, divider, image, callout`), each with `order` (fractional), `mentions[{type,id}]`, denormalized **`plainText`** for search/snippets, `visibility` (`workspace|private|link`) + `allowedUserIds`, `favouriteOf[]`, `mentions[]` (inverted index for backlinks), **`version`** for autosave conflict detection, `lastSnapshotAt`, deletedAt.
2. Indexes: `{workspaceId, parentId, order}`, `{workspaceId, ancestors}`, `{workspaceId, mentions}` (backlinks), text `{title:3, plainText:1}`, `{deletedAt, updatedAt}`.
3. Subtree fetch with **aggregation A3** (`$graphLookup` depth-limited to 8) for the sidebar tree, cached 60 s per workspace.
4. Autosave: `PATCH /pages/:id` requires the client's `version`; a stale version returns **409 with the current document** so the editor can merge/reload — content is never silently lost. Successful save bumps `version`, recomputes `plainText`, updates the inverted `mentions` index, updates `ancestors` for the subtree if the page moved.
5. Move validation: reject moving a page into its own descendant (`422 CYCLE_DETECTED`) via path check; bulk-update descendants' `ancestors` in a transaction.
6. Versions: `pageversions` snapshots with a **repeatable BullMQ job every 5 min that only snapshots pages where `updatedAt > lastSnapshotAt`**; manual snapshot endpoint; restore creates a new version (never overwrites history).
7. Backlinks: `GET /pages/:id/backlinks` via `$match {mentions: pageId}` + `$lookup` (aggregation A4) — no scans.
8. Trash: `DELETE` soft-deletes the **subtree** (`deletedAt` + `deletedFrom` marker to restore precisely); restore endpoint restores the subtree; nightly purge job removes items older than 30 days.
9. Tests: cycle rejection, autosave conflict returns the current doc, subtree fetch correctness at depth 5, descendant `ancestors` correctness after a move, backlinks accuracy, trash/restore round-trip.

**Acceptance criteria:** deep nesting works to depth 8; concurrent edits produce a 409 + merge path (no data loss); backlinks reflect mentions after a save; restore brings back the whole subtree.
**Proof:** `pnpm --filter @orbit/api test -- pages`
**Commit:** `feat(pages): add nested pages with materialized paths, block content, version history, backlinks and trash`

---

## 13. PHASE 8 — Chat: channels, messages, threads, reactions, presence (9 endpoints) — the Slack pillar

**Goal:** Slack-grade chat with correct unread counts and an honest realtime model.

**Endpoints:** `POST /workspaces/:wid/channels` · `GET /channels` · `GET /channels/:id/messages` ·
`POST /channels/:id/messages` · `PATCH /messages/:id` · `DELETE /messages/:id` · `POST /messages/:id/reactions` ·
`GET /messages/:id/thread` · `POST /channels/:id/read` + supporting: `POST /channels/:id/members`, `POST /channels/:id/pins`,
`PATCH /channels/:id`, `POST /channels/:id/typing`.

**Build**
1. Models:
   - `channels`: workspaceId, name, slug (unique per workspace), `type: public|private|dm`, topic/purpose, `memberIds[]`, **denormalized `lastMessage {_id, authorId, preview, at}`** (so the sidebar renders in one query), `messageCount`, createdBy, archivedAt, deletedAt.
   - `messages`: workspaceId, channelId, authorId, body, `mentions[]`, `fileIds[]`, `linkPreviews[]`, `parentId?`, **`threadRootId?`**, `replyCount`, `lastReplyAt`, **embedded `reactions[{emoji, userIds[]}]`**, `editedAt`, `deletedAt`/`deletedBy` (tombstone), `clientId` (idempotency).
   - `channel_reads`: unique `{channelId, userId}`, `lastReadAt`, `lastReadMessageId`, `unreadCount`, `mentionCount`.
2. Indexes: `{channelId:1, threadRootId:1, createdAt:-1}` (timeline **and** threads), `{channelId:1, createdAt:-1}` (cursor paging), text `{body}`, `{mentions:1, createdAt:-1}`, `{workspaceId:1, createdAt:-1}`.
3. Send message: **idempotent via `clientId`** (Redis `SETNX` + unique index) so a retried/duplicated socket or HTTP send creates exactly one message; updates `lastMessage`, `messageCount`; parses mentions into `mentions[]`; enqueues: notification fan-out, search indexing, link-preview fetch.
4. Timeline: `GET /channels/:id/messages` returns **`threadRootId: null`** messages only (thread replies live in the thread view), newest-first internally with an opaque cursor, rendered oldest→newest; first page cached 30 s under tag `channel:{id}`.
5. Threads: replies store `parentId` + `threadRootId` (root of the thread); creating a reply bumps root `replyCount`/`lastReplyAt` in the same transaction; `GET /messages/:id/thread` uses **aggregation A6** with participant `$lookup`.
6. Reactions: `POST /messages/:id/reactions {emoji}` toggles idempotently (`$addToSet`/`$pull` on the embedded array); broadcast a **delta** (`{messageId, emoji, userIds}`), never the full message.
7. Edit/delete: author-only (admins may delete others'); edits set `editedAt`; deletes leave a **tombstone** so thread structure survives; both emit socket events.
8. Unread: per-channel unread = `messagesSince(lastReadAt)` **excluding the user's own messages**, cached in a Redis hash `unread:{wid}:{uid}`; `POST /channels/:id/read` updates `channel_reads` + Redis + emits `unread:updated` to the user's personal room. Provide a reconciliation job that recomputes unread from the DB hourly to repair drift (production hygiene).
9. Aggregation **A5** for the sidebar: channels + `lastMessage` + unread + mention counts in one pipeline, cached 30 s.
10. DM creation: `type:'dm'` with `memberIds` — **dedupe** an existing 1:1 DM instead of creating duplicates (unique compound index guard).
11. Presence & typing live in the Redis layer (Phase 9 wires sockets): `presence:{ws}:{uid}` string with 60 s TTL refreshed by heartbeat; `typing:{channel}:{uid}` with 4 s TTL; typing events throttled to 1 per 2 s per user per channel and never persisted.
12. Tests: idempotent send (same `clientId` twice → one message), thread counters, reaction toggle idempotency, unread correctness after read/send from two users, tombstone shape, DM dedupe, cursor stability while new messages arrive.

**Acceptance criteria:** 10k messages paginate in 50-message pages; unread counts match a recomputed ground truth; a duplicate send never duplicates a message; thread replies never leak into the channel timeline.
**Proof:** `pnpm --filter @orbit/api test -- chat messages`
**Commit:** `feat(chat): add channels, messages, threads, reactions, unread tracking and presence primitives`

---

## 14. PHASE 9 — Realtime gateway (Socket.io + Redis adapter)

**Goal:** cross-worker, permission-checked, rate-limited realtime — provably working across two API containers.

**Server→Client events (emit only after commit):** `notification:new` · `presence:update` · `typing:start` / `typing:stop` ·
`message:new` · `message:updated` · `message:deleted` · `reaction:updated` · `thread:updated` · `unread:updated` ·
`card:created` / `card:updated` / `card:deleted` / `card:moved` · `list:reordered` / `list:rebalanced` ·
`comment:new` · `page:updated` · `page:presence` · `file:ready` · `workspace:member:changed` · `job:progress` · `error`.

**Client→Server events (all with ack callbacks `{ok, data?, error?}`):** `room:join` · `room:leave` · `typing:start` ·
`typing:stop` · `message:send` · `presence:heartbeat` · `sync:since`.

**Build**
1. `socket.server.ts`: Socket.io server with `path: /socket.io`, `transports: ['websocket','polling']`, `maxHttpBufferSize: 64 KB`, `pingInterval 25 s`, `pingTimeout 20 s`, `connectionStateRecovery: {maxDisconnectionDuration: 120000}`, adapter `createAdapter(redisPub, redisSub)` on the cache Redis.
2. **Handshake auth middleware:** accept `auth.token` or the `orbit_at` cookie → verify JWT → check `jti` denylist → hydrate user (cached) → on failure `next(new Error('UNAUTHORIZED'))` (client sees `connect_error`).
3. **Room model:** `user:{id}` (personal), `workspace:{wid}`, `board:{id}`, `channel:{id}`, `page:{id}`, `typing:{channelId}`. `room:join` is **permission-checked** (channel membership for channels; workspace + visibility for boards/pages) and capped at 50 rooms per socket; denials emit `error {code:'FORBIDDEN_ROOM'}`.
4. **Rate limiting:** per-socket token bucket (20 events / 10 s); exceeding drops the event and emits a warning event (never disconnects silently).
5. **Idempotent message send over socket:** `message:send {channelId, body, clientId, fileIds}` → Redis `SETNX` on `clientId` → create → broadcast `message:new` including `clientId` so the sender reconciles its optimistic bubble; ack returns the created message. **REST remains the fallback** when sockets are unavailable.
6. **Presence:** on connect mark online (Redis TTL key) and broadcast; heartbeat refresh every 30 s; on disconnect mark offline with a 5 s grace period (guard against refresh flaps); batch presence broadcasts every 2 s to avoid event storms.
7. **Typing:** ephemeral, throttled, auto-expiring — never written to Mongo.
8. **Reconnect delta-sync:** `sync:since {scope, updatedAt}` returns missed events (cards/messages/notifications changed since) so a reconnecting client doesn't refetch everything.
9. **Emit discipline:** all emits happen **after the transaction commits**. Provide `emitSafe(room, event, payload)` that swallows+logs socket errors (a socket failure must never fail a request) and records `socket_emit_duration_seconds`.
10. Metrics: `socket_connections_active`, `socket_events_total{event,direction}`, emit latency histogram.
11. Tests: unauthenticated handshake rejected; forbidden room rejected; a message sent by client A on worker 1 arrives at client B on worker 2 (proves the adapter); duplicate `clientId` yields one message; typing expiry; reconnect delta-sync returns the missed messages.

**Acceptance criteria:** the two-container cross-worker test passes in CI; no emit occurs inside a transaction; a Redis outage degrades gracefully without 500s.
**Proof:** `pnpm --filter @orbit/api test -- socket` + manual two-browser demo in `docs/demo-script.md`.
**Commit:** `feat(realtime): add socket.io gateway with jwt handshake, permissioned rooms and redis adapter`

---

## 15. PHASE 10 — Background jobs (BullMQ): 9 queues + DLQ

**Goal:** everything slow or retryable leaves the request path, with retries, DLQ and visibility.

**Queues:** `mail` (5) · `notifications` (10) · `search-index` (4) · `files` (3) · `analytics` (1) ·
`cleanup` (1) · `pages` (2) · `reminders` (1) · `webhooks` (5) · `dlq`.

**Build**
1. `queues.ts`: one `Queue` per name on the **queue Redis** (`maxRetriesPerRequest: null`), default job options `attempts: 5`, exponential backoff base 2 s, `removeOnComplete {age: 24h, count: 1000}`, `removeOnFail {age: 7d}`. Helper `enqueueOnce(queue, name, data, key)` using a deterministic `jobId` (sha256 of the key) so duplicate triggers collapse into one job.
2. `apps/worker/src/index.ts`: one `Worker` per queue with its own concurrency, `lockDuration 60 s`, `stalledInterval 30 s`, `maxStalledCount 2`; a `limiter` on `mail` (50/min) to respect SMTP; event handlers `completed` (metrics), `failed` (log + **route exhausted jobs to `dlq`**), `stalled` (warn), `error`.
3. **Repeatable jobs registered ONLY in the worker service** (never in API workers, or each API worker fires them N times): page snapshots every 5 min (`*/5 * * * *`), purge trash nightly (`0 3 * * *`), analytics rollup nightly (`15 1 * * *`), counter reconciliation weekly (`30 3 * * 0`), due-soon reminders hourly (`0 * * * *`), order-key rebalance weekly (`0 4 * * 0`).
4. **Processors**
   - `mail`: MJML templates (verify email, invite, password reset); MailHog in dev.
   - `notifications`: fan-out → dedupe recipients → suppress self-notifications → honour mute prefs/quiet hours → batch insert (500/txn) → emit `notification:new` via socket → optionally enqueue email; **grouping**: many events on the same entity within 5 min collapse into one row with `groupCount`.
   - `search-index`: recompute `plainText`/`title` fields and refresh text indexes; supports full workspace reindex with progress.
   - `files`: sharp thumbnails (256/1024), EXIF strip, checksum verify, quarantine handling.
   - `analytics`: hourly + nightly rollups into `analytics_daily` (cards created/completed, messages sent, pages edited, active members, avg completion hours) and counter reconciliation (compare denormalized counters vs real counts → repair + log drift).
   - `cleanup`: purge trash > 30 days, purge expired tokens/invites, sweep orphan files (no `entityId`, older than 24 h), rebalance exhausted order keys.
   - `pages`: snapshot only pages with `updatedAt > lastSnapshotAt`.
   - `reminders`: due-soon (24 h) and overdue cards, timezone-aware per workspace, `enqueueOnce` keyed by `cardId+date` so a restart doesn't double-notify.
   - `webhooks`: HMAC-signed delivery with retries to 6 h.
5. **Error classification:** permanent failures throw `UnrecoverableError` (straight to DLQ, no retries); transient (SMTP 4xx, S3 5xx, Redis timeouts) retry with backoff.
6. **Hygiene:** payloads carry **ids only, never documents**; processors re-read state and re-check permissions; long work chunks (500 docs) and calls `job.updateProgress()`.
7. **DLQ ops:** BullBoard mounted at `/admin/queues` (RBAC `admin:queue`), with retry/remove actions; plus `GET /admin/jobs/:queue` and `POST /admin/jobs/:queue/:id/retry` as audited admin APIs.
8. `QUEUE_DISABLED=true` mode runs processors synchronously in-process so tests and demos work without a worker.
9. Metrics: `queue_*` gauges + `job_duration_seconds`; alert rules: waiting > 1000 for 10 min, failure rate > 5%; **`evicted_keys > 0` on the queue Redis is a critical alert**.
10. Tests: retry/backoff with fake timers, `UnrecoverableError` → DLQ, repeatable registration is idempotent (register twice → one schedule), notification grouping, reminder de-duplication across restarts.

**Acceptance criteria:** killing the worker mid-job leaves the job recoverable (no loss); retries and DLQ visible in BullBoard; repeatable jobs run once per schedule; API latency is unaffected when a job is slow.
**Proof:** `pnpm --filter @orbit/worker test` + BullBoard screenshot.
**Commit:** `feat(queue): add bullmq queues, workers, retries, dlq, repeatable jobs and bullboard admin`

---

## 16. PHASE 11 — Files, Search, Notifications & Analytics (12 endpoints)

**Files (3):** `POST /files/presign` · `POST /files/:id/confirm` · `DELETE /files/:id`
1. Presign flow: validate name/size/MIME against tier limits + workspace quota → **sniff extension vs declared MIME** → generate a server-side key (`ws/{wid}/{type}/{uuid}.{ext}` — user input never becomes a path) → return presigned PUT with `Content-Type` + `Content-Length-Range` conditions (5 min).
2. Confirm: HEAD the object → verify size + ETag/checksum → **read magic bytes** → mismatch ⇒ `quarantined` + audit + reject; else `ready` + enqueue thumbnails/EXIF strip.
3. Downloads via short-lived (5 min) presigned GETs, permission-checked at issue time; private bucket has no public ACL; lifecycle rule deletes `pending` objects after 24 h.
4. Tests: MIME-spoofed file rejected, quota exceeded, orphan sweep, presign expiry.

**Search (2):** `GET /search` · `GET /search/suggestions`
5. Aggregation **A8**: `$match` `$text` (or `$search`) → `$facet` per type (`page|card|message|file`) → `$meta textScore` → sort by score then recency; **permission filtering applied before ranking**; each result returns `highlight` snippet + `breadcrumb` (Workspace → Board → Card) + `type`.
6. Weights: `title^3, body^1`; minimum 2 chars; `types` filter; cursor pagination; suggestions = recents + people + popular (cached 10 min).
7. Proof: `explain()` shows `IXSCAN`/text index usage; p95 < 400 ms with the `SEED_LARGE` dataset (100k messages) — record the number in `docs/performance.md`.

**Notifications (3):** `GET /notifications` · `POST /notifications/read` · `GET /notifications/summary`
8. Model with `groupKey`/`groupCount`, `readAt`, `link`, `actorId`, TTL 180 d; indexes `{userId, readAt, createdAt}` and `{userId, groupKey, createdAt}`.
9. Read state: single ids or `{all:true}`; unread total cached in Redis and pushed over the socket; summary groups per workspace/type.

**Analytics (2):** `GET /analytics/workspaces/:id/overview` · `GET /analytics/boards/:id/burndown`
10. **A2**: one `$facet` returning cards by status/label/assignee + created-vs-completed trend + activity heatmap (**A11**) + member leaderboard (**A9**).
11. **A7**: burndown via `$setWindowFields` cumulative remaining **over the `analytics_daily` rollups** (never raw-scan messages/cards at request time).
12. Cache 5 min with **stale-while-revalidate 30 min** under tag `ws:{id}`; a manual refresh endpoint bypasses cache (rate-limited).

**Acceptance criteria:** search respects private pages/channels; dashboards load from rollups in <100 ms with stale data served instantly; notification grouping collapses repeats; uploads never pass bytes through the API.
**Proof:** `pnpm --filter @orbit/api test -- files search notifications analytics`
**Commit:** `feat(search,notifications,analytics,files): add presigned uploads, faceted search, grouped notifications and rollup dashboards`

---

## 17. PHASE 12 — Frontend foundation: app shell, design system, layout

**Goal:** the dashboard skeleton with our own component library — no third-party visual kit.

**Build**
1. **Vite app** with path aliases, strict TS, Tailwind configured from CSS variables, `manualChunks` (vendor/editor/charts), source maps, env validation for `VITE_*`.
2. **Tokens** (`styles/tokens.css`): brand ramp, semantic colours (success/warning/danger/info), surfaces, text, borders, focus ring, **chart palette**, radii, shadows, motion durations/easings — defined for light **and** dark (`[data-theme='dark']`), plus `prefers-reduced-motion` overrides.
3. **Theme system:** `ThemeProvider` writing `data-theme` on `<html>`, an **inline pre-hydration script in `index.html`** to prevent a flash of the wrong theme, `system` mode with a live `prefers-color-scheme` listener, choice persisted in Zustand `persist`.
4. **Providers:** TanStack Query client (retry policy that skips 4xx, `staleTime 30 s`, `networkMode: 'offlineFirst'`), router, theme, toast (`sonner`), i18n, error boundaries.
5. **Layout components:** `AppShell` (header + sidebar + outlet + footer, grid with CSS variables for sidebar width), `Header` (⌘K search trigger, create menu, notification bell with popover, presence dot, theme switcher, avatar menu), `Footer` (connection status `Connected/Reconnecting/Offline · N queued`, app version + commit SHA, docs/status links, shortcut hint), `Sidebar` (nav sections, workspace switcher, collapsible groups, recents, favourites, drag-to-resize persisted, collapse to icon rail with tooltips, mobile off-canvas drawer with backdrop + focus trap, keyboard: `[` toggles, `g b`/`g c`/`g d`/`g h` jumps, `?` shortcut sheet), `PageHeader` (breadcrumbs, title, meta, actions, tabs).
6. **Routing map** with lazy routes and nested layout under `/w/:wid`: workspace home, boards index, board (Kanban), card deep-link modal, docs index, page, chat index, channel, files, search, notifications, settings (profile/sessions/appearance/notifications), workspace settings (general/members/roles/audit), analytics, admin/queues, plus `/403 /404 /500 /offline`.
7. **Design system — foundations & core (build in this order):** `ThemeProvider`, `ToastProvider`, `TooltipProvider`, `Portal`, `FocusTrap`, `VisuallyHidden`, `Icon`, `Skeleton`, `Spinner`, `Divider`, `Kbd`, `Popover`.
8. **Buttons & actions:** `Button` (`primary|secondary|outline|ghost|danger|success|link` × `xs|sm|md|lg|icon` × default/hover/active/focus-visible/**loading**/disabled — `loading` keeps width, blocks double submit), `IconButton` (requires `aria-label`), `SplitButton`, `ButtonGroup`, `CopyButton`, `Link`, `FloatingActionButton`, `ConfirmButton`, `AsyncButton` (promise → auto loading/success/error). **Rule: no raw `<button>` anywhere in the app.**
9. **Destructive family:** `DeleteButton` (never deletes directly — opens a confirm), `ConfirmDialog`, **`TypedConfirmDialog`** (type the resource name to enable), `DangerZone`, `UndoToast`, `BulkActionBar`, `LeaveGuard`. Copy rule: state the **consequence**, not "are you sure?".
10. **Forms:** `TextField`, `PasswordField` (visibility + strength), `TextareaField` (auto-grow + counter), `NumberField`, `SelectField`, `Combobox` (async, virtualized), `MultiSelect` (chips), `CheckboxField`, `RadioGroup`, `SwitchField`, `SliderField`, `DateField`, `DateRangeField`, `TimeField`, `FileDropzone` (drag/drop/paste/progress/retry/validation/preview), `FormRow`/`FormSection` (label + hint + error with `aria-describedby`).
11. **Feedback:** `Alert` (info/success/warning/danger + actions + dismissible), `Banner`, `Toast` helpers, `EmptyState`, `ErrorState` (with requestId + retry + copy details), `LoadingState` skeletons per entity, `ProgressBar`, `StatusDot`, `Badge`, `Chip`, `Tooltip`.
12. **Overlays/nav:** `Dialog`, `Drawer`/`Sheet`, `ConfirmPopover`, `DropdownMenu`, `ContextMenu`, **`CommandPalette` (⌘K: navigate, recents, create, search; grouped, fuzzy, keyboard-first)**, `Popover`, `HoverCard`, `Tabs` (URL-synced), `Breadcrumbs`.
13. **Data display:** `DataTable` (sorting, selection, virtualization >200 rows, sticky header, column visibility, CSV export, empty/loading/error slots), `Pagination`, `InfiniteList`, `KanbanColumn`, `CardTile`, `MessageBubble`, `BlockEditor`, `Avatar`/`AvatarGroup` (initials fallback, deterministic colour, presence ring), `Timeline`, `Tree`, `FilePreview`, `StatCard`, chart wrappers (`BarChart`, `LineChart`, `DonutChart`, `Heatmap`, `BurndownChart`).
14. **`/dev/components` gallery route** rendering every component in every variant/state/theme — used for the code-review walkthrough and for visual regression snapshots.
15. **Component conventions:** `forwardRef` everywhere; props extend the native element; variants instead of boolean soup; `asChild` for polymorphism; visible `:focus-visible` ring from the token; every async component exposes `loading`/`disabled`/`error`; JSDoc states the a11y contract; a `.test.tsx` next to each component (renders + keyboard path + one state variant).

**Acceptance criteria:** app shell renders on every authenticated route; sidebar collapses/resizes/drawers correctly at 360/768/1024/1440/1920; theme toggle has **zero flash** on reload; ⌘K palette opens and navigates; every component appears in `/dev/components` in both themes; `axe-core` reports no critical violations on the shell.
**Proof:** `pnpm --filter @orbit/web build && pnpm --filter @orbit/web test` + screenshot of `/dev/components`.
**Commit:** `feat(web): add app shell, design tokens and 60-component design system with destructive-action family`

---

## 18. PHASE 13 — Frontend features: boards, docs, chat, search, notifications, settings

**Goal:** every backend capability exposed through a clean, optimistic, responsive UI.

**Build**
1. **API layer** (`lib/api/`): typed client with `credentials: 'include'`, automatic **silent refresh on 401 then one retry**, request cancellation via `AbortController`, error mapping from the §Error-code catalogue to UI behaviour, and one module per resource (`boardsApi`, `cardsApi`, `pagesApi`, `chatApi`, …) generated from `packages/shared` schemas.
2. **Query key helpers** `qk.*` (`qk.ws(wid).board(id).cards(filters)`) used everywhere; **socket→cache bridge** in one file that writes incoming socket events into the query cache (`setQueriesData`) rather than a parallel store; the actor ignores its own echo via `clientMutationId`.
3. **Boards:** index grid (covers, member avatars, counts, archive toggle), Kanban with `dnd-kit` (columns + cards, drop indicators, **keyboard DnD**), optimistic card move with rollback on `409` (then offer "Reload board"), add-card composer, card modal (inline title edit, description editor, labels, assignees combobox, due date, checklist with progress ring, attachments dropzone, comments with mentions, activity timeline, watchers, archive/delete, permalink copy), filters (assignee/label/due/status), infinite scroll per column, virtualized columns.
4. **Docs:** page tree sidebar (context menu: rename/duplicate/move/delete, drag to re-parent), page view (cover + icon picker, breadcrumbs, slash-command menu, drag-handle block reorder, autosave indicator "Saved 2 s ago", conflict dialog on 409 with *Reload*/*Keep mine*), version history drawer with preview + restore, backlinks panel, favourites, trash view with restore.
5. **Chat:** channel sidebar (sections, unread bold, mention badges, muted icons), virtualized timeline with day dividers, message grouping (<5 min), hover toolbar (react/reply/thread/edit/copy link/delete), reactions with optimistic toggle, **thread side panel** with live reply counts, composer (attachments, emoji, `@` autocomplete, `/` commands, code-paste detection, Enter-to-send preference), optimistic send with `clientId` reconciliation and a Retry chip on failure, typing indicator, "jump to latest" pill, scroll anchoring when loading older messages.
6. **Search:** ⌘K palette (navigate + recents + create + search) and a full results page with type tabs, filters (workspace/board/channel/author/date), highlighted snippets, keyboard navigation, debounce 250 ms + abort previous request.
7. **Notifications:** bell popover + full centre grouped by entity/day with filters (unread/mentions/assigned), mark-read (single + all), inline actions, mute controls per channel/board.
8. **Files:** library grid/list, filter by type/entity, preview lightbox, upload progress with retry, "insert into card/page/message" flows.
9. **Analytics:** KPI `StatCard` row, cards-by-status donut, created-vs-completed line, burndown with ideal line, assignee leaderboard, activity heatmap, channel activity bars, range picker, "Refreshed 2 min ago" + manual refresh.
10. **Settings:** profile, appearance (theme/density/sidebar), notifications (mute matrix, quiet hours), **sessions** (device list + revoke + revoke all), security (change password), **danger zone** (delete account / delete workspace with typed confirmation); workspace settings: general, members table (role dropdown, remove with confirmation), roles matrix view, audit log (filters + CSV export), billing placeholder.
11. **Optimistic UI contract** — implement exactly: message send, reaction toggle, card move, card/page/channel create (`pending` skeleton then real id swap), notification read, assign/unassign, soft delete with 5 s **Undo** toast. Rules: `cancelQueries` → snapshot → `setQueryData` → rollback in `onError` → `invalidateQueries` in `onSettled`. Log a Sentry breadcrumb on every rollback.
12. **Infinite scroll:** `useInfiniteQuery` + `IntersectionObserver` sentinel with `rootMargin 400px`; prepend path preserves scroll offset; autoscroll only when already at the bottom.
13. Tests: RTL for forms (validation + submit + server error mapping), optimistic rollback test with MSW, DnD Playwright test asserting persistence after reload, chat send/receive between two browser contexts, infinite scroll loads page 2 without duplicates.

**Acceptance criteria:** every list has empty/loading/error states; every mutation is optimistic with a working rollback; DnD persists across reload; two browsers stay in sync via sockets; keyboard-only operation is possible for the primary flows.
**Proof:** `pnpm --filter @orbit/web test:e2e`
**Commit:** `feat(web): add boards, docs, chat, search, notifications, analytics and settings with optimistic ui`

---

## 19. PHASE 14 — Frontend hardening: dark mode, offline/PWA, error boundaries, a11y, performance

**Goal:** the five frontend requirements that are usually skipped — done properly and demonstrably.

**Build**
1. **Dark mode:** verify every component in both themes, contrast ≥ 4.5:1 text / 3:1 UI, no flash on load, persisted, respects `system`, and chart palettes legible in both. Add a Playwright visual snapshot suite for `/dev/components` in both themes.
2. **Error boundaries (3 levels + query-level):** app-level (fatal screen), route-level inside the shell (keyed by pathname so navigation resets it, shows the `requestId`), widget-level (one broken chart never blanks the dashboard), plus QueryClient `onError` toast mapping and `window.onerror`/`unhandledrejection` forwarding to Sentry with the last 20 breadcrumbs.
3. **Offline/PWA:** Workbox precache + `offline.html` fallback; TanStack Query persisted to IndexedDB (`persistQueryClient`, whitelisted keys, 24 h max age) so last-viewed boards/pages/channels are readable offline; runtime media cache (CacheFirst, 30 d, size-capped); **outbox in Dexie** `{id, method, url, body, entity, createdAt, retries}` drained **FIFO** on reconnect with exponential backoff and `Idempotency-Key = outbox id` so the server replays safely; a `409` on flush moves the item to a "Needs attention" list with *Keep mine* / *Discard* (never silently dropped); persistent footer status (`Offline · 3 queued`), disabled actions with tooltips, and a service-worker update prompt (`skipWaiting` + `clientsClaim` + "New version available — Reload").
4. **Accessibility:** landmarks (`header/nav/main/contentinfo`), focus trap + restore in all overlays, live regions for toasts and unread counts, labels on every control, `axe-core` check in Playwright with a **zero critical/serious violations** gate, full keyboard pass on primary flows, `prefers-reduced-motion` respected, touch targets ≥44 px.
5. **Responsiveness:** verify 360/768/1024/1440/1920 with no horizontal page scroll; kanban horizontal snap-scroll; tables become cards on mobile; chat thread panel becomes a sheet; sidebar becomes a drawer.
6. **Performance:** route-level code splitting, virtualized long lists, `useDeferredValue` for search/filter inputs, memoized `CardTile`/`MessageBubble` with stable callbacks, image `srcset` + lazy + blurred placeholders, font subsetting + preload, `content-visibility` for offscreen sections, prefetch on nav hover, bundle budget (`size-limit`) and Lighthouse thresholds (≥90 perf / ≥95 a11y) enforced in CI.

**Acceptance criteria:** a Playwright test goes offline, sends a message (queued banner appears), comes back online, and asserts the message is delivered **exactly once**; theme toggle survives reload with no flash; a deliberately thrown widget error leaves the rest of the page usable; axe gate passes; Lighthouse budgets pass.
**Proof:** `pnpm --filter @orbit/web test:e2e -- offline theme boundaries a11y`
**Commit:** `feat(web): add offline outbox, pwa, error boundaries, dark mode polish, a11y and performance budgets`

---

## 20. PHASE 15 — Testing to 60%+ (target 75%) and load testing

**Goal:** prove every graded requirement with an automated test, then prove performance with k6.

**Build**
1. Test harness: ephemeral **Mongo replica set** (`mongodb-memory-server` with replSet) + ephemeral Redis instances configured like prod; storage stub implementing the S3 interface; deterministic factories (`makeWorkspace`, `makeBoard(3 lists, 20 cards)`, `makeChannel(500 messages)`) with a fixed faker seed; helpers `authedRequest(user)`, `createTenant(role)`, `expectApiError(res, code, status)`, `untilQueueDrained()`, `until(fn)` (no `setTimeout` sleeps anywhere).
2. Must-have suites (map each to a graded requirement):
   - `rbac.matrix.spec.ts` — roles × permissions × endpoints (table-driven).
   - `transactions.spec.ts` — inject failure mid-transaction; assert **zero** partial writes (T1, T2, T4, T6).
   - `refresh-rotation.spec.ts` — rotate, reuse → family revoked, parallel refresh → one winner.
   - `cache.spec.ts` — hit/miss, tag invalidation, SWR serves stale then refreshes, **stampede: 20 concurrent misses → exactly 1 DB call**.
   - `jobs.spec.ts` — retries/backoff with fake timers, DLQ on exhaustion, repeatable idempotency.
   - `socket.spec.ts` — handshake auth, forbidden room, cross-worker delivery, `clientId` idempotency, delta-sync.
   - `search.spec.ts` — ranking order, permission filtering, facet counts, cursor stability.
   - `security/` — IDOR, privilege escalation, JWT tampering (`alg:none`, wrong secret, expired, wrong `typ`), CSRF, NoSQL injection, XSS corpus, path traversal, SSRF payloads, mass assignment, oversized payloads, rate-limit enforcement (60+ assertions).
   - `perf/index.spec.ts` — for the 8 hottest queries, assert `explain()` uses `IXSCAN` and `docsExamined` stays low.
3. Coverage: Jest thresholds per area (services ≥90%, controllers/routes ≥80%, middleware ≥85%, utils/repos ≥90%, jobs ≥75%) and a **global gate of 60% that fails CI**; upload to Codecov; badge in the README.
4. Flake policy: no `.skip` (lint-enforced), fixes over quarantine, no cross-test ordering dependencies, truncate collections between tests.
5. **k6 scenarios** in `tests/load/`: `board-read.js` (cached + uncached), `auth-flow.js`, `chat-write.js` (socket storm over 200 connections), `search.js`, `dnd-storm.js` (concurrent moves → assert **zero lost updates**, `409` rate < 1%). Thresholds that fail the run: `p(95)<200`, `p(99)<500`, `http_req_failed<0.01`, `checks>0.99`.
6. Run against `SEED_LARGE=true` (100k messages, 5k cards) and write `docs/load-test-report.md` with a table (VUs, RPS, p50/p95/p99, error rate, memory, Redis hit ratio) + Grafana screenshot.

**Acceptance criteria:** `pnpm test:all` passes locally and in CI in under ~6 minutes; coverage ≥60% (report the real number in the README); every load threshold passes and the numbers are committed; the partial-write and stampede tests exist and pass.
**Proof:** `pnpm test:all && k6 run tests/load/board-read.js`
**Commit:** `test: add rbac matrix, transaction rollback, cache stampede, socket and security suites with coverage gates`

---

## 21. PHASE 16 — DevOps, observability, CI/CD

**Goal:** one-command local stack, five green workflows, real observability.

**Build**
1. **Dockerfiles** (multi-stage, `node:20-alpine`, non-root `orbit` user, `tini` as PID 1, `--max-old-space-size`, BuildKit pnpm cache mount, `HEALTHCHECK` on `/health/ready`): `apps/api` (CMD `node dist/cluster.js`), `apps/worker` (CMD `node dist/worker.js`, no port), `apps/web` (build → `nginx:alpine` serving static with SPA fallback + immutable asset caching + `no-cache` on `index.html`/`sw.js`).
2. **Migrations:** `scripts/migrate.ts` with numbered reversible files recorded in a `migrations` collection, run as a pre-deploy step (`migrate` compose service that must complete before `api` scales up); document rollback per migration.
3. **Seeding:** `seed.ts` (3 workspaces, 12 users covering every role, 6 boards, 200 cards, 40 pages, 5 channels, 2k messages, labels, activity, notifications) + `SEED_LARGE=true` variant; `--reset` flag; deterministic.
4. **GitHub Actions (5 workflows):** `ci.yml` (install → typecheck → lint → format check → unit → integration with Mongo/Redis services → **OpenAPI drift check** → build → `size-limit` → coverage upload; then `e2e` job on the compose stack with Playwright artifacts and compose logs on failure; then a 1-minute `smoke-load` job on main), `security.yml` (`pnpm audit --audit-level=high`, Trivy image scan, gitleaks), `cd.yml` (build → scan → push to GHCR with `:sha`/`:latest` → deploy staging → smoke test → manual approval → prod), `images.yml` (matrix build with SBOM + provenance), `docs.yml` (regenerate OpenAPI, render Mermaid diagrams, publish docs to Pages, fail on diff).
5. Branch protection notes in `CONTRIBUTING.md`: required checks, no force-push, linear history.
6. **Observability stack** (compose profile): Prometheus scraping `/metrics`, Grafana with a provisioned dashboard (**4 panels minimum**: request rate/latency/errors, cache hit ratio, queue depth + failures, resource usage + event-loop lag), Loki for logs, Jaeger for traces; `alerts.yml` with the 9 alert rules; Sentry wired into API, worker and browser with release = git SHA and PII scrubbing.
7. **Runbook** (`docs/runbook.md`): procedure cards for 5xx spikes, Mongo failover, Redis eviction/OOM, queue stalling, reconnect storms, slow queries, memory leaks, disk full, DLQ growth, stuck job locks, accidental mass delete — each with symptom → cause → mitigation → fix → prevention, plus a backup/restore drill with measured **RPO 5 min / RTO 30 min**.

**Acceptance criteria:** a clean clone boots the full stack in under 5 minutes; all five workflows green on `main`; Grafana dashboard shows real traffic during the k6 run; the drift check fails when a schema changes without regenerating docs.
**Proof:** `docker compose down -v && docker compose up -d --wait` + screenshots in `docs/`.
**Commit:** `ci: add five github actions workflows, multi-stage dockerfiles, migrations, seeding and observability stack`

---

## 22. PHASE 17 — Documentation & deliverables

**Build**
1. **README.md** — badges, one-line pitch, 60-second quickstart, feature list, stack table, architecture diagram, screenshots/demo GIFs, performance numbers, "why two Redis instances", "why it's fast" table, project structure, scripts, env table, roadmap, license. Keep the README honest: it must match the code.
2. `docs/architecture.md` — system diagram (cluster + two Redis + workers + Nginx + storage), request lifecycle, socket flow, scaling notes (Mermaid + exported PNG).
3. `docs/er-diagram.md` — all 18 collections, relationships, and the index list.
4. `docs/api.md` + generated `docs/openapi.json` + Postman collection — every endpoint with request/response examples and the error catalogue.
5. `docs/adr/` — 15 ADRs (Express vs Nest, Mongo replica set, Mongoose, fractional indexing, Zustand+TanStack Query, dual Redis, Zod→OpenAPI, Socket.io, vertical modules, cursor pagination, soft delete, pino, pnpm+Turborepo, MinIO, dnd-kit) — each one page: context → options → decision → consequences.
6. `docs/security.md` (OWASP control→proof table, threat model, test evidence), `docs/performance.md` (budgets, index cheat-sheet, `explain` output, k6 numbers), `docs/scaling.md` (capacity math + growth path), `docs/troubleshooting.md` (**15 failure scenarios with the first diagnostic command**), `docs/demo-script.md` (12-minute script), `docs/load-test-report.md`, `docs/commit-convention.md`.
7. `CONTRIBUTING.md`, `CHANGELOG.md` (from commits), `LICENSE`, `.github/pull_request_template.md`, issue templates, `CODEOWNERS`, `PROGRESS.md` (phase checklist + screenshots).
8. A **3-minute screen recording** linked from the README (insurance for the live demo).

**Acceptance criteria:** every diagram renders on GitHub; every claim in the README is verifiable by a command in the README; the deliverable checklist in `PROJECT_PLAN.md` §21 is fully ticked.
**Commit:** `docs: add readme, architecture and er diagrams, adrs, api docs, runbook and demo script`

---

## 23. PER-PHASE OUTPUT FORMAT (what the agent must return every time)

```
## Phase <n> — <name>
### Files created
- path — one-line purpose
### Files changed
- path — what changed and why
### Key decisions
- decision + reason (and the alternative rejected)
### Proof commands
```bash
<exact commands>
```
### Expected output
<what I should see>
### Commit
<exact conventional commit message>
### Deviations / open questions
- none, or an explicit list with your recommendation
```

---

## 24. GLOBAL DEFINITION OF DONE (apply to every phase)

```
[ ] Code compiles with TypeScript strict; no `any`; no `@ts-ignore`
[ ] Lint + format clean; no TODOs, no console logs, no commented-out code
[ ] Layering respected (route → controller → service → repository → model)
[ ] Zod validation on every input; typed ApiError with a catalogue code
[ ] RBAC enforced (middleware + service + repository query guard)
[ ] Multi-document writes inside a transaction; side-effects (sockets/queues) AFTER commit
[ ] Index exists for every new query + a test asserting IXSCAN
[ ] Cache invalidation wired via tags where data is cached
[ ] Audit entry written for every mutation
[ ] Socket event emitted if other clients must see it live; queued job if async work exists
[ ] Unit + integration tests added; security tests for access-control changes
[ ] OpenAPI regenerated; `pnpm openapi:check` passes
[ ] UI states implemented: loading, empty, error, optimistic (where applicable)
[ ] Responsive at 360/768/1024/1440/1920; keyboard-operable; axe-clean
[ ] Docs updated (README/docs/ADR) in the same commit
[ ] Conventional commit; PROGRESS.md updated
```

---

## 25. ANTI-PATTERNS — DO NOT DO THESE

| ❌ Never | ✅ Instead |
|---|---|
| One Redis for cache + BullMQ | Two instances: `allkeys-lru` cache, `noeviction` queue |
| `skip`/`limit` pagination | Cursor pagination with an index-friendly seek |
| Integer `position` for ordering | Fractional string keys + rebalance job |
| Emitting sockets or enqueuing jobs *inside* a transaction | Emit/enqueue **after commit** |
| Registering repeatable BullMQ jobs in API workers | Register only in the worker service |
| Trusting `workspaceId` from the client | Derive it from the authenticated membership + repository guard |
| Storing refresh tokens raw | Store SHA-256 hashes; rotate; detect reuse |
| `console.log` / logging tokens or PII | Pino with redaction and request correlation |
| Business logic in controllers | Controllers call services; services own logic |
| `any`, `as any`, `@ts-ignore` | `unknown` + Zod parse, or a properly typed generic |
| 800-line God files | Split by responsibility; 300-line soft limit |
| Optimistic UI without rollback | Snapshot in `onMutate`, restore in `onError`, reconcile in `onSettled` |
| Silent `catch {}` | Log with context and rethrow or handle explicitly |
| Long-running work in a request | BullMQ job with progress and chunking |
| Unbounded `$lookup` / full-collection aggregation | `$match` first, pipeline-limited `$lookup`, rollups for dashboards |
| `docker compose` with no healthchecks | Healthchecks + `depends_on: condition: service_healthy` |
| Tests that sleep to wait | `until()` polling helpers; `QUEUE_DISABLED` in unit tests |

---

## 26. FAILURE MODES THE BUILD MUST SURVIVE (verify each once)

| # | Scenario to test manually | Expected behaviour |
|---|---|---|
| 1 | Kill a Node worker while serving traffic | Cluster respawns it; zero dropped requests |
| 2 | `SIGUSR2` the cluster primary | Rolling reload, zero dropped requests |
| 3 | Stop `redis-cache` | Reads fall back to Mongo (slower, correct); auth fails closed; APIs return 200/503 but never 500 |
| 4 | Stop `redis-queue` | Jobs buffer ≤500 then `503 JOB_BACKEND_UNAVAILABLE`; no job loss after restart (AOF) |
| 5 | Stop `mongo` primary | `/health/ready` reports unhealthy; requests fail cleanly with 503 |
| 6 | Send the same `Idempotency-Key` twice | One side-effect; the second replays the stored response |
| 7 | Present an already-used refresh token | Whole token family revoked; forced re-login |
| 8 | Move the same card from two clients at once | One wins, the other gets `409 VERSION_CONFLICT` with the current card |
| 9 | Force an order-key collision | Item still orders correctly; rebalance job enqueued + warning metric |
| 10 | Upload a `.jpg` containing a script | Rejected/quarantined by magic-byte sniffing + audit entry |
| 11 | Two browser windows, two containers | Sockets stay in sync via the Redis adapter |
| 12 | Go offline, send a message, reconnect | Queued, flushed once, delivered exactly once |
| 13 | Crash the worker mid-job | Job retried (or DLQ'd after attempts), never silently lost |
| 14 | Throw inside a deep widget component | Only that widget's error state renders; shell keeps working |
| 15 | Exhaust an API rate limit | `429` + `Retry-After`; UI shows a countdown, not a crash |

---

## 27. QUICK PROMPTS (copy-paste one at a time)

```
P0  Build Phase 0 from BUILD_PROMPT.md. Reply with files, proof commands and commit message.
P1  Build Phase 1 (docker: mongo replica set, dual redis, minio, nginx). Prove all healthchecks pass.
P2  Build Phase 2 (logger, errors, db, redis clients, cluster runtime, health, metrics).
P3  Build Phase 3 (auth: argon2id, jwt access, rotating refresh with reuse detection, sessions).
P4  Build Phase 4 (authenticate, authorize, validate, lua rate limiter, idempotency, audit, soft delete).
P5  Build Phase 5 (workspaces: transactional bootstrap T1, members, invites, roles).
P6  Build Phase 6 (boards/lists/cards + fractional index + transactional move T2 + filters).
P7  Build Phase 7 (pages: nested tree, blocks, autosave conflicts, versions, backlinks, trash).
P8  Build Phase 8 (chat: channels, messages, threads, reactions, unread, presence primitives).
P9  Build Phase 9 (socket.io gateway with jwt handshake, permissioned rooms, redis adapter).
P10 Build Phase 10 (bullmq: 9 queues, retries, DLQ, repeatable jobs, bullboard).
P11 Build Phase 11 (files presign flow, faceted search, notifications, analytics rollups).
P12 Build Phase 12 (web: app shell, tokens, 60-component design system, /dev/components).
P13 Build Phase 13 (web features: boards, docs, chat, search, notifications, settings, optimistic UI).
P14 Build Phase 14 (offline PWA + outbox, dark mode, error boundaries, a11y, performance budgets).
P15 Build Phase 15 (test suites to 60%+ coverage, index-plan tests, k6 load tests).
P16 Build Phase 16 (dockerfiles, migrations, seed, 5 CI workflows, observability, runbook).
P17 Build Phase 17 (README, architecture + ER diagrams, ADRs, API docs, runbook, demo script).
QA  Audit the repo against §24 (Global Definition of Done) and §26 (failure modes). Report gaps with file paths, then fix them.
```

**Debug prompt (when something breaks):**
```
Symptom: <paste error / screenshot / failing test>
Environment: <docker compose ps output> · requestId: <X-Request-Id>
Do: (1) state the 3 most likely causes, ranked, with the evidence for each; (2) give me the single
command that discriminates between them; (3) once I confirm, fix the smallest correct thing;
(4) add a regression test; (5) explain the systemic prevention (index, guard, alert, config).
Do not rewrite unrelated code.
```

---

## 28. FINAL SHIP CHECKLIST

```
BOOT      [ ] clean clone → cp .env.example .env → docker compose up -d → healthy in <5 min → seeded demo data
BACKEND   [ ] all endpoints in Swagger with examples   [ ] 40 primary + 24 supporting documented
          [ ] transactions proven by rollback tests    [ ] dual redis with correct eviction policies
          [ ] 9 queues + DLQ in BullBoard              [ ] cluster + SIGUSR2 rolling reload proven
          [ ] search explain shows IXSCAN              [ ] security middleware fully wired
FRONTEND  [ ] sidebar/header/footer on every authed screen   [ ] dark mode, zero flash
          [ ] 60-component library + /dev/components gallery [ ] every delete confirmed, typed for high impact
          [ ] loading/empty/error everywhere           [ ] offline read + queued writes proven by test
          [ ] responsive 360→1920, keyboard-operable, axe-clean
DEVOPS    [ ] 5 workflows green on main                [ ] coverage ≥60% with visible badge
          [ ] images + secrets scanned                 [ ] Grafana dashboard shows the k6 run
DOCS      [ ] README accurate & complete               [ ] 15 ADRs · ER + architecture diagrams
          [ ] runbook + troubleshooting                [ ] demo script + 3-min recording
GIT       [ ] 70+ conventional commits over 8+ days     [ ] PRs with templates and review comments
          [ ] no secrets, no .env, no large binaries   [ ] tags v0.1.0 → v1.0.0
REHEARSAL [ ] 12-min demo run 3× hands-off             [ ] 15 failure modes from §26 verified once

Ship it. 🚀
```
