# Audit and implementation status — 2026-09-24

## Corrections implemented

- Missing authentication middleware on board/card GET routes.
- Board collection now serializes `id` consistently with frontend contracts.
- Nested workspace/board counters increment `stats.*`, not unknown root fields.
- Parsed `force` boolean reaches list deletion correctly.
- Card seek pagination uses the same fields for sort and cursor.
- Card collections and list reordering check board visibility.
- Cross-board moves check destination private-board access.
- Session revocation is scoped to the requesting user.
- Auth snapshots are read fresh so token-version changes are not cached for 15 minutes.
- Workspace authorization checks that the workspace still exists/is not archived.
- Restore authorization can load deleted cards; tenant check happens before restoration.
- Board soft-delete participates in its transaction.
- Workspace settings merge partial settings; self-role changes/status changes receive additional guards.
- Dependency-down API requests fail promptly with 503.
- Database transaction probe uses the configured database and aborts instead of dropping a separate database.
- Fixed backend pretest workspace resolution; added profile and invitation-list endpoints.
- Frontend uses real HTTP envelopes, versioned card writes and same-origin proxying.
- Added startup instructions, local infrastructure Compose, index/seed/check scripts.

Correction to an earlier review comment: `/lists/reorder` was already registered before `/lists/:id`; there was no demonstrated route-shadowing defect. The added comment documents the required ordering only.

## Evidence / limits

24 shared tests and 4 new backend regression tests passed. The regressions cover missing-auth guards, dependency-down envelopes, profile validation and user-scoped revocation. They are **not** database integration tests or browser end-to-end tests. Build/type/lint checks do not prove MongoDB connectivity.

Atlas DNS resolution worked, but TLS/server selection failed. IP allowlisting, network policy and cluster configuration remain possible causes. No successful database write, index build, seed or transaction was observed in this environment. Docker Compose is supplied but was not run here.

## Remaining work (not certified complete)

- Transactional/concurrent restore, reset-token consumption, seat reservations, role grants, counter races and refresh rotation need database integration/security tests.
- Compensation mode does not provide transaction-equivalent atomicity. Require transactions for real deployments.
- Deleted-card browsing and some advanced API features lack frontend controls; board views cap cards at 100/list and comments at 100. Activity pagination is not yet exposed in the modal.
- Workspace switching/deletion and multi-tab session races require browser tests; no automated UI suite yet.
- Drag/drop currently uses HTML5 (touch/keyboard support is incomplete); mobile navigation and modal focus management need accessibility work.
- SMTP, sockets, background jobs, uploads, Docs and Chat are stubs/not implemented.
- No production deployment, load test, index query-plan evidence or claimed coverage threshold.
- Some modules exceed the design document's size/layering targets.

The original README described a target architecture as if delivered. It has been replaced with an accurate entry point; PROJECT_PLAN.md and BUILD_PROMPT.md remain roadmap documents.
