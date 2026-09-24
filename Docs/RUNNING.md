# Running Orbit

## What exists today

React/Vite web client and Express/Mongoose API, in npm workspaces. Implemented screens cover authentication, workspace creation/switching, boards, lists, cards with drag/drop, card details/checklists/labels/assignees/comments/activity, members, invites and settings. These call real API endpoints, not mock data.

This is **not yet the entire product described in PROJECT_PLAN.md**. Pages/docs, chat, realtime sockets, durable queues, file uploads and notification delivery remain unimplemented. Notification preferences are saved but do not trigger delivery. Mail is a development log stub. Some existing API operations still need UI coverage (advanced board visibility/member settings, archive browsing, card search/pagination, WIP settings). Do not deploy as production-ready.

## Requirements

- Node **22.12+** (the installed Vite 8 requires a newer Node than the original plan).
- npm 10+
- MongoDB replica set (Atlas or local Docker).
- Redis for production/auth rate limiting. Two instances if queue infrastructure is enabled.

## npm + Atlas

From the repository root:

```sh
npm ci
cp orbitserver/env.example orbitserver/.env # only if .env does not already exist!
npm run build:shared
```

Edit `orbitserver/.env` privately. Set `MONGODB_URI` to your Atlas connection string, `MONGO_DB_NAME=orbit`, and replace `JWT_SECRET` with a generated random secret. Never put credentials in VITE variables: those become public JavaScript.

Atlas: verify cluster availability, database-user read/write permissions on `orbit`, DNS/SRV connectivity and Network Access for the machine running the API. A TLS reset/server-selection timeout is not proof of a wrong password or a particular whitelist issue.

```sh
npm run check-db
npm run sync-indexes
npm run seed          # optional: writes demo users/workspace/cards
npm run dev           # API :8010 and frontend :5173
```

Open http://localhost:5173. The frontend sends `/api/v1/*` and `/health/*` to its own origin. Vite proxies them to :8010. Host-only refresh cookies work through this proxy; no browser-facing localhost backend URL is needed.

For separate terminals: build shared first, then `npm run dev:server` and `npm run dev:web`. If the API port changes set `ORBIT_API_URL` on the Vite process. The dev proxy forwards the configured local Origin; this is development tooling, not an authorization boundary.

## Docker infrastructure alternative

```sh
docker compose up -d
# Wait for mongo to become healthy: docker compose ps
```

This Compose file runs **infrastructure only**, with persistent Mongo/queue volumes and loopback-bound ports. Run API and web on the host with npm. Use the local Mongo URI and Redis URLs in `orbitserver/env.example`. Mongo initializes a one-node replica set, not standalone. It has no credentials and is only suitable for local development.

```sh
npm run check-db
npm run sync-indexes
npm run seed
npm run dev
```

Stop with `docker compose down`. Do not add `-v` unless you intend to destroy local data. Full containerized application deployment is not supplied here.

## Demo accounts

After seeding: `owner@orbit.dev`, `admin@orbit.dev`, `manager@orbit.dev`, `member@orbit.dev`, `viewer@orbit.dev`. Default password: `Orbit@1234567` (override `SEED_DEMO_PASSWORD` before seeding). Existing users are reused without resetting passwords. Seed is a development helper, not an atomic migration; do not run it against production.

## Authentication and mail

Access tokens are held in memory. Refresh tokens are httpOnly host-only cookies. Reloading uses the refresh endpoint. For HTTPS deployments use `COOKIE_SECURE=true` and an exact CORS allowlist. Do not expose the dev server publicly as a production service.

Verification and password-reset links are captured in development server logs (`[mail-stub]`). The screens accept the token from those links. Development invitations also return a one-time accept token to the inviter. Sign in as the invited email before accepting. Production SMTP is **not implemented**; these flows are not production-complete.

## Build/check commands

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start                       # compiled API only
npm run preview -w orbit        # locally preview the built frontend :4173
```

For deployment serve `orbit/dist` with SPA fallback and reverse-proxy `/api` and `/health` to the API. `npm start` does not serve the frontend. Configure CORS for the deployed origin and supply environment secrets externally. Run index creation during deployment; the API does not auto-build indexes. The script creates declared indexes without dropping unrelated indexes; conflicting existing indexes require an explicit migration.

## Troubleshooting

- `/health/live` 200 proves only that the process is alive.
- `/health/ready`: inspect `dependencies.mongo` and `runtime.transactionsSupported`. Database-backed requests return 503 while disconnected.
- `MONGO_REQUIRE_TRANSACTIONS=true` makes missing transaction support a startup failure. Keep it true for real data integrity. Atlas replica sets can support transactions; the previous blanket M0 limitation in comments is not reliable.
- Missing Redis: development permits unthrottled requests and logs a warning. **Never use that mode in production.** Auth fails closed in production or when configured Redis is down.
- `QUEUE_DISABLED=false` does not implement BullMQ: the queue facade remains a stub. Keep it true.
- 409 on card edit/move means a stale version; refetch before retrying.
- 404 can mean missing membership/private resource, not only a missing record.

## Verification in the coding environment

The supplied Atlas URI was stored only in ignored `orbitserver/.env`. DNS resolved, but TLS/server selection failed; **no live database CRUD or transaction test passed**. Docker/Mongo binaries were unavailable here. Unit/HTTP tests use no live database. See AUDIT.md for the remaining validation scope.
