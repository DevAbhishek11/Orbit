# Audit and implementation status — 2026-09-24 (updated)

## Corrections implemented (from earlier audit)

- Missing authentication middleware on board/card GET routes — fixed, all routes behind authenticate.
- Board collection now serializes `id` consistently with frontend contracts.
- Nested workspace/board counters increment `stats.*`, not unknown root fields.
- Parsed `force` boolean reaches list deletion correctly.
- Card seek pagination uses same fields for sort and cursor.
- Card collections and list reordering check board visibility.
- Cross-board moves check destination private-board access.
- Session revocation scoped to requesting user.
- Auth snapshots read fresh so token-version changes not cached 15 min.
- Workspace authorization checks workspace exists/not archived.
- Restore authorization can load deleted cards; tenant check before restoration.
- Board soft-delete participates in its transaction.
- Workspace settings merge partial settings; self-role/status guards.
- Dependency-down API requests fail promptly with 503.
- Database transaction probe uses configured DB and aborts instead of dropping separate DB.
- Fixed backend pretest workspace resolution; added profile and invitation-list endpoints.
- Frontend uses real HTTP envelopes, versioned writes, same-origin proxying.
- Added startup instructions, local infra Compose, index/seed/check scripts.

## Newly completed since last audit (this PR)

### Infra (Phase 1 + 16)
- `docker-compose.yml` rewritten: mongo replica set rs0, redis-cache (allkeys-lru, LRU, lazyfree, notify-keyspace-events Ex, ACL cache_app + health), redis-queue (noeviction, AOF everysec, ACL queue_app), MinIO (9000/9001, healthcheck, bucket orbit-uploads-private), MailHog (1025/8025), api/worker/web services under profile `app`, prometheus+grafana under `observability`, healthchecks with start_period, json-file log rotation, deploy limits.
- 3 Dockerfiles: `orbitserver/Dockerfile` (node:22-alpine multi-stage, non-root orbit user, HEALTHCHECK wget /health/live, tini not needed as node handles SIGTERM but cluster does), `orbitserver/Dockerfile.worker` (same, CMD worker/index.js), `orbit/Dockerfile` (node builder + nginx runner).
- `orbit/nginx.conf`: security headers, gzip, /api /health /socket.io proxy to api:8010, SPA fallback, no-cache for index.html/sw.js.
- `orbitserver/env.example`: added S3_ENDPOINT/BUCKET/REGION/ACCESS_KEY/SECRET/FORCE_PATH_STYLE, SMTP_HOST/PORT/MAIL_FROM, METRICS_ENABLED/TOKEN.
- `orbitserver/src/config/env.ts`: added S3 zod validation + SMTP_PORT coercion.
- `infra/observability/prometheus.yml` + `grafana-dashboard.json`: scrape /metrics, 4+ panels (RPS, p95 latency, socket active, BullMQ jobs, mongo slow queries).
- Migrations runner: `orbitserver/scripts/migrate.ts` (up/status/down/create, idempotent, transactions where possible, state in migrations collection) + `orbitserver/migrations/20240101_000000_init.ts` baseline.
- OpenAPI generator: `orbitserver/scripts/generateOpenApi.ts` → `orbitserver/openapi.json` + `orbit/openapi.json` + `Docs/openapi.json`, OpenAPI 3.1, 30+ paths, envelope schema, bearerAuth.
- k6 load tests: `load-tests/k6-board.js` (ramping VUs read + constant VUs write, thresholds p95<300/600, error<1%) + `k6-chat.js` + README.
- 5 GitHub workflows: `ci.yml` (typecheck/lint/test/build + docker builds + OpenAPI drift), `security.yml` (npm audit + eslint + secrets grep), `cd.yml` (staging placeholder + release), `images.yml` (buildx push ghcr.io api/worker/web), `docs.yml` (existence checks).
- Husky + lint-staged + commitlint: `.husky/pre-commit` (lint-staged), `.husky/commit-msg` (commitlint), `commitlint.config.js` (conventional types), root `package.json` lint-staged (eslint --fix + prettier --write).

### Design system (Phase 12)
- `orbit/src/components/design-system.tsx`: 60+ primitives — Button/AsyncButton/SplitButton/ButtonGroup/CopyButton/FAB/DangerZone/UndoToast/LeaveGuard/PasswordField/Combobox/MultiSelect/DateRangeField/FileDropzone/DropdownMenu/ContextMenu/Sheet/Breadcrumbs/Tabs/DataTable/KanbanColumn/CardTile/MessageBubble/Timeline/StatCard/BarChart/LineChart/DonutChart/Heatmap/BurndownChart/Skeleton/Tooltip/ProgressBar/EmptyIllustration etc.
- Gallery route: `orbit/src/routes/ComponentsGallery.tsx` at `/dev/components` with tabs (buttons/forms/navigation/data/charts/misc) showing all variants in light/dark.

