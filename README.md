# Orbit

Team workspace built with React/Vite, Express, Mongoose and Redis using npm workspaces.

- `orbit/`: frontend
- `orbitserver/`: API and database scripts
- `shared/`: permissions, envelopes, pagination and ordering

## Start here

**[Complete run guide](Docs/RUNNING.md)** — Atlas or local Docker infrastructure, npm commands, secrets, demo accounts, production caveats and troubleshooting.

**[Audit and verification status](Docs/AUDIT.md)** — fixes made, checks performed and remaining gaps.

```sh
npm ci
# Configure orbitserver/.env; see Docs/RUNNING.md
npm run build:shared
npm run check-db
npm run sync-indexes
npm run seed      # optional development data
npm run dev
```

Web: http://localhost:5173. API: http://localhost:8010. Browser requests use the web origin's proxy.

## Current scope

Auth, workspaces, members, invitations, boards, lists, cards, comments, activity and user settings have API-backed screens. Advanced operations still have UI/test gaps. Docs, Chat, realtime, file storage, durable queues and email delivery are **not implemented**. This is a development implementation, not a production-complete SaaS.

```sh
npm run verify
```

The supplied Atlas connection could not be verified from the coding environment (TLS/server-selection failure). No claim of end-to-end database success is made.

Planning documents: [Project plan](Docs/PROJECT_PLAN.md), [Build prompt](Docs/BUILD_PROMPT.md), [Progress](Docs/PROGRESS.md).
