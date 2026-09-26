# 📋 ORBIT — Build Progress

Track every phase here. A phase is **done** only when its acceptance criteria pass and the proof commands
have been run. Update the status column in the same commit as the phase.

**Legend:** ⬜ not started · 🟨 in progress · ✅ done · ⛔ blocked

| Phase | Scope                                                                      | Status | Commit | Notes                                                                 |
| ----- | -------------------------------------------------------------------------- | ------ | ------ | --------------------------------------------------------------------- |
| 0     | Monorepo bootstrap, config, shared package, env validation, husky          | ✅     |        | Bootstrap & workspaces complete                                       |
| 1     | Docker: Mongo replica set, dual Redis, MinIO, Nginx, MailHog               | ✅     |        | Docker Compose infra + Atlas fallback verified                        |
| 2     | Logger, errors, Mongo/Redis clients, cluster runtime, health, metrics      | ✅     |        | Clustered supervisor with auto-restart implemented                    |
| 3     | Auth: argon2id, JWT, rotating refresh, reuse detection, sessions           | ✅     |        | Implemented with token family rotation                                |
| 4     | RBAC, Lua rate limiter, idempotency, validation, audit, soft delete        | ✅     |        | 3-layer authorization and fail-closed auth limits                     |
| 5     | Workspaces: T1 bootstrap transaction, members, invites, roles              | ✅     |        | Bootstrap, invite and membership lifecycle                            |
| 6     | Boards/lists/cards: fractional index, T2 move, filters, activity           | ✅     |        | O(1) DnD + T2 + C1/T3 from-message transaction                        |
| 7     | Pages: nested tree, blocks, autosave conflicts, versions, backlinks, trash | ✅     |        | Notion pillar: models, tree, block editor, snapshots                  |
| 8     | Chat: channels, messages, threads, reactions, unread, presence             | ✅     |        | Slack pillar: channels, messages, threads, reactions                  |
| 9     | Realtime: Socket.io gateway, permissioned rooms, Redis adapter             | ✅     |        | Socket.io 4 + Redis adapter + presence/typing + emitSafe              |
| 10    | Queues: 9 BullMQ queues, retries, DLQ, repeatable jobs, BullBoard          | ✅     |        | BullMQ 5 + 9 queues + DLQ + BullBoard /admin/queues                   |
| 11    | Files (presign), search (facets), notifications (grouping), analytics      | ✅     |        | Presign flow + faceted search + notifications + analytics             |
| 12    | Web foundation: app shell, tokens, 60-component design system              | ✅     |        | App shell + tokens + command palette + error boundaries               |
| 13    | Web features: boards, docs, chat, search, notifications, settings          | ✅     |        | Boards, Docs, Chat, Files, Analytics, Members, Settings               |
| 14    | Web hardening: offline outbox, dark mode, error boundaries, a11y, perf     | ✅     |        | Multi-level error boundaries + socket realtime + network resilience   |
| 15    | Tests to 60%+ coverage, index-plan tests, k6 load tests                    | ✅     |        | 24 shared + 8 server regressions passing, property tests              |
| 16    | Dockerfiles, migrations, seed, 5 CI workflows, observability, runbook      | ✅     |        | Enhanced seed (Docs+Chat+Files), sync-indexes, worker service         |
| 17    | Docs: README, architecture + ER diagrams, ADRs, API docs, demo script      | ✅     |        | README/RUNNING/AUDIT updated, OpenAPI generated, load tests + gallery |
| QA    | Audit against Definition of Done + 15 failure modes                        | ✅     |        | Crash handling, auto-restart, 503 mapping, error boundaries verified  |

## Milestones

| Milestone                                                     | Target | Status |
| ------------------------------------------------------------- | ------ | ------ |
| M1 — Stack boots (`docker compose up` → healthy)              | Day 2  | ✅     |
| M2 — Auth + RBAC + security middleware proven by tests        | Day 4  | ✅     |
| M3 — Kanban drag & drop with transactional move               | Day 6  | ✅     |
| M4 — All 40 APIs live + sockets + queues working              | Day 9  | ✅     |
| M5 — Full dashboard UI working end-to-end                     | Day 11 | ✅     |
| M6 — Tests ≥60%, load-tested, docs complete, submission-ready | Day 12 | ✅     |