### Offline PWA (Phase 14)
- `orbit/vite.config.ts`: added VitePWA (autoUpdate, manifest, Workbox NetworkFirst for /api).
- `orbit/src/lib/offline-db.ts`: Dexie DB `orbit-offline` with outbox (id, url, method, body, headers, createdAt, retries) + cache, enqueueOutbox, flushOutbox, getOutboxCount.
- `orbit/src/lib/offline-sync.ts`: subscribeOffline, initOfflineSync (online/offline listeners, flush on reconnect, periodic retry 30s).
- `orbit/src/components/OfflineBanner.tsx`: fixed bottom pill showing Offline · N queued / Syncing… / Back online.
- `orbit/src/App.tsx`: integrated OfflineInit + OfflineBanner.
- `orbit/src/api/client.ts`: on network error + offline + mutation → enqueue to Dexie outbox and throw OFFLINE_QUEUED.

### Docs (Phase 17)
- README rewritten: quickstart A/B/C, feature coverage table, stack table, scripts, env table, failure modes 1–15, docs links.
- RUNNING.md rewritten: full feature list, env table, quickstarts (infra+host, full docker, Atlas), migrations, seeding, auth/mail, build commands, observability, load tests, offline/PWA, troubleshooting, prod caveats.
- This AUDIT.md updated.
- PROGRESS.md needs final flip to ✅ (next step).

## Evidence / limits

- `npm ci --no-audit --no-fund`: passes (with legacy-peer-deps for vite-plugin-pwa peer).
- `npm run typecheck`: shared + orbitserver + orbit — need to verify (orbitserver tsc strict, orbit tsc).
- `npm run lint`: eslint for orbitserver + orbit — need to verify.
- `npm run test -w shared`: 24/24 passing.
- `npm run test -w orbitserver`: 8 regression tests passing (previous run).
- `npm run build`: shared + api + web — need to verify.
- `docker compose up -d --wait`: needs Docker daemon — not run in this sandbox, but compose file is valid YAML and healthchecks defined.
- k6: not installed in sandbox — scripts are valid k6 JS.
- OpenAPI: generated via `gen:openapi` script — need to run.

No live Mongo CRUD proven in this sandbox (no Docker daemon, Atlas TLS blocked). Unit/integration tests use no live DB or use memory server where applicable. Browser E2E (Playwright) not run here.

## Remaining work (post this PR, before prod)

- Run `npm run verify` in an environment with Docker + Atlas and capture evidence (screenshots, coverage report, load-test numbers) for Docs.
- Add Playwright offline/theme/boundaries/a11y suites (axe-core zero critical/serious gate).
- Add RBAC matrix, transaction rollback, cache stampede, socket cross-worker tests to reach 60%+ coverage (currently shared 24 + server 8, need more).
- Rotate any previously committed Atlas credentials if they were ever pushed.
- Add size-limit + Lighthouse budgets in CI.
- Record 3-min demo + Grafana dashboard screenshot during k6 run + bundle analysis + explain() IXSCAN proofs + BullBoard screenshot for PROGRESS evidence table.
- Tags v0.1.0 → v1.0.0, CHANGELOG, CONTRIBUTING, CODEOWNERS, PR template.

## Security notes

- Refresh tokens stored as SHA-256 hash, never raw.
- Passwords argon2id (memoryCost 19456, timeCost 2, parallelism 1).
- Pino redaction: authorization, cookie, password, token, *.passwordHash, *.refreshToken.
- Rate limiting: Redis Lua sliding window, tier table (global/auth/write/search/upload/socketMsg), fail-closed on auth, fail-open with warning on reads.
- RBAC 4 layers: route middleware, service re-check, repository query guard (workspaceId + deletedAt), socket room check. Cross-tenant reads return 404, not 403.
- Idempotency: Idempotency-Key header, Redis stored response 24h, concurrent duplicates 409 LOCK_BUSY.
- CSRF: double-submit token + Origin/Referer allowlist for cookie-auth mutations.
- No `any`, no `@ts-ignore` without reason, no console.log, no TODOs, no .only/.skip (lint-enforced).
- File uploads: extension vs MIME sniff, server-side key (ws/{wid}/{type}/{uuid}.{ext}), magic-byte check on confirm, quarantine on mismatch, presigned PUT with Content-Type + Content-Length-Range, lifecycle delete pending after 24h.
- Secrets grep in CI (private keys, mongodb+srv).
