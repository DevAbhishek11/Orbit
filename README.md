# Orbit Enterprise

> Collaborative workspace combining Sprint Boards, Knowledge Docs, Realtime Chat, and File Management in a unified high-velocity platform.

---

## Key Features

- **Executive Management Dashboard**: Modern KPI metrics, period filtering, recent tasks directory, and top contributor rankings.
- **Collapsible Navigation Sidebar**: Smooth expand/collapse transition with persistent state, user profile badge, and section organization.
- **Enterprise Theme Engine**: Dark, Light, and System modes with instant toggle and synchronized user preferences.
- **Strong Authentication**: Password validation enforcing complexity regex, interactive real-time checklist, and visibility eye toggle.
- **Complete Lucide Iconography**: Emojis replaced with standardized Lucide React icons.
- **Resilient Multi-Store Architecture**: Primary connection to MongoDB Atlas with graceful fallback to local embedded MongoDB when Atlas is unreachable.
- **Hybrid File Storage**: S3-compatible cloud storage with seamless fallback to secure local disk streaming when cloud credentials are not present.
- **Full CI/CD Automation**: GitHub Actions pipelines for linting, typechecking, testing, and release bundling.

---

## Quick Start

### 1. Install & Build

```bash
npm install
npm run build:shared
```

### 2. Environment Setup

```bash
cp orbitserver/env.example .env
cp orbitserver/env.example orbitserver/.env
```

### 3. Run Development Servers

```bash
npm run dev
```

- API Server: `http://localhost:8010`
- Web Dashboard: `http://localhost:5173`

### 4. Default Login Credentials

- **Email**: `dev.abhishek.ap11@gmail.com`
- **Password**: `Admin@1120@ABHI`
- **Role**: `owner`

---

## Documentation Index

- [Verification & Quality Checklist](Docs/CHECKLIST.md)
- [How to Run & Deploy](Docs/RUNNING.md)
- [Database Model Evolution & Migrations](Docs/DB_MIGRATIONS.md)
- [CI/CD Pipelines](Docs/CI_CD.md)
- [Project Architecture Plan](Docs/PROJECT_PLAN.md)
