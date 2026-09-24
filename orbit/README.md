# Orbit web client

React, TypeScript, Vite, React Router and TanStack Query.

Run from the repository root with `npm run dev` (API + web), or `npm run dev:web`
when the API is already running. Browser requests use `/api/v1`; Vite proxies
them to the API. See [the complete run guide](../Docs/RUNNING.md) and
[audit/status](../Docs/AUDIT.md) for setup, supported features and limitations.

`npm run build -w orbit` produces `orbit/dist`. A production static server needs
SPA fallback and a reverse proxy for `/api` and `/health`.
