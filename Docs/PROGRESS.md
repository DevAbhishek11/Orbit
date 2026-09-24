# 📋 ORBIT — Build Progress

Track every phase here. A phase is **done** only when its acceptance criteria pass and the proof commands
have been run. Update the status column in the same commit as the phase.

**Legend:** ⬜ not started · 🟨 in progress · ✅ done · ⛔ blocked

| Phase | Scope | Status | Commit | Notes |
|---|---|---|---|---|
| 0 | Monorepo bootstrap, config, shared package, env validation, husky | ⬜ | | |
| 1 | Docker: Mongo replica set, dual Redis, MinIO, Nginx, MailHog | ⬜ | | |
| 2 | Logger, errors, Mongo/Redis clients, cluster runtime, health, metrics | ⬜ | | |
| 3 | Auth: argon2id, JWT, rotating refresh, reuse detection, sessions | ⬜ | | |
| 4 | RBAC, Lua rate limiter, idempotency, validation, audit, soft delete | ⬜ | | |
| 5 | Workspaces: T1 bootstrap transaction, members, invites, roles | ⬜ | | |
| 6 | Boards/lists/cards: fractional index, T2 move, filters, activity | ⬜ | | |
| 7 | Pages: nested tree, blocks, autosave conflicts, versions, backlinks, trash | ⬜ | | |
| 8 | Chat: channels, messages, threads, reactions, unread, presence | ⬜ | | |
| 9 | Realtime: Socket.io gateway, permissioned rooms, Redis adapter | ⬜ | | |
| 10 | Queues: 9 BullMQ queues, retries, DLQ, repeatable jobs, BullBoard | ⬜ | | |
| 11 | Files (presign), search (facets), notifications (grouping), analytics | ⬜ | | |
| 12 | Web foundation: app shell, tokens, 60-component design system | ⬜ | | |
| 13 | Web features: boards, docs, chat, search, notifications, settings | ⬜ | | |
| 14 | Web hardening: offline outbox, dark mode, error boundaries, a11y, perf | ⬜ | | |
| 15 | Tests to 60%+ coverage, index-plan tests, k6 load tests | ⬜ | | |
| 16 | Dockerfiles, migrations, seed, 5 CI workflows, observability, runbook | ⬜ | | |
| 17 | Docs: README, architecture + ER diagrams, ADRs, API docs, demo script | ⬜ | | |
| QA | Audit against Definition of Done + 15 failure modes | ⬜ | | |

## Milestones

| Milestone | Target | Status |
|---|---|---|
| M1 — Stack boots (`docker compose up` → healthy) | Day 2 | ⬜ |
| M2 — Auth + RBAC + security middleware proven by tests | Day 4 | ⬜ |
| M3 — Kanban drag & drop with transactional move | Day 6 | ⬜ |
| M4 — All 40 APIs live + sockets + queues working | Day 9 | ⬜ |
| M5 — Full dashboard UI working end-to-end | Day 11 | ⬜ |
| M6 — Tests ≥60%, load-tested, docs complete, submission-ready | Day 12 | ⬜ |

## Evidence collected (for the README / demo)

| Artifact | Status | Location |
|---|---|---|
| Coverage report screenshot | ⬜ | `docs/assets/coverage.png` |
| k6 load-test results | ⬜ | `docs/load-test-report.md` |
| Grafana dashboard screenshot during load | ⬜ | `docs/assets/grafana.png` |
| Bundle analysis screenshot | ⬜ | `docs/assets/bundle.png` |
| `explain()` IXSCAN proofs | ⬜ | `docs/performance.md` |
| BullBoard queue screenshot | ⬜ | `docs/assets/bullboard.png` |
| Design system gallery (`/dev/components`) | ⬜ | `docs/assets/components.png` |
| 3-minute demo recording | ⬜ | README link |

## Blockers / decisions log

| Date | Item | Decision / status |
|---|---|---|
| | | |
