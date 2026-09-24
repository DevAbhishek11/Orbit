# 🛰️ ORBIT — Unified Team Workspace (Mini SaaS)
## Master Engineering & Delivery Plan

> **Codename:** `Orbit` · **Repo:** `orbit-workspace` · **Tagline:** *Docs. Boards. Chat. One workspace.*
> **Assignment:** Senior Full Stack Developer Assignment — *"Build a Mini SaaS application inspired by Notion, Trello, and Slack."*

| Meta | Value |
|---|---|
| Document type | Master plan (architecture + scope + build + delivery) |
| Owner | Senior Full Stack Developer (candidate) |
| Version | 1.0 |
| Status | ✅ Ready to execute |
| Reading time | ~70 minutes (or skim §1, §4, §10, §13, §20) |

---

## 📑 Table of Contents

| # | Section | What you get |
|---|---|---|
| 1 | [Executive Summary](#1-executive-summary) | The project in 60 seconds |
| 2 | [Assignment Decoded](#2-assignment-decoded) | Every requirement → where it is satisfied |
| 3 | [Domain Research: Notion, Trello, Slack](#3-domain-research-notion-trello-slack) | What they are, what they do, what we borrow |
| 4 | [The Project Idea: Orbit](#4-the-project-idea-orbit) | Concept, personas, epics, scope control |
| 5 | [Functional Scope & Acceptance Criteria](#5-functional-scope--acceptance-criteria) | Module-by-module feature spec |
| 6 | [Architecture](#6-architecture) | Diagrams, layering, cluster setup, scaling |
| 7 | [Data Model & ER Design](#7-data-model--er-design) | Collections, indexes, transactions, aggregations |
| 8 | [Redis — Production-Grade Setup](#8-redis--production-grade-setup) | Topology, hardening, patterns, code, failure modes |
| 9 | [Background Jobs (BullMQ)](#9-background-jobs-bullmq) | Queues, workers, retries, DLQ, schedules |
| 10 | [API Catalog — 40 REST APIs](#10-api-catalog--40-rest-apis) | Full endpoint contract table + conventions |
| 11 | [Realtime Layer (Socket.io)](#11-realtime-layer-socketio) | Rooms, events, presence, scaling |
| 12 | [Frontend Architecture](#12-frontend-architecture) | React+Vite, state strategy, offline, perf |
| 13 | [Design System & UI Component Library](#13-design-system--ui-component-library) | Sidebar/Header/Footer + every component |
| 14 | [Security Blueprint](#14-security-blueprint) | OWASP mapping, JWT, RBAC, uploads |
| 15 | [Performance Engineering](#15-performance-engineering) | Budgets, techniques, load tests |
| 16 | [Observability, Logging & Metrics](#16-observability-logging--metrics) | Pino, Prometheus, health checks |
| 17 | [Testing Strategy and Coverage](#17-testing-strategy-and-coverage) | Pyramid, tools, per-module coverage |
| 18 | [DevOps & Delivery](#18-devops--delivery) | Docker, Compose, CI/CD, env matrix |
| 19 | [Git Strategy & 45-Commit Plan](#19-git-strategy--45-commit-plan) | Branching, PRs, exact commit list |
| 20 | [Milestone Timeline](#20-milestone-timeline) | 12-day plan + 5-day crunch plan |
| 21 | [Deliverables Checklist](#21-deliverables-checklist) | Mapped to the assignment line-by-line |
| 22 | [Demo Script (12 minutes)](#22-demo-script-12-minutes) | Exactly what to show |
| 23 | [Live Debugging Playbook (20% of score)](#23-live-debugging-playbook-20-of-score) | Method + 15 failure scenarios |
| 24 | [Code Review Playbook (10%)](#24-code-review-playbook-10) | How to review and be reviewed |
| 25 | [System Design Interview Prep (10%)](#25-system-design-interview-prep-10) | Scaling story, capacity math, Q&A bank |
| 26 | [Requirement Traceability Matrix](#26-requirement-traceability-matrix) | Requirement → code → demo |
| 27 | [Appendix](#27-appendix) | Env vars, scripts, folder tree, glossary |

---

## 1. Executive Summary

**Orbit** is a multi-tenant team workspace SaaS. Inside one product, a team gets the three primitives that modern knowledge work runs on:

| Pillar | Inspired by | In Orbit |
|---|---|---|
| 📄 **Docs / Wiki** | Notion | Nested pages, block editor, autosave, versions, backlinks, trash + restore |
| 🗂️ **Kanban Boards** | Trello | Boards → Columns → Cards, drag & drop reordering, labels, assignees, comments, activity |
| 💬 **Team Chat** | Slack | Channels, DMs, threads, reactions, mentions, presence, typing indicators, unread counts |

Wrapping all three: **workspaces + RBAC**, **global search**, **notifications**, **file uploads**, **audit logs**, **analytics dashboards**, and **background job processing**.

**Why this project wins the assignment:** it is *one coherent product* that legitimately requires **every** listed backend, frontend and DevOps capability — not a checklist of disconnected demos. A Kanban card move needs a **Mongo transaction + fractional indexing + socket broadcast + Redis cache invalidation + BullMQ notification fan-out + audit log**. That single interaction touches 6 graded technology areas, which makes for an excellent live-debugging and system-design story.

**Non-negotiable engineering standards for this build**

1. **Clustered runtime** — Node `cluster` primary + N workers (`WEB_CONCURRENCY`), plus horizontally scalable API containers behind Nginx.
2. **Two Redis instances** — `redis-cache` (evictable, cache/pubsub/presence) and `redis-queue` (persistent, BullMQ). Mixing them is the #1 production Redis mistake.
3. **Stateless API** — no in-process session state, so any worker can serve any request; Socket.io scales via the Redis adapter.
4. **Contract-first APIs** — Zod schemas generate OpenAPI 3.1 + validate requests + type the frontend.
5. **Everything observable** — structured logs w/ request-id, Prometheus metrics, health probes, BullMQ dashboard.
6. **Everything testable** — 75% coverage target, integration tests on real Mongo replica set + real Redis.
7. **Every destructive action safe** — soft delete → trash → hard-delete via scheduled job; typed-confirmation dialogs in UI.

---

## 2. Assignment Decoded

### 2.1 The literal brief

| Area | Requirement | Orbit's answer |
|---|---|---|
| Objective | Mini SaaS inspired by Notion, Trello, Slack | One product with Docs + Boards + Chat (§4, §5) |
| Backend | JWT auth | Access (15 min) + refresh rotation (7 d) with reuse detection (§14.2) |
| | Refresh tokens | Hashed, per-device family, revocable, `jti` denylist in Redis (§14.2) |
| | RBAC | 5 roles × resource scopes, permission matrix + middleware (§14.3) |
| | 35–40 REST APIs | **40 core endpoints** catalogued in §10 |
| | MongoDB aggregations | 12 pipelines: `$facet`, `$graphLookup`, `$lookup`, `$setWindowFields`, `$bucketAuto`, `$search` (§7.6) |
| | Transactions | 6 named multi-document transaction flows (§7.5) |
| | Redis caching | Cache-aside + versioned invalidation + SWR + Lua rate limiter (§8) |
| | BullMQ jobs | 8 queues + 1 DLQ, repeatable jobs, flows, BullBoard (§9) |
| | File uploads | Multer → S3-compatible (MinIO dev), streaming, MIME sniffing, sharp thumbnails (§14.6) |
| | Socket.io | Namespaced rooms, Redis adapter, presence, ack-based emits (§11) |
| | Audit logs | Append-only collection + actor/ip/ua/diff, indexed, TTL tiering (§5.11) |
| | Search | Mongo Atlas/text index + weighted ranking + type facets + debounce (§10.9) |
| | Security best practices | Helmet, CSP, CORS allowlist, rate limits, sanitization, argon2id (§14) |
| Frontend | React + Vite | React 18 + Vite 5 + TS strict (§12) |
| | Redux Toolkit **or** Zustand | **Zustand** (client state) + **TanStack Query** (server state) — justified in ADR-005 |
| | React Hook Form | RHF + Zod resolver, shared schemas with backend package (§12.5) |
| | Optimistic UI | Pattern + rollback contract for chat, kanban, reactions (§12.7) |
| | Drag & Drop | `dnd-kit` for columns/cards, fractional indexing on server (§7.7) |
| | Infinite scroll | Cursor pagination + `useInfiniteQuery` + IntersectionObserver (§12.8) |
| | Dark mode | Token-driven, system + manual, persisted, zero-flash (§13.2) |
| | Offline support | Service worker + IndexedDB outbox + background sync (§12.9) |
| | Error boundaries | Route-level + widget-level + query-level boundaries (§12.6) |
| DevOps | Docker | Multi-stage, distroless-ish, non-root, healthcheck (§18.1) |
| | Docker Compose | Dev (hot reload) + Prod profile, full stack incl. replica set (§18.2) |
| | GitHub Actions | 5 workflows: CI, security, CD, images, docs (§18.4) |
| | Swagger/OpenAPI | `/api/docs` generated from Zod, bearer auth, examples (§10.11) |
| | Logging | Pino JSON + correlation ids + redaction (§16.1) |
| | 60%+ test coverage | Target 75% overall, 90% on services (§17) |
| Deliverables | Source code, README, architecture diagram, ER diagram, API docs, Docker setup, 40+ commits | §19 (45 commits), §21 checklist |

### 2.2 Evaluation weights → where to spend effort

| Weight | Criterion | How Orbit scores it | Section |
|---:|---|---|---|
| 20% | **Live debugging** | Deliberate failure-mode playbook, request-id tracing, 15 rehearsed scenarios | §23 |
| 20% | **Architecture** | Layered monorepo, cluster + Redis topology, ADRs with tradeoffs, diagrams | §6, §7 |
| 15% | **Code quality** | ESLint/Prettier/strict TS, no `any`, service layer purity, DTO boundaries, naming rules | §18.5 |
| 10% | **Performance** | Budgets (p95<200 ms), indexes, cursors, caching, virtualization, k6 proof | §15 |
| 10% | **Code review** | Small PRs, PR template, self-review pass, review-comment examples | §24 |
| 10% | **System design** | Scaling to 100k users, capacity math, tradeoff Q&A bank | §25 |
| 10% | **Git history** | 45 conventional commits, logical branch flow, no "fix" noise | §19 |
| 5% | **Communication** | README, ADRs, demo script, diagrams, this document | §21, §22 |

> ⚠️ **Read this twice:** *Live Debugging* (20%) + *Code Review* (10%) + *System Design* (10%) = **40% of the grade is verbal/whiteboard work**. Build the app so you can *explain* it, not just run it. §23–§25 exist for exactly that.

---

## 3. Domain Research: Notion, Trello, Slack

### 3.1 What each product is

#### 📄 Notion — *the connected workspace*
**What it is:** A block-based document and database tool. Every piece of content — a paragraph, a heading, an image, a to-do, a table row — is a **block** with a type and properties. Blocks nest inside pages, and pages nest inside pages infinitely, so a team can build anything from a meeting note to a full wiki, CRM, or roadmap inside the same surface.

**Core mental model**
- **Page** = a block that can contain blocks (recursive tree).
- **Block** = the atomic content unit (`paragraph`, `heading`, `todo`, `code`, `image`, `table`, `embed`, `divider`, …).
- **Database** = a collection of pages whose properties are typed (select, date, person, relation, formula, rollup).
- **Views** = alternative renderings of the same data (table, board, calendar, gallery, timeline).
- **Slash command** = the universal "insert anything" interaction.

**Why teams use it:** single source of truth, replaces 4–5 tools, extremely flexible, generous free tier, strong collaboration (live cursors, comments, mentions, page history).

**Where it's weak (our opportunity):** no real-time chat, no true task workflow (no board WIP limits, no per-card drag workflow), can be slow with huge nested trees, and free-form structure becomes entropy without discipline.

**What Orbit borrows:** infinite nested page tree, slash-command block editor, autosave with version history, trash + restore, backlinks, mentions, "recent" and "favourites".

**What Orbit deliberately simplifies (scope control):** the block model is stored as a **flattened ordered array of typed blocks per page with a fractional `position`** rather than a recursive nested block forest. Same UX, vastly simpler server + sync logic, and it keeps the drag/reorder machinery identical to Kanban.

---

#### 🗂️ Trello — *the visual task board*
**What it is:** A Kanban tool built on four objects: **Board → List → Card**, plus **Members**, **Labels**, **Checklists**, **Due dates**, **Attachments** and **Activity**. Cards move between lists by drag & drop; the board is the shared state of the team's work.

**Core mental model**
- **Board** — a project/team surface.
- **List (column)** — a stage ("Backlog", "In Progress", "Done").
- **Card** — a unit of work, with description, assignees, labels, checklists, attachments, comments, activity.
- **Drag & drop** — the primary interaction; ordering inside a list *is* priority.

**Why teams use it:** zero learning curve, instantly legible status, works for content calendars, sales pipelines, hiring, sprint boards. Power-ups + automation (Butler) add workflow.

**Where it's weak:** breaks down past ~2,000 cards per board, no native docs, no chat, weak reporting, "everything looks like a card" limits richer objects.

**What Orbit borrows:** board/list/card model, drag & drop ordering, labels, assignees, checklists, per-card activity feed, archive instead of delete, filters by label/member/due date.

**The hard engineering detail Orbit adds (a strong senior signal):** card ordering uses **fractional indexing / LexoRank-style string keys** instead of integer positions. Moving a card writes **one** document (plus transaction bookkeeping) instead of renumbering every sibling — this is the difference between an O(1) and an O(n) drag, and it's a great live-debugging talking point.

---

#### 💬 Slack — *the realtime communication layer*
**What it is:** A channel-based messaging platform. Work is organised into **channels** (public/private), **DMs** (1:1) and **group DMs**, with **threads**, **reactions**, **mentions**, **files**, **presence**, **typing indicators**, **unread badges**, **search**, and deep integrations/webhooks.

**Core mental model**
- **Workspace** — tenant; holds users, channels, billing.
- **Channel / DM** — a conversation container; membership controls visibility.
- **Message** — text + attachments, may start a **thread** or reply into one.
- **Realtime presence** — who's online, typing, unread counts, live message delivery.
- **Slash commands & apps** — extensibility.

**Why teams use it:** replaces email for internal comms; searchable history; integrations; culture of async.

**Where it's weak:** information gets buried ("scroll-back fatigue"), decisions are lost in chat, notification overload, per-seat cost scales badly.

**What Orbit borrows:** channel/DM/thread model, reactions, mentions, presence + typing, unread counts, infinite scroll message history, edit/delete with tombstones, link previews, per-channel notification prefs.

**Realtime engineering detail:** Socket.io with the **Redis adapter** so a message published by worker #3 on container A reaches a socket held by worker #7 on container B — the exact problem that makes this a genuinely distributed system rather than a toy.

---

### 3.2 Benchmark: what we take, what we skip

| Capability | Notion | Trello | Slack | Orbit (MVP) | Orbit (stretch) |
|---|:--:|:--:|:--:|:--:|:--:|
| Nested pages / wiki | ✅ | ⚪ | ⚪ | ✅ | — |
| Block editor + slash menu | ✅ | ⚪ | ⚪ | ✅ (8 block types) | Full 20+ blocks |
| Version history / restore | ✅ | ⚪ | ⚪ | ✅ (last 20 versions) | Diff viewer |
| Backlinks & mentions | ✅ | ⚪ | ✅ | ✅ | Graph view |
| Board / column / card | ⚪ | ✅ | ⚪ | ✅ | — |
| Drag & drop ordering | ⚪ | ✅ | ⚪ | ✅ (fractional index) | Multi-select drag |
| Card attachments / checklists | ⚪ | ✅ | ⚪ | ✅ | — |
| Channels / DMs | ⚪ | ⚪ | ✅ | ✅ | Group DMs |
| Threads + reactions | ⚪ | ⚪ | ✅ | ✅ | Emoji picker full set |
| Presence + typing | ✅ | ⚪ | ✅ | ✅ | Custom status |
| Global search | ✅ | ✅ | ✅ | ✅ (weighted, faceted) | Atlas Search |
| Notifications | ✅ | ✅ | ✅ | ✅ (in-app + email) | Push, digests |
| Analytics dashboards | ⚪ | ✅ (paid) | ⚪ | ✅ (2 dashboards) | Custom report builder |
| Public API / webhooks | ✅ | ✅ | ✅ | ✅ (OpenAPI + 3 webhooks) | OAuth apps + marketplace |
| Realtime collaborative editing (CRDT) | ✅ | ⚪ | ⚪ | ⚪ **out of scope** | Yjs |
| Billing / subscriptions | ✅ | ✅ | ✅ | ⚪ (schema-ready only) | Stripe |

**Scope rule:** MVP column = what we build and demo. Stretch = mentioned in README "Future work" so graders see you know the boundary.

### 3.3 Positioning thesis (why this would be a real product)

Markets for docs, boards and chat are each crowded; the *unbundled* combination is the actual pain: a team pays for Notion + Trello + Slack, then manually copies links between them. Orbit's wedge: **one data model** — a card can hold a page, a page can be discussed in a channel, a channel can spawn cards from messages. Every "convert to card / discuss in channel / embed page" action is a first-class feature rather than a copy-paste.

**Object graph (the product's core idea in one line):**
`Message → create Card → link Page → notify Channel` — all inside one workspace, one permission model, one search index.

---

## 4. The Project Idea: Orbit

### 4.1 Concept

> **Orbit** — *the workspace where a conversation becomes a task, and a task becomes a document.*
> Multi-tenant SaaS. A company creates a **Workspace**, invites **Members** with **Roles**, and gets three linked surfaces: **Channels** (chat), **Boards** (tasks), **Pages** (docs) — with one search box, one notification centre and one permission model across all of it.

### 4.2 The cross-pillar features (this is the differentiator)

These six features are what make Orbit **one product** instead of three demos. Graders remember these.

| # | Feature | Flow |
|---|---|---|
| C1 | **Message → Card** | Right-click/hover a channel message → "Create card" → dialog picks board+column → card created via **transaction**, message linked (`sourceMessageId`), reply posted in thread with a permalink. |
| C2 | **Card → Page** | Card detail → "Open doc" → creates a Page, stores `pageId` on the card, renders a live preview in the card modal. |
| C3 | **Page → Channel** | Page header "Discuss" → creates/uses a channel linked by `pageId`; channel header shows the doc. |
| C4 | **Unified search** | One query returns pages, cards, messages, files grouped by type, each with permission-aware filtering + highlighted snippet. |
| C5 | **Unified notification centre** | Mentions in chat, card assignments, page mentions, due-date reminders — one feed, one unread badge, per-channel/board mute rules. |
| C6 | **Unified activity/audit** | Every entity shows "who changed what, when"; workspace admins get the full audit log with filters and CSV export. |

### 4.3 Personas

| Persona | Role | Goals | Key screens |
|---|---|---|---|
| **Aarav — Workspace Owner** | `owner` | Onboard team, control billing/security, see adoption | Admin, Audit log, Analytics, Members |
| **Neha — Project Manager** | `admin`/`manager` | Plan sprints, track progress, unblock people | Board, Analytics, Notifications |
| **Ravi — Developer** | `member` | Know what to build next, discuss, document | Card detail, Channels, Pages |
| **Zoya — Designer** | `member` | Share files, comment on cards, keep specs | Pages, Files, Card comments |
| **Client / Stakeholder** | `viewer` | Read-only visibility | Board (read), Pages (read) |
| **Ops / Support** | `superadmin` (platform) | Diagnose tenant issues | Platform admin, BullMQ board, metrics |

### 4.4 Epics (the build map)

| Epic | Name | Outcome | Endpoints | Tables |
|---|---|---|---|---|
| E1 | Identity & Access | Signup → verified → session with rotating refresh, RBAC enforced | 8 | `users`, `refreshtokens` |
| E2 | Workspaces & Membership | Multi-tenant isolation + invitations + role management | 8 | `workspaces`, `workspacemembers`, `invitations` |
| E3 | Boards (Trello) | Kanban with DnD, labels, checklists, comments, activity | 13 | `boards`, `lists`, `cards`, `labels`, `comments`, `activities` |
| E4 | Pages (Notion) | Nested wiki, block editor, autosave, versions, backlinks | 7 | `pages`, `pageversions` |
| E5 | Chat (Slack) | Channels, DMs, threads, reactions, presence, unread | 9 | `channels`, `messages`, `reactions`, `reads` |
| E6 | Files & Media | Upload, thumbnails, signed URLs, quotas | 3 | `files` |
| E7 | Search & Discovery | Unified search, facets, suggestions, recents | 2 | search indexes |
| E8 | Notifications | Fan-out, grouping, read state, email digests | 3 | `notifications` |
| E9 | Analytics & Reporting | Workspace overview + board burndown (aggregations) | 2 | (derived) |
| E10 | Admin, Audit & Ops | Audit log, job admin, health, metrics | 3 | `auditlogs` |
| E11 | Realtime | Socket.io gateway, presence, live updates | (socket events) | Redis presence |
| E12 | Cross-pillar links | C1–C6 above | embedded in above | link fields |
| **Total** | | | **40 REST + 22 socket events** | **18 collections** |

### 4.5 MVP / stretch / out-of-scope (say this out loud in the interview)

**MVP (must ship, = what's demoed):** all of §5 acceptance criteria, Docker Compose one-command boot, Swagger, 45 commits, 75% tests, dark mode, offline read + queued writes, 2 analytics dashboards.

**Stretch (only if time remains, in this priority order):**
1. Yjs/CRDT collaborative editing for pages
2. Stripe billing + plan limits (schema already includes `plan`, `seatLimit`)
3. Webhooks (3 events) + API tokens for third-party apps
4. Email digest scheduler with user preferences
5. Mobile PWA install + push notifications
6. Atlas Search fuzzy/typo-tolerant search

**Explicitly out of scope (state why):** video calls, voice, e2e encryption, SSO/SAML, marketplace apps, native mobile apps, CRDT presence cursors at char level. Mentioning what you *didn't* build is a seniority signal when paired with the reason.

---

## 5. Functional Scope & Acceptance Criteria

> Format: each module lists **Features → Acceptance criteria (AC)** written in testable Given/When/Then shorthand, because these ACs become the Playwright + Supertest test names in §17.

### 5.1 Authentication & Identity (E1)

**Features:** email+password signup, email verification, login, refresh rotation, logout (single device), logout-all, forgot/reset password, change password, session list, profile CRUD, avatar upload, account deletion (soft).

**AC**
- AC1.1 Password stored with **argon2id** (memory 19 MiB, t=2, p=1); plaintext never logged.
- AC1.2 Signup returns `201` + access token; a verification email job is enqueued in **<10 ms** (job latency, not email latency).
- AC1.3 Access token = JWT HS256/RS256, `exp 15m`, claims `{sub, wid, role, jti, typ:'access'}`; refresh = opaque 64-byte random, **SHA-256 hashed at rest**.
- AC1.4 Refresh rotates: old token marked `rotatedAt` + replaced; presenting a **already-used** refresh token revokes the whole token family and forces re-login ("reuse detection").
- AC1.5 5 failed logins per email/IP per 15 min → `429` with `Retry-After`; counter in Redis with TTL.
- AC1.6 `POST /auth/logout` adds `jti` to a Redis denylist with TTL = remaining token life.
- AC1.7 Sessions list shows device, IP, last-seen; user can revoke one or all.
- AC1.8 Timing-safe login: identical response time & message for "unknown email" and "wrong password".

### 5.2 Workspaces, Members & RBAC (E2)

**Features:** create workspace, list/switch, rename, settings (timezone, working days, logo), invite by email (with role), accept/decline invite, member list, role change, remove member, transfer ownership, leave workspace, per-workspace member directory.

**AC**
- AC2.1 Workspace creation is a **transaction**: creates `workspaces` + `workspacemembers(owner)` + default channel `#general` + default board "Getting Started" + default page "Welcome" + audit entry. If any step fails, **nothing** persists.
- AC2.2 Every tenant-scoped query is filtered by `workspaceId` and membership-checked on the server — never trust a client-sent `workspaceId`.
- AC2.3 Only `owner`/`admin` can invite, change roles, or remove members.
- AC2.4 `owner` cannot be removed or demoted except by explicit ownership transfer.
- AC2.5 Invitation links are single-use, expire in 72 h, are hashed at rest, and record `invitedBy`.
- AC2.6 Removing a member reassigns (not orphans) their cards: cards stay, `assignees` pruned, `activity` entry written.
- AC2.7 Cross-tenant access attempt returns `404` (not `403`) to avoid resource enumeration.

### 5.3 Boards / Kanban (E3) — *Trello*

**Features:** boards CRUD + archive, columns CRUD + reorder, cards CRUD + archive, drag & drop move & reorder, labels (create/assign), assignees, due dates, checklists (with % progress), comments, attachments, per-card activity feed, board filters (assignee/label/due/status), card cover colour, watch/unwatch, bulk actions.

**AC**
- AC3.1 Move card: `PATCH /cards/:id/move` body `{targetListId, beforeCardId?, afterCardId?}` → server computes a **fractional key strictly between neighbours**; one card write + source/target list counters + activity + audit + socket emit — all inside a **transaction** with `withTransaction` retry on `TransientTransactionError`.
- AC3.2 Concurrent move of the same card → second write rejected by `__v` optimistic concurrency (`409 Conflict`) and client re-syncs.
- AC3.3 Fractional key exhaustion (keys colliding below float precision) triggers a **rebalance job** that re-spreads that list's keys — surfaced in logs + metrics, never silent corruption.
- AC3.4 Ordering is stable: two clients fetching the same list get identical order, even mid-drag (server is source of truth; client uses temporary optimistic key).
- AC3.5 A column with cards cannot be hard-deleted by accident: deleting a non-empty list requires `force=true` + typed confirmation in UI; default is **archive**.
- AC3.6 Card create from chat message (C1) writes `sourceMessageId` and posts a thread reply with the card permalink.
- AC3.7 Board view loads in **<300 ms p95** for 500 cards via cursor pagination + Redis-cached board meta.
- AC3.8 Every mutation writes an `activities` doc `{entityType:'card', entityId, action, actorId, diff, at}` and a matching `auditlogs` entry for admin-relevant actions.

### 5.4 Pages / Docs (E4) — *Notion*

**Features:** nested page tree (unlimited depth), block editor (paragraph, H1–H3, bullet, numbered, todo, quote, code, divider, image, callout), slash-command insert, drag handle reorder, autosave with debounce, version snapshots (every 5 min of edits + manual), version restore, backlinks, page mentions (`@page`), favourites, trash + restore + purge, per-page permissions (workspace / private / shared-link read-only).

**AC**
- AC4.1 Page tree uses **materialized path** (`ancestors: [ObjectId]`) + parent ref; fetching a subtree is one `$graphLookup` (depth-limited).
- AC4.2 Autosave: `PATCH /pages/:id` with `If-Unmodified-Since`-style `version` field; on conflict server returns `409` with the current doc so the editor can merge or reload (never silently loses a block).
- AC4.3 Moving a page into its own descendant is rejected (`422 CycleDetected`) via path check.
- AC4.4 Version snapshot is created by a **BullMQ repeatable job** (every 5 min) that only snapshots pages with `updatedAt > lastSnapshotAt` — no wasted writes.
- AC4.5 Trash: `DELETE` sets `deletedAt`; a nightly job purges items older than 30 days (with audit entry); restore within 30 days restores the whole subtree.
- AC4.6 Backlinks computed with an inverted index maintained on page save (`mentions:` array), not a scan.
- AC4.7 Code blocks are syntax-highlighted and **sanitized** on render (DOMPurify) — no raw HTML injection path.

### 5.5 Chat (E5) — *Slack*

**Features:** channels (public/private), DMs, channel membership, message send/edit/delete, threads, reactions, mentions (`@user`, `@channel`, `@here`), file attachments, link previews, unread counts + badges, mark-as-read, typing indicators, presence, message search, pinned messages, per-channel mute/snooze, jump-to-message.

**AC**
- AC5.1 Channel message history is **cursor-paginated, newest-first internally, rendered oldest-to-newest** in a virtualized list; loading 10,000 messages never ships more than 50 at a time.
- AC5.2 Send message: optimistic bubble with `clientId` → server assigns `_id` → socket ack reconciles (`clientId` → `_id`); on failure the bubble shows "Retry" with the original text preserved.
- AC5.3 Threads: replies stored with `parentId` + `threadRootId`; channel timeline shows a "3 replies — last from Zoya" summary that live-updates.
- AC5.4 Reactions are idempotent (`$addToSet`/`$pull`) and broadcast as deltas, not full refetches.
- AC5.5 Unread count = `messagesSince(lastReadAt)` per channel, cached in Redis (`unread:{wid}:{uid}` hash), decremented/bumped on read; badge updates over socket.
- AC5.6 Presence: Redis key `presence:{wid}:{uid}` with 60 s TTL refreshed by socket heartbeat; `online`/`away`/`offline` derived, broadcast on change.
- AC5.7 Typing: ephemeral, throttled to 1 event/2 s per user per channel, auto-expires after 4 s, never persisted.
- AC5.8 Edit/delete only by author (or admin); deletes leave a tombstone ("message deleted") to keep thread structure.
- AC5.9 `@here`/`@channel` notify only online/active members and are rate-limited to prevent spam.
- AC5.10 Message content is sanitized; mentions rendered as chips linking to profiles; XSS payload test suite passes.

### 5.6 Files & Media (E6)

**AC**
- AC6.1 Upload path: client asks server → server returns **presigned PUT** (S3/MinIO) → client uploads directly → client confirms → server validates & records. API never proxies large bytes through the cluster.
- AC6.2 Limits: 25 MB/file (configurable per plan), MIME allowlist, extension must match sniffed magic bytes, image dimensions capped, SVG sanitized or rejected.
- AC6.3 Images get thumbnails (256/1024) generated by a BullMQ job (sharp) with EXIF stripped.
- AC6.4 Downloads use short-lived signed URLs (5 min); private files are permission-checked at URL issue time.
- AC6.5 Orphan files (uploaded, never attached) are swept nightly; storage usage per workspace enforced against quota.

### 5.7 Notifications (E8)

**AC**
- AC7.1 Event-driven: `mention.created`, `card.assigned`, `card.commented`, `card.due.soon`, `page.mentioned`, `member.invited`, `message.thread.reply`.
- AC7.2 Fan-out performed by BullMQ worker; recipients de-duplicated; self-notifications suppressed.
- AC7.3 Grouping: many events on the same entity within 5 min collapse into one notification with a count.
- AC7.4 Delivery: in-app (socket) always; email via queue honouring channel/board mute + user quiet hours.
- AC7.5 Read state: single, bulk, and "mark all read"; unread total cached in Redis and pushed on change.

### 5.8 Search (E7)

**AC**
- AC8.1 `GET /search?q=&types=page,card,message,file&cursor=` → grouped results with `highlight` snippet, `score`, `breadcrumb` (e.g. *Workspace → Board → Card*).
- AC8.2 Ranking: exact title match > prefix > weighted text match (`title^3, body^1`), recency tie-breaker, permission-filtered **before** ranking.
- AC8.3 p95 < 400 ms for 100k messages/workspace using a compound text index; `explain()` proves `IXSCAN` not `COLLSCAN` (documented in README).
- AC8.4 Suggestions endpoint returns recents + popular + people; command palette (⌘K) merges navigate/action/search results.
- AC8.5 Search input debounced 250 ms, requests cancelled via `AbortController`, minimum 2 chars.

### 5.9 Analytics (E9)

**AC**
- AC9.1 Workspace overview: cards by status/label/assignee, created vs completed (last 30 d), active members, channel activity heatmap.
- AC9.2 Board burndown: cumulative remaining vs ideal line, computed with `$setWindowFields` over daily rollups produced by a nightly job (never raw-scan at request time).
- AC9.3 All analytics cached 5 min in Redis with `stale-while-revalidate`; a manual "refresh" bypasses cache with a rate limit.
- AC9.4 Dashboard screenshot-able in the demo; numbers reconcile with the underlying list counts (integrity AC).

### 5.10 Realtime (E11)

**AC**
- AC10.1 Socket handshake requires a valid access token; unauthenticated sockets are rejected in the middleware with `connect_error: UNAUTHORIZED`.
- AC10.2 Room join is permission-checked server-side per room (`workspace:*`, `channel:*`, `board:*`, `page:*`, `user:*`).
- AC10.3 Cross-worker delivery proven in the demo: two browser windows, one hit through Nginx to a different Node worker, message still arrives (Redis adapter).
- AC10.4 Reconnect uses exponential backoff + jitter; on reconnect the client **re-syncs deltas** (last event id / `updatedAt` cursor) instead of full refetch.
- AC10.5 Socket writes are rate-limited (token bucket per socket) and payload size capped (64 KB).

### 5.11 Audit & Admin (E10)

**AC**
- AC11.1 Append-only `auditlogs`: `{workspaceId, actorId, action, entityType, entityId, before, after, ip, userAgent, requestId, at}`.
- AC11.2 Filters: actor, action, entity, date range, free text; CSV export streamed (not buffered in memory).
- AC11.3 Retention: 90 days hot in Mongo, older aggregated/archived; TTL index on `at` for expired retention classes.
- AC11.4 Platform admin can inspect queue depths, retry failed jobs, purge a cache namespace, and toggle a maintenance flag — all RBAC-gated and themselves audited.
- AC11.5 Health endpoints: `/health/live` (process alive), `/health/ready` (Mongo + Redis + queue reachable), `/health/startup` (migrations/indexes applied) — used by Docker + Nginx + CI.

### 5.12 Cross-cutting UX acceptance criteria

- AC12.1 **Every** destructive action requires an explicit confirmation dialog; high-impact ones (delete workspace, purge trash, remove member) require typing the resource name.
- AC12.2 Every async action has: idle → loading (button spinner + disabled) → success (toast) → failure (toast + retry + rollback of optimistic state).
- AC12.3 Every list has an **empty state** (icon + explanation + primary CTA) and an **error state** (message + retry).
- AC12.4 Full keyboard operability: `⌘K` palette, `g b` boards, `g c` chat, `g d` docs, `Esc` closes overlays, focus is trapped in modals and restored on close.
- AC12.5 Responsive at 360 / 768 / 1024 / 1440 / 1920 px: sidebar → icon rail → drawer; kanban scrolls horizontally; tables become cards on mobile.
- AC12.6 Dark/light/system themes with no flash of wrong theme on load (theme applied in an inline pre-hydration script).
- AC12.7 Offline: last-viewed screens readable, sends queued in IndexedDB outbox, "You're offline" banner shown, auto-flush with ordering guarantee on reconnect.
- AC12.8 All interactive elements have visible focus rings and ARIA labels; colour contrast ≥ 4.5:1 in both themes; axe-core CI check passes with 0 critical violations.

---

## 6. Architecture

### 6.1 System context (ASCII — renders everywhere)

```
                                   ┌──────────────────────────────────────┐
        ┌──────────────┐           │            EDGE / LE       (Nginx)    │
        │  Browser     │  HTTPS    │  TLS · gzip/brotli · rate-limit ·     │
        │  (React SPA) │──────────▶│  security headers · static assets ·   │
        │  PWA + SW    │   WSS     │  upstream least_conn · sticky (ip_hash)│
        └──────┬───────┘           └───────┬──────────────────────┬────────┘
               │                           │                      │
               │  /api/*                   │ /api/*               │ /socket.io
               ▼                           ▼                      ▼
   ┌───────────────────────────────────────────────────────────────────────────┐
   │                      API CLUSTER  (Docker service: api)                    │
   │                                                                            │
   │   ┌──────────────────── Container #1 ────────────────────┐                 │
   │   │ Node PRIMARY (cluster.isPrimary, pid 1)              │                 │
   │   │  • forks WEB_CONCURRENCY workers (= vCPU count)      │                 │
   │   │  • zero-downtime rolling restart (SIGTERM → respawn) │                 │
   │   │  • aggregates health · supervises, never serves HTTP │                 │
   │   │      ├── worker 1 ─┐                                 │                 │
   │   │      ├── worker 2 ─┼─▶ Express app (identical,        │                 │
   │   │      ├── worker 3 ─┤    stateless, SO_REUSEPORT-     │                 │
   │   │      └── worker N ─┘    shared port 4000)            │                 │
   │   └──────────────────────────────────────────────────────┘                 │
   │   ┌──────────────────── Container #2 … #N (identical) ───┐  ◀── HPA /    │
   │   └───────────────────────────────────────────────────────┘      compose scale
   └───────┬─────────────────┬──────────────────┬──────────────────┬──────────┘
           │                 │                  │                  │
           ▼                 ▼                  ▼                  ▼
   ┌───────────────┐  ┌─────────────┐   ┌──────────────┐   ┌────────────────┐
   │ MongoDB 7     │  │ redis-cache │   │ redis-queue  │   │ Object Storage │
   │ Replica Set   │  │ (LRU evict) │   │ (noeviction) │   │ S3 / MinIO     │
   │ rs0: 1P+2S    │  │ cache·pubsub│   │ BullMQ only  │   │ presigned URLs │
   │ transactions  │  │ presence    │   │ persistent   │   └────────────────┘
   └───────┬───────┘  └─────────────┘   └──────┬───────┘
           │                                    │ BRPOPLPUSH / blocking
           │                                    ▼
           │                    ┌──────────────────────────────────────┐
           │                    │  WORKER CLUSTER (Docker service: worker)│
           └────────────────────│  BullMQ consumers, own Node cluster      │
                                │  email · notify · search-index · files   │
                                │  analytics-rollup · cleanup · webhooks   │
                                └──────────────────────────────────────┘
                                ┌──────────────────────────────────────┐
                                │  OBSERVABILITY: Pino → Loki/S3 ·       │
                                │  Prometheus /metrics · Grafana · Sentry│
                                └──────────────────────────────────────┘
```

### 6.2 Why **two** Redis instances (say this in the interview)

| | `redis-cache` | `redis-queue` |
|---|---|---|
| Purpose | Cache, rate-limit counters, presence, pub/sub, socket adapter, idempotency keys | BullMQ job data, scheduler keys, job locks |
| `maxmemory-policy` | `allkeys-lru` (evict anything — it's reproducible) | **`noeviction`** (evicting a job = data loss / stuck workers) |
| Persistence | RDB snapshots only (`save 900 1`), AOF off | **AOF `everysec` + RDB** — must survive restart |
| Loss tolerance | Total loss acceptable (cold cache) | Zero loss; jobs must be recoverable |
| Sizing | 1–4 GB, grows with traffic | ~512 MB–1 GB (job payloads are small; large files live in S3) |

> ❌ **Anti-pattern:** one Redis for both. Under memory pressure `allkeys-lru` will silently evict BullMQ keys → jobs vanish, workers hang, and it looks like an application bug. This exact failure is rehearsed in §23 (Scenario 6).

### 6.3 Request lifecycle (the pipeline every request walks)

```
1  Nginx ── TLS, brotli, per-IP limit_req, proxy_pass upstream api
2  Node cluster worker accepts on shared :4000
3  requestContext middleware   → req.id (uuid v7), AsyncLocalStorage store
4  helmet + cors + body parser (json 1mb, urlencoded) + compression
5  pino-http                   → access log {method, path, status, dur, reqId, userId}
6  global rate limiter         → Redis Lua sliding window (100 req/min/IP, burst 20)
7  cookie/header token parse   → attach req.auth (no DB hit; JWT verify only)
8  authenticate (if protected) → verify JWT → check jti denylist (Redis) → req.user
9  authorize(permission)       → RBAC matrix check (+ workspace membership from Redis cache)
10 validate(zodSchema)         → body/query/params → typed, sanitized DTO
11 idempotency guard (mutating POSTs) → replay cached response if Idempotency-Key repeats
12 ROUTE HANDLER → thin: (req,res) => service call with DTO
13    SERVICE               → business rules, transactions, cache, events, jobs
14      REPOSITORY          → Mongoose queries, projections, cursor pagination
15      CACHE layer         → get-or-set with versioned keys + SWR
16      EVENT layer         → socket.io emit via Redis adapter + BullMQ enqueue
17    Audit service        → async append (never blocks the response path)
18 RESPONSE serialize ↔ response envelope {success, data, meta} | {success:false, error}
19 error middleware       → maps ApiError → status + code; unknown → 500 + Sentry + reqId
20 metrics middleware     → http_request_duration_seconds{route,method,status}
```

**Guardrails**
- Controllers contain **no business logic** and **no Mongoose calls** (lint rule + code review gate).
- Services never touch `req`/`res` — they take DTOs and return domain objects (this is what makes them unit-testable without HTTP).
- Repositories are the only place with Mongoose knowledge → swapping to a read replica later is a one-file change.

### 6.4 Monorepo layout

```
orbit-workspace/
├── apps/
│   ├── api/                      # Express + TS (cluster runtime)
│   │   ├── src/
│   │   │   ├── cluster.ts        # PRIMARY: fork workers, supervise, rolling restart
│   │   │   ├── server.ts         # WORKER: http + express + socket.io bootstrap
│   │   │   ├── app.ts            # express app factory (no listen → testable)
│   │   │   ├── config/           # env.ts (zod-validated), constants, permissions
│   │   │   ├── modules/          # ★ feature-sliced vertical modules
│   │   │   │   ├── auth/          { auth.routes.ts, auth.controller.ts, auth.service.ts,
│   │   │   │   │                    auth.repository.ts, auth.schema.ts, auth.test.ts }
│   │   │   │   ├── users/  workspaces/  boards/  cards/  pages/  channels/
│   │   │   │   ├── messages/  files/  search/  notifications/  analytics/
│   │   │   │   └── audit/  admin/  health/
│   │   │   ├── middleware/       # authenticate, authorize, validate, rateLimit,
│   │   │   │                     # idempotency, errorHandler, notFound, requestContext
│   │   │   ├── infrastructure/   # db (mongoose), redis (cache|queue clients), queue,
│   │   │   │                     # socket, storage(s3), mailer, cache, lock, logger, metrics
│   │   │   ├── shared/           # ApiError, envelope, cursor helpers, fractionalIndex,
│   │   │   │                     # permissions matrix, pagination, dates
│   │   │   └── jobs/             # processors + scheduler registration
│   │   ├── tests/                # unit · integration · e2e · fixtures · load
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── web/                      # React 18 + Vite + TS (dashboard UI)
│   │   ├── src/
│   │   │   ├── app/              # router, providers, ErrorBoundary, query client
│   │   │   ├── components/ui/    # ★ design system (see §13)
│   │   │   ├── components/layout/ # AppShell, Sidebar, Header, Footer, PageHeader
│   │   │   ├── features/         # auth, workspaces, boards, pages, chat, files,
│   │   │   │                     # search, notifications, analytics, admin, settings
│   │   │   ├── hooks/  lib/  stores/  styles/  types/  locales/
│   │   ├── public/ (manifest.json, sw.js, icons/, offline.html)
│   │   └── Dockerfile · nginx.conf (SPA fallback)
│   │
│   └── worker/                   # BullMQ consumers (separate cluster + scaling unit)
├── packages/
│   ├── shared/                   # zod schemas, TS types, constants, permission matrix
│   ├── ui/                       # (optional) extracted design system if reused
│   └── config/                   # eslint, tsconfig, prettier, tailwind presets
├── infra/
│   ├── docker/ (compose.dev.yml, compose.prod.yml, mongo-init.js, redis-cache.conf,
│   │            redis-queue.conf, nginx.conf)
│   ├── observability/ (prometheus.yml, grafana dashboards, loki)
│   └── k8s/ (optional manifests — shows horizontal thinking)
├── docs/  (architecture.md + mermaid, er-diagram.md, ADRs, api.md, runbook.md,
│          troubleshooting.md, load-test-report.md)
├── .github/workflows/ (ci.yml, security.yml, cd.yml, images.yml, docs.yml)
├── docker-compose.yml            # one-command boot: mongo-rs · redis x2 · api · worker · web
├── turbo.json · pnpm-workspace.yaml · .env.example · README.md
```

**Why vertical modules, not horizontal folders:** everything for "cards" lives in one directory. A reviewer asking "where is the card move logic?" gets one path. It also makes the repo trivially extensible and keeps PRs small (great for the *Code Review* 10%).

### 6.5 Clustered server runtime (the setup you asked for)

**Goal:** use every vCPU, survive worker crashes, restart with **zero dropped requests**, and scale out by adding containers — with **no sticky-session requirement** except for the raw WebSocket upgrade.

```ts
// apps/api/src/cluster.ts  — PRIMARY PROCESS
import cluster from 'node:cluster';
import os from 'node:os';
import process from 'node:process';
import { logger } from './infrastructure/logger';

const WORKERS = Number(process.env.WEB_CONCURRENCY) || os.availableParallelism();
const SHUTDOWN_GRACE_MS = 15_000;

if (cluster.isPrimary) {
  logger.info({ workers: WORKERS, pid: process.pid }, 'primary: forking workers');

  const bootTime = Date.now();
  let shuttingDown = false;

  const fork = (i: number) => {
    const w = cluster.fork({ WORKER_INDEX: String(i) });
    w.on('message', (msg: any) => {
      if (msg?.type === 'ready') {
        logger.info({ worker: w.process.pid, bootMs: Date.now() - bootTime }, 'worker ready');
      }
    });
    return w;
  };

  // 1) fork all workers but stagger starts so DB/Redis pools warm up gently
  for (let i = 0; i < WORKERS; i++) setTimeout(() => fork(i), i * 750);

  // 2) crash resilience: exponential backoff to avoid crash-loops melting the DB
  const crashes = new Map<number, { count: number; lastAt: number }>();
  cluster.on('exit', (worker, code, signal) => {
    if (shuttingDown) return;
    const rec = crashes.get(worker.id) ?? { count: 0, lastAt: 0 };
    rec.count = Date.now() - rec.lastAt < 60_000 ? rec.count + 1 : 1;
    rec.lastAt = Date.now();
    crashes.set(worker.id, rec);
    const delay = Math.min(2 ** rec.count * 250, 30_000);
    logger.error({ pid: worker.process.pid, code, signal, restartInMs: delay },
      'worker exited — restarting');
    if (rec.count > 10) {
      logger.fatal('crash loop detected — exiting primary so the orchestrator restarts it');
      process.exit(1);
    }
    setTimeout(() => fork(worker.id), delay);
  });

  // 3) ZERO-DOWNTIME rolling reload (on SIGUSR2 or config change)
  async function rollingReload() {
    const ids = Object.keys(cluster.workers!) as unknown as number[];
    for (const id of ids) {
      const w = cluster.workers![id];
      if (!w) continue;
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => { w.process.kill('SIGKILL'); resolve(); }, SHUTDOWN_GRACE_MS);
        w.on('exit', () => { clearTimeout(t); resolve(); });
        w.send({ type: 'graceful-shutdown' });       // worker drains, stops accepting
      });
      fork(id);
      await new Promise((r) => setTimeout(r, 500));  // stagger
    }
  }
  process.on('SIGUSR2', () => void rollingReload());

  // 4) orchestrated shutdown (docker stop / k8s preStop)
  const shutdown = async () => {
    shuttingDown = true;
    logger.warn('primary: draining all workers');
    await Promise.all(Object.values(cluster.workers!).map((w) =>
      new Promise<void>((res) => {
        const t = setTimeout(() => { w?.kill('SIGKILL'); res(); }, SHUTDOWN_GRACE_MS);
        w?.once('exit', () => { clearTimeout(t); res(); });
        w?.send({ type: 'graceful-shutdown' });
      })));
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  // WORKER: run the actual HTTP server + socket.io
  require('./server');
}
```

```ts
// apps/api/src/server.ts  — WORKER PROCESS (abridged but complete in spirit)
const server = http.createServer(app);
const io = new Server(server, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  adapter: createAdapter(redisPub, redisSub),   // @socket.io/redis-adapter
  pingInterval: 25_000,
  pingTimeout: 20_000,
  maxHttpBufferSize: 64 * 1024,
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000 },
});
await connectMongo(); await connectRedis(); await ensureIndexes();
server.listen(PORT, '0.0.0.0', () => process.send?.({ type: 'ready' }));

// GRACEFUL SHUTDOWN: stop accepting → drain in-flight → close sockets → close pools
async function shutdown(signal: string) {
  logger.warn({ signal }, 'worker draining');
  server.close(() => logger.info('http closed'));
  io.close(() => logger.info('io closed'));
  setTimeout(() => { // hard deadline
    void Promise.allSettled([mongoose.disconnect(), redisCache.quit(), redisQueue.quit()])
      .then(() => process.exit(0));
  }, SHUTDOWN_GRACE_MS).unref();
}
process.on('message', (m: any) => { if (m?.type === 'graceful-shutdown') void shutdown('primary'); });
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (e) => { logger.fatal({ e }, 'unhandledRejection'); void shutdown('unhandledRejection'); });
process.on('uncaughtException',  (e) => { logger.fatal({ e }, 'uncaughtException');  process.exit(1); });
```

**Cluster decision table**

| Concern | Decision | Reason |
|---|---|---|
| In-container parallelism | Node `cluster` module | Free multi-core utilization; no extra deps |
| Cross-container scaling | Nginx `least_conn` upstream + `docker compose up --scale api=3` / HPA | Horizontal scale without code change |
| Socket.io across workers | `@socket.io/redis-adapter` | Removes need for sticky sessions for pub/sub *(still add `ip_hash` for the WebSocket upgrade path)* |
| Shared state | None in-process; Redis for cache/locks/presence | Statelessness = any worker serves any request |
| Health during rollout | `/health/startup` gate → `/health/ready` → LB | Prevents traffic to a cold/warming worker |
| Memory safety | `--max-old-space-size` per worker + `NODE_OPTIONS` | Prevents container OOM-kill of the whole box |
| Cron/repeatable jobs | **Only in the `worker` service**, never in API workers | Otherwise N workers each fire the job N times |

> **Interview-ready line:** *"We cluster inside the container for CPU utilization and scale containers horizontally for throughput. Because state lives in Redis and Mongo, the API is stateless, so scaling is a matter of adding Nginx upstreams. The only sticky-session requirement is the WebSocket upgrade, which we handle with `ip_hash` on Nginx while pub/sub still works across all workers via the Redis adapter."*

### 6.6 Architecture Decision Records (ADRs)

> Keep these in `docs/adr/ADR-00X-*.md`. Each is 1 page: context → options → decision → consequences. Graders love ADRs because they prove you *chose* rather than *defaulted*. Summarised here:

| ADR | Decision | Options considered | Rationale | Cost accepted |
|---|---|---|---|---|
| 001 | **Express 5 + TS** over NestJS | Express, NestJS, Fastify | Fastest to a clean layered design; explicit middleware chain is easier to defend live; huge ecosystem. Nest's DI would add ceremony without graded benefit. | Manual DI container (a tiny `container.ts`) |
| 002 | **MongoDB replica set** (not standalone) | Standalone mongo, Postgres | Assignment mandates Mongo aggregations; **transactions require a replica set** — so Compose boots `rs0` with `replicaSet` + `directConnection=false`. | Slightly heavier dev stack |
| 003 | **Mongoose** as ODM (with raw driver for heavy aggregations) | Native driver only, Prisma | Schema validation, indexes, middleware for soft-delete & audit hooks; drop to `.aggregate()` for reporting pipelines. | Must be careful with `lean()`/types |
| 004 | **Fractional indexing** for ordering | Integer `position`, linked list, LexoRank vendor | O(1) drag writes; no sibling renumbering; works identically for cards, lists, blocks. | Periodic rebalance job |
| 005 | **Zustand + TanStack Query** over RTK | Redux Toolkit, Redux+RTK Query, Zustand | Assignment allows either. Split: server state → TanStack Query (caching, retries, optimistic mutations, infinite scroll out of the box); UI/session/socket/theme state → Zustand (tiny, no boilerplate). Far less code than RTK for the same result. | Two mental models documented in §12.2 |
| 006 | **Two Redis instances** | One shared Redis | BullMQ requires `noeviction`; cache wants LRU. Mixing risks silent job loss. | One more container |
| 007 | **Zod → OpenAPI** (single source of truth) | Hand-written swagger.yaml, decorators | One schema validates requests, types the service, generates docs **and** is shared with the frontend via `packages/shared`. Docs can't drift. | Slight schema-authorship discipline |
| 008 | **Socket.io** (with Redis adapter) | raw `ws`, SSE, polling | Assignment mandates Socket.io; rooms + acks + auto-reconnect + adapter = the exact Slack-like feature set. | Larger payload than raw ws |
| 009 | **Vertical feature modules** | Layered global folders | Locality, small PRs, easier review & debugging | Duplication risk handled by `shared/` |
| 010 | **Cursor pagination everywhere** | `skip/limit` | Stable under writes, index-friendly, O(1) deep paging; enables infinite scroll | No random-access page numbers |
| 011 | **Soft delete + trash** | Hard delete | Recoverability, audit compliance, "undo" UX | Jobs to purge; every query must filter `deletedAt: null` (enforced by a base repository) |
| 012 | **pino** structured logs + request-id | winston/morgan | Speed (fastest JSON logger), native redaction, log-level sampling, plays well with Loki | - |
| 013 | **pnpm workspaces + Turborepo** | npm workspaces, Nx | Fast installs, hard linking, shared `packages/shared`, cached pipelines | - |
| 014 | **MinIO (S3 API) in dev** | Local disk, Cloudinary | Same code path as prod S3; presigned uploads work offline in Docker | Extra container |
| 015 | **dnd-kit** | react-beautiful-dnd (deprecated), HTML5 DnD | Actively maintained, accessible (keyboard DnD!), touch support, small | Learning curve |

### 6.7 Environments & configuration

| Env | Mongo | Redis | Storage | API runtime | Purpose |
|---|---|---|---|---|---|
| `development` | Docker `mongo:7` single node (still `rs0` for tx) | cache + queue containers | MinIO | `tsx watch`, `cluster` **off** (single worker, fast reload) | Local dev |
| `test` | `mongodb-memory-server` replica set | `ioredis-mock` or ephemeral container | in-memory fake | Jest/Vitest, cluster off | CI tests |
| `staging` | Managed Mongo (Atlas M0/M10) | managed Redis or container | S3 bucket | 2 api containers × 2 workers | Pre-prod smoke + load test |
| `production` | Atlas M10+ / self-hosted RS (3 nodes) | 2 Redis (Sentinel or managed) | S3 | ≥3 containers × vCPU workers, autoscaled | Live |

**Config rule:** `config/env.ts` validates `process.env` with Zod **at boot**; the app refuses to start on a missing/invalid var (fail fast, never `undefined` at 2 a.m.). `.env.example` is the contract and is checked in CI.

---

## 7. Data Model & ER Design

### 7.1 Design principles

1. **Every tenant document carries `workspaceId`** — the partitioning key for every query and every index prefix.
2. **Embed what you always read together; reference what grows unboundedly.** (e.g. `card.labels` = compact array of label subdocs; `card.comments` = separate collection.)
3. **Ordering via fractional keys** (`order: "a0G39"`), never integer positions.
4. **Soft delete** (`deletedAt`) + `archivedAt` where relevant; base repository injects `deletedAt: null` automatically.
5. **Denormalized counters** (`messageCount`, `cardCount`, `memberCount`) maintained in the same transaction, plus a nightly **reconciliation job** that re-derives and logs drift (a real production practice).
6. **Optimistic concurrency** via `__v` (Mongoose `optimisticConcurrency: true`).
7. **Timestamps** every document (`createdAt`, `updatedAt`); `at`/`when` for event-like docs.
8. **No unbounded arrays** — reactions and reads are capped/bound, and any array expected to exceed ~1000 elements is a separate collection.

### 7.2 ER diagram (mirror this into `docs/er-diagram.md` as Mermaid for GitHub)

```
 users ─┬─< workspacemembers >─┬─ workspaces ─┬─< boards ─┬─< lists ─┬─< cards ─┬─< comments
        │                       │              │           │          │         ├─< activities
        │                       │              │           │          │         ├── checklists[] (embedded)
        │                       │              │           │          │         └── labels[] (embedded)
        │                       │              │           │          └── pageId ──▶ pages
        │                       │              │           └── (list.order: fractional)
        │                       │              ├─< pages (self-ref: parentId + ancestors[])
        │                       │              │      └─< pageversions
        │                       │              ├─< channels ─┬─< messages (self-ref: threadRootId/parentId)
        │                       │              │             ├─< reactions (embedded in message)
        │                       │              
        │                       │              │             └─< channelreads
        │                       │              ├─< files
        │                       │              ├─< notifications
        │                       │              ├─< invitations
        │                       │              ├─< auditlogs
        │                       │              └─< analyticsdaily (rollup)
        └─< refreshtokens

 Legends: ─< = one-to-many   ──▶ = reference   [] = embedded document
```

```mermaid
erDiagram
  USERS ||--o{ WORKSPACEMEMBERS : "is"
  WORKSPACES ||--o{ WORKSPACEMEMBERS : "has"
  USERS ||--o{ REFRESHTOKENS : "owns"
  WORKSPACES ||--o{ BOARDS : contains
  WORKSPACES ||--o{ PAGES : contains
  WORKSPACES ||--o{ CHANNELS : contains
  WORKSPACES ||--o{ FILES : owns
  WORKSPACES ||--o{ AUDITLOGS : logs
  BOARDS ||--o{ LISTS : contains
  LISTS ||--o{ CARDS : contains
  CARDS ||--o{ COMMENTS : has
  CARDS ||--o{ ACTIVITIES : logs
  CARDS }o--|| PAGES : "optional doc"
  PAGES ||--o{ PAGES : "parent/child"
  PAGES ||--o{ PAGEVERSIONS : snapshots
  CHANNELS ||--o{ MESSAGES : contains
  MESSAGES ||--o{ MESSAGES : "thread replies"
  MESSAGES ||--o{ CHANNELREADS : "read by"
  USERS ||--o{ NOTIFICATIONS : receives
  WORKSPACES ||--o{ INVITATIONS : issues
```

### 7.3 Collection reference (18 collections)

#### `users`
```ts
{
  _id, email (unique, lowercased, indexed), emailVerifiedAt?, 
  passwordHash (argon2id, select:false),
  name, handle (unique per workspace namespace, indexed),
  avatarFileId?, timezone: 'Asia/Kolkata', locale: 'en',
  status: 'active'|'suspended'|'deleted',
  lastSeenAt, preferences: { theme:'system'|'light'|'dark', notifications:{ email:bool, desktop:bool, quietHours:{from,to} } },
  failedLoginCount, lockedUntil?,
  createdAt, updatedAt, deletedAt?
}
// Indexes: {email:1} unique partial(deletedAt null) · {handle:1} · text{name,email}
```

#### `workspaces`
```ts
{
  _id, name, slug (unique, indexed), logoFileId?, description?,
  ownerId (ref users), plan:'free'|'pro'|'enterprise', seatLimit, storageQuotaBytes,
  settings: { timezone, weekStart:'monday', allowGuestInvites:bool, defaultRole:'member' },
  stats: { memberCount, boardCount, pageCount, channelCount, cardCount },   // denormalized
  createdAt, updatedAt, archivedAt?, deletedAt?
}
// Indexes: {slug:1} unique · {ownerId:1} · {deletedAt:1, updatedAt:-1}
```

#### `workspacemembers` (the join + permission table)
```ts
{ _id, workspaceId, userId, role:'owner'|'admin'|'manager'|'member'|'viewer',
  status:'active'|'invited'|'suspended', invitedBy?, joinedAt, lastActiveAt,
  notificationPrefs: { mutedChannelIds:[], mutedBoardIds:[] } }
// Indexes: {workspaceId:1,userId:1} unique · {userId:1,status:1} (my workspaces list)
```

#### `boards` / `lists` / `cards` (Trello layer)
```ts
boards: { _id, workspaceId, name, description?, visibility:'workspace'|'private',
          background: 'color-1', memberIds:[], createdBy, archivedAt?, deletedAt?, createdAt, updatedAt }
// Indexes: {workspaceId:1, archivedAt:1, updatedAt:-1} · text{name,description}

lists:  { _id, workspaceId, boardId, name, order: 'a0G39', color?, wipLimit?,
          cardCount, archivedAt?, deletedAt?, createdAt, updatedAt }
// Indexes: {boardId:1, order:1} · {boardId:1, archivedAt:1}

cards:  { _id, workspaceId, boardId, listId, title, description? (blocks/rich text),
          order: 'a0G4',                       // fractional key — the DnD engine
          labels: [{ _id, name, color }],      // embedded: small, always read with card
          assignees: [ObjectId], dueAt?, startAt?, completedAt?,
          priority:'low'|'medium'|'high'|'urgent',
          checklist: [{ _id, text, done, order }],   // embedded (bounded, always visible)
          coverColor?, coverFileId?,
          attachments: [{ fileId, name, size, mime }], // embedded refs (bounded)
          commentCount, attachmentCount, checklistProgress, watcherIds: [ObjectId],
          sourceMessageId?, pageId?, coverImageUrl?,
          archivedAt?, deletedAt?, createdBy, createdAt, updatedAt, __v
        }
// Indexes: {listId:1, order:1} (board render) · {boardId:1, archivedAt:1, dueAt:1}
//          {workspaceId:1, assignees:1, completedAt:1} (my tasks) · text{title,description}
//          {dueAt:1} partial(completedAt null) for reminders · {sourceMessageId:1} sparse
```

#### `comments` / `activities`
```ts
comments: { _id, workspaceId, entityType:'card'|'page'|'message', entityId, parentId?,
            authorId, body, mentions:[userId], fileIds:[], editedAt?, deletedAt?, createdAt, updatedAt }
// Indexes: {entityType:1,entityId:1,createdAt:-1} · {mentions:1,createdAt:-1} (my mentions)

activities: { _id, workspaceId, entityType, entityId, action:'created'|'moved'|'assigned'|
              'updated'|'archived'|'deleted'|'restored', actorId,
              diff: { field: { from, to } }, meta:{ fromListId?, toListId? }, at }
// Indexes: {entityType:1,entityId:1,at:-1} · TTL on at (365d) for the demo dataset
```

#### `pages` / `pageversions` (Notion layer)
```ts
pages: { _id, workspaceId, title, icon:'📄', coverFileId?,
         parentId: ObjectId|null,                // null = workspace root
         ancestors: [ObjectId],                  // materialized path → subtree queries
         depth: 0..n, slug, order: 'a0G4',
         blocks: [ { _id, type:'paragraph'|'h1'|'h2'|'h3'|'bullet'|'numbered'|'todo'|'quote'
                    |'code'|'divider'|'image'|'callout'|'embed',
                     text?, lang?, checked?, fileId?, url?, order:'a0G', 
                     mentions:[{ type:'user'|'page', id }] } ],   // flattened, not nested
         plainText,                              // denormalized → search + snippets
         visibility:'workspace'|'private'|'link', allowedUserIds:[], 
         favouriteOf:[userId], mentions:[pageId],  // inverted index → backlinks
         version: 12,                            // optimistic concurrency for autosave
         lastSnapshotAt?, deletedAt?, createdBy, createdAt, updatedAt }
// Indexes: {workspaceId:1,parentId:1,order:1} · {workspaceId:1,ancestors:1}
//          {workspaceId:1,mentions:1} · text{title:3,plainText:1} · {deletedAt:1,updatedAt:-1}
```

#### `channels` / `messages` / `channelreads` (Slack layer)
```ts
channels: { _id, workspaceId, name, slug, type:'public'|'private'|'dm',
            topic?, purpose?, memberIds:[ObjectId], 
            lastMessage: { _id, authorId, preview, at },   // denormalized → sidebar render in 1 query
            messageCount, unreadMeta?, createdBy, archivedAt?, deletedAt?, createdAt, updatedAt }
// Indexes: {workspaceId:1,type:1,updatedAt:-1} · {workspaceId:1,memberIds:1} · {slug:1,workspaceId:1} unique

messages: { _id, workspaceId, channelId, authorId,
            body, blocks?, mentions:[userId], fileIds:[], linkPreviews:[{url,title,desc,image}],
            parentId?, threadRootId?, replyCount, lastReplyAt,
            reactions: [{ emoji, userIds:[ObjectId] }],   // embedded (bounded by emoji set)
            editedAt?, deletedAt?, deletedBy?, clientId?, createdAt, updatedAt }
// Indexes: {channelId:1,threadRootId:1,createdAt:-1}  ← channel timeline & thread view
//          {channelId:1,createdAt:-1}   ← cursor pagination
//          text{body} · {mentions:1,createdAt:-1} · {workspaceId:1,createdAt:-1}

channelreads: { _id, workspaceId, channelId, userId, lastReadAt, lastReadMessageId, unreadCount, mentionCount }
// Indexes: {channelId:1,userId:1} unique · {userId:1,workspaceId:1}
```

#### `files` / `notifications` / `invitations` / `refreshtokens` / `auditlogs` / `analyticsdaily`
```ts
files: { _id, workspaceId, uploaderId, key (storage path), name, mime, size,
         checksum (sha256), width?, height?, thumbnails:{sm,md}?, 
         entityType?, entityId?, status:'pending'|'ready'|'quarantined'|'deleted',
         deletedAt?, createdAt, updatedAt }
// Indexes: {workspaceId:1,entityType:1,entityId:1} · {status:1,createdAt:1} (orphan sweep) · {checksum:1}

notifications: { _id, workspaceId, userId, type, title, body, 
                 entityType, entityId, actorId?, link, groupKey, groupCount,
                 readAt?, deliveredAt?, createdAt }
// Indexes: {userId:1,readAt:1,createdAt:-1} (unread first, cursor) · TTL {createdAt:1} 180d
//          {userId:1,groupKey:1,createdAt:-1} (grouping)

invitations: { _id, workspaceId, email, role, tokenHash, invitedBy, expiresAt (72h),
               acceptedAt?, declinedAt?, createdAt }
// Indexes: {tokenHash:1} unique · {email:1,workspaceId:1} · TTL {expiresAt:1}

refreshtokens: { _id, userId, tokenHash unique, familyId, userAgent, ip,
                 expiresAt (7d), rotatedAt?, revokedAt?, replacedBy?, createdAt }
// Indexes: {tokenHash:1} unique · {userId:1,revokedAt:1} · {familyId:1} · TTL {expiresAt:1}

auditlogs: { _id, workspaceId?, actorId, actorRole, action, entityType, entityId,
             before?, after?, ip, userAgent, requestId, at }
// Indexes: {workspaceId:1,at:-1} · {actorId:1,at:-1} · {action:1,at:-1} · text? (admin search)

analyticsdaily: { _id, workspaceId, boardId?, date:'2026-09-24',
                  cardsCreated, cardsCompleted, messagesSent, pagesEdited,
                  activeMemberIds:[], avgCompletionHours, computedAt }
// Indexes: {workspaceId:1,date:-1} · {workspaceId:1,boardId:1,date:-1} unique
```

### 7.4 Indexing strategy (with the "why")

| Query pattern | Index | Notes |
|---|---|---|
| Board render | `{listId:1, order:1}` | Covered sort — no in-memory SORT stage |
| Channel timeline | `{channelId:1, threadRootId:1, createdAt:-1}` | Both timeline (`threadRootId:null`) and threads |
| My tasks | `{workspaceId:1, assignees:1, completedAt:1}` | Multikey on `assignees` |
| Global search | `text{title:3, plainText:1}` + `{workspaceId:1}` filter | Weighted; proof via `explain('executionStats')` |
| Due-date reminder job | `{dueAt:1}` **partial**: `{completedAt:null, deletedAt:null}` | Smaller index, only actionable docs |
| Notification bell | `{userId:1, readAt:1, createdAt:-1}` | Unread-first compound |
| Audit export | `{workspaceId:1, at:-1}` | Range scan + stream |
| Trash purge | `{deletedAt:1}` partial `{deletedAt:{$ne:null}}` | Nightly job scan |

**Index rules for the repo:** every new query needs (a) an index, (b) a test that asserts the plan is `IXSCAN`, (c) a line in `docs/performance.md`. This is a *strong* senior signal and directly serves the Performance 10%.

### 7.5 MongoDB transactions (6 flows to implement & demo)

> Requires a replica set (§18.2) — `mongoose.startSession()` + `withTransaction`. Helper handles `TransientTransactionError` retry (up to 3 attempts with jitter) and `UnknownTransactionCommitResult`.

| # | Flow | Writes inside the transaction | Why it must be atomic |
|---|---|---|---|
| T1 | **Workspace bootstrap** | `workspaces` + `workspacemembers(owner)` + `channels(#general)` + `boards(Getting Started)` + `pages(Welcome)` + `auditlogs` | A half-created workspace is a broken tenant forever |
| T2 | **Card move (DnD)** | card `listId`+`order`+`__v`, source list `cardCount--`, target list `cardCount++`, `activities`, `auditlogs` | Counters drifting from reality is the classic bug |
| T3 | **Card create from message (C1)** | `cards` + `activities` + `messages(reply with permalink, replyCount++, lastReplyAt)` + `notifications` | Thread reply without the card (or vice-versa) confuses everyone |
| T4 | **Member removal** | `workspacemembers` delete + `workspaces.stats.memberCount--` + prune `assignees` on their cards + `auditlogs` | Orphaned assignees break board filters |
| T5 | **List reorder (bulk)** | N list `order` writes + board `updatedAt` + `activities` | Half-applied column order is visibly wrong |
| T6 | **Invite accept** | `invitations.acceptedAt` + upsert `workspacemembers` + `workspaces.stats.memberCount++` + `notifications(inviter)` + `auditlogs` | Double-accept must be impossible (idempotent) |

**Fallback narrative (great interview answer):** *"If the deployment didn't support transactions (standalone Mongo), I'd fall back to a saga: write an intent record, apply steps idempotently, compensate on failure, and let a reconciliation job repair drift. We chose transactions because our replica set guarantees them, but the design keeps compensating actions available."*

### 7.6 Aggregation catalog (12 pipelines — the "MongoDB aggregations" requirement)

| # | Endpoint / Job | Stages used | Output |
|---|---|---|---|
| A1 | Board with cards + assignee profiles | `$match` → `$sort` → `$facet` (cards/counts) → `$lookup` users → `$project` | One round-trip board payload |
| A2 | Workspace overview dashboard | `$match` → `$group` → `$facet` (byStatus, byLabel, byAssignee, trend) | 4 charts from 1 query |
| A3 | Page subtree fetch | `$match` → `$graphLookup` (ancestors/parentId, `maxDepth: 8`) → `$sort` | Nested tree for sidebar |
| A4 | Backlinks | `$match {mentions: pageId}` → `$lookup` → `$project` | "Referenced by" list |
| A5 | Unread summary per channel | `$match` (channelIds) → `$lookup` channelreads → `$addFields` computed unread → `$sort` | Sidebar badges in 1 query |
| A6 | Thread with reply authors | `$match {threadRootId}` → `$sort {createdAt:1}` → `$lookup` users → `$group` participants | Thread panel |
| A7 | Board burndown | `$match` date range → `$setWindowFields` cumulative remaining → `$bucket` daily | Chart series |
| A8 | Search with facets + highlight | `$search`/`$match $text` → `$facet` per type → `$addFields {score:{ $meta:'textScore' }}` → `$sort` | Grouped, ranked results |
| A9 | Member contribution report | `$match` → `$group` by actorId → `$lookup` → `$sort` → `$limit 10` | Leaderboard |
| A10 | Storage usage by workspace | `$match {status:'ready'}` → `$group {sum:'$size'}` → `$bucketAuto` | Admin cost view |
| A11 | Activity heatmap | `$match` 30d → `$group` by `{$dateToString:%Y-%m-%d}` + hour → `$sort` | Calendar heatmap |
| A12 | Counter reconciliation (job) | `$group` real counts vs stored → `$merge` corrections → log drift | Self-healing data |

**Pipeline rules:** `$match` first (index use), `$project` early (shrink docs before `$lookup`), `allowDiskUse` only for reports, `.explain()` each pipeline once and paste the winning plan into `docs/performance.md`, cap `$lookup` with a pipeline + `$limit` (never unbounded).

### 7.7 Fractional indexing — the DnD engine (implement once, use 3×)

**Problem:** dragging a card between neighbours. Integer positions force rewriting every sibling (`O(n)` writes, race conditions, noisy git-like audit trails).

**Solution:** each item holds a **string key** ordered lexicographically by Mongo (`{order: 1}` sort). To place an item between `a0G` and `a0H`, generate a key strictly between them. Moving = **1 write**.

```ts
// shared/fractionalIndex.ts — LexoRank-style, base-62, no external dep needed
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function keyBetween(prev?: string | null, next?: string | null): string {
  if (!prev && !next) return 'a0';
  if (!prev) return decrement(next!);
  if (!next) return increment(prev);
  if (prev >= next) throw new ApiError(409, 'ORDER_CONFLICT', 'Neighbours out of order');
  let out = '';
  for (let i = 0; ; i++) {
    const p = prev[i] ?? DIGITS[0];
    const n = next[i] ?? DIGITS[DIGITS.length - 1];
    if (n.charCodeAt(0) - p.charCodeAt(0) > 1) {
      return out + DIGITS[Math.floor((p.charCodeAt(0) + n.charCodeAt(0)) / 2)];
    }
    out += p;
    // if prev exhausted and next continues, append midpoint digit
    if (!prev[i]) return out + DIGITS[Math.floor(n.charCodeAt(0) / 2)];
  }
}
// increment/decrement: append midpoint digit / prepend (omitted for brevity — 20 lines each)

// Move endpoint (transactional, optimistic-concurrency safe)
async function moveCard(dto: MoveCardDTO, user: AuthUser) {
  const session = await mongoose.startSession();
  try {
    let result!: Card;
    await session.withTransaction(async () => {
      const card = await CardRepo.findByIdOrFail(dto.cardId, session);
      assertCan(user, 'card:update', card);
      const [before, after] = await Promise.all([
        dto.beforeCardId ? CardRepo.getOrder(dto.beforeCardId, session) : null,
        dto.afterCardId  ? CardRepo.getOrder(dto.afterCardId, session)  : null,
      ]);
      const order = keyBetween(before, after);
      if (order.length > 60) throw new ApiError(409, 'ORDER_KEY_EXHAUSTED', 'Rebalance required');
      result = await CardRepo.move({ id: dto.cardId, from: card.listId, to: dto.targetListId,
                                     order, expectedVersion: dto.version }, session);
      await ListRepo.bumpCounts(card.listId, dto.targetListId, session);
      await ActivityRepo.record({ entityType:'card', entityId: card._id, action:'moved',
                                  actorId: user.id, meta:{ fromListId: card.listId, toListId: dto.targetListId } }, session);
    });
    // ⬇ side-effects AFTER commit (never inside) — sockets & queues are not transactional
    await cache.invalidateTag(`board:${result.boardId}`);
    io.to(`board:${result.boardId}`).emit('card:moved', toCardEvent(result));
    await Queue.notifications.add('card.moved', { cardId: result._id, actorId: user.id });
    return result;
  } finally { await session.endSession(); }
}
```

**Rebalance job (BullMQ, on-demand + weekly):** when a list's keys exceed 60 chars or neighbours collide, regenerate evenly spaced keys for that list in one bulk write and emit `list:rebalanced` so clients re-sort. Logged, metered, and mentioned in §23 Scenario 11.

### 7.8 Pagination, filtering & sorting contract (used by all 40 endpoints)

```
GET /resource?limit=25&cursor=<opaque>&sort=-updatedAt&filter[status]=active&q=term

Response:
{
  "success": true,
  "data": [ ... ],
  "meta": { "nextCursor": "eyJpZCI6...", "hasMore": true, "limit": 25,
            "total": 1234,            // only when cheap (indexed count) else omitted
            "cached": true, "requestId": "01J..." }
}
```
- **Cursor** = base64 of `{sortValue, _id}` → `$or` seek condition. Never `skip` (proved with `explain` in docs).
- **Limits:** default 25, max 100 (`zod.coerce.number().min(1).max(100)`), rejected with `422` otherwise.
- **Sort allowlist** per endpoint (prevents index-less sorts and injection).
- **`total`** computed by `estimatedDocumentCount` or a cached counter — never a full `countDocuments` in a hot path.

---

## 8. Redis — Production-Grade Setup

### 8.1 Topology

```
DEV (docker compose up)
  redis-cache:7-alpine   :6379   maxmemory 256mb  allkeys-lru   + redis-commander (UI)
  redis-queue:7-alpine   :6380   maxmemory 512mb  noeviction    AOF everysec
  (both bound to the docker network only — never published to the public internet)

PROD — baseline (what we ship)
  redis-cache  → managed (ElastiCache/Upstash/Redis Cloud) or container + volume
                 optional: Sentinel (3 sentinels, 1 primary + 2 replicas) for HA failover
  redis-queue  → separate instance, persistent volume, AOF everysec + RDB, noeviction,
                 monitored by alert on `bull:*` key count + `evicted_keys` (must stay 0)

PROD — >10k concurrent sockets (documented scale path, not built)
  Redis Cluster (3 primaries + 3 replicas, hash tags: {ws:123}:presence) for sharding
  Socket.io Redis adapter (non-sharded) → use @socket.io/redis-streams-adapter or
  sharded adapter; because Cluster shards by key, keep related keys in the same hash tag.
```

### 8.2 Hardened `redis-cache.conf` (committed to `infra/docker/`)

```conf
# ---- network ----
bind 0.0.0.0
protected-mode yes
port 6379
timeout 300
tcp-keepalive 60
tcp-backlog 511

# ---- auth & ACL (never run without auth, even inside a network) ----
requirepass ${REDIS_CACHE_PASSWORD}
user default off                                  # disable the default superuser
user cache_app on >${REDIS_CACHE_PASSWORD} ~orbit:* +@read +@write +@keyspace +@pubsub -@dangerous -@admin
user health on >${REDIS_HEALTH_PASSWORD} -@all +ping +info

# ---- memory & eviction (cache instance) ----
maxmemory 1gb
maxmemory-policy allkeys-lru
maxmemory-samples 5
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes

# ---- persistence (cache: light, for warm restarts) ----
save 900 1
save 300 100
appendonly no

# ---- durability/consistency of writes to disk ----
stop-writes-on-bgsave-error no
rdbcompression yes
rdbchecksum yes

# ---- performance & safety ----
io-threads 4
maxclients 10000
slowlog-log-slower-than 10000
slowlog-max-len 256
latency-monitor-threshold 100
# rename-command CONFIG ""   # optional hardening in prod (breaks some tooling)

# ---- keyspace notifications (used by presence/expiry listeners) ----
notify-keyspace-events "Ex"
```

```conf
# redis-queue.conf — BullMQ
maxmemory 512mb
maxmemory-policy noeviction        # ★ jobs must never be evicted
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
save 900 1
user queue_app on >${REDIS_QUEUE_PASSWORD} ~bull:* ~orbit:lock:* ~orbit:idem:* +@read +@write +@keyspace -@dangerous -@admin
```

### 8.3 Key naming, TTL policy, and what lives where

**Convention:** `orbit:{env}:{domain}:{id}[:{sub}]` — always environment-prefixed so staging and prod can share an instance safely (and `SCAN` by prefix stays safe; **never** use `KEYS` in prod).

| Key | Type | TTL | Purpose | Invalidation |
|---|---|---|---|---|
| `orbit:dev:cache:session:{userId}` | hash | 15 m | Session/RBAC context (role per workspace) | on role change / logout |
| `orbit:dev:cache:user:{id}` | string(JSON) | 10 m | Profile hydrate | on user update (delete key) |
| `orbit:dev:cache:board:{boardId}:meta` | string | 5 m | Board shell + lists + counts | tag `board:{id}` on any board mutation |
| `orbit:dev:cache:board:{boardId}:cards:{listId}:{cursor}` | string | 60 s | Hot first page of cards | tag `board:{id}` |
| `orbit:dev:cache:channel:{id}:recent` | string | 30 s | First page of messages | tag `channel:{id}` |
| `orbit:dev:cache:tag:{tag}:keys` | set | = max TTL of members | Tag-based invalidation index | self-managed |
| `orbit:dev:rl:{scope}:{id}:{window}` | string (INCR) | window | Rate limiting counters | auto-expire |
| `orbit:dev:rl:lua:{scope}:{id}` | zset | 60 s | Sliding-window limiter | auto-expire + trim |
| `orbit:dev:presence:{ws}:{uid}` | string | 60 s (heartbeat) | Online presence | TTL expiry + socket disconnect |
| `orbit:dev:typing:{channel}:{uid}` | string | 4 s | Typing indicator | auto-expire |
| `orbit:dev:unread:{ws}:{uid}` | hash | 7 d | Per-channel unread badges | on read / new message |
| `orbit:dev:denylist:jti:{jti}` | string | = token remaining life | Logout / revoked access token | auto-expire |
| `orbit:dev:lock:{resource}:{id}` | string (SET NX PX) | 10 s | Short critical sections / stampede guard | release in `finally` |
| `orbit:dev:idem:{userId}:{key}` | string(JSON) | 24 h | Idempotent POST replays | auto-expire |
| `orbit:dev:analytics:{ws}:overview` | string | 5 m + SWR 30 m | Dashboard payload | tag `ws:{id}` |
| `orbit:dev:search:suggest:{ws}:{q}` | string | 10 m | Suggestion list | TTL only |
| `orbit:dev:stats:cache:hit` / `:miss` | counter | none | Hit-ratio metric source | manual/rollup |

**Memory math (put this in the README):** assume 2 KB average serialized value → 1 GB holds ~500k keys. A 500-member workspace with 200 channels, 50 boards and hot first pages ≈ 12k keys ≈ 25 MB. So 1 GB gives ~40× headroom → the cache instance is CPU-bound long before it is memory-bound; alerts fire at 70% memory, `evicted_keys > 0` is a warning, `> 100/min` is an incident (means the working set is bigger than the cache → investigate key TTLs, not just add RAM).

### 8.4 Caching patterns we implement (with code)

**(a) Cache-aside with tag invalidation + single-flight (stampede protection)**

```ts
// infrastructure/cache/cache.service.ts
export class CacheService {
  constructor(private redis: Redis, private metrics: Metrics) {}

  async remember<T>(opts: {
    key: string; ttl: number; tags?: string[];
    swr?: number;                       // stale-while-revalidate window
    singleFlight?: boolean;
    fetcher: () => Promise<T>;
  }): Promise<T> {
    const env = await this.redis.get(opts.key);

    if (env) {
      const { v, exp, tags } = JSON.parse(env) as { v: T; exp: number; tags: string[] };
      if (Date.now() < exp) { this.metrics.cacheHit(); return v; }          // fresh
      if (opts.swr && Date.now() < exp + opts.swr * 1000) {                 // stale but usable
        this.metrics.cacheStale();
        void this.revalidate(opts).catch(() => void 0);                     // background refresh
        return v;
      }
    }
    this.metrics.cacheMiss();
    return this.singleFlight ? this.withLock(opts.key, () => this.revalidate(opts))
                             : this.revalidate(opts);
  }

  private async revalidate<T>(o: { key: string; ttl: number; tags?: string[]; fetcher: () => Promise<T> }) {
    const v = await o.fetcher();
    const payload = JSON.stringify({ v, exp: Date.now() + o.ttl * 1000, tags: o.tags ?? [] });
    await this.redis.set(o.key, payload, 'EX', o.ttl + (o as any).swr ?? 0);
    if (o.tags?.length) {
      const pipe = this.redis.pipeline();
      for (const t of o.tags) pipe.sadd(`orbit:dev:cache:tag:${t}:keys`, o.key);
      for (const t of o.tags) pipe.expire(`orbit:dev:cache:tag:${t}:keys`, o.ttl + 3600);
      await pipe.exec();                                    // tag→keys index for invalidation
    }
    return v;
  }

  /** Stampede guard: one fetcher runs, others wait briefly then read the cache. */
  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const lockKey = `orbit:dev:lock:cache:${key}`;
    const got = await this.redis.set(lockKey, '1', 'PX', 5000, 'NX');
    if (got) { try { return await fn(); } finally { await this.redis.del(lockKey); } }
    await sleep(80 + Math.random() * 120);
    const warm = await this.redis.get(key);
    return warm ? (JSON.parse(warm).v as T) : fn();          // last-resort: fetch ourselves
  }

  /** Tag-based invalidation: used after every mutation. */
  async invalidateTag(tag: string) {
    const idx = `orbit:dev:cache:tag:${tag}:keys`;
    const keys = await this.redis.smembers(idx);
    if (keys.length) await this.redis.del(...keys, idx);
    await this.redis.publish('orbit:cache:invalidate', tag);   // fan-out to other containers
  }
}
```

**(b) Atomic sliding-window rate limiter (Lua — single round-trip, race-free)**

```lua
-- infrastructure/redis/lua/slidingWindow.lua
-- KEYS[1] = zset key ; ARGV = now_ms, window_ms, limit, member_id
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, limit - count, math.ceil((tonumber(oldest[2]) + window - now))}
end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], window)
return {1, limit - count - 1, 0}   -- allowed, remaining, retryAfterMs
```
```ts
// Tiered limits (fail-open for reads, fail-closed for auth writes)
const TIERS = {
  global:      { windowMs: 60_000, limit: 300, keyBy: 'ip'   },
  auth:        { windowMs: 900_000, limit: 10,  keyBy: 'ip+email', failClosed: true },
  write:       { windowMs: 60_000, limit: 60,  keyBy: 'userId' },
  search:      { windowMs: 60_000, limit: 30,  keyBy: 'userId' },
  upload:      { windowMs: 3_600_000, limit: 100, keyBy: 'userId' },
  socketMsg:   { windowMs: 10_000, limit: 20,  keyBy: 'socketId' },
} as const;
```
Header contract: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` on `429`.

**(c) Distributed lock (Redlock-lite) — only for short, non-transactional critical sections**

```ts
async function withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const token = randomUUID();
  const ok = await redis.set(`orbit:dev:lock:${key}`, token, 'PX', ttlMs, 'NX');
  if (!ok) throw new ApiError(409, 'LOCK_BUSY', 'Resource is being modified, retry');
  try { return await fn(); }
  finally {
    // release only if we still own it (compare-and-delete, atomic via Lua)
    await redis.eval(`if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) end return 0`,
                     1, `orbit:dev:lock:${key}`, token);
  }
}
```
> **Honest engineering note (say this):** *"Redlock is not a perfect mutual-exclusion guarantee under clock skew and GC pauses. We use it only for cheap optimizations (stampede protection, dedupe of an expensive job) — never as the sole correctness boundary. Real correctness comes from Mongo's transactions and unique indexes."* Graders love this nuance.

**(d) Presence & membership caching** — presence via TTL keys + keyspace notifications; membership/role cached 15 min and invalidated on role change; **fail-open on read** (if Redis is down we query Mongo) but **fail-closed on auth** (no Redis → no login, we don't want to bypass the denylist).

### 8.5 Failover, degradation & operations

| Failure | Detection | Behaviour | Recovery |
|---|---|---|---|
| Cache Redis down | `ready`/`error` events, `/health/ready` | Circuit breaker opens → **bypass cache**, serve from Mongo (latency ↑, correctness ✅). Auth still fails closed. | breaker half-open probe every 10 s |
| Queue Redis down | BullMQ `error` events | API still serves; **jobs buffer in memory up to 500** then requests fail with `503 JOB_BACKEND_UNAVAILABLE` | auto-reconnect (ioredis retry strategy, capped backoff + jitter) |
| Redis latency spike (`> 50 ms p99`) | latency monitor + metrics | Reduce cache TTL pressure, alert; log slow commands via `SLOWLOG` | investigate big keys (`redis-cli --bigkeys`), hot keys → local LRU layer |
| Evictions on cache instance | `evicted_keys` metric | Warning; if sustained → key TTL review + memory bump | — |
| Evictions on **queue** instance | `evicted_keys > 0` | **Incident** — job loss risk; page immediately | verify AOF, restore, fix `noeviction` config |
| Redis restart | reconnect | Cache refills naturally; locks lost (acceptable for our use); presence rebuilt from socket connections | — |

**Connection management:** `ioredis` with `maxRetriesPerRequest: null` **only** for BullMQ (required), `enableOfflineQueue: false` for the cache client (fail fast instead of queuing requests behind a dead Redis), `family: 4`, `keepAlive: 30000`, separate connections for pub/sub (adapter requires dedicated subscribers), `lazyConnect: true` + explicit `connect()` during boot so `/health/ready` is truthful.

**Operational tooling:** RedisInsight (dev), `MONITOR` only in dev, key-prefix `SCAN` scripts for debugging, a `scripts/redis-report.ts` that prints memory, hit ratio, top prefixes, slowlog, and evictions — handy in the live-debugging round.

**Backups:** queue instance — AOF + nightly `BGSAVE` to volume; documented restore drill (`kill -9` Redis, restart, assert 0 lost jobs in `waiting` count).

---

## 9. Background Jobs (BullMQ)

### 9.1 Queues & workers

| Queue | Jobs | Concurrency | Retries / backoff | Notes |
|---|---|---|---|---|
| `mail` | verify-email, invite, reset-password, mention-digest, weekly-summary | 5 | 5 / exponential 2 s | SMTP via nodemailer; MJML templates; dev sink = MailHog |
| `notifications` | fanout, group, deliver-in-app, deliver-email | 10 | 3 / exponential | Batch insert (500/txn), de-dup by `groupKey` |
| `search-index` | index-card, index-page, index-message, reindex-workspace | 4 | 3 / fixed 5 s | Keeps text/Atlas index warm; also recomputes `plainText` |
| `files` | thumbnails (sharp), exif-strip, checksum-verify, virus-scan-hook | 3 | 3 / exponential | CPU-heavy → dedicated worker with its own concurrency |
| `analytics` | hourly-rollup, nightly-daily-rollup, reconcile-counters | 1 | 2 / fixed | **Repeatable**: `0 * * * *`, `15 1 * * *`, `30 3 * * 0` |
| `cleanup` | purge-trash (30 d), purge-tokens, sweep-orphan-files, expire-invites, rebalance-order-keys | 1 | 3 | Repeatable nightly; each batch-limited (never load 1M docs) |
| `pages` | snapshot-versions (every 5 min) | 2 | 2 | Only pages with `updatedAt > lastSnapshotAt` |
| `reminders` | card-due-soon (24 h), card-overdue | 1 | 3 | Repeatable hourly, TZ-aware per workspace |
| `webhooks` | deliver (HMAC-signed, 3 event types) | 5 | 5 / exponential to 6 h | Secret-per-endpoint, replay-safe |
| `dlq` | any job that exhausts attempts | — | — | BullBoard view + "retry selected" + Slack alert |

### 9.2 Queue infrastructure code

```ts
// infrastructure/queue/queues.ts
export const QUEUE_NAMES = ['mail','notifications','search-index','files','analytics',
                            'cleanup','pages','reminders','webhooks'] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

export const queueConnection = new IORedis(REDIS_QUEUE_URL, {
  maxRetriesPerRequest: null,          // REQUIRED by BullMQ
  enableReadyCheck: false,
  enableOfflineQueue: true,
});

export const queues = Object.fromEntries(
  QUEUE_NAMES.map((name) => [name, new Queue(name, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: { age: 24 * 3600, count: 1_000 },   // keep the queue lean
      removeOnFail:    { age: 7 * 24 * 3600 },              // keep failures for the DLQ view
    },
  })])
) as Record<QueueName, Queue>;

// Idempotency: jobId = deterministic hash → duplicate enqueues collapse into one job
export async function enqueueOnce<T>(queue: QueueName, name: string, data: T, key: string) {
  return queues[queue].add(name, data, { jobId: createHash('sha256').update(key).digest('hex').slice(0, 24) });
}
```

```ts
// apps/worker/src/index.ts  — WORKER ENTRY (its own cluster, its own scaling curve)
const workerDefs: Array<[QueueName, Processor, number]> = [
  ['mail', mailProcessor, 5],
  ['notifications', notificationProcessor, 10],
  ['search-index', searchIndexProcessor, 4],
  ['files', fileProcessor, 3],
  ['analytics', analyticsProcessor, 1],
  ['cleanup', cleanupProcessor, 1],
  ['pages', pageSnapshotProcessor, 2],
  ['reminders', reminderProcessor, 1],
  ['webhooks', webhookProcessor, 5],
];

const workers = workerDefs.map(([name, processor, concurrency]) => {
  const w = new Worker(name, processor, {
    connection: queueConnection,
    concurrency,
    limiter: name === 'mail' ? { max: 50, duration: 60_000 } : undefined,  // respect SMTP limits
    lockDuration: 60_000,
    stalledInterval: 30_000,
    maxStalledCount: 2,
    autorun: true,
  });
  w.on('completed', (job, res) => metrics.jobDone(name, job.name, Date.now() - job.timestamp));
  w.on('failed',    (job, err) => {
    metrics.jobFailed(name, job?.name);
    logger.error({ queue: name, jobId: job?.id, attempts: job?.attemptsMade, err }, 'job failed');
    if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) void queues.dlq.add('dead', { from: name, job: job.data, error: err.message });
  });
  w.on('stalled', (id) => logger.warn({ queue: name, jobId: id }, 'job stalled — will be retried'));
  return w;
});

// Repeatable / scheduled jobs — registered ONCE (worker service only!)
await queues.pages.add('snapshot-versions', {}, { repeat: { pattern: '*/5 * * * *' }, jobId: 'snapshot' });
await queues.cleanup.add('purge-trash', {}, { repeat: { pattern: '0 3 * * *' }, jobId: 'purge-trash' });
await queues.analytics.add('nightly-rollup', {}, { repeat: { pattern: '15 1 * * *' }, jobId: 'rollup' });
await queues.analytics.add('reconcile-counters', {}, { repeat: { pattern: '30 3 * * 0' }, jobId: 'reconcile' });
await queues.reminders.add('due-soon', {}, { repeat: { pattern: '0 * * * *' }, jobId: 'due-soon' });
await queues.cleanup.add('rebalance-order-keys', {}, { repeat: { pattern: '0 4 * * 0' }, jobId: 'rebalance' });

// graceful: stop pulling new jobs, finish in-flight, then exit
for (const s of ['SIGTERM','SIGINT']) process.on(s, async () => {
  await Promise.all(workers.map((w) => w.close()));
  await queueConnection.quit();
  process.exit(0);
});
```

### 9.3 Job design rules (production hygiene)

1. **Payloads are small ids, not documents** — `{cardId}` not the whole card. Avoids stale data and keeps Redis memory flat.
2. **Processors are idempotent** — always re-read current state; use `enqueueOnce` with a deterministic `jobId` for anything triggered by user clicks (double-submit safe).
3. **Never trust a job payload for authorization** — re-check permissions on execution.
4. **Long work is chunked** — batch 500, `await job.updateProgress(pct)`, re-enqueue the next batch (no 30-minute locks).
5. **Errors are classified** — validation/permanent errors → `UnrecoverableError` (no retries, straight to DLQ); transient (SMTP 4xx, S3 5xx) → retry with backoff.
6. **DLQ is visible** — BullBoard at `/admin/queues` (RBAC `admin`), showing waiting/active/failed/completed counts, job data, stack traces, retry button.
7. **Metrics** — `bull_queue_waiting`, `bull_queue_active`, `bull_queue_failed_total`, `bull_job_duration_seconds` exposed to Prometheus; alert if `waiting > 1000` for 10 min or `failed rate > 5%`.
8. **Backpressure** — before enqueuing from the API, check queue depth; if over threshold, return `202 Accepted` with a "will notify" contract instead of piling on.
9. **Scalability** — workers scale independently (`docker compose up --scale worker=4`); CPU-heavy `files` queue can run on a separate service/host.
10. **Local dev** — `QUEUE_DISABLED=true` runs an in-process synchronous executor so tests and demos don't need a worker running.

---

## 10. API Catalog — 40 REST APIs

### 10.1 Conventions (apply to all)

| Aspect | Standard |
|---|---|
| Base path | `/api/v1` (version in path; breaking changes → `/v2` with 6-month overlap) |
| Content type | `application/json; charset=utf-8` (uploads are presigned, never proxied) |
| Auth | `Authorization: Bearer <access>` **or** `orbit_at` httpOnly cookie (web app uses cookies + CSRF double-submit) |
| Success envelope | `{ success: true, data: T, meta?: {...} }` |
| Error envelope | `{ success: false, error: { code, message, details?, requestId, docs? } }` |
| Status codes | 200 OK · 201 Created · 202 Accepted (async) · 204 No Content · 400 malformed · 401 unauthenticated · 403 unauthorized · 404 not found/enumeration-safe · 409 conflict (version/order/duplicate) · 410 gone · 413 too large · 422 validation · 429 rate limited · 500 · 503 dependency down |
| Error codes | `AUTH_INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `TOKEN_REUSED`, `FORBIDDEN_ROLE`, `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `VERSION_CONFLICT`, `ORDER_CONFLICT`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, … (enum in `packages/shared`) |
| Idempotency | `Idempotency-Key: <uuid>` required on POSTs that create side-effects (workspace, card-from-message, invite) |
| Pagination | `limit` + opaque `cursor` (+ `sort`, `filter[...]`, `q`) per §7.8 |
| Caching | `Cache-Control: private, max-age=0, no-store` for user-specific data; `ETag` + `304` for GETs of single resources |
| Tracing | Response always carries `X-Request-Id` (from request context, also in logs and Sentry) |
| Time | ISO-8601 UTC in transit, workspace TZ for display/aggregations |
| Validation | Zod schema per route; unknown keys stripped; `422` body lists `path` + `message` per field |
| Rate limits | Per §8.4(b) tier table, advertised in response headers |
| Versioning of payloads | Additive-only within `v1`; new fields optional; deprecated fields documented + `Sunset` header |

### 10.2 The 40 endpoints (core deliverable list)

**A. Auth & Identity (8)** — `modules/auth`

| # | Method | Path | Auth | RBAC | Body / Query | Response | Cache | Rate limit |
|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/auth/register` | – | – | `{name,email,password}` | `201 {user, accessToken}` + refresh cookie; queues verify email | – | `auth` (fail-closed) |
| 2 | POST | `/auth/login` | – | – | `{email,password,remember?}` | `200 {user, accessToken}` + refresh cookie | – | `auth` |
| 3 | POST | `/auth/refresh` | cookie | – | – | `200 {accessToken}` + rotated cookie | Redis denylist check | `auth` |
| 4 | POST | `/auth/logout` | ✅ | – | `{allDevices?}` | `204`; `jti` denylisted, family revoked | – | write |
| 5 | POST | `/auth/forgot-password` | – | – | `{email}` | `202` (always — no user enumeration) | – | `auth` |
| 6 | POST | `/auth/reset-password` | – | – | `{token,newPassword}` | `204`; all sessions revoked | – | `auth` |
| 7 | POST | `/auth/verify-email` | – | – | `{token}` | `204` | – | auth |
| 8 | GET | `/auth/sessions` | ✅ | self | – | `200 [{device,ip,lastSeen,current}]` | 60 s | read |

**B. Users & Profile (4)** — `modules/users`

| # | Method | Path | Auth | RBAC | Notes |
|---|---|---|---|---|---|
| 9 | GET | `/users/me` | ✅ | self | Profile + prefs + workspace list + unread counts (one aggregated call) |
| 10 | PATCH | `/users/me` | ✅ | self | name, handle, timezone, theme, notification prefs |
| 11 | POST | `/users/me/avatar` | ✅ | self | Presign → confirm; old avatar cleaned by job |
| 12 | GET | `/users/search?q=` | ✅ | member | People picker; returns only users in shared workspaces |

**C. Workspaces, Members & Invites (8)** — `modules/workspaces`

| # | Method | Path | Auth | RBAC | Notes |
|---|---|---|---|---|---|
| 13 | POST | `/workspaces` | ✅ | any | **T1 transaction**: workspace + owner membership + #general + Getting Started board + Welcome page |
| 14 | GET | `/workspaces` | ✅ | self | My workspaces with roles + unread totals (cached 60 s) |
| 15 | GET | `/workspaces/:id` | ✅ | member | Detail + stats + settings (cached 5 m, tag `ws:{id}`) |
| 16 | PATCH | `/workspaces/:id` | ✅ | admin | name, slug, logo, settings |
| 17 | DELETE | `/workspaces/:id` | ✅ | owner | Soft delete + 30-day purge job; requires typed confirmation in UI |
| 18 | POST | `/workspaces/:id/invites` | ✅ | admin | `{email, role}` → invitation + mail job; seat limit enforced |
| 19 | GET | `/workspaces/:id/members?role=&q=` | ✅ | member | Directory, cursor paginated, cached 60 s |
| 20 | PATCH | `/workspaces/:id/members/:userId` | ✅ | admin | Role change (`403` on last-owner demotion) + audit |

*(Also in this module: `DELETE /members/:userId`, `POST /invites/:token/accept`, `POST /invites/:token/decline`, `POST /workspaces/:id/leave`, `POST /workspaces/:id/transfer-ownership` — these are counted as **API 18a–18e** in the OpenAPI doc, keeping the "core 40" crisp while shipping full functionality.)*

**D. Boards & Lists & Cards (13)** — `modules/boards|cards`

| # | Method | Path | Auth | RBAC | Notes |
|---|---|---|---|---|---|
| 21 | POST | `/workspaces/:wid/boards` | ✅ | member | Creates board + 3 default lists (tx) |
| 22 | GET | `/workspaces/:wid/boards` | ✅ | member | List + card counts (cached 60 s, tag `ws:{id}`) |
| 23 | GET | `/boards/:id` | ✅ | member | Board shell + lists + counts (cached 5 m, tag `board:{id}`) |
| 24 | PATCH | `/boards/:id` | ✅ | admin | name, visibility, background, members |
| 25 | DELETE | `/boards/:id` | ✅ | admin | Archive (default) or `?force=true` hard delete (typed confirm) |
| 26 | POST | `/boards/:id/lists` | ✅ | member | Append at end (`order = keyBetween(lastKey, null)`) |
| 27 | PATCH | `/lists/:id` | ✅ | member | Rename, colour, WIP limit |
| 28 | PATCH | `/lists/reorder` | ✅ | member | **T5**: bulk `{lists:[{id,order}]}` |
| 29 | DELETE | `/lists/:id` | ✅ | admin | Archive; non-empty requires `?force=true` |
| 30 | GET | `/boards/:id/cards?listId=&assignee=&label=&due=overdue&q=` | ✅ | member | Cursor paginated, filtered, cached 60 s |
| 31 | POST | `/lists/:id/cards` | ✅ | member | Create (with labels/assignees/checklist) |
| 32 | PATCH | `/cards/:id` | ✅ | assignee/member | Optimistic concurrency via `version`; partial update |
| 33 | PATCH | `/cards/:id/move` | ✅ | member | **T2** fractional order move + sockets + jobs |
| 34 | DELETE | `/cards/:id` | ✅ | member (author/admin) | Soft delete → trash |
| 35 | POST | `/cards/:id/comments` | ✅ | member | Mentions → notification fan-out |
| 36 | GET | `/cards/:id/activity` | ✅ | member | `activities` timeline (cursor) |

*(Supporting, counted as 36a–36e: `POST /cards/:id/assignees`, `POST /cards/:id/attachments`, `POST /cards/:id/watch`, `POST /cards/:id/checklist`, `POST /cards/from-message` (**C1, T3**).)*

**E. Pages / Docs (7)** — `modules/pages`

| # | Method | Path | Auth | RBAC | Notes |
|---|---|---|---|---|---|
| 37 | POST | `/workspaces/:wid/pages` | ✅ | member | Create with parent + blocks |
| 38 | GET | `/pages?parentId=&cursor=` | ✅ | member | Children of a node (tree lazy-load) |
| 39 | GET | `/pages/:id` | ✅ | member/viewer | Full page + blocks + breadcrumb (cached 30 s, tag `page:{id}`) |
| 40 | PATCH | `/pages/:id` | ✅ | editor | Autosave; `version` conflict → `409` + current doc |
| 41 | DELETE | `/pages/:id` | ✅ | author/admin | Trash (subtree) + restore endpoint |
| 42 | GET | `/pages/:id/versions` | ✅ | member | Snapshot list (cursor) |
| 43 | POST | `/pages/:id/versions/:versionId/restore` | ✅ | editor | **T-alt** restore + new snapshot |

*(Supporting 43a–43c: `GET /pages/:id/backlinks`, `POST /pages/:id/favourite`, `GET /pages/tree`.)*

**F. Chat (9)** — `modules/channels|messages`

| # | Method | Path | Auth | RBAC | Notes |
|---|---|---|---|---|---|
| 44 | POST | `/workspaces/:wid/channels` | ✅ | member | public/private; DMs via `type:'dm'` + `memberIds` (dedupe existing DM) |
| 45 | GET | `/channels?type=&cursor=` | ✅ | member | Sidebar list + lastMessage + unread (aggregation A5, cached 30 s) |
| 46 | GET | `/channels/:id/messages?cursor=&aroundId=` | ✅ | channel member | Timeline, threads excluded (`threadRootId:null`), cached 30 s |
| 47 | POST | `/channels/:id/messages` | ✅ | channel member | Idempotent via `clientId`; socket broadcast; mentions → jobs |
| 48 | PATCH | `/messages/:id` | ✅ | author | Edit → `editedAt` + socket `message:updated` |
| 49 | DELETE | `/messages/:id` | ✅ | author/admin | Tombstone (keeps thread shape) |
| 50 | POST | `/messages/:id/reactions` | ✅ | channel member | `{emoji}` toggle, idempotent, socket delta |
| 51 | GET | `/messages/:id/thread` | ✅ | channel member | Aggregation A6: replies + participants |
| 52 | POST | `/channels/:id/read` | ✅ | member | `{lastReadMessageId}` → unread recount (Redis + doc) |

*(Supporting 52a–52d: `POST /channels/:id/members`, `POST /channels/:id/pins`, `PATCH /channels/:id` (topic/mute), `POST /channels/:id/typing` — the last is usually a socket event, REST kept for polling fallback.)*

**G. Files, Search, Notifications, Analytics, Admin (12)**

| # | Method | Path | Auth | RBAC | Notes |
|---|---|---|---|---|---|
| 53 | POST | `/files/presign` | ✅ | member | `{name,size,mime,entityType,entityId}` → `{uploadUrl,fileId,key}` + server-side validation of size/mime |
| 54 | POST | `/files/:id/confirm` | ✅ | member | Verify checksum/size, mark `ready`, queue thumbnails |
| 55 | DELETE | `/files/:id` | ✅ | uploader/admin | Soft delete + storage release + orphan-safe |
| 56 | GET | `/search?q=&types=&workspaceId=&cursor=` | ✅ | member | **A8** faceted, weighted, permission-filtered |
| 57 | GET | `/search/suggestions?q=` | ✅ | member | Recents + people + popular (cached 10 m) |
| 58 | GET | `/notifications?unreadOnly=&cursor=` | ✅ | self | Feed, grouped |
| 59 | POST | `/notifications/read` | ✅ | self | `{ids:[]}` or `{all:true}` → unread total socket update |
| 60 | GET | `/notifications/summary` | ✅ | self | Unread counts per workspace/type (Redis-cached) |
| 61 | GET | `/analytics/workspaces/:id/overview?range=30d` | ✅ | admin/manager | **A2 + A11** cached 5 m + SWR 30 m |
| 62 | GET | `/analytics/boards/:id/burndown?range=14d` | ✅ | member | **A7** `$setWindowFields` over rollups |
| 63 | GET | `/audit-logs?actor=&action=&entity=&from=&to=&cursor=` | ✅ | admin | Streaming CSV via `?format=csv` |
| 64 | GET | `/admin/jobs/:queue?status=` · `POST /admin/jobs/:queue/:id/retry` | ✅ | superadmin | BullBoard-backed ops API |

> **Count check:** 8 (auth) + 4 (users) + 8 (workspaces) + 16 (boards/cards) + 7 (pages) + 9 (chat) + 12 (files/search/notif/analytics/admin) = **64 documented routes**, of which the **primary 40** are numbered above and the rest are supporting endpoints listed as `Na`. The README states: *"40 primary APIs (the numbered list) + 24 supporting endpoints, all in OpenAPI."* That comfortably exceeds "35–40" without looking padded.

### 10.3 Sample request/response (copy this style for all 40 in `docs/api.md`)

```http
POST /api/v1/cards/65f1.../move HTTP/1.1
Authorization: Bearer eyJhbGciOi...
Idempotency-Key: 6f1c2b8e-6f4a-4d2e-9f0a-2b1c3d4e5f60
Content-Type: application/json

{ "targetListId": "65f2...", "beforeCardId": "65f3...", "afterCardId": null, "version": 4 }
```
```json
{
  "success": true,
  "data": {
    "_id": "65f1...", "listId": "65f2...", "order": "a0G4z",
    "title": "Ship drag & drop", "assignees": [ { "_id": "u1", "name": "Ravi" } ],
    "checklistProgress": 0.4, "version": 5, "updatedAt": "2026-09-24T06:31:12.004Z"
  },
  "meta": { "requestId": "01J8Z...", "cached": false }
}
```
```json
// 409 — optimistic concurrency
{ "success": false, "error": { "code": "VERSION_CONFLICT",
  "message": "This card was modified by Neha 2s ago.", "details": { "currentVersion": 5 },
  "requestId": "01J8Z..." } }
```

### 10.4 Standard error catalogue (used by the frontend to pick UI behaviour)

| Code | HTTP | UI behaviour |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Inline field errors from RHF (path-mapped), focus first invalid field |
| `UNAUTHENTICATED` / `TOKEN_EXPIRED` | 401 | Silent refresh once → retry; else redirect to login with `?next=` |
| `FORBIDDEN_ROLE` | 403 | Toast + hide the action (permission-aware UI) |
| `RESOURCE_NOT_FOUND` | 404 | Route to not-found state, offer back |
| `VERSION_CONFLICT` / `ORDER_CONFLICT` | 409 | "Someone else changed this" dialog: *Reload* / *Keep mine* |
| `QUOTA_EXCEEDED` | 413/403 | Upgrade prompt with plan comparison |
| `RATE_LIMITED` | 429 | Toast with countdown from `Retry-After`; disable button until then |
| `DEPENDENCY_UNAVAILABLE` | 503 | Full-screen retry screen + status page link |

### 10.5 OpenAPI / Swagger

- **Generation:** Zod schemas → `@asteasolutions/zod-to-openapi` → `openapi.json` at build time. Committed to `docs/openapi.json` and diff-checked in CI (`If the API changed and docs didn't, CI fails`).
- **Served at:** `GET /api/docs` (Swagger UI, dark theme), `GET /api/openapi.json`.
- **Features:** bearer **and** cookie auth schemes, tag groups per module, request/response examples, error schema documented once, `x-rate-limit` and `x-cache-ttl` vendor extensions per route, "Try it out" works against `/api/v1` in dev.
- **Postman collection** exported from the spec into `docs/postman.json` (nice extra, 2 minutes of work, graders notice).

### 10.6 Example route + controller + validation (the pattern for all 40)

```ts
// modules/cards/cards.routes.ts
const router = Router({ mergeParams: true });
router.use(authenticate);
router.patch(
  '/:id/move',
  authorize('card:update'),
  validate({ params: z.object({ id: objectId }), body: MoveCardSchema }),
  idempotent(),                       // replays the cached response for a repeated Idempotency-Key
  asyncHandler(cardsController.move),
);
export default router;

// modules/cards/cards.controller.ts — thin, no business logic, no Mongoose
export const cardsController = {
  move: async (req: Request, res: Response) => {
    const card = await cardsService.move(req.params.id, req.body, req.auth!);
    res.status(200).json(ok(card, { requestId: req.id }));
  },
};

// modules/cards/cards.schema.ts — one schema, four jobs:
//   1) runtime validation  2) TS types  3) OpenAPI  4) shared with the frontend form
export const MoveCardSchema = z.object({
  targetListId: objectId,
  beforeCardId: objectId.nullish(),
  afterCardId: objectId.nullish(),
  version: z.number().int().nonnegative(),
}).refine((v) => !(v.beforeCardId && v.afterCardId && v.beforeCardId === v.afterCardId),
           { message: 'beforeCardId and afterCardId must differ' });
export type MoveCardDTO = z.infer<typeof MoveCardSchema>;
```

---

## 11. Realtime Layer (Socket.io)

### 11.1 Connection & authorization

```ts
// infrastructure/socket/socket.server.ts
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token
      ?? parseCookie(socket.handshake.headers.cookie, 'orbit_at');
    const claims = await verifyAccessToken(token);          // throws on expiry/bad signature
    if (await isDenylisted(claims.jti)) throw new ApiError(401, 'TOKEN_REVOKED');
    socket.data.user = await hydrateUser(claims.sub, claims.wid);   // cached 10 m
    next();
  } catch (e) { next(new Error('UNAUTHORIZED')); }           // client sees connect_error
});

io.on('connection', async (socket) => {
  const { id: userId, workspaceIds } = socket.data.user;

  socket.join(`user:${userId}`);                              // personal room (notifications)
  for (const wid of workspaceIds) socket.join(`workspace:${wid}`);

  await presence.markOnline(userId, workspaceIds);            // Redis TTL key + broadcast
  socket.to(`workspace:${wid}`).emit('presence:update', { userId, status: 'online' });

  socket.on('room:join',  async (payload, ack) => { /* permission-checked join */ });
  socket.on('room:leave', (payload, ack) => { /* ... */ });
  socket.use(rateLimitSocket(socket));                        // 20 events / 10 s / socket
  socket.on('disconnect', () => void presence.markOffline(userId));
});
```

**Room naming:** `workspace:{wid}` · `board:{boardId}` · `channel:{channelId}` · `page:{pageId}` · `user:{userId}` · `typing:{channelId}` (ephemeral).
**Rule:** a `room:join` for `channel:*` verifies channel membership; for `board:*`/`page:*` verifies workspace membership + visibility. Failures emit `error` with `FORBIDDEN_ROOM`.

### 11.2 Event contract (22 events)

**Server → Client**

| Event | Payload | Room | Notes |
|---|---|---|---|
| `notification:new` | `{id,type,title,link,actor,at}` | `user:{id}` | Bell badge bump |
| `presence:update` | `{userId,status:'online'\|'away'\|'offline'}` | `workspace:{wid}` | Batched every 2 s |
| `typing:start` / `typing:stop` | `{channelId,userId}` | `typing:{channelId}` | Ephemeral, 4 s auto-stop |
| `message:new` | `{message,clientId?}` | `channel:{id}` | `clientId` lets the sender reconcile its optimistic bubble |
| `message:updated` | `{id,body,editedAt,version}` | `channel:{id}` | Edit |
| `message:deleted` | `{id,tombstone:true}` | `channel:{id}` | Keeps thread shape |
| `reaction:updated` | `{messageId,emoji,userIds}` | `channel:{id}` | Delta, not full message |
| `thread:updated` | `{rootId,replyCount,lastReplyAt,lastAuthor}` | `channel:{id}` | "3 replies" chip |
| `unread:updated` | `{channelId,unreadCount,mentionCount}` | `user:{id}` | Badge sync |
| `card:created` / `card:updated` / `card:deleted` | `{card}` / `{id,version}` | `board:{id}` | Board live sync |
| `card:moved` | `{cardId,listId,order,version,movedBy}` | `board:{id}` | Other clients re-sort; the actor ignores its own echo via `clientMutationId` |
| `list:reordered` / `list:rebalanced` | `{lists:[{id,order}]}` | `board:{id}` | Bulk order repair |
| `comment:new` | `{entityType,entityId,comment}` | `card:{id}` or `page:{id}` or `channel:{id}` | Unified comments |
| `page:updated` | `{pageId,title,version,updatedBy}` | `page:{id}` | Tree/meta sync (content conflicts resolved by `version`) |
| `page:presence` | `{pageId,viewers:[{id,name,avatar}]}` | `page:{id}` | "2 people viewing" avatars |
| `file:ready` | `{fileId,url,thumbnails}` | `user:{id}` | Replaces the upload placeholder |
| `workspace:member:changed` | `{userId,action,role}` | `workspace:{wid}` | Directory refresh |
| `job:progress` | `{jobId,queue,progress,label}` | `user:{id}` | Export/import progress bars |
| `error` | `{code,message}` | socket | Recoverable failures (e.g. `FORBIDDEN_ROOM`) |

**Client → Server (with ack callbacks — every one returns `{ok, data?, error?}`)**

| Event | Payload | Ack | Notes |
|---|---|---|---|
| `room:join` / `room:leave` | `{room}` | `{ok}` | Permission-checked |
| `typing:start` / `typing:stop` | `{channelId}` | – | Throttled client-side |
| `message:send` | `{channelId,body,clientId,fileIds}` | `{ok, message}` | Server assigns `_id`, writes DB, broadcasts; **REST is the fallback** if socket is down |
| `presence:heartbeat` | – | `{ok}` | Every 30 s; refreshes Redis TTL |
| `sync:since` | `{scope,updatedAt}` | `{events:[…]}` | Reconnect delta-sync (avoids full refetch) |

### 11.3 Reliability rules

1. **Sockets are an accelerator, not the source of truth.** Every socket-driven mutation has a REST equivalent, so offline/blocked-WebSocket clients still work — and the live-debugging round can't break the app by killing sockets.
2. **Idempotent handlers** — the client sends `clientId`; a retried `message:send` returns the already-created message instead of duplicating it (Redis `SETNX orbit:dev:idem:socket:{clientId}`).
3. **Ordering** — per-channel ordering is guaranteed by the DB (`createdAt` + `_id` tiebreak) not by socket arrival. Clients sort by `(createdAt,_id)` on insert.
4. **Reconnect** — `connectionStateRecovery` (2 min) + `sync:since` for longer gaps; exponential backoff with jitter client-side.
5. **Scale-out** — `@socket.io/redis-adapter` for pub/sub across workers/containers; `ip_hash` in Nginx only for the upgrade handshake. Documented Cluster-mode caveat (hash tags) in §8.1.
6. **Backpressure** — `maxHttpBufferSize: 64 KB`, per-socket token bucket, and a hard cap on rooms per socket (50) to prevent resource exhaustion.
7. **Observability** — gauge `socket_connections_active`, `socket_events_total{event,dir}`, `socket_emit_duration_seconds`; log slow emits > 250 ms.

---

## 12. Frontend Architecture

### 12.1 Stack

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite 5** + TS (strict) | Assignment-mandated; instant HMR, small bundles, first-class SWC |
| UI | **React 18** | Concurrent features, `useTransition` for non-urgent updates (chat search, filters) |
| Routing | **React Router 6.4+** (data router) | Nested layouts (AppShell), route loaders, error boundaries per route, lazy routes |
| Server state | **TanStack Query v5** | Caching, retries, infinite scroll, optimistic mutations, offline-friendly |
| Client state | **Zustand** (+ `persist`) | UI store (theme, sidebar, modals), session store, socket store — tiny and testable |
| Forms | **React Hook Form** + Zod resolver | Mandated; shared schemas from `packages/shared` |
| Styling | **Tailwind CSS** + CSS variables | Token-driven theming (dark mode), no runtime CSS-in-JS cost |
| Primitives | **Radix UI** (unstyled, accessible) wrapped in our own components | Keyboard/ARIA correctness without fighting a design system |
| Icons | **lucide-react** | Consistent 1.5px stroke, tree-shakeable |
| DnD | **@dnd-kit** | Accessible (keyboard DnD), touch support, virtualization-friendly |
| Virtual list | **@tanstack/react-virtual** | 10k-message channels, 1k-card boards at 60 fps |
| Motion | **framer-motion** (sparingly) + CSS transitions | Micro-interactions, respects `prefers-reduced-motion` |
| Editor | **TipTap** core (or a custom block list) | Slash-command block editor for Pages |
| Charts | **Recharts** | Dashboard widgets |
| Toasts | **sonner** wrapped in our `<Toaster/>` | Stackable, promise-aware toasts |
| i18n | **i18next** + `en` (+ placeholder `hi`) | Nice-to-have, cheap for a senior-level signal |
| Testing | **Vitest + RTL** (unit) · **Playwright** (e2e) | §17 |
| Offline | **Workbox** (vite-plugin-pwa) + **Dexie** (IndexedDB) | §12.9 |

### 12.2 State management strategy (the #1 interview question about the frontend)

| Data | Where it lives | Why |
|---|---|---|
| Entities from the API (boards, cards, pages, messages, notifications) | **TanStack Query** | It's a cache with staleness policy, not app state. Query keys give precise invalidation. |
| Realtime arrivals (socket events) | TanStack Query **cache writes** (`setQueryData`) | Keeps one source of truth: the UI reads the query cache, not a parallel socket store |
| Session / tokens (in memory) + user prefs | **Zustand** session store (+ httpOnly cookie for the refresh token) | Access token in memory only → XSS can't read a persisted token |
| UI state (theme, sidebar collapsed, active modal, palette open, active workspace) | **Zustand** UI store (`persist` for theme + sidebar) | Synchronous, no provider ceremony, trivially unit-testable |
| Form state | RHF local state | Rerender isolation |
| Optimistic writes | TanStack Query `onMutate` + snapshot rollback | §12.7 |

**Query key convention:** `['ws', wid, 'board', boardId, 'cards', filters]`, `['ws', wid, 'channel', cid, 'messages']` → helpers `qk.ws(wid).board(id).cards(f)` keep keys consistent across features (the only reliable way to avoid stale-cache bugs).

**Socket → Query bridge (one place, not scattered):**

```ts
// features/realtime/useSocketBridge.ts
useEffect(() => {
  const onMoved = ({ cardId, listId, order, version, movedBy }: CardMoved) => {
    if (movedBy === me.id) return;                                  // ignore our own echo
    qc.setQueriesData<Card[]>({ queryKey: qk.ws(wid).boards().cardsAll() }, (old) =>
      old?.map((c) => (c._id === cardId ? { ...c, listId, order, version } : c))
        .sort((a, b) => a.order.localeCompare(b.order)));
  };
  socket.on('card:moved', onMoved);
  socket.on('message:new', onMessageNew);
  socket.on('notification:new', onNotificationNew);
  // … one handler per event, all writing into the query cache
  return () => { socket.off('card:moved', onMoved); /* … */ };
}, [wid, me.id, qc]);
```

### 12.3 Routing map

```
/                                   → redirect to /w/:lastWorkspaceId or /login
/login · /register · /forgot-password · /reset-password/:token · /verify/:token
/invite/:token                      → accept-invite screen (works logged-in or not)

/w/:wid                             → AppShell (Sidebar + Header + Footer + Outlet)
   /  (workspace home)              → overview: recents, activity, quick actions
   /boards                          → board index (grid, create/archive/filter)
   /boards/:boardId                 → Kanban (DnD)  [virtualized columns]
   /boards/:boardId/cards/:cardId   → card modal (deep-linkable, DnD of attachments)
   /docs                            → page index
   /docs/:pageId                    → page view (block editor, backlinks, versions)
   /chat                            → channel index / @you inbox
   /chat/:channelId                 → channel view (virtualized timeline + thread panel)
   /files                           → file library (grid/list, filter by type/entity)
   /search?q=                       → results page (grouped by type, filters)
   /notifications                   → notification centre (grouped, mark read)
   /settings/profile|sessions|appearance|notifications
   /w/:wid/settings/general|members|roles|integrations|audit|billing(placeholder)
   /w/:wid/analytics                → dashboards (overview + burndown)
   /admin/queues                    → BullBoard (superadmin only)
   *                                → NotFound (with search fallback)
/403 · /500 · /offline               → dedicated state pages
```

Route-level code splitting: every top-level route is `React.lazy()`; the Kanban, TipTap editor, and Recharts dashboards are the heaviest chunks and load on demand (`build.rollupOptions.manualChunks` verified in CI against a bundle budget).

### 12.4 Layout shell (Sidebar + Header + Footer)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER  ☰  [⌘K Search ─────────────────────────────]  ⊕Create  🔔3  ⚙︎  ◐  (avatar) │  64px
├──────────────┬─────────────────────────────────────────────────────────────────────┤
│              │  PAGE HEADER (breadcrumb · title · meta · primary action · tabs)      │
│  SIDEBAR     ├─────────────────────────────────────────────────────────────────────┤
│  260px       │                                                                     │
│  (collapsible│                    <Outlet />  — route content                        │
│   → 72px     │                                                                     │
│   icon rail) │                                                                     │
│              │                                                                     │
│  • Workspace │                                                                     │
│    switcher  │                                                                     │
│  • ⌘K search │                                                                     │
│  • Home      │                                                                     │
│  • Boards ▸  │                                                                     │
│  • Docs ▸    │                                                                     │
│  • Chat ▸    │                                                                     │
│  • Files     │                                                                     │
│  • Analytics │                                                                     │
│  • Admin     │                                                                     │
│  • Recent    │                                                                     │
│  • Favourites│                                                                     │
│  • [user]    │                                                                     │
├──────────────┴─────────────────────────────────────────────────────────────────────┤
│ FOOTER  ● Connected · v1.4.2 · docs · status · help · ⌘K hint   (status strip)     │  40px
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **Sidebar**: sections (primary nav, collapsible groups, recents), drag-to-resize (persisted width), collapse to icon rail with tooltips, mobile → off-canvas drawer with backdrop + focus trap, keyboard shortcuts (`[` toggles, `g b`/`g c`/`g d` jumps, `?` opens shortcut sheet), live unread badges, contextual "+" actions per section.
- **Header**: global search trigger (⌘K), create menu (board/page/channel/invite), notification bell with popover, presence indicator, theme switcher, avatar menu (profile, settings, logout, switch workspace), page-agnostic; hidden on auth screens.
- **Footer**: connection status (`● Connected` / `◌ Reconnecting…` / `● Offline` with queued-count), app version + commit SHA (from `VITE_APP_VERSION`), uptime/status link, docs/help, keyboard hint. Sub-40px so it reads as a status strip rather than clutter — and it doubles as a visible demonstration of the offline/socket work.
- **Responsive breakpoints**: `≥1280` full sidebar; `1024–1279` collapsible narrow; `768–1023` icon rail + drawer; `<768` hamburger + bottom sheet nav for chat/board switching; Kanban scrolls horizontally with snap and a column-width token (`w-[280px] md:w-[300px]`).

### 12.5 Forms — the standard pattern (RHF + Zod + our components)

```tsx
const schema = CreateCardSchema;                       // ★ imported from packages/shared
export function CreateCardForm({ listId, onDone }: Props) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } =
    useForm<CreateCardDTO>({ resolver: zodResolver(schema), defaultValues: { priority: 'medium' } });

  const mutation = useMutation({
    mutationFn: (dto: CreateCardDTO) => cardsApi.create(listId, dto),
    onMutate: async (dto) => {                         // optimistic insert
      await qc.cancelQueries({ queryKey: qk.cards(listId) });
      const prev = qc.getQueryData<Card[]>(qk.cards(listId));
      qc.setQueryData<Card[]>(qk.cards(listId), (old = []) => [...old, { ...dto, _id: `tmp-${nanoid()}`, pending: true }]);
      return { prev };
    },
    onError: (err, _dto, ctx) => {
      qc.setQueryData(qk.cards(listId), ctx?.prev);     // rollback
      toast.error(getErrorMessage(err));                 // uses the error catalogue in §10.4
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.cards(listId) }),
    onSuccess: () => { reset(); onDone?.(); toast.success('Card created'); },
  });

  return (
    <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="space-y-4">
      <TextField label="Title" required error={errors.title?.message} {...register('title')} />
      <SelectField label="Priority" options={PRIORITIES} error={errors.priority?.message} {...register('priority')} />
      <DateField label="Due date" error={errors.dueAt?.message} {...register('dueAt')} />
      <UserPicker name="assignees" multiple label="Assignees" register={register('assignees')} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} type="button">Cancel</Button>
        <Button type="submit" loading={isSubmitting || mutation.isPending}>Create card</Button>
      </div>
    </form>
  );
}
```
Rules: every form uses `zodResolver` with a **shared** schema; field components own label + error + hint + a11y wiring (`aria-invalid`, `aria-describedby`, `role="alert"`); submit buttons show `loading` and are disabled while pending; server field errors are mapped back into RHF via `setError` by `path`.

### 12.6 Error boundaries (three levels + a hook)

```tsx
// 1) App-level — catches provider/router crashes
<AppErrorBoundary fallback={<FatalErrorScreen />} />

// 2) Route-level — inside AppShell so nav survives; per-route reset keys
<ErrorBoundary key={location.pathname} fallback={<RouteErrorCard onRetry={reload} showRequestId />}>
  <Outlet />
</ErrorBoundary>

// 3) Widget-level — a broken chart never blanks the dashboard
<ErrorBoundary fallback={<WidgetError label="Burndown chart" />}>
  <BurndownChart boardId={id} />
</ErrorBoundary>

// Query-level — global handlers + per-query opt-out
const qc = new QueryClient({
  defaultOptions: { queries: { retry: (n, e) => !isClientError(e) && n < 2, staleTime: 30_000,
                                refetchOnWindowFocus: false, networkMode: 'offlineFirst' },
                     mutations: { onError: (e) => toast.error(getErrorMessage(e)) } },
});
```
Also: `unhandledrejection` + `error` window listeners forward to Sentry with the last 20 breadcrumbs (route, actions, query keys) and the `requestId` of the failing call — so a demo failure is instantly traceable to a server log line.

### 12.7 Optimistic UI — the contract

| Action | Optimistic behaviour | Rollback rule | Conflict rule |
|---|---|---|---|
| Send message | Bubble appears instantly with `clientId`, clock icon | On error → red "Retry" chip, text preserved, outbox entry kept | `clientId` dedupe on server prevents doubles |
| Toggle reaction | Emoji chip count +1 immediately | Revert on error | Server returns authoritative `userIds`; socket delta fixes others |
| Move card (DnD) | Card renders at the drop position with a temp order key | Revert to original list/position + toast | `409 VERSION_CONFLICT` → "Reload board" prompt |
| Create card/page/channel | Row appears with skeleton shimmer + `pending:true` | Remove row + restore input text | `_id` swap on success (temp→real) |
| Mark notification read | Badge count decrements | Restore count | Server is authoritative on next fetch |
| Assign/unassign user | Avatar appears/removes | Revert | Server prunes invalid assignees |
| Delete (soft) | Row fades with 5 s **Undo** snackbar | Undo → `POST /restore` | Purge job runs at 30 d, so undo is safe |

Implementation rules: **always** `cancelQueries` before `setQueryData`; snapshot with `getQueryData`; rollback in `onError`; `invalidateQueries` in `onSettled`; never optimistic-write across two query keys without a single `onMutate` handler; log a Sentry breadcrumb on every rollback (so you can see rollback frequency in prod — real teams do this).

### 12.8 Infinite scroll & virtualization

```tsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: qk.channel(cid).messages(),
  queryFn: ({ pageParam }) => messagesApi.list(cid, { cursor: pageParam, limit: 50 }),
  initialPageParam: undefined,
  getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  select: (d) => d.pages.flatMap((p) => p.data),
});

// Sentinel-based auto-load (no scroll spam) + "jump to present" affordance
const sentinel = useRef<HTMLDivElement>(null);
useEffect(() => {
  const el = sentinel.current; if (!el || !hasNextPage) return;
  const io = new IntersectionObserver(([e]) => e.isIntersecting && fetchNextPage(), { rootMargin: '400px' });
  io.observe(el); return () => io.disconnect();
}, [hasNextPage, fetchNextPage]);
```
For **chat** the older direction is `fetchPreviousPage` (prepend + scroll anchoring via `overflow-anchor`/manual offset restore so the viewport doesn't jump); for **boards** columns are virtualized with `@tanstack/react-virtual` and infinite-fetch when a column scrolls to the end. Lists > 200 rows (members, audit log, files) use a `DataTable` with virtualized rows.

### 12.9 Offline support & PWA

| Layer | Implementation |
|---|---|
| App shell | Workbox precache → app opens offline (route-level fallbacks to `offline.html`) |
| Read cache | TanStack Query persisted to **IndexedDB** (`persistQueryClient`, `maxAge: 24 h`, whitelisted query keys) → last-viewed board/docs/channels readable offline |
| Media | Runtime cache (CacheFirst, 30 d) for avatars/thumbnails; size-capped |
| Writes | **Outbox in Dexie**: `{id, method, url, body, entity, createdAt, retries}`; drained in FIFO order on `online` with exponential backoff; `Idempotency-Key` = outbox id → server replays safely (this is why idempotency middleware exists) |
| Conflict on flush | Server `409` → item moved to a "Needs attention" list with *Keep mine* / *Discard* actions (never silently dropped) |
| UX | Persistent footer status (`Offline · 3 changes queued`), disabled-by-default actions with tooltips, "You're offline" banner, optimistic bubbles with a clock icon |
| Sync engine | `navigator.onLine` + `online`/`offline` events + periodic background sync (where supported) |
| Testing | Playwright with `context.setOffline(true)` — asserts queued send then successful flush (a demonstrable offline test, rare and impressive) |

---

## 13. Design System & UI Component Library

> **Goal:** a *custom* library — not a themed third-party kit. Radix provides behaviour (focus traps, ARIA, positioning); **every visual, variant, and API is ours**. Folder: `apps/web/src/components/ui/`. Each component ships with: `.tsx`, `.test.tsx`, and a story/demo entry in `/dev/components` (a hidden route that renders every variant — perfect for a code-review walkthrough and for the demo).

### 13.1 Design tokens (the foundation)

```css
/* styles/tokens.css — single source of truth; Tailwind reads these */
:root {
  /* brand + semantic colours (light) */
  --color-brand-50:#eef4ff; --color-brand-100:#d9e5ff; --color-brand-300:#a9c4ff;
  --color-brand-500:#3b6cf6; --color-brand-600:#2f57d8; --color-brand-700:#2443ab;
  --color-success-500:#16a34a; --color-warning-500:#d97706; --color-danger-500:#dc2626;
  --color-info-500:#0ea5e9;

  /* surfaces & text */
  --bg-canvas:#f7f8fa; --bg-surface:#ffffff; --bg-raised:#ffffff; --bg-sunken:#eef0f4;
  --bg-overlay:rgba(15,23,42,.45);
  --text-primary:#0f172a; --text-secondary:#475569; --text-muted:#94a3b8;
  --text-inverse:#f8fafc; --border-subtle:#e6e9ef; --border-strong:#cbd5e1;
  --focus-ring:#2563eb;

  /* chart palette (accessible in both themes) */
  --chart-1:#3b6cf6; --chart-2:#16a34a; --chart-3:#d97706; --chart-4:#8b5cf6; --chart-5:#0ea5e9;

  /* spacing scale = Tailwind 4px base; radii & shadows */
  --radius-sm:6px; --radius-md:10px; --radius-lg:14px; --radius-full:999px;
  --shadow-xs:0 1px 2px rgba(16,24,40,.05);
  --shadow-sm:0 1px 3px rgba(16,24,40,.10),0 1px 2px rgba(16,24,40,.06);
  --shadow-md:0 4px 12px rgba(16,24,40,.10);
  --shadow-lg:0 12px 32px rgba(16,24,40,.14);

  /* motion */
  --ease-out:cubic-bezier(.16,1,.3,1); --dur-fast:120ms; --dur-base:200ms; --dur-slow:320ms;
}
[data-theme='dark'] {
  --bg-canvas:#0b0f17; --bg-surface:#121826; --bg-raised:#182033; --bg-sunken:#0e1420;
  --text-primary:#e8ecf4; --text-secondary:#a7b0c0; --text-muted:#6b7688;
  --border-subtle:#212b3d; --border-strong:#33405a;
  --shadow-md:0 4px 14px rgba(0,0,0,.5);
}
@media (prefers-reduced-motion: reduce) { * { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
```

**Theme handling:** `ThemeProvider` writes `data-theme` on `<html>`; a tiny **inline script in `index.html`** sets it before first paint (zero flash); Zustand `persist` stores the choice; `system` follows `prefers-color-scheme` with a live listener. Every component must look correct in light, dark and high-contrast — enforced by a Storybook-style visual check (Playwright screenshot snapshots of `/dev/components` in both themes).

### 13.2 Component inventory (60 components)

#### A. Foundations (12)
`ThemeProvider` · `ToastProvider (sonner)` · `TooltipProvider` · `Portal` · `FocusTrap` · `VisuallyHidden` · `Icon` (lucide wrapper w/ size tokens) · `Skeleton` · `Spinner` · `Divider` · `Kbd` (shortcut chip) · `Portal`-based `Popover`.

#### B. Buttons & actions (9) — *customized, with every state*
| Component | Variants | Sizes | States | Notes |
|---|---|---|---|---|
| `Button` | `primary` `secondary` `outline` `ghost` `danger` `success` `link` | `xs sm md lg icon` | default/hover/active/focus-visible/**loading**/disabled | `loading` swaps in a spinner, keeps width (no layout shift), blocks double submit |
| `IconButton` | same | `sm md lg` | + active | Requires `aria-label` (typed prop, compile-time enforced) |
| `SplitButton` | primary + menu | `md` | – | For "Create ▾" (board/page/channel) |
| `ButtonGroup` | attached | – | – | Segmented controls (board view switch) |
| `CopyButton` | – | `sm` | Copying→Copied | Clipboard + toast + fallback |
| `Link` | – | – | – | Internal (router) vs external (icon + `rel="noopener"`) |
| `FloatingActionButton` | – | – | – | Mobile quick-create |
| `ConfirmButton` | `danger` default | – | – | Wraps Button with an inline confirm popover |
| `AsyncButton` | – | – | – | `promise` prop → auto loading/success/error |

> ⚠️ **Every submit/delete in the app uses `Button`/`AsyncButton` — never a raw `<button>`.** That single rule is what makes the UI feel consistent, and it's a great answer to "how do you enforce design consistency?".

#### C. Destructive-action family (7) — *explicitly requested*
| Component | Purpose | Behaviour |
|---|---|---|
| `DeleteButton` | The canonical destructive action | `variant="danger"` + trash icon + optional label; **never deletes directly** — opens `ConfirmDialog` (or `ConfirmPopover` when `inline`) |
| `ConfirmDialog` | Generic confirmation | Title, body, `confirmLabel`, `cancelLabel`, `variant`, `loading`, `onConfirm`; focus lands on **Cancel** by default; `Esc` cancels |
| `TypedConfirmDialog` | High-impact deletes | Requires typing the resource name (`Neha's Board`) to enable the button; used for: delete board, delete workspace, purge trash, remove member, revoke all sessions |
| `DangerZone` | Settings section | Red-bordered card grouping destructive actions with explanatory copy + consequences list |
| `UndoToast` | Soft-delete UX | 5 s "Deleted · **Undo**" snackbar wired to `POST /restore`; auto-dismisses |
| `BulkActionBar` | Multi-select | Sticky bottom bar: "3 selected · Move · Archive · Delete · Clear" with the same confirm rules |
| `LeaveGuard` | Unsaved changes | Blocks navigation with a "Discard changes?" dialog (RHF `isDirty`) |

**Copy rules for destructive UI:** state the *consequence*, not the action — *"Delete board «Sprint 42»? Its 47 cards and 3 pages will move to Trash for 30 days. Team members will lose access immediately."* Never "Are you sure?".

#### D. Forms & inputs (16)
`TextField` · `PasswordField` (visibility toggle + strength meter) · `TextareaField` (auto-grow + char counter) · `NumberField` (stepper + min/max) · `SelectField` · `Combobox` (async, virtualized — assignees/labels) · `MultiSelect` (chips + search) · `CheckboxField` · `RadioGroup` · `SwitchField` · `SliderField` · `DateField` (calendar, TZ-aware, keyboard nav) · `DateRangeField` (analytics filters) · `TimeField` · `FileDropzone` (drag/drop, paste, progress, retry, size/type validation, image previews) · `FormRow`/`FormSection` (label + description + error + `aria-describedby` wiring).

Non-negotiables: label always visible (no placeholder-only labels), error text under the field with an icon, `aria-invalid`, `autoComplete` tokens correct, `enterKeyHint` on mobile, `dir="auto"` for RTL text in chat, 100% keyboard operable.

#### E. Feedback & status (11)
| Component | Notes |
|---|---|
| `Alert` | variants `info success warning danger neutral`; optional title, actions, dismissible, `role="status"`/`alert` |
| `Banner` | full-width app-level (offline, maintenance, email-unverified, trial ending) with an action slot |
| `Toast` / `toast.*` | `success · error · info · warning · promise · custom`; max 3 stacked, dedupe by key, action button support, positions, a11y live region |
| `EmptyState` | illustration + title + description + primary/secondary action (used by **every** list) |
| `ErrorState` | message + requestId + "Retry" + "Copy details" |
| `LoadingState` | skeleton grids/rows per entity (`SkeletonCard`, `SkeletonTable`, `SkeletonChat`) |
| `ProgressBar` | determinate/indeterminate + label + percentage |
| `StatusDot` | online/away/offline/busy with legend tooltip |
| `Badge` | `neutral brand success warning danger outline`; count badges on nav |
| `Chip` | removable token (assignees, labels, filters) |
| `Tooltip` | 300 ms delay, keyboard focusable triggers, never carries essential-only info |

#### F. Overlays & navigation (10)
`Dialog` (sizes, header/footer slots, scrollable body, focus trap, restores focus) · `Drawer`/`Sheet` (right/bottom, mobile nav, card detail on mobile) · `ConfirmPopover` · `DropdownMenu` (items, separators, submenus, destructive styling, shortcuts) · `ContextMenu` (right-click card/message) · `CommandPalette` (**⌘K**: navigate, recent, create, search; grouped results, fuzzy match, keyboard-first) · `Popover` · `HoverCard` (user profile preview) · `Tabs` (underline/pill, URL-synced) · `Breadcrumbs` (truncating with overflow menu).

#### G. Data display (12)
| Component | Notes |
|---|---|
| `DataTable` | column defs, sorting, row selection, virtualization >200 rows, sticky header, column visibility, CSV export, empty/loading/error slots, row actions |
| `Pagination` | cursor-based "Load more" + total + page-size control |
| `InfiniteList` | IntersectionObserver wrapper with sentinel + scroll restoration |
| `KanbanColumn` | sticky header w/ WIP count, droppable, "+ Add card" composer, overflow menu |
| `CardTile` | title, labels, assignee avatars, due chip (overdue = danger), checklist ring, comment/attachment counts, cover; draggable + keyboard-movable |
| `MessageBubble` | author avatar, timestamp grouping (<5 min collapse), edited flag, reactions row, hover toolbar (react/reply/thread/edit/more), tombstone state, thread summary chip |
| `BlockEditor` | slash menu, drag handle, block-type switcher, inline formatting, code block, callout, todo; autosave indicator |
| `Avatar` / `AvatarGroup` | image fallback → initials with deterministic colour; `+3` overflow; presence ring |
| `Timeline` | activity feed with actor, verb, target, relative time, diff summary |
| `Tree` | nested nav for page sidebar & file browser (keyboard arrows, lazy children) |
| `FilePreview` | image/video/audio/pdf/code previews in a lightbox |
| `StatCard` | KPI number + delta arrow + sparkline + tooltip on how it's computed |
| `Chart` | Recharts wrappers: `BarChart`, `LineChart`, `DonutChart`, `Heatmap`, `BurndownChart` — all share axis/tooltip/legend theming and a "no data" state |

#### H. Layout & structure (8)
`AppShell` · `Sidebar` (nav sections, workspace switcher, resizer, collapse, mobile drawer) · `SidebarNavItem` (icon, label, badge, active pill, tooltip when collapsed) · `Header` (search trigger, create menu, bell, theme, avatar menu) · `Footer` (status strip: connection, version, docs, shortcuts) · `PageHeader` (breadcrumbs, title, meta, actions, tabs) · `Container`/`Grid`/`Stack` (spacing primitives) · `SplitPane` (chat thread panel, page outline) · `ResizablePanel`.

### 13.3 Component API conventions (enforced by ESLint + review)

1. **`forwardRef` everywhere** (Radix composition + focus management need it).
2. **Props extend the native element**: `interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: ...; size?: ...; loading?: boolean }` — so native attributes always work.
3. **No boolean soup**: `variant` + `size` + `tone`; `className` accepted last for escape hatches; `asChild` on interactive wrappers for polymorphic rendering.
4. **Every interactive component is keyboard-operable and has a visible `:focus-visible` ring** using `--focus-ring`.
5. **Every async component exposes `loading`/`disabled`/`error` states** — no component leaves the consumer to invent these.
6. **Accessibility contract per component** documented in its JSDoc (`@a11y role=dialog, aria-modal, labelled by title`).
7. **Motion:** transform/opacity only (no layout-thrashing animation), 120/200/320 ms tokens, reduced-motion respected.
8. **i18n-ready strings:** all user-visible text through `t()` (even if only `en` ships) — global components never hardcode copy.
9. **Test file next to component** with at least: renders, keyboard path, and a state variant (loading/disabled/error).
10. **`/dev/components` gallery** updated whenever a component is added → the reviewer sees the whole library in 30 seconds.

### 13.4 Screens catalogue (what the dashboard actually contains)

| Screen | Key UI elements |
|---|---|
| **Login / Register** | Split layout: left = brand panel with product value + testimonial, right = form card; inline validation, "show password", OAuth-style buttons disabled with tooltip "SSO on Enterprise", rate-limit messaging |
| **Workspace home** | Greeting + quick actions (New board/page/invite), "Jump back in" recents grid, activity feed, my open cards, unread mentions |
| **Boards index** | Grid of board cards (background colour, member avatars, card counts, last activity), filter/sort bar, archived toggle, empty state with template picker |
| **Kanban board** | Horizontal scroll of `KanbanColumn`s, sticky column headers with counts, cards with labels/avatars/due chips, DnD with drop indicators + keyboard DnD, filter chips row, member filter avatars, "board updated by X" live banner |
| **Card detail** | Modal (desktop) / full sheet (mobile): title (inline edit), description editor, labels, assignees, due date, checklist with progress, attachments (drag & drop), comments with mentions, activity timeline, watchers, archive/delete actions, permalink copy |
| **Docs index / Page view** | Tree sidebar + editor canvas, breadcrumbs, cover + icon picker, slash menu, autosave indicator ("Saved 2 s ago"), share menu, version history drawer with preview + restore, backlinks panel, favourite toggle, presence avatars |
| **Chat** | Channel sidebar (sections: channels/DMs, unread bold, mention badge, muted icon), virtualized timeline with day dividers and date chips, message hover toolbar, reactions, thread side panel, composer (attachments, emoji, `@` mention autocomplete, `/` commands, code block paste detection, "Enter to send" pref), typing indicator, "jump to latest" pill |
| **Search** | Command palette (⌘K) + full results page with type tabs, filters (workspace/board/channel/author/date), highlighted snippets, keyboard-first results, "no results" suggestions |
| **Notifications** | Grouped by entity/day, filters (unread/mentions/assigned), mark-all-read, inline actions (accept invite, open card), quiet-hours hint |
| **Analytics** | KPI row (`StatCard`s), cards-by-status donut, created-vs-completed line, burndown with ideal line, assignee leaderboard, activity heatmap, channel activity bars, range picker, "Refreshed 2 min ago" + manual refresh |
| **Settings** | Profile, appearance (theme, density, sidebar), notifications (per-channel/board mute matrix), sessions (device list + revoke), security, danger zone |
| **Workspace settings** | General (name/slug/logo/TZ), members table (role dropdown, remove with confirmation, invite), roles matrix view, integrations (placeholder), audit log (filters + CSV export), billing placeholder |
| **Admin** | Queue dashboard (BullBoard embedded), cache stats (hit ratio, memory, keys by prefix), feature flags, maintenance mode toggle |
| **Error/edge screens** | 403, 404 (with search), 500, Offline, Maintenance, Session expired |

### 13.5 Accessibility & responsiveness checklist (used as a PR gate)

- [ ] Keyboard-only pass on the new screen (Tab order logical, no traps, `Esc` works, focus restored)
- [ ] Screen-reader pass: landmarks (`header`/`nav`/`main`/`contentinfo`), live regions for toasts/unread, labels on all controls
- [ ] Contrast ≥ 4.5:1 (text) / 3:1 (UI borders & focus rings) in **both** themes
- [ ] Tested at 360 / 768 / 1024 / 1440 / 1920 with no horizontal page scroll
- [ ] Touch targets ≥ 44×44 px on mobile
- [ ] `axe-core` (via Playwright) reports 0 critical/serious violations
- [ ] Loading/empty/error states all implemented (not just the happy path)
- [ ] `prefers-reduced-motion` respected

---

## 14. Security Blueprint

### 14.1 Layered control map (OWASP Top 10 → implementation)

| OWASP risk | Control in Orbit | Proof in repo |
|---|---|---|
| **A01 Broken access control** | Every route has `authenticate` + `authorize(permission)`; **tenant isolation** enforced in repositories (`workspaceId` always applied); cross-tenant returns `404`; membership-checked socket rooms | `tests/security/idor.spec.ts` — 20 tests attempting cross-tenant reads/writes |
| **A02 Cryptographic failures** | argon2id passwords; SHA-256 refresh-token hashes; TLS everywhere; secrets via env/secret manager; no PII in logs | `config/env.ts` rejects weak secrets < 32 chars |
| **A03 Injection** | Zod validation + Mongoose casting; **no `$where`**, no string-concatenated queries; `express-mongo-sanitize` strips `$`/`.` keys; React escapes by default; DOMPurify on rich text/HTML renders | `tests/security/injection.spec.ts` incl. NoSQL operator payloads |
| **A04 Insecure design** | Rate limits per tier; typed-confirm on destructive ops; soft delete; quotas; explicit permission matrix reviewed per module | `docs/security.md` threat model |
| **A05 Security misconfiguration** | Helmet (CSP, HSTS, `nosniff`, frameguard), CORS allowlist (no `*` with credentials), Redis `requirepass` + ACL, Mongo auth + bind to network only, Docker non-root, no `latest` tags, `.env` never committed | `helmet` config + `docker-compose` review checklist |
| **A06 Vulnerable components** | `pnpm audit` + Dependabot + Trivy image scan in CI; lockfile committed; Node LTS pinned | `.github/workflows/security.yml` |
| **A07 Auth failures** | Refresh rotation + reuse detection + family revocation; `jti` denylist; login lockout; uniform timing; token TTLs short; sessions revocable | `tests/auth/refresh-rotation.spec.ts` |
| **A08 Data integrity** | Idempotency keys; optimistic concurrency (`version`); webhook HMAC signing; S3 presigned PUT with content-length + content-type conditions | `tests/api/idempotency.spec.ts` |
| **A09 Logging failures** | Audit log for all admin/security events; Pino redaction; Sentry with `requestId`; alert rules on 401/403 spikes | `docs/runbook.md` |
| **A10 SSRF** | Link-preview fetcher uses an allowlist scheme (http/https), blocks private CIDRs (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, `::1`), 5 s timeout, 1 MB cap, no redirects followed, runs in the worker not the API | `linkPreview.spec.ts` with 12 SSRF payloads |

### 14.2 JWT & session design (exact)

```
ACCESS TOKEN                                     REFRESH TOKEN
type:  JWT (HS256 in dev, RS256 in prod)         type:  opaque 64-byte random (base64url)
ttl:   15 minutes                                 ttl:   7 days (30 with "remember me")
store: memory (JS) + httpOnly cookie for SSR     store: httpOnly, Secure, SameSite=Lax cookie
                                                 at rest: SHA-256 hash in Mongo (never raw)
claims: { sub, wid, role, jti, typ:'access',       rotation: on every /auth/refresh →
          iss, aud, iat, exp }                               old.rotatedAt set, new issued,
                                                             replacedBy linked
REVOCATION:                                      REUSE DETECTION:
  logout → jti in Redis denylist (ttl=exp-left)    if a presented token has rotatedAt != null
  logout-all → user.tokenVersion++ + family revoke  → revoke ENTIRE familyId + alert + force login
  role change → wid scoped revocation + cache bust
```

```ts
// middleware/authenticate.ts
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = bearer(req) ?? req.cookies?.orbit_at;
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED');
  const claims = await verifyJwt(token);                       // signature + exp + iss + aud
  if (claims.typ !== 'access') throw new ApiError(401, 'WRONG_TOKEN_TYPE');
  if (await redis.exists(`orbit:dev:denylist:jti:${claims.jti}`)) throw new ApiError(401, 'TOKEN_REVOKED');
  const session = await sessionCache.get(claims.sub);           // 15 m Redis cache
  if (session.tokenVersion !== claims.ver) throw new ApiError(401, 'SESSION_INVALIDATED');
  if (session.status !== 'active') throw new ApiError(403, 'ACCOUNT_SUSPENDED');
  req.auth = { id: claims.sub, workspaceId: claims.wid, role: claims.role, jti: claims.jti };
  next();
});
```

**Cookie & CSRF policy:** refresh + access cookies are `httpOnly; Secure; SameSite=Lax; Path=/`. Because the web app sends cookies, all mutating routes require a **double-submit CSRF token** (`orbit_csrf` cookie + `X-CSRF-Token` header, compared with `timingSafeEqual`) and enforce `Origin`/`Referer` allowlisting. Mobile/CLI clients use the `Authorization` header instead and skip CSRF (documented, with the reasoning: no ambient cookie → no CSRF surface).

### 14.3 RBAC design

**Roles (workspace-scoped):** `owner` › `admin` › `manager` › `member` › `viewer`. **Platform scope:** `superadmin` (ops-only, audited, cannot read tenant content by default — "break-glass" flow required).

```ts
// shared/permissions.ts — single source of truth, shared with the frontend for UI gating
export const PERMISSIONS = [
  'workspace:read','workspace:update','workspace:delete','workspace:transfer',
  'member:invite','member:update_role','member:remove','member:read',
  'board:create','board:read','board:update','board:delete','board:archive',
  'list:create','list:update','list:delete','list:reorder',
  'card:create','card:read','card:update','card:move','card:delete','card:assign',
  'comment:create','comment:update','comment:delete',
  'page:create','page:read','page:update','page:delete','page:share','page:restore',
  'channel:create','channel:read','channel:update','channel:archive','channel:join',
  'message:send','message:update','message:delete','message:react','message:pin',
  'file:upload','file:read','file:delete',
  'search:read','notification:read','analytics:read','audit:read','admin:queue','admin:cache',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, Permission[] | ['*']> = {
  owner:   ['*'],
  admin:   [/* everything except workspace:transfer, workspace:delete */],
  manager: [/* board/list/card full, page full, channel create/update, analytics:read,
              member:read, comment full, message full, file full */],
  member:  [/* board:read/create, card:create/read/update/move, comment:*, page:create/read/update,
              channel:join/read, message:send/react, file:upload/read, search:read */],
  viewer:  [/* *:read only, message:read, file:read, notification:read */],
};
```

**Decision layers (all must agree):**
1. **Role** — what the role can do at all.
2. **Resource scope** — e.g. `card:update` additionally requires `card.assignees.includes(userId)` OR `role >= manager`, OR board membership for private boards.
3. **Visibility** — private pages: creator + `allowedUserIds`; private channels: `memberIds`; private boards: `memberIds`.

```ts
// middleware/authorize.ts — composable, resource-aware
export const authorize = (permission: Permission, opts?: {
  load?: (req: Request) => Promise<{ workspaceId: string; memberIds?: string[]; assignees?: string[];
                                      allowedUserIds?: string[]; createdBy?: string; visibility?: string }>;
  allowOwner?: boolean;      // author self-service (edit/delete own comment)
  scope?: 'own' | 'any';
}) => asyncHandler(async (req, _res, next) => {
  const { role, id: userId } = req.auth!;
  if (!hasPermission(role, permission)) throw new ApiError(403, 'FORBIDDEN_ROLE');

  if (opts?.load) {
    const res = await opts.load(req);
    if (opts.scope === 'own' && ![res.createdBy, ...(res.assignees ?? [])].includes(userId) && !isManagerPlus(role))
      throw new ApiError(403, 'FORBIDDEN_SCOPE');
    if (res.visibility === 'private' && !(res.memberIds ?? []).includes(userId) && !isAdminPlus(role))
      throw new ApiError(404, 'RESOURCE_NOT_FOUND');    // enumeration-safe
  }
  next();
});
```
Enforcement points: (1) HTTP middleware, (2) **service layer re-check** (defence in depth for job-driven and socket-driven flows), (3) MongoDB query-level filtering in repositories (a `workspaceId`/`memberIds` guard that no query can forget — a base repository hook adds it automatically), (4) socket room checks. **Four layers, and you can say why:** middleware is easy to bypass from a job; the query layer is the only one that can't be.

### 14.4 Input validation & sanitization

| Surface | Control |
|---|---|
| HTTP body/query/params | Zod at route boundary; strict object (`unknownKeys: 'strip'`); size limits (1 MB JSON) |
| NoSQL operators | `express-mongo-sanitize` + Zod object shapes (no free-form objects reaching queries) |
| Rich text / markdown | Server-side sanitization (allowed tag/attr allowlist) + DOMPurify on render; never `dangerouslySetInnerHTML` on server data |
| File names | Slugified, stored key generated server-side (`ws/{wid}/{type}/{uuid}.{ext}`) — user input never becomes a path (no traversal) |
| URLs (link preview, embeds) | Scheme allowlist + SSRF guard (§14.1 A10) |
| CSV export | Formula-injection guard (prefix `'` on `= + - @` cells) — small detail, big impression |
| Socket payloads | Zod-validated per event, 64 KB max, per-socket rate limit |

### 14.5 Rate limiting, quotas & abuse

| Throttle | Limit | Scope | Action |
|---|---|---|---|
| Register/login | 10 / 15 min | IP + email | 429 + `Retry-After` + audit `auth.throttled` |
| Password reset request | 3 / hour | email | Silent 202 (no enumeration) |
| Global API | 300 / min | IP | 429 |
| Authenticated writes | 60 / min | user | 429 |
| Search | 30 / min | user | 429 |
| Uploads | 100 / hour · 2 GB/day | user | 429 / 413 |
| Socket messages | 20 / 10 s | socket | emit dropped + warning event |
| Mentions `@channel` | 5 / hour | user/channel | 429 + UI hint |
| Workspace quotas | seats, storage (1 GB free), boards (20 free), file size (25 MB) | workspace | `QUOTA_EXCEEDED` with upgrade CTA |

Also: **login lockout** after 10 failures (30 min, exponential), **device/anomaly email** on new-country login (stretch), **bot mitigation** hook point for hCaptcha on register (feature-flagged), **soft-suspend** flow for abusive tenants.

### 14.6 File upload security

```
1  POST /files/presign   → validate {name,size,mime}; check quota + tier limits; sniff extension
                           vs declared MIME; generate key; return presigned PUT with
                           Content-Type + Content-Length-Range conditions (5 min TTL)
2  client PUTs directly to S3/MinIO (API never proxies bytes)
3  POST /files/:id/confirm → HEAD the object; verify size + ETag/checksum matches the declaration;
                           read magic bytes; if the sniffed type disagrees → status 'quarantined'
                           + audit + reject; else 'ready' + enqueue thumbnails/EXIF strip/virus hook
4  downloads → GET /files/:id/url → permission check → 5-min presigned GET; public assets served
               through a CDN path with cache headers; no directory listing ever
```
Storage buckets: `orbit-uploads-private` (default, no public ACL), `orbit-public-assets` (avatars, board covers — read-only public). Lifecycle rule deletes `pending` objects older than 24 h.

### 14.7 Security testing & verification (put this in the README)

- `tests/security/` — 60+ assertions: IDOR (cross-tenant), privilege escalation (member→admin), JWT tampering (`alg: none`, wrong secret, expired, wrong `typ`), refresh reuse, CSRF, NoSQL injection, XSS payload corpus, path traversal, SSRF payload set, mass-assignment (send `role: 'owner'` in a profile update → ignored), oversized payloads, rate-limit enforcement.
- `pnpm audit --audit-level=high` + Trivy in CI (fails the build on high/critical).
- Manual checklist in `docs/security.md` with the ZAP baseline scan command (documented as optional evidence for the "Security Best Practices" line).
- **Threat model table** (asset → threat → control → residual risk) — 1 page, high signal.

---

## 15. Performance Engineering

### 15.1 Budgets (CI-enforced where possible)

| Metric | Budget | How measured |
|---|---|---|
| API p95 (read, cached) | ≤ 80 ms | k6 + Prometheus histogram |
| API p95 (read, uncached) | ≤ 200 ms | k6 |
| API p95 (write) | ≤ 300 ms | k6 |
| Board render (500 cards) | ≤ 300 ms server · ≤ 1.2 s TTI client | k6 + Lighthouse |
| Channel open (10k msgs) | ≤ 250 ms server (50 msgs) | k6 |
| Socket message fan-out (200 listeners) | ≤ 150 ms p95 | custom socket load script |
| Search p95 (100k docs) | ≤ 400 ms | k6 + `explain` |
| Cold API boot | ≤ 2.5 s | Docker healthcheck timing |
| Bundle (initial JS, gzip) | ≤ 250 KB | `vite build` + `size-limit` in CI |
| Route chunk (largest) | ≤ 120 KB | `rollup-plugin-visualizer` |
| Lighthouse (desktop, prod build) | ≥ 90 perf / 95 a11y / 95 best-practices | CI |
| Memory per API worker | ≤ 400 MB steady (1k rps soak, 30 min) | `process.memoryUsage` metric |

### 15.2 Backend techniques (each one is a talking point)

| Technique | Where | Effect |
|---|---|---|
| Cursor pagination | all lists | O(1) deep paging; no `skip` scans |
| Compound indexes matching query + sort | §7.4 | Removes in-memory SORT stage |
| `$project` + `.lean()` on hot reads | board cards, messages | 30–50% less BSON, no hydration cost |
| Two-tier cache (Redis + 5 s in-worker LRU micro-cache for hot config) | board meta, permissions | Saves Redis round-trips at high rps |
| `SWR` + tag invalidation | dashboards, board meta | Zero-cost freshness; no thundering herd |
| Single-flight/stampede lock | any expensive cache miss | One DB query instead of N |
| `$facet` to collapse 4 circulars into 1 query | board load, dashboard | Fewer round-trips, no waterfall |
| Denormalized counters in the same transaction | `cardCount`, `replyCount`, `unreadCount` | Avoids `countDocuments` on hot paths |
| Daily rollup collection for analytics | `analyticsdaily` | Dashboard = range scan on tiny docs |
| Bulk writes (`bulkWrite`, `insertMany` ordered:false) | notification fan-out, reindex | 10–50× fewer round-trips |
| Payload trimming (`fields=` param + DTO mapping) | message list, search | Smaller JSON, faster TTI |
| HTTP compression (brotli) + ETag/304 | Nginx + Express | Bandwidth + perceived speed |
| Connection pooling tuned | Mongo `maxPoolSize: 20`, warmup query at boot | No cold-start latency spike |
| Socket emit batching (2 s coalescing for presence) | presence layer | Cuts event volume ~90% |
| `Promise.all` for independent IO | controllers/services | Removes sequential waterfalls |
| Streaming CSV/JSON export | audit, analytics | Constant memory on large exports |
| Worker offloading (thumbnails, email, link previews) | BullMQ | Keeps request path short |

### 15.3 Frontend techniques

Route-level code splitting · `manualChunks` for vendor/editor/charts · tree-shaken icon imports · `React.lazy` + `Suspense` boundaries with skeletons · virtualization (messages, cards, tables, member lists) · `useDeferredValue`/`useTransition` for search & filters · memoized selectors (`useShallow`) in Zustand · `React.memo` on `CardTile`/`MessageBubble` with stable callbacks · image sizing (`srcset`), lazy loading, `decoding="async"`, blurred placeholder thumbnails · font subsetting + `font-display: swap` + preload · `content-visibility: auto` on long offscreen sections · CSS variables instead of JS theme recalcs · preconnect to the API + CDN · request dedupe/abort via TanStack Query · prefetch on hover of nav items and board cards · optimistic UI so perceived latency ≈ 0 · prefetch next page when the scroll cursor is 80% through the current page.

### 15.4 Load testing (k6 scenarios — committed in `tests/load/`)

```js
// tests/load/board-read.js — smoke → load → stress → soak, with thresholds that FAIL the run
export const options = {
  scenarios: {
    smoke:   { executor: 'constant-vus', vus: 5,   duration: '1m', tags: { s: 'smoke' } },
    load:    { executor: 'ramping-vus', startVUs: 0,
               stages: [{ duration: '2m', target: 50 }, { duration: '5m', target: 200 }, { duration: '1m', target: 0 }],
               startTime: '1m' },
    spike:   { executor: 'ramping-arrival-rate', startRate: 50, timeUnit: '1s', preAllocatedVUs: 500,
               stages: [{ duration: '30s', target: 500 }, { duration: '30s', target: 50 }], startTime: '9m' },
    soak:    { executor: 'constant-vus', vus: 100, duration: '30m', startTime: '11m' },
  },
  thresholds: {
    'http_req_duration{expected_response:true}': ['p(95)<200', 'p(99)<500'],
    'http_req_failed': ['rate<0.01'],
    'http_reqs': ['rate>200'],
    'checks': ['rate>0.99'],
  },
};
```

Five scenarios: (1) **board-read** (cached + uncached paths), (2) **auth-flow** (login/refresh churn), (3) **chat-write** (socket message storm across 200 connections), (4) **search**, (5) **dnd-storm** (concurrent card moves — proves transaction/optimistic-concurrency correctness under contention: zero lost updates, `409` rate < 1%).

**Results artifact:** `docs/load-test-report.md` with a table (VUs, RPS, p50/p95/p99, error rate, memory, Redis hit ratio) plus the Grafana screenshot. This document alone can swing the *Performance 10%* — most candidates have no evidence at all.

### 15.5 Performance proof pack (what you show, not just claim)

1. `explain('executionStats')` output for 6 key queries showing `IXSCAN`, `totalKeysExamined ≈ nReturned`, and `docsExamined` low.
2. k6 summary + Grafana dashboard screenshot.
3. Lighthouse scores for dashboard, board, chat.
4. Bundle analysis screenshot (before/after a chunk split).
5. Redis hit-ratio report from `/admin` cache stats.
6. A short "why it's fast" table in the README (the §15.2 list, trimmed to 8 rows).

---

## 16. Observability, Logging & Metrics

### 16.1 Structured logging (Pino)

```ts
// infrastructure/logger/logger.ts
export const logger = pino({
  level: env.LOG_LEVEL,                       // trace|debug|info|warn|error|fatal
  base: { service: 'orbit-api', env: env.NODE_ENV, pid: process.pid,
          worker: process.env.WORKER_INDEX ?? 0, version: env.APP_VERSION, commit: env.GIT_SHA },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password',
                    'req.body.token', '*.passwordHash', '*.refreshToken', '*.otp', '*.creditCard'],
            censor: '[REDACTED]' },
  serializers: { err: pino.stdSerializers.err, req: pino.stdSerializers.req, res: pino.stdSerializers.res },
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});

// AsyncLocalStorage request context → every log line in a request carries the same ids
export const requestContext = new AsyncLocalStorage<{ requestId: string; userId?: string; workspaceId?: string }>();
const child = () => logger.child({ ...requestContext.getStore() });
```
**Log levels policy:** `error` = needs a human; `warn` = degraded but handled (retry succeeded, cache miss storm, stale lock); `info` = business events (login, card created, invite sent, job completed); `debug` = diagnostics (cache hit/miss, query time, socket event); `trace` = payload-level, **dev only**. Never log PII, tokens, or full payloads in `info`.

**Correlation:** `X-Request-Id` generated per request (uuid v7 — time-sortable!), echoed to the client, attached to every log line, propagated into BullMQ job data (`requestId`) and into socket events, and set as the Sentry tag. **Demo moment:** paste the `requestId` from an error toast into the log viewer and show the exact server-side cause.

**Sampling:** 100% of `warn`/`error`; `info` 100% (low volume by design); `debug` 5% in prod (`sampleRate` via `fast-json-parse` middleware) — a real production tradeoff you can explain.

### 16.2 Metrics (Prometheus)

```
# RED (per route)          orbit_http_request_duration_seconds{method,route,status}
                           orbit_http_requests_total{method,route,status}
                           orbit_http_in_flight_requests
# domain                   orbit_cards_moved_total{result}
                           orbit_messages_sent_total{channel_type}
                           orbit_auth_logins_total{result}
                           orbit_cache_operations_total{result="hit|miss|stale"}
                           orbit_cache_invalidation_total{tag}
                           orbit_socket_connections_active
                           orbit_socket_events_total{event,direction}
# queues                   orbit_queue_jobs_total{queue,status}
                           orbit_queue_waiting{queue}   orbit_queue_failed_total{queue,job}
                           orbit_job_duration_seconds{queue,job}
# data                     orbit_mongo_pool_connections{state}
                           orbit_mongo_query_duration_seconds{collection,operation}
                           orbit_redis_commands_total{cmd}   orbit_redis_keys_evicted_total
# node                     orbit_process_memory_bytes{type}      orbit_event_loop_lag_seconds
                           orbit_gc_duration_seconds
```
Exposed at `GET /metrics` (protected: internal network only or bearer-token guarded), scraped by Prometheus, visualised in the provisioned Grafana dashboard (**4 panels minimum: request rate/latency/errors, cache hit ratio, queue depth + failures, resource usage**). Screenshot goes in the README.

**Alert rules (in `infra/observability/alerts.yml`, documented even if not deployed):**

| Alert | Condition | Severity |
|---|---|---|
| HighErrorRate | 5xx rate > 2% for 5 min | critical |
| HighLatency | p95 > 500 ms for 10 min | warning |
| QueueBacklog | `waiting > 1000` for 10 min | warning |
| JobFailureSpike | failed rate > 5% for 5 min | critical |
| CacheEvictions | `evicted_keys > 0` on **queue** instance | critical |
| LowCacheHitRatio | hit ratio < 60% for 15 min | warning |
| EventLoopLag | lag > 0.2 s for 5 min | warning |
| MongoPoolSaturated | pool usage > 90% for 5 min | warning |
| DiskSpaceLow | volume > 85% | critical |

### 16.3 Tracing & error tracking

- **OpenTelemetry (optional, documented):** `@opentelemetry/sdk-node` with auto-instrumentation (http, express, mongoose, ioredis) + `AsyncLocalStorage` context → spans visible in Jaeger (compose profile `observability`). Shows you understand distributed tracing even if the graders don't run it.
- **Sentry:** API + worker + browser. Release = git SHA, `beforeSend` scrubs PII, `requestId` tag, source maps uploaded in CI, per-issue fingerprints for dedupe, breadcrumbs from the frontend (navigation, mutations, socket events).
- **Health checks:** `/health/live` (no deps), `/health/ready` (Mongo ping + Redis ping + queue connectivity + disk), `/health/startup` (indexes built + migrations applied). Docker `HEALTHCHECK` uses `/health/ready`; Nginx `max_fails=3 fail_timeout=10s` so a bad worker is pulled out automatically.

### 16.4 Runbook (`docs/runbook.md` — 1 page per incident)

For each of these: symptom → likely cause → immediate mitigation → fix → prevention: API 5xx spike · Mongo replica-set failover · Redis cache OOM/evictions · **queue stalling** · socket reconnect storms · slow query (with `currentOp`/`explain` commands) · memory leak (heap snapshot procedure) · disk full from uploads/logs · certificate expiry · DLQ growth · duplicate webhooks · stuck BullMQ job lock (`--unlock` procedure) · accidental mass delete (restore-from-backup drill with RPO/RTO numbers: RPO 5 min via oplog/AOF, RTO 30 min documented).

---

## 17. Testing Strategy and Coverage

### 17.1 The pyramid for this project

```
                 ┌───────────────────────────┐
                 │  E2E (Playwright)   ~25   │  5%   critical journeys, offline, a11y
                 ├───────────────────────────┤
                 │  Integration (Supertest)  │  35%  real Mongo RS + real Redis,
                 │       ~120 specs          │       HTTP → DB → cache → queue assert
                 ├───────────────────────────┤
                 │  Unit (Vitest/Jest)  ~180 │  45%  services, permissions, utils,
                 │                           │       fractional index, zod schemas
                 ├───────────────────────────┤
                 │  Static: TS strict, ESLint, │  15%  typed contracts, no `any`,
                 │  zod schema → type parity   │       OpenAPI drift check
                 └───────────────────────────┘
   Plus: contract tests (OpenAPI ↔ implementation), load tests (k6), security suites (§14.7)
```

**Coverage targets by area (Jest `coverageThreshold`):** services ≥ 90% · controllers/routes ≥ 80% · middleware ≥ 85% · utils/repositories ≥ 90% · jobs ≥ 75% · **global ≥ 60% hard gate, 75% actual target**. Coverage is uploaded to Codecov with a badge in the README, and CI **fails below threshold** (`--coverage --coverageThreshold='{"global":{"lines":60}}'`).

### 17.2 Test infrastructure (the part most candidates get wrong)

```ts
// tests/setup/globalSetup.ts
// 1) Boot an ephemeral Mongo REPLICA SET (transactions require it) once per suite
const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
// 2) Ephemeral Redis with the SAME config as prod (noeviction for queue, LRU for cache)
const redisCache = new RedisMemoryServer(); const redisQueue = new RedisMemoryServer();
// 3) In-memory storage stub implementing the S3 interface (presign → local capture)
// 4) QUEUE_DISABLED=true → jobs execute synchronously so assertions don't need polling
//    (plus a separate suite that runs the real BullMQ path against real Redis)
// 5) Fake timers where deterministic time matters (due-date reminders, TTL expiry)
// 6) Test data factories with faker (deterministic seed) → `makeWorkspace()`, `makeBoard(3 lists, 20 cards)`
```
Helpers: `authedRequest(user)` (returns a supertest agent with cookies handled), `createTenant(role)` (returns user+workspace+token), `expectApiError(res, code, status)`, `await untilQueueDrained()`.

### 17.3 What each test type proves (map to the assignment wording)

| Requirement | Test that proves it |
|---|---|
| JWT auth | `auth.spec.ts`: login → access token used → expired token rejected → refresh works → `401` paths |
| Refresh tokens | `refresh-rotation.spec.ts`: rotate, reuse old → family revoked, parallel refresh race → single winner |
| RBAC | `rbac.matrix.spec.ts`: table-driven over **all roles × all permissions × sample endpoints** (≈ 120 generated cases) — a matrix test is the cleanest possible proof |
| Aggregations | `aggregations.spec.ts`: seed known data, assert exact pipeline output + `explain` uses the expected index |
| Transactions | `transactions.spec.ts`: inject a failure at step 3 (mock throw) → assert **zero** partial writes (this is the killer test for T2/T4) |
| Redis caching | `cache.spec.ts`: first call hits DB (spy), second hits cache, mutation invalidates tag, SWR serves stale then refreshes, stampede → 1 DB call for 20 concurrent |
| BullMQ jobs | `jobs.spec.ts`: enqueue → processor effects asserted; failure → retries with backoff (fake timers); exhausted → DLQ; repeatable registration is idempotent |
| File uploads | `uploads.spec.ts`: presign constraints, MIME sniffing rejects a `.jpg` that is actually a script, quota enforcement, orphan sweep |
| Socket.io | `socket.spec.ts`: handshake auth, forbidden room, message broadcast to 2 clients across 2 workers (adapter proof), typing expiry, reconnect delta-sync |
| Audit logs | `audit.spec.ts`: each mutation writes the expected entry with before/after, actor, requestId |
| Search | `search.spec.ts`: ranking order, permission filtering (viewer can't see private page), facet counts, cursor stability |
| Security | §14.7 suites |
| Offline (frontend) | `offline.spec.ts` (Playwright): go offline → send message → queued banner → online → message delivered exactly once |
| Optimistic UI | `optimistic.spec.ts` (Vitest + MSW): mutation resolves → UI correct; mutation rejects → UI rolled back and toast shown |
| Dark mode | `theme.spec.ts` (Playwright): toggle → `data-theme` flips, no flash on reload, persisted across sessions |
| Error boundaries | `boundaries.spec.tsx`: child throws → fallback rendered, app shell intact, Sentry called once |

### 17.4 CI test pipeline & flake policy

1. `typecheck` → `lint` → `test:unit` (parallel, cached via Turborepo) → `test:integration` (matrix: Node 20/22, Mongo 7) → `test:e2e` (Playwright, 2 shards, against the compose stack) → `coverage` gate → `openapi-drift` check → `security` scans.
2. **Zero-skip policy:** no `.skip` in committed code (lint rule); flaky test → fixed or quarantined with an issue + `test.fixme()` and a TODO referencing the issue number.
3. Tests are deterministic: no `setTimeout` sleeps (use `until()` helpers with timeouts), seeds fixed, DB truncated between tests via `afterEach` collection cleanup, no cross-test ordering dependencies.
4. `test:watch` for dev; `test:ci` mirrors CI exactly; **`pnpm test:all` runs everything in under 6 minutes** (state the number in the README — graders like concrete numbers).

---

## 18. DevOps & Delivery

### 18.1 API Dockerfile (multi-stage, non-root, cache-friendly, healthchecked)

```dockerfile
# ---------- deps ----------
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# ---------- build ----------
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @orbit/shared build \
 && pnpm --filter @orbit/api build          # tsc → dist/ ; also emits openapi.json

# ---------- runtime ----------
FROM node:20-alpine AS runtime
RUN addgroup -S orbit && adduser -S orbit -G orbit \
 && apk add --no-cache curl tini
WORKDIR /app
ENV NODE_ENV=production NODE_OPTIONS="--max-old-space-size=384 --enable-source-maps" WEB_CONCURRENCY=0
COPY --from=build --chown=orbit:orbit /app/node_modules ./node_modules
COPY --from=build --chown=orbit:orbit /app/apps/api/dist ./dist
COPY --from=build --chown=orbit:orbit /app/apps/api/package.json ./
COPY --from=build --chown=orbit:orbit /app/docs/openapi.json ./openapi.json
USER orbit
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/health/ready || exit 1
ENTRYPOINT ["/sbin/tini","--"]                 # PID 1 signal handling for graceful shutdown
CMD ["node","dist/cluster.js"]
```
**Why these choices (say them in review):** multi-stage → small image (~180 MB) and no build tooling in prod · non-root + tini → security + clean SIGTERM propagation · BuildKit cache mount → fast rebuilds · `WEB_CONCURRENCY=0` → auto-detect vCPUs (overridable) · healthcheck → orchestrator can pull a bad worker out · source maps → readable Sentry stacks.

`apps/web/Dockerfile` is a static build served by Nginx (`nginx:alpine`, `try_files $uri /index.html`, security headers, gzip/brotli, immutable caching for hashed assets, `Cache-Control: no-cache` for `index.html` and `sw.js`). `apps/worker/Dockerfile` mirrors the API image with `CMD ["node","dist/worker.js"]` and **no** exposed port.

### 18.2 Docker Compose (dev = one command, full stack incl. replica set)

```yaml
# docker-compose.yml  (dev profile — `docker compose up -d` and you're done)
name: orbit
services:
  mongo:
    image: mongo:7.0
    command: ["--replSet","rs0","--bind_ip_all","--wiredTigerCacheSizeGB","0.5"]
    ports: ["27017:27017"]
    environment: { MONGO_INITDB_ROOT_USERNAME: orbit, MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD} }
    volumes: [ mongo-data:/data/db, ./infra/docker/mongo-init.js:/docker-entrypoint-initdb.d/init.js:ro ]
    healthcheck:
      test: ["CMD-SHELL","mongosh --quiet --eval \"db.adminCommand('ping').ok\" | grep 1"]
      interval: 10s, timeout: 5s, retries: 10, start_period: 20s
    deploy: { resources: { limits: { memory: 1g } } }

  mongo-init:              # runs once: initiates rs0 then exits
    image: mongo:7.0
    depends_on: { mongo: { condition: service_healthy } }
    entrypoint: ["bash","-c","mongosh --host mongo:27017 -u orbit -p ${MONGO_PASSWORD} --authenticationDatabase admin --eval \"rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]})\" || true; mongosh --host mongo:27017 -u orbit -p ${MONGO_PASSWORD} --authenticationDatabase admin --eval \"db.getSiblingDB('orbit').createUser({user:'orbit_app',pwd:'${MONGO_APP_PASSWORD}',roles:[{role:'readWrite',db:'orbit'}]})\""]
    restart: "no"

  redis-cache:
    image: redis:7.2-alpine
    command: ["redis-server","/usr/local/etc/redis/redis.conf"]
    volumes: [ ./infra/docker/redis-cache.conf:/usr/local/etc/redis/redis.conf:ro ]
    environment: { REDIS_CACHE_PASSWORD: ${REDIS_CACHE_PASSWORD} }
    ports: ["6379:6379"]
    healthcheck: { test: ["CMD-SHELL","redis-cli -a $$REDIS_CACHE_PASSWORD ping | grep PONG"], interval: 10s, retries: 5 }
    deploy: { resources: { limits: { memory: 512m } } }

  redis-queue:
    image: redis:7.2-alpine
    command: ["redis-server","/usr/local/etc/redis/redis.conf"]
    volumes: [ ./infra/docker/redis-queue.conf:/usr/local/etc/redis/redis.conf:ro, redis-queue-data:/data ]
    environment: { REDIS_QUEUE_PASSWORD: ${REDIS_QUEUE_PASSWORD} }
    ports: ["6380:6380"]
    healthcheck: { test: ["CMD-SHELL","redis-cli -a $$REDIS_QUEUE_PASSWORD ping | grep PONG"], interval: 10s, retries: 5 }

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment: { MINIO_ROOT_USER: orbit, MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD} }
    ports: ["9000:9000","9001:9001"]
    volumes: [ minio-data:/data ]
    healthcheck: { test: ["CMD","mc","ready","local"], interval: 10s }

  minio-init:              # creates the two buckets + lifecycle rule, then exits
    image: minio/mc
    depends_on: { minio: { condition: service_healthy } }
    entrypoint: ["sh","-c","mc alias set o http://minio:9000 orbit ${MINIO_PASSWORD} && mc mb -p o/orbit-uploads-private o/orbit-public-assets && mc anonymous set download o/orbit-public-assets"]

  api:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    command: ["node","dist/cluster.js"]
    env_file: [ .env ]
    environment:
      NODE_ENV: production
      WEB_CONCURRENCY: "4"                 # or omit → auto (vCPU detection)
      MONGODB_URI: mongodb://orbit_app:${MONGO_APP_PASSWORD}@mongo:27017/orbit?replicaSet=rs0&authSource=orbit
      REDIS_CACHE_URL: redis://:${REDIS_CACHE_PASSWORD}@redis-cache:6379
      REDIS_QUEUE_URL: redis://:${REDIS_QUEUE_PASSWORD}@redis-queue:6380
      S3_ENDPOINT: http://minio:9000
    depends_on:
      mongo-init: { condition: service_completed_successfully }
      redis-cache: { condition: service_healthy }
      redis-queue: { condition: service_healthy }
    ports: ["4000:4000"]
    healthcheck: { test: ["CMD","curl","-fsS","http://127.0.0.1:4000/health/ready"], interval: 30s, start_period: 30s }
    stop_grace_period: 20s
    deploy: { replicas: 2, resources: { limits: { memory: 700m, cpus: "2" } } }   # ← scale out
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }

  worker:
    build: { context: ., dockerfile: apps/worker/Dockerfile }
    env_file: [ .env ]
    environment: { NODE_ENV: production, WEB_CONCURRENCY: "2" }
    depends_on: { api: { condition: service_healthy } }
    deploy: { replicas: 1, resources: { limits: { memory: 800m, cpus: "1.5" } } }
    stop_grace_period: 60s               # let in-flight jobs finish

  web:
    build: { context: ., dockerfile: apps/web/Dockerfile }
    environment: { VITE_API_URL: http://localhost/api/v1 }
    depends_on: { api: { condition: service_healthy } }
    ports: ["8080:80"]

  nginx:
    image: nginx:1.27-alpine
    volumes: [ ./infra/docker/nginx.conf:/etc/nginx/nginx.conf:ro ]
    depends_on: { api: { condition: service_started }, web: { condition: service_started } }
    ports: ["80:80"]
    healthcheck: { test: ["CMD","wget","-qO-","http://localhost/nginx-health"], interval: 20s }

  mailhog:                              # dev email sink → http://localhost:8025
    image: mailhog/mailhog
    ports: ["1025:1025","8025:8025"]

  bullboard:                            # optional standalone; also mounted at /admin/queues
    image: ghcr.io/.../bull-board  # or a tiny custom image referencing our queues
    profiles: ["tools"]
    ports: ["3100:3000"]

  prometheus / grafana / loki / jaeger:
    profiles: ["observability"]         # `docker compose --profile observability up -d`
```
```nginx
# infra/docker/nginx.conf (essentials)
upstream orbit_api { least_conn; server api:4000 max_fails=3 fail_timeout=10s; keepalive 64; }
upstream orbit_web { server web:80; }
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
map $http_x_forwarded_for $client_ip { default $http_x_forwarded_for; '' $remote_addr; }

limit_req_zone $binary_remote_addr zone=api_zone:10m rate=20r/s;
limit_req_zone $binary_remote_addr zone=auth_zone:10m rate=2r/s;

server {
  listen 80; server_name _;
  client_max_body_size 1m;                 # uploads bypass this path (presigned)
  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  gzip on; gzip_types application/json application/javascript text/css image/svg+xml;

  location /api/v1/auth/ { limit_req zone=auth_zone burst=5 nodelay; proxy_pass http://orbit_api; include /etc/nginx/proxy_params; }
  location /api/         { limit_req zone=api_zone burst=40 nodelay;  proxy_pass http://orbit_api; include /etc/nginx/proxy_params; }
  location /socket.io/   { proxy_pass http://orbit_api; proxy_http_version 1.1;
                           proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade;
                           proxy_read_timeout 75s; proxy_send_timeout 75s; }
  location /health       { proxy_pass http://orbit_api; access_log off; }
  location /metrics      { allow 172.16.0.0/12; allow 10.0.0.0/8; deny all; proxy_pass http://orbit_api; }
  location /             { proxy_pass http://orbit_web; }
  location /nginx-health { return 200 "ok"; access_log off; }
}
```

**Dev workflow commands (document in README):**
```bash
cp .env.example .env
docker compose up -d --build            # full stack: mongo RS, 2 redis, minio, api×2, worker, web, nginx, mailhog
docker compose logs -f api worker
docker compose up -d --scale api=4      # ← horizontal scale demo, no config change
docker compose exec api sh -c 'kill -USR2 1'   # ← zero-downtime worker reload demo
open http://localhost                   # app        (Nginx)
open http://localhost:4000/api/docs     # Swagger    (direct)
open http://localhost:8025              # MailHog
open http://localhost:9001              # MinIO console
open http://localhost:3100              # BullBoard  (tools profile)
```

### 18.3 Database migrations & seeding

- **Migrations:** a lightweight runner (`scripts/migrate.ts`) with numbered files (`migrations/001-add-card-order.ts`) storing applied ids in `migrations` collection, run as a **pre-deploy step** (a compose `migrate` service that must complete before `api` scales up). Rollback documented per migration. (Rationale for rolling your own: Mongoose has no built-in migrations; showing a real runner + versioned records is a senior signal.)
- **Indexes:** declared in Mongoose schemas + `Model.syncIndexes()` gated behind an explicit `npm run db:sync-indexes` (never automatic in prod — index builds are heavy and can be surprising). A cheat-sheet in `docs/performance.md` lists every index and which query it serves.
- **Seed script:** `pnpm seed` creates 3 workspaces, 12 users (one per role), 6 boards with 200 cards, 40 pages, 5 channels with 2,000 messages, labels, activity, notifications, plus **1 large dataset workspace** (100k messages, 5k cards) with `SEED_LARGE=true` — needed for the §15 load-test and search-projection numbers. Deterministic seed + `--reset` flag.
- **Backup/restore drill:** `docs/runbook.md` documents `mongodump`/`mongorestore` + Redis AOF restore + S3 versioning, with measured RPO/RTO.

### 18.4 GitHub Actions (5 workflows)

```yaml
# .github/workflows/ci.yml  (abridged)
name: CI
on:
  push: { branches: [main, develop] }
  pull_request:
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      mongo: { image: mongo:7.0, ports: ['27017:27017'] }
      redis-cache: { image: redis:7.2-alpine, ports: ['6379:6379'] }
      redis-queue: { image: redis:7.2-alpine, ports: ['6380:6380'] }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm test:unit -- --coverage
      - run: pnpm test:integration            # boots mongo replica set in-test
      - run: pnpm openapi:check               # fails if docs drift from schemas
      - run: pnpm build
      - run: pnpm size-limit                  # bundle budget gate
      - uses: codecov/codecov-action@v4
  e2e:
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose up -d --wait
      - run: pnpm test:e2e -- --shard=${{ matrix.shard }}/2
        strategy: { matrix: { shard: [1,2] } }
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report-${{ matrix.shard }}, path: apps/web/playwright-report }
      - run: docker compose logs --no-color > compose.log || true
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: compose-logs, path: compose.log }
  smoke-load:
    needs: quality
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - run: k6 run tests/load/board-read.js --summary-export=load.json   # 1-minute smoke variant
```
```yaml
# .github/workflows/security.yml
jobs:
  audit:   { steps: [ pnpm audit --audit-level=high,
                      trivy image scan on built image,
                      gitleaks secrets scan on git history ] }
# .github/workflows/cd.yml  — build → trivy scan → push to GHCR (:sha, :latest) →
#                             deploy to staging via SSH/compose pull+up →
#                             run smoke tests against staging → manual approval → prod
# .github/workflows/images.yml — matrix build for api/web/worker, pushes with SBOM + provenance
# .github/workflows/docs.yml   — regenerate OpenAPI + ER diagram (mermaid-cli) + publish
#                                typedoc/api docs to GitHub Pages, fail if diff is non-empty
```
**Required status checks on `main`:** `quality`, `e2e`, `security` → PRs cannot merge without green CI (branch protection), which is graded positively under both DevOps and Code Review.

### 18.5 Code quality tooling & conventions

| Tool | Config highlights |
|---|---|
| **TypeScript** | `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, path aliases; **`no-any` rule in review** (allow `unknown` + zod parse instead) |
| **ESLint** (flat config) | `@typescript-eslint/strict-type-checked`, `import/order`, `no-floating-promises`, `no-misused-promises`, `require-await`, **custom rules**: `no-mongoose-in-controllers`, `no-req-in-services`, `require-zod-validation-on-mutation`, `no-raw-html`, `no-skip-tests`, `no-console` |
| **Prettier** | 100-char print width, single quotes, trailing commas; `prettier-plugin-tailwindcss` for class ordering |
| **Commitlint + Husky + lint-staged** | Conventional Commits enforced; pre-commit = lint-staged (prettier+eslint on staged) + `tsc --noEmit` on affected; pre-push = unit tests for affected packages |
| **Naming** | `camelCase` vars/functions · `PascalCase` types/components · `SCREAMING_SNAKE` constants · `*.service.ts`/`*.repository.ts`/`*.routes.ts`/`*.schema.ts` suffixes · Mongo collections lowercase plural · permission strings `resource:action` |
| **Error handling** | `ApiError` class + `asyncHandler`; **no silent catches** (`catch (e) { logger.warn(...) }` must rethrow or handle); typed error codes (never string-matching on messages) |
| **File size** | Soft limit 300 lines/component, 400/service (lint warning) — keeps files reviewable |
| **Dead code** | `knip` in CI to catch unused exports/deps |
| **Env discipline** | All env access through `config/env.ts` (`process.env` banned by lint outside that file) |

---

## 19. Git Strategy & 45-Commit Plan

### 19.1 Branching & commit conventions

```
main ──●────────●──────────────●───────────●──────────●─────▶ (protected, signed, tagged releases)
        ╲      ╱ ╲            ╱ ╲         ╱ ╲        ╱
         feat/…   feat/…      fix/…  chore/…  perf/…  docs/…
                 (each = one PR, squash-merged, CI green, self-reviewed)
develop ─ optional long-lived integration branch (if you want a visible flow; otherwise trunk-based on main)
```

- **Conventional Commits:** `feat(boards): add fractional-index card move with transaction` · prefixes `feat|fix|perf|refactor|test|docs|chore|build|ci|style|revert` · **scopes** = module names (`auth`, `boards`, `chat`, `redis`, `queue`, `web:ui`, `docker`, `ci`).
- **Body template:** what · why · how tested · screenshots (for UI) · breaking change note.
- **Rules:** one logical change per commit; **no "wip"/"fix typo"/"final"** commits; never commit `.env` or secrets; every commit compiles (`tsc`) — verified by pre-commit; `git rebase -i` to clean local history before pushing (but keep meaningful sequence); tag releases `v0.1.0` → `v1.0.0` with release notes.
- **Branch protection on `main`:** require PR, require 1 approval (self-review checklist if solo), require status checks, no force-push, linear history.
- **PR template** (`.github/pull_request_template.md`): Summary · Type of change · Screenshots/recording · How to test (exact commands) · Checklist (tests added, docs updated, a11y checked, perf budget respected, no console logs) · Related issue.
- **Realistic timeline spread:** commits on 8–10 different days across ~2 weeks (graders do look at `git log --date=short`). Avoid a single-day dump — that reads as fabricated history.

### 19.2 The 45 commits (in order — copy this into your plan)

| # | Commit message | Files/area | Notes |
|---|---|---|---|
| 1 | `chore: bootstrap pnpm monorepo with turbo, tsconfig and eslint presets` | root, `packages/config` | Shows tooling discipline up front |
| 2 | `chore(shared): add zod schemas, permission matrix and shared TS types` | `packages/shared` | Contract-first |
| 3 | `feat(api): add env validation and app bootstrap with helmet, cors, compression` | `apps/api/src/{config,app.ts}` | Security first |
| 4 | `feat(api): add pino logger with request-id context and redaction` | `infrastructure/logger` | Observability early |
| 5 | `feat(api): add error envelope, ApiError taxonomy and global error middleware` | `shared/errors`, `middleware/error` | Define contracts before features |
| 6 | `feat(api): add mongodb connection with pool tuning, health checks and index sync script` | `infrastructure/db` | |
| 7 | `feat(api): add dual redis clients (cache + queue) with ACL config and health` | `infrastructure/redis`, `infra/docker/redis*.conf` | The requested Redis setup |
| 8 | `feat(infra): add docker compose stack with mongo replica set, redis x2, minio, nginx` | `docker-compose.yml`, `infra/` | One-command boot |
| 9 | `feat(api): add cluster runtime with worker supervision and graceful shutdown` | `cluster.ts`, `server.ts` | Cluster requirement |
| 10 | `feat(auth): add user model, argon2id hashing and register endpoint` | `modules/auth` | |
| 11 | `feat(auth): add login with timing-safe verification and lockout` | | |
| 12 | `feat(auth): add jwt access tokens with typed claims and jti denylist` | | |
| 13 | `feat(auth): add refresh rotation, reuse detection and session family revocation` | | High-signal security feature |
| 14 | `feat(auth): add email verification, password reset and session listing` | | |
| 15 | `feat(api): add authenticate and resource-aware authorize middleware with rbac matrix` | `middleware`, `shared/permissions` | |
| 16 | `feat(api): add rate limiter with redis lua sliding window and tier policies` | `middleware/rateLimit`, `lua/` | |
| 17 | `feat(api): add idempotency middleware with redis replay store` | | Pair with outbox feature |
| 18 | `feat(workspaces): add workspace bootstrap transaction with defaults` | `modules/workspaces` | T1 |
| 19 | `feat(workspaces): add invites, member directory and role management` | | |
| 20 | `feat(boards): add board and list models with fractional order keys` | | LexoRank core |
| 21 | `feat(cards): add card model, checklist, labels and attachments` | | |
| 22 | `feat(cards): add card move endpoint with transaction, counters and audit` | | T2 — the flagship endpoint |
| 23 | `feat(cards): add card filters, cursor pagination and activity timeline` | | |
| 24 | `feat(cards): add create-card-from-message with thread reply` | | C1 + T3 |
| 25 | `feat(pages): add nested page model with materialized path and graphlookup subtree` | | A3 |
| 26 | `feat(pages): add block editor API with autosave, version conflicts and snapshots` | | |
| 27 | `feat(pages): add backlinks, favourites, trash and restore` | | |
| 28 | `feat(chat): add channels, dms and membership` | | |
| 29 | `feat(chat): add messages with threads, reactions and cursor history` | | |
| 30 | `feat(chat): add unread tracking, presence and typing with redis ttl keys` | | |
| 31 | `feat(files): add presigned uploads with mime sniffing, quotas and thumbnails` | | |
| 32 | `feat(search): add weighted text index, faceted search and suggestions` | | A8 |
| 33 | `feat(notifications): add event model, grouping and read state` | | |
| 34 | `feat(analytics): add overview and burndown aggregations with daily rollups` | | A2/A7 |
| 35 | `feat(audit): add append-only audit log with filters and streamed csv export` | | |
| 36 | `feat(realtime): add socket.io gateway with jwt handshake and redis adapter` | `infrastructure/socket` | Cluster-scale realtime |
| 37 | `feat(queue): add bullmq queues, workers, retries, dlq and repeatable jobs` | `apps/worker` | |
| 38 | `feat(api): add health, readiness, metrics and swagger generation from zod` | | |
| 39 | `feat(web): scaffold vite react app with app shell, sidebar, header and footer` | `apps/web` | UI requirement #1 |
| 40 | `feat(web:ui): add design system tokens and core components (button, input, alert, dialog)` | `components/ui` | |
| 41 | `feat(web:ui): add destructive-action components (delete button, typed confirm, danger zone)` | | Explicitly requested |
| 42 | `feat(web): add boards kanban with dnd-kit, optimistic moves and virtualized columns` | | |
| 43 | `feat(web): add docs editor with slash commands, autosave and version history` | | |
| 44 | `feat(web): add chat with virtualized timeline, threads, reactions and optimistic send` | | |
| 45 | `feat(web): add command palette, dark mode, offline outbox and error boundaries` | | Frontend checklist complete |
| 46+ | `test: …` (8–10 commits), `perf: …` (3–4), `docs: …` (5–6), `ci: …` (4), `fix: …` (5–8 organic) | | **Target 70–85 commits total** |

> 45 commits is the *floor* (assignment asks 40+). Aim for **70–85** with tests, docs, perf and CI split into their own commits — that reads as a real project history, and the grader's `git log` check is trivially satisfied.

---

## 20. Milestone Timeline

### 20.1 Full plan (12 working days, ~6–7 h/day)

| Day | Focus | Deliverable by end of day | Commit range |
|---|---|---|---|
| 1 | Bootstrap: monorepo, tsconfig/eslint, shared package, env validation, error taxonomy, logger | `pnpm dev` boots an empty but correct API | 1–5 |
| 2 | Data + infra: Mongo models/indexes, dual Redis, Docker Compose (mongo RS, redis×2, minio, nginx), cluster runtime | `docker compose up` → full stack healthy, `/health/ready` green | 6–9 |
| 3 | Auth complete: register, login, JWT, refresh rotation, verify, reset, sessions, denylist | Auth suite passing; Swagger shows 8 auth endpoints | 10–14 |
| 4 | Cross-cutting: RBAC middleware + matrix tests, rate limiter (Lua), idempotency, validation, audit service | Security middleware proven by tests | 15–17 |
| 5 | Workspaces + members + invites (T1 transaction) + tenant isolation tests | Multi-tenant safe | 18–19 |
| 6 | Boards/Lists/Cards: models, CRUD, **move endpoint (T2)**, filters, activity | Board API complete + aggregation A1 | 20–23 |
| 7 | Pages: tree (A3), blocks, autosave, versions, backlinks, trash · plus C1 card-from-message (T3) | Docs API complete | 24–27 |
| 8 | Chat: channels, messages, threads, reactions, unread, presence · Files: presigned uploads, thumbnails | Chat + Files APIs complete | 28–31 |
| 9 | Search (A8), notifications + BullMQ fan-out, analytics (A2/A7), audit filters/CSV, Socket.io gateway | All 40 APIs live; sockets working | 32–38 |
| 10 | Frontend: shell (sidebar/header/footer), tokens + design system, auth screens, boards kanban + DnD | Login → board drag & drop working end-to-end | 39–42 |
| 11 | Frontend: docs editor, chat, notifications, search/palette, dark mode, offline, error boundaries | All screens working | 43–45 |
| 12 | Hardening: tests to 75%, k6 load test, docs (README, ADRs, ER, API, runbook), CI/CD, badges, demo rehearsal | **Submission-ready** | 46–85 |

**Daily rhythm:** 15 min plan → build → **commit every 45–60 min** → 30 min tests/docs at day end → update `PROGRESS.md` (a visible plan file is a communication signal).

### 20.2 Crunch plan (5 days, aggressive — cut scope, not quality)

| Day | Focus | Cut decisions |
|---|---|---|
| 1 | Bootstrap + infra + auth + RBAC + middleware | Skip invites UI (API only), skip email verification flow UI (token endpoint only) |
| 2 | Workspaces + Boards + Cards + move transaction + audit | No bulk actions, no WIP limits, no board templates |
| 3 | Chat + Pages + Files + Search + BullMQ + Sockets | Pages: 6 block types only, no drag-reorder of blocks; Chat: no link previews |
| 4 | Frontend shell + design system + Boards + Chat + Docs + dark mode | No analytics dashboard UI (API + Swagger proof only), no PWA install prompt |
| 5 | Tests (60% gate), Docker polish, README/ADRs/diagrams, demo rehearsal, offline basic | Offline = read cache only (no outbox), no i18n |

**Scope-cut order (cut from the bottom up when time is short):** analytics UI → webhooks → audit CSV export → page version restore → typing indicators → presence → link previews → file thumbnails → offline outbox → invite UI.


### 20.3 Definition of Done (per feature — apply to every item in §5)

```
[ ] Endpoint implemented (service + repository + route + zod schema)
[ ] RBAC enforced at middleware + service + query layer
[ ] Validation + error codes mapped in the §10.4 catalogue
[ ] Redis caching (if read-heavy) with tag invalidation on write
[ ] Audit entry + activity entry (if it mutates)
[ ] Socket event emitted (if others must see it live)
[ ] BullMQ job enqueued (if it has async side-effects)
[ ] Unit + integration tests written, coverage target met
[ ] OpenAPI doc generated and example added
[ ] UI wired with loading / empty / error / optimistic states
[ ] Accessibility checked (keyboard + axe)
[ ] Responsive at 4 breakpoints
[ ] Committed in a logically-scoped commit
```

---

## 21. Deliverables Checklist

### 21.1 Mapped to the assignment's deliverable list

| Deliverable | Where it lives | Done when |
|---|---|---|
| **Source code** | `orbit-workspace/` monorepo (clean, no TODOs left) | `pnpm i && docker compose up -d` works on a clean machine in <5 min |
| **README** | `README.md` | Badges, 1-line pitch, 60-second quickstart, architecture diagram, feature list, tech stack table, env table, scripts, demo GIFs, perf numbers, "what I'd do next" |
| **Architecture diagram** | `docs/architecture.md` (Mermaid + PNG export) | Includes cluster + Redis topology + request lifecycle + socket flow |
| **ER diagram** | `docs/er-diagram.md` (Mermaid) | All 18 collections, relationships, indexes listed |
| **API documentation** | Swagger UI at `/api/docs` + `docs/api.md` + `docs/openapi.json` + Postman collection | All 40 primaries documented with examples; drift check in CI |
| **Docker setup** | `docker-compose.yml` + 3 Dockerfiles + `infra/` | Compose healthchecks pass; `--scale api=4` works |
| **Git history** | 70–85 conventional commits across 8–10 days | `git log --oneline` reads like a story; branch + PR history present |

### 21.2 Extra deliverables (differentiators)

- [ ] `docs/adr/` — 15 ADRs (§6.6), each 1 page
- [ ] `docs/security.md` — threat model + control map + test evidence
- [ ] `docs/performance.md` — budgets, index cheat-sheet, `explain` output, k6 report
- [ ] `docs/runbook.md` — 13 incident procedures with RPO/RTO
- [ ] `docs/troubleshooting.md` — the §23.4 scenario table (shows debugging method)
- [ ] `docs/scaling.md` — capacity math + scale-up path (§25.3)
- [ ] `docs/demo-script.md` — the §22 script
- [ ] `docs/load-test-report.md` — k6 numbers + Grafana screenshot
- [ ] `docs/commit-convention.md` + `.github/` templates (PR, issues, codeowners)
- [ ] `CONTRIBUTING.md` — how to work in this repo (nobody expects it; everybody notices)
- [ ] `LICENSE`, `CHANGELOG.md` (auto-generated from commits via changesets or `git-cliff`)
- [ ] `PROGRESS.md` — living build log with screenshots of each milestone
- [ ] 3-minute **screen recording** walkthrough (link in README) — insurance if the live demo fails
- [ ] Postman/Bruno collection with an environment file for instant API play
- [ ] `/dev/components` gallery route for the design system

---

## 22. Demo Script (12 minutes)

> Rehearse **three times** with a timer. Have the recording as backup. Prepare `SEED_LARGE=true` data so lists look real.

| Time | What you show | What you say (key line) |
|---|---|---|
| 0:00–0:45 | `docker compose up -d` already running → `docker compose ps` healthy | *"One command boots Mongo replica set, two Redis instances, MinIO, 2 API containers, a worker cluster, Nginx and the web app."* |
| 0:45–1:30 | Architecture diagram in README | *"Cluster inside the container for CPU, containers horizontally for throughput, Redis for shared state so any worker serves any request."* |
| 1:30–2:30 | Register → verify email in MailHog → login → session list → revoke a device | *"Argon2id, rotating refresh tokens with reuse detection, per-device revocation."* |
| 2:30–3:15 | Swagger UI: show auth, cards move, search, analytics schemas | *"Docs are generated from the same Zod schemas that validate requests — they cannot drift; CI fails if they do."* |
| 3:15–4:30 | Create workspace → **highlight the transaction** (logs show T1) → invite a member as `viewer` → show 403 on a write and a hidden button | *"Tenant bootstrap is one transaction — no half-created workspaces. RBAC is enforced in middleware, service and query layer."* |
| 4:30–6:00 | Board: create card → drag between lists → **two browser windows** → move in window A, watch B update → show `card:moved` in logs | *"Move is O(1) via fractional indexing inside a transaction with counters and audit; the other window updates over Socket.io through the Redis adapter."* |
| 6:00–7:00 | Chat: send message optimistically → reaction → thread → type as second user → mention → notification badge → click through | *"Optimistic UI reconciles by clientId; unread counts live in Redis; mentions fan out through BullMQ."* |
| 7:00–8:00 | Message → "Create card" **C1** → card appears on board with a thread reply link | *"This is why it's one product: the chat message, the card and the notification are one transaction."* |
| 8:00–9:00 | Docs: page tree, slash command, autosave indicator, version history → restore, backlinks, trash + undo toast | *"Materialized-path tree, `$graphLookup` subtree, version snapshots every 5 minutes from a repeatable job."* |
| 9:00–10:00 | Search ⌘K → grouped results with highlights, then analytics dashboard (no loading spinner — cached), then audit log CSV export | *"Weighted text index with permission filtering before ranking; dashboards come from pre-aggregated rollups with stale-while-revalidate."* |
| 10:00–11:00 | **Ops tour:** BullBoard queues, Grafana metrics (cache hit ratio, p95), `/api/docs`, `/health/ready`, rate-limit demo (hammer login → 429) | *"Cache hit ratio is 92% under load; p95 read latency 68 ms; queue depth monitored with alert rules."* |
| 11:00–11:45 | **Dark mode** toggle → **offline mode**: go offline, send message (queued banner), go online, message delivers once | *"Offline outbox in IndexedDB with idempotency keys — that's why the API has idempotency middleware."* |
| 11:45–12:00 | Mobile viewport: sidebar → drawer, kanban swipe, responsive footer | *"Fully responsive at 360 px, keyboard-operable, axe-clean."* |

**Then close with tradeoffs (extremely important):** *"What I'd do next: CRDT collaborative editing, read replicas for analytics, Redis Cluster with hash tags above 10k sockets, and moving search to Atlas Search for typo tolerance. What I deliberately skipped: video/voice, SSO and billing — they'd add surface without demonstrating the graded skills."*

---

## 23. Live Debugging Playbook (20% of score)

### 23.1 The method (say this out loud — it's what they're grading)

1. **Reproduce** deterministically; get the smallest failing case (curl/`httpie` or a failing test) before touching code.
2. **Read the error, not the stack alone** — status code → error code → requestId.
3. **Trace the requestId** across API logs, worker logs, Sentry, socket logs. One id, whole picture.
4. **Check dependency health first** (is Redis up? is the replica set primary? is the queue stalled?) — most "application bugs" in a clustered system are infrastructure state.
5. **Form one hypothesis, then falsify it with a single measurement** (log line, `explain()`, `MONITOR`, `currentOp`, `redis-cli info`, latency histogram). Don't shotgun.
6. **Fix the smallest correct thing**, then re-run the failing test; add a regression test.
7. **Explain the systemic fix** (index, cache, guard, alert) — not just the patch.

### 23.2 Toolbox (have these open before the session)

```bash
docker compose logs -f api worker --since 10m | jq 'select(.requestId=="01J8...")'
docker stats --no-stream
mongosh "mongodb://orbit_app:...@localhost:27017/orbit?replicaSet=rs0" --eval "rs.status().myState"
mongosh ... --eval "db.cards.find({listId:ObjectId('...')}).explain('executionStats')"
mongosh ... --eval "db.currentOp({ 'secs_running': { \$gte: 1 } })"
redis-cli -p 6379 -a $PASS INFO stats | grep -E "hit|miss|evicted|rejected"
redis-cli -p 6380 -a $PASS LLEN bull:notifications:wait
redis-cli -p 6379 -a $PASS --bigkeys
redis-cli -p 6379 -a $PASS SLOWLOG GET 10
curl -s localhost:4000/health/ready | jq
curl -s localhost:4000/metrics | grep orbit_queue_waiting
node --inspect=0.0.0.0:9229 dist/cluster.js     # attach Chrome DevTools to a worker
lsof -i :4000 ; ps -eo pid,ppid,rss,cmd | grep node
```

### 23.3 Fifteen scenarios to prepare (what to *check first*, and the fix)

| # | Symptom | Likely cause | Check first | Fix / prevention |
|---|---|---|---|---|
| 1 | `500` on card move; logs show `MongoServerError: Transaction numbers are only allowed on a replica set` | Mono standalone (dev), not RS | `rs.status()`; connection string has `replicaSet=rs0` | Fix compose init / connect string; add a boot-time guard that refuses to start if transactions are unsupported when `REQUIRE_TX=true` |
| 2 | `409 VERSION_CONFLICT` storms on drag | Two clients + stale `version`; retry loop missing | Network tab: same `version` sent twice | Return the latest doc in the `409` body, client re-syncs and retries once; add Sentry breadcrumb to measure frequency |
| 3 | Duplicate cards/messages created | Double-submit; no idempotency | Check `Idempotency-Key`/`clientId` in logs | Confirm idempotency middleware is mounted **before** the handler and that the key is client-stable; add test |
| 4 | Order keys collide; cards appear out of order | Fractions exhausted (long identical prefixes) | `db.cards.find({listId}).sort({order:1}).limit(5)` | Trigger `rebalance-order-keys` job for that list; broadcast `list:rebalanced`; raise the 60-char threshold alarm |
| 5 | Board feels slow; Redis hit ratio drops to 10% | Cache key includes a cursor/limit → key explosion; or TTL too short | `redis-cli --bigkeys`, count keys by prefix | Cache only stable keys (`board:{id}:meta`), keep cursors out of keys; add a key-cardinality metric |
| 6 | Jobs stop processing; queue depth climbs | **Redis-queue evicting keys** under `allkeys-lru`, or worker crashed/stalled | `INFO stats \| grep evicted_keys`; BullBoard stalled tab | Switch to `noeviction`, restart worker, requeue stalled; alert on `evicted_keys > 0` for the queue instance |
| 7 | Socket message doesn't reach a user in another container | Adapter misconfigured / different Redis / room name typo | Check adapter init + `io.of('/').adapter` pub/sub logs | Use the shared cache Redis for the adapter; assert room join permissions; add a cross-worker integration test |
| 8 | `429` on legitimate traffic | Tier limits too tight / all users behind one NAT IP | `RateLimit-Remaining` headers, limiter logs | Key authenticated limits by `userId` (not IP); tune burst; document NAT caveat |
| 9 | Chat list jitters / scrolls to bottom while reading history | New message insert forces scroll; key by index instead of id | React DevTools: list keys | Key by message `_id`, preserve scroll offset on prepend, only autoscroll when already at bottom ("stick to bottom" flag) |
| 10 | Memory climbs until OOM-kill | Unbounded in-memory cache, listener leak (socket handlers added per render), big `$lookup` result retained | `process.memoryUsage` metric, heap snapshot, `Listener count` in DevTools | Bound caches, `useEffect` cleanup for socket handlers (`socket.off`), stream instead of buffer |
| 11 | Search returns nothing for a term that exists | Text index missing after a model change or `syncIndexes` never run | `db.messages.getIndexes()` | Run `pnpm db:sync-indexes`; add a CI check that schema index defs match the DB in staging |
| 12 | `504` timeouts on analytics | Aggregation scanning raw messages without date filter/index | `explain()` → `COLLSCAN`, `secs_running` | Add `$match` on `createdAt` first + index; move to rollup collection; cache 5 min with SWR |
| 13 | Everything `401` right after deploy | Access tokens signed with a different secret between containers (env not shared) / clock skew | Compare `JWT_SECRET` fingerprints + `date -u` on containers | Single source of env (compose `env_file`/secret manager); add a boot log line with a secret fingerprint (never the secret) |
| 14 | File upload succeeds but preview 403 | Private bucket + expired presigned URL; confirm step never ran | S3 object metadata, file status in Mongo | Ensure `confirm` marks `ready` and generates fresh signed GETs; test the full 3-step flow |
| 15 | Frontend blank screen after deploy | Stale cached `index.html` referencing deleted chunks / SW serving old shell | Console network errors, SW cache version | `no-cache` on `index.html`, immutable hashed assets, Workbox `skipWaiting` + `clientsClaim` with a "new version available" prompt |

### 23.4 Instant diagnosis matrix (print this)

| Layer | One command | Reading it |
|---|---|---|
| Process | `docker compose ps` | Any `unhealthy`/restarting → inspect that service's logs first |
| API | `curl -s /health/ready` | Shows per-dependency status JSON |
| Logs | `docker compose logs api \| jq 'select(.level>=50)'` | Errors only, with requestIds |
| Mongo | `rs.status()` + `db.serverStatus().connections` | Primary health, connection saturation |
| Slow queries | `currentOp` + `explain()` | `COLLSCAN` = missing index |
| Redis cache | `INFO stats` | `keyspace_hits/misses`, `evicted_keys`, `rejected_connections` |
| Redis queue | `LLEN bull:*:wait`, BullBoard | Depth, stalled, failed |
| Sockets | `/metrics \| grep socket_connections` | Drop to 0 = adapter/proxy issue |
| Node | `/metrics \| grep event_loop_lag` | > 0.2 s = blocking work (move to worker) |

---

## 24. Code Review Playbook (10%)

### 24.1 How to self-review before requesting review (do this on every PR)

- Re-read the diff as if it were someone else's — you'll catch 30% of your own issues.
- Ask the six questions: **Does it do what the ticket says? Is it tested? Is it secure & tenant-safe? Is it performant (index, N+1, payload)? Is it readable? Does it update docs/OpenAPI?**
- Check error paths explicitly (what happens when the DB throws mid-transaction? when Redis is down? when the input is empty/oversized/unicode?).
- Verify no debug leftovers (`console.log`, `it.only`, TODOs).
- Confirm the PR is **< 400 lines** (split if bigger — a senior habit graders can see in the PR list).

### 24.2 Review comments to leave (and to invite) — real examples

```ts
// ❌ Before — controller reaching into the DB, no tenant guard, unbounded query
router.get('/cards', async (req, res) => {
  const cards = await Card.find({ listId: req.query.listId });   // cross-tenant leak + full scan
  res.json(cards);
});

// ✅ After
router.get('/cards',
  authenticate,
  authorize('card:read', { load: loadListScope }),
  validate({ query: ListCardsQuery }),
  asyncHandler(cardsController.list));        // controller → service → repo (workspaceId applied)
```
```
COMMENT (nit): this changes cardCount outside the transaction — under concurrent moves the
counter will drift. Move it into the same withTransaction block and add a reconciliation
assertion in transactions.spec.ts.

COMMENT (blocking): the cache key includes `cursor`, so every page creates a new key → key
explosion. Cache only the first page (cursor === undefined), or cache per-list meta instead.
Evidence: redis-cli --bigkeys showed 41k keys under board:*.meta after the load test.

COMMENT (praise): nice — returning the fresh doc in the 409 body means the client can
re-sync without an extra round trip. Worth documenting in §10.4 of the plan.
```

### 24.3 If you review someone else's code (or are asked to demo review skill live)

Framework: **Correctness → Security → Performance → Readability → Tests → Docs.** Report blockers vs nits explicitly ("2 blocking, 3 nits"). Praise something specific (it signals you read the code, not the diff). Suggest a concrete alternative, never just "this is wrong". Note missing edge cases as questions ("what happens if `beforeCardId` is from a different list?"). Offer to pair for the complex part.

### 24.4 Code quality signals the grader is looking for

| Signal | Where they'll look |
|---|---|
| Consistent layering | Any module folder — controller thin, service deep, repo DB-only |
| Typed boundaries | No `any` in `src/`; zod at edges; DTO types reused on the frontend |
| Tests that find bugs | `transactions.spec.ts` partial-write test, `refresh-rotation.spec.ts` reuse test |
| Error taxonomy | `ApiError` + codes + mapped statuses; nothing thrown as a bare `Error` |
| Naming | `*.service.ts` etc., permission strings `resource:action`, Mongo collections plural |
| Small, focused files | Soft 300/400-line limits, no God files |
| Comments that explain **why** | e.g. above the lock helper: why Redlock isn't the correctness boundary |
| Docs next to code | `docs/adr`, `docs/api.md`, README "why it's fast" table |

---

## 25. System Design Interview Prep (10%)

### 25.1 The 6-minute whiteboard answer (structure, then content)

> **1) Clarify** (users, read/write ratio, data size, latency, consistency) → **2) APIs & data model** → **3) High-level diagram** → **4) Deep-dive the hard part** → **5) Tradeoffs + failure modes** → **6) Evolution path**.

**Content for Orbit:** read-heavy 10:1 · p95 < 200 ms · multi-tenant with hard isolation · strong consistency for task state (a card must not be in two lists), eventual consistency acceptable for notifications/analytics/search. Hard parts to volunteer: **ordering under concurrency** (fractional index + optimistic concurrency), **fan-out** (Redis adapter for realtime, BullMQ for notifications), **cache coherence across N workers** (tag invalidation + pub/sub), **unread counters** (Redis hash + periodic reconciliation).

### 25.2 Likely questions & crisp answers

| Question | Answer |
|---|---|
| Why Mongo over Postgres? | Assignment mandates Mongo aggregations; documents map naturally to boards/pages; **transactions need a replica set** — which we run. Where I'd choose Postgres: financial ledgers, complex relational reporting, strict invariants across many tables. |
| Why two Redis instances? | BullMQ requires `noeviction` (jobs must never be evicted); cache wants LRU. Different durability and blast radius. Mixing risks silent job loss. |
| Why cluster + containers? | Cluster = use all vCPUs in a container; containers = horizontal scale & deploy isolation. State lives in Redis/Mongo so any worker serves any request. |
| How do you avoid duplicate work with N workers? | Repeatable jobs scheduled **only** in the worker service; deterministic `jobId` for dedupe; distributed locks only for cheap optimizations, never for correctness. |
| How is ordering handled under concurrent drags? | Fractional keys + `__v` optimistic concurrency; `409` returns the current doc; rebalance job repairs pathological key growth. |
| What happens when Redis dies? | Cache: circuit-break and read-through to Mongo (worse latency, same correctness); auth: fail closed; queue: buffer ≤500 then `503`; presence: rebuilt from socket connections. |
| How do you scale to 100k users? | §25.3 math → horizontal API replicas behind Nginx/ALB, Mongo RS with read replicas for analytics, Redis Cluster with hash tags for socket adapter, CDN for assets, queue workers scaled per-queue, sharded by `workspaceId` if needed. |
| How do you handle a hot tenant? | Isolate by `workspaceId` shard/collection prefix, per-tenant rate limits and quotas, dedicated cache namespace, and the option to move that tenant to its own Mongo cluster (documented in `docs/scaling.md`). |
| Where do you need strong consistency? | Card/list/board state, membership & roles, invitation acceptance, counters — MongoDB transactional. Notifications, search, analytics can lag by seconds. |
| How would you add multiplayer editing? | Yjs CRDT per page doc, awareness protocol for cursors, persistence of updates with periodic snapshots + compaction, Socket.io transport — replaces the `version` conflict model for content. |
| How do you prevent data loss on delete? | Soft delete + trash window, undo toast, transactional audit entries, backups with measured RPO/RTO, and a typed-confirmation UX for irreversible actions. |
| What's the riskiest part of this system? | Cross-worker realtime + transactional side-effects: sockets and queues are outside the transaction boundary, so we emit **after commit** and make consumers idempotent — the alternative (emitting inside) publishes phantom events on rollback. |

### 25.3 Capacity math (put this in `docs/scaling.md` — graders love numbers)

**Assumptions:** 100k registered · 20k DAU · 2k concurrent peak · 15 req/DAU·min read, 2 write.

```
Requests      : 20k DAU × 17 ≈ 340k req/day ≈ 4 rps avg → peak 5× ≈ 20 rps  (very manageable)
               with 2k concurrent sockets: socket events dominate (≈ 50–200 msg/s peak)
API capacity  : 1 worker ≈ 600–1200 simple reads/s (p95 < 100 ms, cached)
               → 1 container (4 workers) ≈ 3–5k rps ≈ 150–250× headroom
               → 2 containers for HA (N+1), autoscale on CPU > 65% / p95 > 200 ms
Mongo         : 20k users × ~1.2k docs (cards+messages+pages) ≈ 24M docs ≈ 25–40 GB
               working set ≈ 6–10 GB → 16 GB RAM primary; read replicas for analytics
Redis cache   : hot working set ≈ 300–600 MB → 1 GB instance, alert at 70%
Redis queue   : ~5k jobs/hour peak, ~2 KB/job → < 100 MB actual; 512 MB is plenty
Storage       : 20k users × 25 MB avg ≈ 500 GB → S3 + CDN, lifecycle to IA at 90 days
Bandwidth     : ~50 GB/month egress; brotli + CDN cuts 60–70%
Sockets       : 2k concurrent → 1 Node process handles ~5–10k → 2 containers fine;
                beyond 10k → Redis Cluster + sharded adapter + sticky L4 LB
Cost sketch   : 2× API (2 vCPU/4 GB) + worker (2 vCPU/4 GB) + Mongo M10 + Redis 1 GB
                + 500 GB S3 + CDN ≈ $300–450/month at this scale (state assumptions clearly)
Latency budget: Nginx 1–3 ms · auth (JWT verify + 1 Redis GET) 2–5 ms · service+DB 20–60 ms
                (indexed) · cache hit 1–3 ms · serialization 1–5 ms → p95 ≈ 70–90 ms cached,
                ≈ 150–200 ms uncached  ← matches our budgets in §15.1
```

### 25.4 Tradeoff table (have this memorized)

| Decision | Chosen | Alternative | Why we chose it | What we gave up |
|---|---|---|---|---|
| Ordering | Fractional keys | Integer positions | O(1) drag writes | Occasional rebalance job |
| Consistency for cards | Transactions | Saga/compensation | Simpler correctness with RS available | Requires replica set (heavier dev) |
| State split | Query cache + Zustand | Redux for everything | Less boilerplate, better cache semantics | Two mental models to document |
| Realtime | Socket.io + Redis adapter | SSE / polling | Rooms, acks, auto-reconnect, cross-worker | Bigger payload than raw `ws` |
| Cache invalidation | Tag-based + SWR | Short TTLs only | Correct freshness with fewer cold misses | Tag-index bookkeeping in Redis |
| Docs storage | Flattened blocks + fractional order | Nested block forest | Simple sync, reusable DnD engine | Less faithful to Notion's model |
| Pagination | Cursor | Offset | Stable + index-friendly | No random page jumps |
| Uploads | Direct-to-S3 presigned | Proxy through API | No large bytes through Node cluster | Client must handle 3-step flow |
| Search | Mongo text index | Atlas Search / Elastic | Zero extra infra, meets budget | No typo tolerance/fuzzy |
| Delete | Soft delete + trash | Hard delete | Recoverability + audit | Purge jobs, `deletedAt` filtering discipline |

---

## 26. Requirement Traceability Matrix

> Every assignment line → the code that satisfies it → the test that proves it → the demo moment that shows it. Hand this table to the reviewer.

| # | Requirement (from the PDF) | Implementation | Proof (test / artifact) | Demo (min) |
|---|---|---|---|---|
| 1 | JWT Authentication | `modules/auth/*`, `verifyJwt`, `authenticate` | `tests/auth/jwt.spec.ts` | 1:30 |
| 2 | Refresh Tokens | `refreshToken.service.ts`, rotation + family revocation | `tests/auth/refresh-rotation.spec.ts` | 1:30 |
| 3 | RBAC | `shared/permissions.ts`, `authorize()` (resource-aware) | `tests/rbac/matrix.spec.ts` (role × permission sweep) | 3:45 |
| 4 | 35–40 REST APIs | 40 primary + 24 supporting (§10.2) | OpenAPI drift check in CI | 2:30 |
| 5 | MongoDB Aggregations | 12 pipelines (§7.6: facet, graphLookup, lookup, setWindowFields, bucketAuto) | `tests/aggregations.spec.ts` + `explain` output | 9:00 |
| 6 | Transactions | 6 flows (§7.5) with `withTransaction` + retry | `tests/transactions.spec.ts` (partial-write injection) | 3:15 |
| 7 | Redis Caching | CacheService (SWR, tags, single-flight), Lua limiter, denylist, presence | `tests/cache.spec.ts` (hit/miss/invalidate/stampede) | 10:00 |
| 8 | BullMQ Jobs | 9 queues + DLQ, repeatables, BullBoard (§9) | `tests/jobs.spec.ts` (retry/backoff/DLQ) | 10:00 |
| 9 | File Uploads | Presign → PUT → confirm, MIME sniff, thumbnails, quotas (§14.6) | `tests/uploads.spec.ts` | 11:30 |
| 10 | Socket.io | Gateway, 22 events, Redis adapter, presence/typing (§11) | `tests/socket.spec.ts` incl. cross-container delivery | 4:30 |
| 11 | Audit Logs | `audit.service.ts` + append-only collection + filters + CSV | `tests/audit.spec.ts` | 9:30 |
| 12 | Search | Weighted text index, facets, cursor, suggestions (§5.8) | `tests/search.spec.ts` + `explain` (IXSCAN) | 9:00 |
| 13 | Security Best Practices | §14 complete: helmet, CORS, rate limits, sanitize, argon2id, CSRF, SSRF guard | `tests/security/*` (60+ assertions) | 10:30 |
| 14 | React + Vite | `apps/web` (Vite 5, React 18, TS strict) | `pnpm build` + Lighthouse | 3:15 |
| 15 | Redux Toolkit or Zustand | Zustand + TanStack Query (ADR-005) | `stores/*.test.ts` | — |
| 16 | React Hook Form | Every form via `zodResolver` + shared schemas (§12.5) | `features/**/*.form.test.tsx` | 4:30 |
| 17 | Optimistic UI | Contract table (§12.7) for chat/react/DnD/create/read | `optimistic.spec.ts` (rollback asserted) | 6:00 |
| 18 | Drag & Drop | dnd-kit + fractional indexing + transactional move (§7.7) | `dnd.spec.ts` (Playwright) + concurrency test | 4:30 |
| 19 | Infinite Scroll | Cursor pagination + IntersectionObserver + virtualization (§12.8) | `infinite-scroll.spec.ts` (10k messages) | 9:00 |
| 20 | Dark Mode | Token system + ThemeProvider + no-flash script (§13.1) | `theme.spec.ts` | 11:00 |
| 21 | Offline Support | Workbox PWA + IndexedDB outbox + idempotent flush (§12.9) | `offline.spec.ts` (Playwright offline) | 11:15 |
| 22 | Error Boundaries | 3-level + query-level + Sentry breadcrumbs (§12.6) | `boundaries.spec.tsx` | — |
| 23 | Dashboard UI: sidebar | `AppShell`/`Sidebar` with collapse, drawer, badges (§12.4, §13.2H) | `sidebar.spec.tsx` + responsive tests | 11:45 |
| 24 | Dashboard UI: header | `Header` with ⌘K, create menu, bell, theme, avatar (§12.4) | `header.spec.tsx` | 3:15 |
| 25 | Dashboard UI: footer | Status strip: connection, version, docs, shortcut hint (§12.4) | `footer.spec.tsx` | 11:00 |
| 26 | Responsive | 4 breakpoints, mobile drawer, touch targets ≥44 px (§13.5) | Playwright viewport matrix | 11:45 |
| 27 | Customized components (alert, delete, etc.) | 60-component library incl. destructive-action family (§13.2) | component tests + `/dev/components` gallery | 10:30 |
| 28 | Docker | 3 Dockerfiles, multi-stage, non-root, healthchecks (§18.1) | `docker compose up --wait` in CI | 0:00 |
| 29 | Docker Compose | Full stack incl. Mongo RS, Redis×2, MinIO, Nginx (§18.2) | CI e2e job | 0:00 |
| 30 | GitHub Actions | 5 workflows (§18.4) + branch protection | Green checks on PRs | — |
| 31 | Swagger/OpenAPI | Zod → OpenAPI, `/api/docs`, drift check (§10.5) | `pnpm openapi:check` | 2:30 |
| 32 | Logging | Pino + requestId + redaction + levels (§16.1) | log sample in README | 3:15 |
| 33 | 60%+ Test Coverage | Global gate 60%, target 75%, per-area thresholds (§17.1) | Codecov badge + CI gate | — |
| 34 | Clustered server | `cluster.ts` + supervision + rolling reload (§6.5) | `kill -USR2` demo + zero-dropped-request assertion | 0:45 |
| 35 | Production-grade Redis | Two instances, ACL, Lua, SWR, tag invalidation, failure modes (§8) | `tests/cache.spec.ts` + `docs/runbook.md` | 10:00 |
| 36 | Optimized | Budgets, indexes, k6 proof pack (§15) | `docs/load-test-report.md` | 10:00 |
| 37 | README | §21.1 | — | 0:45 |
| 38 | Architecture Diagram | `docs/architecture.md` (§6.1) | — | 0:45 |
| 39 | ER Diagram | `docs/er-diagram.md` (§7.2) | — | 9:00 |
| 40 | API Documentation | Swagger + `docs/api.md` + Postman (§10) | — | 2:30 |
| 41 | Git History (40+ commits) | 70–85 conventional commits (§19) | `git log --oneline \| wc -l` | — |

---

## 27. Appendix

### 27.1 Environment variables (`.env.example` — the contract)

```bash
# ─── runtime ───────────────────────────────────────────────
NODE_ENV=development
PORT=4000
APP_NAME=Orbit
APP_URL=http://localhost:5173
API_URL=http://localhost:4000
WEB_CONCURRENCY=0                      # 0 = auto-detect vCPUs
LOG_LEVEL=debug                        # trace|debug|info|warn|error|fatal
LOG_PRETTY=true
GIT_SHA=                               # injected in CI
APP_VERSION=1.0.0
TRUST_PROXY=true

# ─── security ──────────────────────────────────────────────
JWT_SECRET=change-me-min-32-characters-long-secret
JWT_ALGORITHM=HS256                    # RS256 in prod
JWT_PRIVATE_KEY=                       # PEM (RS256)
JWT_PUBLIC_KEY=
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
REFRESH_TOKEN_TTL_REMEMBER=30d
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false                    # true behind TLS
CSRF_ENABLED=true
CORS_ORIGINS=http://localhost:5173,http://localhost
ARGON2_MEMORY_KIB=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1
RATE_LIMIT_GLOBAL=300
RATE_LIMIT_AUTH=10

# ─── data ──────────────────────────────────────────────────
MONGODB_URI=mongodb://orbit_app:orbit_app_pw@localhost:27017/orbit?replicaSet=rs0&authSource=orbit
MONGO_MAX_POOL_SIZE=20
MONGO_MIN_POOL_SIZE=2
MONGO_REQUIRE_TRANSACTIONS=true         # refuse to boot on standalone

REDIS_CACHE_URL=redis://:cache_pw@localhost:6379
REDIS_QUEUE_URL=redis://:queue_pw@localhost:6380
REDIS_CACHE_TTL_DEFAULT=300
REDIS_KEY_PREFIX=orbit:dev
CACHE_ENABLED=true

# ─── storage ───────────────────────────────────────────────
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=orbit
S3_SECRET_KEY=orbit_minio_pw
S3_BUCKET_PRIVATE=orbit-uploads-private
S3_BUCKET_PUBLIC=orbit-public-assets
S3_FORCE_PATH_STYLE=true
UPLOAD_MAX_SIZE_BYTES=26214400          # 25 MB
UPLOAD_ALLOWED_MIME=image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document
PRESIGN_EXPIRES_SECONDS=300
STORAGE_QUOTA_BYTES=1073741824          # 1 GB free plan

# ─── queues ────────────────────────────────────────────────
QUEUE_DISABLED=false                    # true in unit tests / demos without a worker
QUEUE_PREFIX=orbit
QUEUE_MAX_BACKPRESSURE=1000
DLQ_ENABLED=true

# ─── email ─────────────────────────────────────────────────
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM="Orbit <no-reply@orbit.dev>"

# ─── realtime ──────────────────────────────────────────────
SOCKET_PATH=/socket.io
SOCKET_CORS_ORIGINS=http://localhost:5173,http://localhost
SOCKET_MAX_BUFFER=65536
SOCKET_ROOM_LIMIT=50
PRESENCE_TTL_SECONDS=60

# ─── observability ─────────────────────────────────────────
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.1
METRICS_ENABLED=true
METRICS_TOKEN=internal-scrape-token
HEALTH_DETAILED=true

# ─── frontend (Vite — must be prefixed VITE_) ──────────────
VITE_API_URL=http://localhost/api/v1
VITE_SOCKET_URL=http://localhost
VITE_APP_VERSION=1.0.0
VITE_SENTRY_DSN=
VITE_FEATURE_ANALYTICS=true
VITE_FEATURE_OFFLINE=true
```

### 27.2 NPM scripts (root, Turborepo-orchestrated)

```jsonc
{
  "dev":              "turbo run dev --parallel",              // api + web + worker watch
  "build":            "turbo run build",
  "typecheck":        "turbo run typecheck",
  "lint":             "turbo run lint",
  "lint:fix":         "turbo run lint -- --fix",
  "format":           "prettier --write \"**/*.{ts,tsx,md,json}\"",
  "test":             "turbo run test",
  "test:unit":        "turbo run test:unit",
  "test:integration": "turbo run test:integration --filter=@orbit/api",
  "test:e2e":         "pnpm --filter @orbit/web test:e2e",
  "test:coverage":    "turbo run test -- --coverage",
  "test:all":         "pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:integration && pnpm test:e2e",
  "perf:k6":          "k6 run tests/load/board-read.js",
  "db:migrate":       "tsx scripts/migrate.ts up",
  "db:rollback":      "tsx scripts/migrate.ts down",
  "db:sync-indexes":  "tsx scripts/syncIndexes.ts",
  "db:reset":         "tsx scripts/reset.ts --yes",
  "seed":             "tsx scripts/seed.ts",
  "seed:large":       "SEED_LARGE=true tsx scripts/seed.ts",
  "openapi:generate": "tsx scripts/generateOpenApi.ts",
  "openapi:check":    "pnpm openapi:generate && git diff --exit-code docs/openapi.json",
  "docker:up":        "docker compose up -d --build",
  "docker:logs":      "docker compose logs -f api worker",
  "docker:scale":     "docker compose up -d --scale api=4",
  "docker:down":      "docker compose down -v",
  "prepare":          "husky install"
}
```

### 27.3 Folder tree (this plan's implementation target)

```
orbit-workspace/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── cluster.ts · server.ts · app.ts
│   │   │   ├── config/           env.ts · constants.ts · permissions.ts · swagger.ts
│   │   │   ├── middleware/       authenticate · authorize · validate · rateLimit ·
│   │   │   │                     idempotency · requestContext · errorHandler · notFound · metrics
│   │   │   ├── infrastructure/
│   │   │   │   ├── db/           mongoose.ts · plugins(softDelete, audit, counters) · baseRepository.ts
│   │   │   │   ├── redis/        cacheClient.ts · queueClient.ts · lua/*.lua · lock.ts
│   │   │   │   ├── cache/        cache.service.ts · keys.ts · tags.ts
│   │   │   │   ├── queue/        queues.ts · producers.ts
│   │   │   │   ├── socket/       socket.server.ts · auth.ts · rooms.ts · presence.ts
│   │   │   │   ├── storage/      s3.ts · presign.ts · mimeSniff.ts
│   │   │   │   ├── mailer/       mailer.ts · templates/*.mjml
│   │   │   │   ├── logger/       logger.ts · context.ts
│   │   │   │   └── metrics/      registry.ts · collectors.ts
│   │   │   ├── modules/          auth · users · workspaces · boards · lists · cards ·
│   │   │   │                     pages · channels · messages · comments · files · search ·
│   │   │   │                     notifications · analytics · audit · admin · health
│   │   │   │                     (each: *.routes.ts *.controller.ts *.service.ts
│   │   │   │                            *.repository.ts *.model.ts *.schema.ts *.test.ts)
│   │   │   ├── jobs/             mail · notifications · searchIndex · files · analytics ·
│   │   │   │                     cleanup · pages · reminders · webhooks · dlq
│   │   │   └── shared/           ApiError · envelope · pagination · fractionalIndex ·
│   │   │                         dates · sanitize · csv · slug
│   │   ├── tests/                unit/ · integration/ · security/ · fixtures/ · helpers/ · setup/
│   │   └── Dockerfile · package.json · tsconfig.json · jest.config.ts
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/              router.tsx · providers.tsx · queryClient.ts · errorBoundaries/
│   │   │   ├── components/ui/    Button/ · Alert/ · DeleteButton/ · ConfirmDialog/ · Dialog/ ·
│   │   │   │                     DataTable/ · KanbanColumn/ · MessageBubble/ · BlockEditor/ · …
│   │   │   │                     (each folder: index.tsx · Component.tsx · Component.test.tsx)
│   │   │   ├── components/layout/ AppShell · Sidebar · Header · Footer · PageHeader
│   │   │   ├── features/         auth · workspaces · boards · pages · chat · files · search ·
│   │   │   │                     notifications · analytics · admin · settings · realtime
│   │   │   ├── hooks/            useSocket · useTheme · useMediaQuery · useHotkeys · useOutbox
│   │   │   ├── lib/              api(client, endpoints) · socket · outbox(dexie) · errors · i18n
│   │   │   ├── stores/           uiStore · sessionStore · socketStore
│   │   │   ├── styles/           tokens.css · globals.css · tailwind.css
│   │   │   └── types/            api.d.ts · models.ts
│   │   ├── public/               manifest.json · sw.js · icons/ · offline.html
│   │   ├── e2e/                  playwright specs + fixtures
│   │   └── Dockerfile · nginx.conf · vite.config.ts · tailwind.config.ts
│   └── worker/   src/index.ts · Dockerfile · package.json
├── packages/
│   ├── shared/   src/{schemas,types,permissions,constants,errorCodes}/ · package.json
│   └── config/   eslint · tsconfig · prettier · tailwind-preset
├── infra/
│   ├── docker/   compose.dev.yml · compose.prod.yml · mongo-init.js · redis-cache.conf ·
│   │             redis-queue.conf · nginx.conf · nginx.prod.conf
│   ├── observability/ prometheus.yml · alerts.yml · grafana/dashboards/*.json · loki.yml · jaeger.yml
│   └── k8s/      (optional) deployment.yaml · service.yaml · hpa.yaml · ingress.yaml · secrets.example.yaml
├── scripts/      migrate.ts · syncIndexes.ts · seed.ts · reset.ts · generateOpenApi.ts ·
│                 redisReport.ts · restoreDrill.sh
├── tests/load/   board-read.js · auth-flow.js · chat-write.js · search.js · dnd-storm.js · README.md
├── docs/         architecture.md · er-diagram.md · api.md · security.md · performance.md ·
│                 scaling.md · runbook.md · troubleshooting.md · demo-script.md ·
│                 load-test-report.md · commit-convention.md · adr/ADR-001..015-*.md ·
│                 openapi.json · postman.json
├── migrations/   001-*.ts … 
├── .github/      workflows/{ci,security,cd,images,docs}.yml · pull_request_template.md ·
│                 ISSUE_TEMPLATE/*.md · CODEOWNERS · dependabot.yml
├── docker-compose.yml · .env.example · .dockerignore · .gitignore
├── turbo.json · pnpm-workspace.yaml · package.json · commitlint.config.js
├── README.md · CONTRIBUTING.md · CHANGELOG.md · LICENSE · PROGRESS.md
```

### 27.4 Glossary (so the vocabulary in this plan is unambiguous)

| Term | Meaning in this project |
|---|---|
| **Workspace** | Tenant boundary; every document carries `workspaceId` |
| **Board / List / Card** | Trello-style Kanban hierarchy |
| **Page / Block** | Notion-style doc and its atomic content unit |
| **Channel / Message / Thread** | Slack-style conversation container and its content |
| **Fractional index** | Lexicographic string key allowing inserts between neighbours — `order` |
| **Rebalance** | Job that re-spreads exhausted order keys for a list |
| **Cache tag** | Invalidation grouping (`board:{id}`) tracked in a Redis set |
| **SWR** | Stale-while-revalidate: serve stale immediately, refresh in background |
| **Single-flight** | Collapse concurrent identical cache misses into one DB fetch |
| **Denylist (`jti`)** | Redis set of revoked access-token ids until natural expiry |
| **Token family** | All refresh tokens descended from one login; revoked together on reuse |
| **Outbox** | IndexedDB queue of offline mutations replayed idempotently on reconnect |
| **DLQ** | Dead-letter queue for jobs that exhausted retries |
| **Zero-downtime reload** | Rolling worker replacement via `SIGUSR2` in the cluster primary |
| **RPO / RTO** | Data-loss window / recovery time targets (5 min / 30 min here) |
| **Proof pack** | The set of performance evidence artifacts (§15.5) |

### 27.5 Source-of-truth rule for future updates

> **PROJECT_PLAN.md is provisional. Code and CI are authoritative.** If the final code diverges from any number in this plan (an endpoint count, a TTL, a threshold), update **this file and the README in the same commit** — graders notice documentation that contradicts the repo, and consistency between plan → code → docs is itself a signal of seniority.

---

### ✅ Final pre-submission checklist (print and tick)

```
BOOT        [ ] fresh clone → cp .env.example .env → docker compose up -d → all healthy in <5 min
            [ ] seed runs; demo user credentials in README
BACKEND     [ ] 40 APIs in Swagger, all with examples          [ ] transactions proven by test
            [ ] redis x2 with ACL + correct eviction policies  [ ] 9 queues + DLQ visible in BullBoard
            [ ] cluster running (WEB_CONCURRENCY workers)      [ ] SIGUSR2 rolling reload works
            [ ] audit log complete for admin actions           [ ] search explain shows IXSCAN
            [ ] rate limits + helmet + CSRF + SSRF guard on    [ ] idempotency on side-effect POSTs
FRONTEND    [ ] sidebar/header/footer in every authed screen   [ ] dark mode, no flash
            [ ] every list has empty + error + loading state   [ ] every delete is confirmed
            [ ] ⌘K palette, shortcuts, focus mgmt              [ ] responsive 360→1920
            [ ] offline read + queued writes + flush           [ ] 3 error boundaries + Sentry wired
DEVOPS      [ ] 5 workflows green on main                      [ ] coverage ≥60% (badge visible)
            [ ] images scanned, secrets scanned                [ ] compose prod profile documented
DOCS        [ ] README (badges, quickstart, architecture, perf) [ ] ADRs 15 files
            [ ] ER + architecture diagrams render on GitHub     [ ] runbook + troubleshooting
            [ ] demo script + 3-min recording link              [ ] load-test report + screenshots
GIT         [ ] 70+ conventional commits over 8+ days          [ ] PRs with templates + review comments
            [ ] no secrets, no .env, no large binaries         [ ] tags v0.1.0 → v1.0.0
REHEARSAL   [ ] full 12-min demo run 3× without touching notes [ ] 15 debugging scenarios practiced
            [ ] answers to the 12 system-design questions ready [ ] tradeoff table memorized

Ship it. 🚀
```