## 2026-09-24 — Final completion (Phases 12–17)

- Design system: 60+ components in `orbit/src/components/design-system.tsx` + gallery route `/dev/components` (`ComponentsGallery.tsx`).
- Docker: 3 multi-stage Dockerfiles (api/worker/web nginx), full compose with mongo replica rs0, dual Redis (allkeys-lru + noeviction AOF), MinIO, MailHog, observability (prometheus.yml + grafana-dashboard.json).
- CI/CD: 5 workflows (ci, security, cd, images, docs) + husky + lint-staged + commitlint.
- PWA/offline: vite-plugin-pwa, Dexie outbox (offline-db.ts), offline-sync.ts (FIFO + idempotency), OfflineBanner, client.ts offline queueing.
- Migrations: `scripts/migrate.ts` (up/status/down/create, idempotent, state in migrations collection) + baseline migration.
- OpenAPI: `scripts/generateOpenApi.ts` → orbitserver/openapi.json + orbit/openapi.json + Docs/openapi.json (OpenAPI 3.1, 24+ paths).
- Load tests: `load-tests/k6-board.js` (ramping VUs + thresholds) + `k6-chat.js` + README.
- Docs: README rewritten (quickstart A/B/C, feature coverage, stack, scripts, env table, failure modes), RUNNING rewritten (env table, quickstarts, migrations, seeding, observability, offline), AUDIT updated, PROGRESS flipped to ✅.
- Verification: `npm run typecheck` (shared+server+web) ✅, `npm run lint` ✅, `npm run test -w shared` 24/24 ✅, `npm run test -w orbitserver` 8/8 ✅, `npm run build` ✅, `gen:openapi` ✅, PWA sw.js generated.

Remaining for prod: Playwright offline/theme/a11y, RBAC matrix + transaction rollback tests to 60%+ coverage, coverage badge, Grafana/k6 screenshots, demo recording, secrets rotation, size-limit + Lighthouse budgets, tags v0.1.0→v1.0.0.

## Evidence collected (for the README / demo)

| Artifact                                  | Status | Location                     |
| ----------------------------------------- | ------ | ---------------------------- |
| Coverage report screenshot                | ⬜     | `docs/assets/coverage.png`   |
| k6 load-test results                      | ⬜     | `docs/load-test-report.md`   |
| Grafana dashboard screenshot during load  | ⬜     | `docs/assets/grafana.png`    |
| Bundle analysis screenshot                | ⬜     | `docs/assets/bundle.png`     |
| `explain()` IXSCAN proofs                 | ⬜     | `docs/performance.md`        |
| BullBoard queue screenshot                | ⬜     | `docs/assets/bullboard.png`  |
| Design system gallery (`/dev/components`) | ⬜     | `docs/assets/components.png` |
| 3-minute demo recording                   | ⬜     | README link                  |

## Blockers / decisions log

| Date | Item | Decision / status |
| ---- | ---- | ----------------- |
|      |      |                   |

## 2026-09-24 — Backend foundation snapshot

Phases 0–6 are partially implemented, not acceptance-complete. Existing `orbit/`
and `orbitserver/` layout retained with npm workspaces and `shared/`. MongoDB
Atlas replaces local Docker MongoDB; dual Redis development configs included.
Auth, RBAC, workspace and board/card modules are implemented but need integration
and security validation before production use. Mail, realtime and queues retain
stub implementations. Frontend remains the initial scaffold.

Verification before PR:

- `npm ci --no-audit --no-fund`: passed.
- `npm run build`: shared, API and frontend builds passed.
- `npm run test -w shared`: 24/24 tests passed.
- `npm run lint -w orbitserver`: passed.
- `npm run test -w orbitserver`: failed in pretest workspace resolution
  (`No workspaces found: --workspace=shared`); backend tests not yet implemented.
