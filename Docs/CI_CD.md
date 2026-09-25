# CI/CD Pipeline Documentation

Orbit employs GitHub Actions for continuous integration and automated deployment.

---

## 1. Continuous Integration (`ci.yml`)

The CI workflow triggers on every commit pushed and every pull request across all branches.

### Pipeline Stages

1. **Repository Checkout**: Fetches full git commit history.
2. **Environment Setup**: Configures Node.js 22 with dependency caching enabled.
3. **Clean Installation**: Executes `npm ci` ensuring exact lockfile parity.
4. **Shared Types Compilation**: Builds `@orbit/shared` types required by both frontend and backend.
5. **Static Typecheck**: Runs `tsc --noEmit` across all workspaces.
6. **Linting**: Runs ESLint with zero-tolerance rules for architecture violations and unused variables.
7. **Test Suite Execution**: Runs Vitest across server and shared workspaces.
8. **Production Build**: Compiles web and backend bundles.

---

## 2. Continuous Delivery (`cd.yml`)

The CD workflow triggers on pushes to the `main` or `master` branches and when semantic version tags (`v*`) are published.

### Pipeline Stages

1. Runs full verification suite.
2. Compiles production assets for client (`orbit/dist`) and API (`orbitserver/dist`).
3. Packages deployment artifacts and uploads to GitHub Releases / artifact registry.
