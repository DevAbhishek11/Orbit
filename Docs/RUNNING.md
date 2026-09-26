# Running Orbit Enterprise

This guide covers setting up, running, and testing the Orbit monorepo locally and in production.

---

## 1. Quick Start

### Prerequisites

- Node.js >= 22.12.0
- npm >= 10.0.0

### Installation

```bash
# Install dependencies across all monorepo workspaces
npm install

# Build shared types and utilities
npm run build:shared
```

---

## 2. Environment Configuration

Copy the example environment configuration into both the root directory and `orbitserver`:

```bash
cp orbitserver/env.example .env
cp orbitserver/env.example orbitserver/.env
```

### Key Environment Variables

| Variable        | Description                         | Default / Example                  |
| --------------- | ----------------------------------- | ---------------------------------- |
| `NODE_ENV`      | Environment mode                    | `development`                      |
| `PORT`          | API server port                     | `8010`                             |
| `APP_URL`       | Frontend URL                        | `http://localhost:5173`            |
| `API_URL`       | API server public URL               | `http://localhost:8010`            |
| `JWT_SECRET`    | Secret key for JWT signing          | `[32+ characters]`                 |
| `MONGODB_URI`   | MongoDB connection URI              | `mongodb+srv://...`                |
| `MONGO_DB_NAME` | Database name                       | `orbit`                            |
| `S3_ENDPOINT`   | AWS S3 or MinIO endpoint (optional) | `""` (falls back to local storage) |

### Database Resilience & Fallback

Orbit attempts to connect to the configured `MONGODB_URI` (such as MongoDB Atlas). If the remote cluster cannot be reached (e.g. sandbox IP whitelist restrictions or offline development), the server activates an embedded local MongoDB engine (`127.0.0.1:27018`). This ensures 100% functionality without crashes or dependency blockers.

### Hybrid File Uploads

When AWS S3 credentials (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) are not provided, Orbit stores uploaded files in the local `./uploads` directory. Files are streamed securely via `/api/v1/files/:id/download`.

---

## 3. Starting the Application

### Running Frontend and Backend Concurrently

```bash
npm run dev
```

This launches:

- **API Server**: `http://localhost:8010`
- **Web Frontend**: `http://localhost:5173`

### Running Services Individually

```bash
# Terminal 1: Backend API
npm run dev:server

# Terminal 2: Web Client
npm run dev:web
```

---

## 4. Default Credentials & Initial Workspace

On first startup, the database auto-seeds the primary administrator account:

- **Email**: `dev.abhishek.ap11@gmail.com`
- **Password**: `Admin@1120@ABHI`
- **Role**: `owner`
- **Workspace**: `Orbit Enterprise`

Additional seeded demo accounts:

- `admin@orbit.dev` / `Orbit@1234567` (Admin)
- `manager@orbit.dev` / `Orbit@1234567` (Manager)
- `member@orbit.dev` / `Orbit@1234567` (Member)
- `viewer@orbit.dev` / `Orbit@1234567` (Viewer)

---

## 5. Verification & Testing Commands

```bash
# Typecheck monorepo
npm run typecheck

# Lint source code
npm run lint

# Run unit and integration tests
npm run test

# Production build
npm run build
```

---

## 6. Database Tools & Migrations

```bash
# Synchronize declared schema indexes with MongoDB
npm run sync-indexes

# Run database migrations
npm run migrate --workspace=orbitserver

# Seed or re-seed demo data
npm run seed --workspace=orbitserver
```