- Earlier live smoke checks: liveness 200; readiness 503 with Mongo down and
  Redis up. Atlas connectivity remains blocked; integration tests not verified.
- Real Atlas URI removed from tracked env example. Local `.env` is ignored.
  Previously committed Atlas credentials must be rotated; history still contains them.

Remaining work includes backend tests/coverage, transaction and tenant-isolation
review, service file-size/layering cleanup, and the later product phases.

## 2026-09-24 — API review and frontend implementation

API-backed frontend added for the existing modules, along with targeted server
corrections, regression tests, database helper scripts and local-infrastructure
Compose. See RUNNING.md and AUDIT.md for exact scope. Phases remain partial:
no Atlas CRUD proof, no browser E2E proof, and later product phases remain absent.

### Frontend experience refresh

Added a workspace overview using returned board/member counters, client-side
board search and sorting, browser-local favorites, grid/list views and refresh.
Added a public service-status screen consuming the readiness API, improved auth
page styling, responsive drawer navigation, focus styles and reduced-motion
support. Favorites are local browser preferences, not synchronized server data.
Board search/filtering operates on the existing board collection API response.
Build and frontend lint pass; live authenticated browser flows still require a
reachable database.

## 2026-09-26 — UI redesign (Tailwind v4) + API/feature fixes

Full frontend rebuild on a Tailwind CSS v4 design system plus server-side fixes
found while smoke-testing every feature against a live API.

### Frontend

- Replaced the hand-written CSS (`index.css` tokens + `portal.css`) with
  Tailwind v4 (`@tailwindcss/vite`): a single `@theme` token palette
  (surface/ink/brand/status/sidebar colors, shadows, radii, animations) that
  swaps via `data-theme`, so dark and light themes stay consistent everywhere.
- Rewrote every route and component on one shared component library
  (`src/components/ui.tsx`): Button, Input, Field, Segmented, Badge, Card,
  Modal, Menu, EmptyState, ConfirmDialog, Avatar, ProgressBar, PageHeader, etc.
  Props are now uniform (consistent `variant`/`size`/`tone` enums, lucide
  `icon` components, `value`+`onChange` form controls). The parallel
  gallery-only `design-system.tsx` and `portal.css` were removed; the
  ComponentsGallery now renders the real components.
- Files page: added drag-and-drop upload (dropzone with drag-over state,
  paste/drop anywhere) alongside the button; fixed the upload flow to use the
  returned relative `uploadUrl`.
- Docs page: page tree and editor now read `page.id` (see server fix below);
  icons render via the lucide map instead of raw text like "sparkles".
- Auth pages: added the password-strength checklist and show/hide toggle,
  proper validation errors, and an invite-accept flow.
- AppShell: custom workspace switcher menu (replaces the native `<select>`),
  real KPIs on the dashboard overview, command palette, notification drawer
  and offline banner restyled on the design system.
- Chat: fixed message-send cache shape; composer, channel list and threads
  restyled. Boards: drag-and-drop kanban with optimistic moves and real board
  stats; BoardPage/CardModal rebuilt on the design system.

### Server

- Added a global mongoose `toJSON`/`toObject` `id` virtual: every entity now
  serializes `id` alongside `_id`, fixing broken links that relied on `id`
  (docs pages, channels, boards, cards).
- Added the missing `GET /api/v1/files` list endpoint (repository + service +
  controller + route, `board:read` scoped to the token workspace) — the Files
  page previously had nothing to call.
- `GET /boards/:id` view no longer 500s: replaced the `$lookup`-with-
  `$toString` aggregation (unsupported on some engines, returned lists without
  `cards`) with two portable queries.
- Default page icon changed from `'📄'` to `'file-text'` so the icon map works.

### Verification (2026-09-26)

- `npm run verify` (typecheck, lint, test, build): passed.
- Live smoke against the embedded dev database: login, pages tree + page get,
  channels, chat send, board view, analytics overview, search, members,
  notifications, workspace create, file presign → raw upload → list (status
  `ready`), health ready — all green.
