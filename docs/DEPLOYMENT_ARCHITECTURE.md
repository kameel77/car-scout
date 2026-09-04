# Car Scout — Deployment Architecture (MUST READ)

> **For AI agents**: Read this file in full before making ANY changes to Docker Compose, Nginx config, GitHub Actions, Coolify settings, or anything networking-related. Breaking this setup means frontends won't talk to backends.

---

## 1. Environments & Branches

| Environment | Branch | Domain | Coolify compose file |
|---|---|---|---|
| development | `dev` | `dev.carsalon.pl` | `docker-compose.coolify.yml` |
| staging | `staging` | `staging.carsalon.pl` | `docker-compose.coolify.yml` |
| production | `main` | `carsalon.pl` | `docker-compose.coolify.yml` |

**All three environments use the same `docker-compose.coolify.yml` file.** Environment-specific values are injected via Coolify's Environment Variables UI (not .env files). `COMPOSE_PROJECT_NAME` is the key differentiator (`carscout-dev`, `carscout-staging`, `carscout-prod`).

---

## 2. Build & Deployment Pipeline

```
git push → GitHub Actions: CI (quality gates) + Docker Build & Push → GHCR → Coolify webhook → redeploy
```

- **Images are built by GitHub Actions**, not by Coolify. Coolify only pulls pre-built images from GHCR.
- Image tags match branch names: `dev`, `staging`, `main` (controlled by `IMAGE_TAG` env var in Coolify).
- Coolify build pack: **dockercompose** (not Nixpacks, not single Dockerfile).
- `docker-compose.coolify.yml` references `ghcr.io/kameel77/car-scout-backend:${IMAGE_TAG}` and `ghcr.io/kameel77/car-scout-frontend:${IMAGE_TAG}`.
- Never switch build pack to Nixpacks — it will fail (no GHCR auth).
- Two GitHub Actions workflows run on every push to `dev`/`staging`/`main` and on every PR (see Section 11):
  - `ci.yml` — type-check + lint + unit tests (frontend + backend typecheck)
  - `docker.yml` — builds and pushes images to GHCR (only on push to branches, not on PRs)

---

## 3. Docker Network Architecture

Each environment has **two networks**:

```
carscout-{env}-private   (isolated bridge, name = "${COMPOSE_PROJECT_NAME}-private")
coolify                  (shared external network, managed by Coolify/Traefik)
```

### Service membership:

| Service | carscout-private | coolify |
|---|---|---|
| `carscout-api` (backend) | ✅ alias: `backend` | ✅ alias: `${COMPOSE_PROJECT_NAME}-backend` |
| `frontend` (Nginx) | ✅ (no alias needed) | ✅ (Traefik routes here) |

### Why this matters:

- **`carscout-private`**: Frontend Nginx proxies `/api → http://backend:3000`. The alias `backend` on this network enables that. Because it's an isolated bridge network per environment, there's no collision between staging and prod.
- **`coolify`**: Traefik routes public traffic here. Also, **Coolify-managed standalone databases (PostgreSQL, Redis) live on this network** — the backend MUST be on `coolify` to reach them.
- **CRITICAL**: The backend alias on `coolify` MUST be unique per environment (`${COMPOSE_PROJECT_NAME}-backend` = `carscout-staging-backend`, `carscout-prod-backend`). If both staging and prod backends use the same alias `backend` on the shared `coolify` network, Docker DNS returns a random container → cross-environment auth failures (401s after login).

### ❌ Never do this:
```yaml
# WRONG — same alias on shared network = DNS collision between environments
coolify:
  aliases:
    - backend
```

### ✅ Correct pattern (current):
```yaml
networks:
  carscout-private:
    aliases:
      - backend                          # isolated — no collision
  coolify:
    aliases:
      - "${COMPOSE_PROJECT_NAME}-backend"  # unique: carscout-staging-backend, carscout-prod-backend
```

---

## 4. Frontend → Backend Communication

- `VITE_API_URL=/api` (relative, not absolute) — frontend calls its **own** Nginx.
- Nginx inside the frontend container proxies `/api → http://backend:3000` using the `carscout-private` network.
- `BACKEND_URL=http://backend:3000` is passed as env var to the frontend container at runtime.
- The Nginx config reads `BACKEND_URL` via `envsubst` or similar at startup.
- **Do NOT change `VITE_API_URL` to an absolute URL** unless you intentionally want to point to a different backend — this would break environment isolation.

---

## 5. Backend → Frontend (SSR HTML template)

**Rule:** the backend must read the SPA shell (`index.html`) from this resource's **own** frontend,
never through the public domain and never through a shared alias.

`frontendBase()` in `backend/src/routes/render.ts` picks the source in this order:
1. Explicit `INTERNAL_FRONTEND_URL`, if set to something **other than** the shared `http://frontend:80` alias.
2. `http://${COOLIFY_RESOURCE_UUID}-frontend` — Coolify injects `COOLIFY_RESOURCE_UUID` into every
   deployment, so this alias always resolves to the frontend of **this** resource.
3. The public domain — last resort only.

**Why the public domain is wrong:** `index.html` is served with `Cache-Control: max-age=14400` (4 h)
and requests to the public domain go through Cloudflare. After a deploy, the edge CDN keeps serving
the pre-deploy template — pointing at asset hashes that no longer exist — for up to 4 hours. The
backend would render **every** page from that stale template.

**Why `http://frontend:80` is wrong:** it's a shared alias across environments. On production it
resolved to the **staging** frontend container and returned staging's build hash. This is the same
class of bug Section 3 warns about (generic aliases on shared networks collide across environments)
— here it hit the SSR template fetch instead of the `/api` proxy.

**Verification after deploy — the three-measurement method:**
Compare the `assets/index-*.js` hash from three places:
1. What the user gets through the CDN.
2. What the origin returns bypassing the CDN (`curl --resolve domain:443:<origin-IP> -k`).
3. What's physically in the frontend container (`grep -o "assets/index-[A-Za-z0-9_-]*\.js" /usr/share/nginx/html/index.html`).

A mismatch between (1) and (2) points to CDN cache; a mismatch between (2) and (3) points to SSR
cache or an in-memory template in the backend.

**Incident:** 2026-09-04, fixed in commit `816af7b`.

---

## 6. IPv4 Requirement

The application must communicate over **IPv4**, not IPv6. This particularly affects Nginx health checks and upstream connections.

- Nginx must bind to `0.0.0.0` (not `::` / IPv6).
- Health check: `curl -f http://localhost:3000/health` (explicit IPv4 localhost, not `::1`).
- If Nginx fails to connect to the backend, ensure it's resolving to IPv4. Use `resolver 127.0.0.11 ipv6=off;` in Nginx config if needed.
- Docker's default DNS (`127.0.0.11`) returns IPv4 for service names on bridge networks — do not add `--network=host` or other overrides that bypass this.

---

## 7. Coolify-Managed Databases

Standalone databases created in Coolify (PostgreSQL, Redis):
- Live on the `coolify` network with their UUID as hostname (e.g., `uw40cw8c4wsg0s4kckw4cgoo:5432`).
- Connection strings are stored in Coolify env vars (`DATABASE_URL`, `REDIS_URL`).
- **Never remove the backend from the `coolify` network** — it will lose database connectivity.
- If the backend can't reach the DB (`P1001: Can't reach database server`), first check if `DATABASE_URL` hostname matches the actual database UUID visible in Coolify UI.

---

## 8. Key Environment Variables (set in Coolify UI, not in code)

| Variable | Purpose |
|---|---|
| `COMPOSE_PROJECT_NAME` | Differentiates environments: `carscout-staging`, `carscout-prod` |
| `IMAGE_TAG` | Docker image tag to pull: `staging`, `main` |
| `DATABASE_URL` | PostgreSQL connection string with Coolify DB UUID as host |
| `REDIS_URL` | Redis connection string with Coolify Redis UUID as host |
| `JWT_SECRET` | **Must be different** per environment to prevent token cross-use |
| `BACKEND_URL` | `http://backend:3000` — used by Nginx to proxy /api |
| `CORS_ORIGINS` | e.g. `https://staging.carsalon.pl` — must match the environment's domain |
| `FRONTEND_URL` | e.g. `https://staging.carsalon.pl` — used in backend email links etc. |
| `VITE_API_URL` | `/api` — always relative, baked into frontend image at build time |

---

## 9. Deployment Procedure

1. Commit & push to the appropriate branch (`dev`, `staging`, or `main`).
2. GitHub Actions builds images and pushes to GHCR automatically.
3. In Coolify: click **Redeploy** (not just Restart) to pull the new image and recreate containers.
4. When changing `docker-compose.coolify.yml` network/service config: **always Redeploy**, not restart — networks only reconfigure on container recreation.
5. Preferred deployment order: staging first → verify → production.

---

## 10. Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| 401 on `/api/auth/me` after staging+prod both deployed | DNS collision: both backends share same alias on `coolify` network | Ensure aliases are unique per env (`${COMPOSE_PROJECT_NAME}-backend`) |
| `Can't reach database server` | Backend removed from `coolify` network, or wrong DB UUID in `DATABASE_URL` | Restore `coolify` network in `carscout-api`, verify UUID |
| 502 Bad Gateway | Traefik can't reach frontend, or frontend Nginx can't reach backend | Check port exposure (frontend exposes 80), check `BACKEND_URL` |
| Frontend calls wrong backend | `VITE_API_URL` set to absolute URL pointing to wrong env | Set back to `/api` |
| Build fails with 403 from GHCR | Coolify trying to build with Nixpacks instead of pulling image | Ensure build pack = `dockercompose`, images are pre-built by GHA |

---

## 11. CI Pipeline (Quality Gates)

Defined in `.github/workflows/ci.yml`. Runs on every PR and on every push to `dev`, `staging`, `main`.

| Job | Steps | Purpose |
|---|---|---|
| `frontend` | `npm ci` → `tsc --noEmit` → `npm run lint` → `npm test -- --run` (vitest) | Catches type errors, lint regressions, and unit-test failures before deployment |
| `backend` | `npm ci` → `npx prisma generate` → `tsc --noEmit` (in `backend/`) | Catches type errors in Fastify/Prisma backend |
| `gitleaks` | `gitleaks-action@v2` over full git history | **Always blocking** — fails CI if any secret pattern is detected anywhere in history |

**Important constraints:**

- Vitest is scoped via `vitest.config.ts` to `src/**/*.{test,spec}.{ts,tsx}` and explicitly excludes `backend/` and `apps/`. Backend tests would otherwise be picked up by the frontend job, which doesn't install backend dependencies (would fail with `ERR_MODULE_NOT_FOUND` for `fastify`).
- `concurrency.cancel-in-progress: true` — pushing a new commit to the same branch cancels in-flight CI runs.
- CI does NOT run end-to-end tests, integration tests, or DB migrations — these are verified manually on `dev.carsalon.pl` after deploy.
- Lint must stay clean — when adding `eslint-disable` comments, prefer a per-line rule disable with a one-line justification (see existing examples in `backend/src/routes/rental-vehicles.ts` for `no-control-regex` on transliteration regex).
- Gitleaks scans the **entire git history** (`fetch-depth: 0`). If a secret was ever committed and only later removed, it will still fail. Rotate the secret AND rewrite history (`git filter-repo` or BFG) — re-pushing without rewrite will keep failing.

### 11.1 Container vulnerability scan (Trivy)

Defined in `.github/workflows/docker.yml`. Runs after each image is pushed to GHCR for `dev`, `staging`, `main`. Three matrix jobs (backend, frontend-carsalon, frontend-motolia) each scan their own image.

- **Severity filter:** `CRITICAL` only (HIGH and below are noise for a small team — surface them only if requested).
- **Ignore unfixed:** `true` — CVEs without an upstream fix don't block; we can't act on them anyway.
- **Vuln types:** `os,library` (Alpine packages + node_modules).
- **Blocking behavior:** `exit-code: 1` only on `main`; on `dev` and `staging` the scan runs and reports but doesn't fail the workflow. This means a fresh CRITICAL CVE shows up in dev/staging logs as a warning before it can block production.
- Trivy pulls the image from GHCR using the branch tag (`ghcr.io/.../car-scout-<service>:${branch}`), so it runs against the exact image Coolify will deploy.

### 11.2 Dependency updates (Dependabot)

Defined in `.github/dependabot.yml`. Five ecosystems, all targeting `dev` branch:

| Ecosystem | Directory | Cadence |
|---|---|---|
| `npm` | `/` (frontend) | Mondays, max 5 open PRs |
| `npm` | `/backend` | Mondays, max 5 open PRs |
| `github-actions` | `/` | Weekly |
| `docker` | `/` (frontend Dockerfile) | Weekly |
| `docker` | `/backend` | Weekly |

**Dependabot security alerts** (separate from version updates) are enabled in repo Settings → Code security. Alerts open PRs against the **default branch** (`main`), independent of `dependabot.yml`. Standard handling: cherry-pick / rebase the security PR onto `dev`, run CI, promote through staging → main like any other change.

### 11.3 npm overrides (transitive CVE patching)

`backend/package.json` declares an `overrides` block:

```json
"overrides": {
  "fast-jwt": "^6.2.0"
}
```

**Why it exists:** `@fastify/jwt@8.0.1` (the latest version compatible with `fastify@4`) ships with `fast-jwt@4.0.5`, which has two CRITICAL CVEs — CVE-2026-34950 (JWT Algorithm Confusion) and CVE-2026-35039 (Cache Confusion via cacheKeyBuilder). Both are fixed in `fast-jwt@6.2.0+`. `@fastify/jwt@9` and `@fastify/jwt@10` bundle the patched versions but require `fastify@5` (verified via `fastify-plugin` runtime check), which would force a multi-plugin ecosystem upgrade (cors, multipart, swagger).

The override forces `fast-jwt@6.2.4` while keeping `@fastify/jwt@8` and `fastify@4`. Smoke-tested locally with our exact JWT payload shape (memberships + activeContext) — `sign` and `verify` work unchanged.

**Do NOT remove this override** until either:
- A backport patch lands in `fast-jwt@4.x` (unlikely — upstream advised upgrade to 6.x), OR
- The codebase is migrated to `fastify@5` + `@fastify/jwt@10`, at which point `fast-jwt@6.2.0+` becomes a direct dep and the override becomes redundant.

If you upgrade `@fastify/jwt` later, re-run `npm ls fast-jwt` in `backend/` and confirm the resolved version is ≥ 6.2.0 before deleting the override.

---

## 12. Per-Environment Deployment Details

### 12.1 `dev` → `dev.carsalon.pl`

**Purpose:** Active development branch. First place where merged feature branches are observed running. Considered live but unstable.

**Trigger:** Direct push to `dev` (no PR required). Feature branches merge here via `git merge --no-ff` or fast-forward.

**Coolify resource:**
- `COMPOSE_PROJECT_NAME=carscout-dev`
- `IMAGE_TAG=dev`
- Coolify branch source: `dev`
- Domain: `https://dev.carsalon.pl` (frontend) — backend not exposed publicly
- Auto-deploy on GHCR webhook: **enabled**

**Database/Redis:** Dedicated dev instances (separate UUIDs from staging/prod). Schema may diverge transiently while migrations are being authored — run `npx prisma migrate deploy` against the dev DB before pushing.

**JWT_SECRET / FRONTEND_URL / CORS_ORIGINS:** Distinct values per environment. `CORS_ORIGINS=https://dev.carsalon.pl`.

**Verification after deploy:**
1. `curl -I https://dev.carsalon.pl/api/health` → 200
2. Smoke test the changed feature in browser
3. Check Coolify container logs for Prisma errors (most common dev failure mode after schema changes)

---

### 12.2 `staging` → `staging.carsalon.pl`

**Purpose:** Pre-production verification. Mirror of prod data shape, used to catch issues before promoting to `main`.

**Trigger:** Merge from `dev` to `staging` via PR (recommended) or fast-forward push. **CI must pass.**

**Coolify resource:**
- `COMPOSE_PROJECT_NAME=carscout-staging`
- `IMAGE_TAG=staging`
- Coolify branch source: `staging`
- Domain: `https://staging.carsalon.pl`
- Auto-deploy on GHCR webhook: **enabled**

**Database/Redis:** Dedicated staging instances. Should always be at the same migration head as production. Run `prisma migrate deploy` as part of deploy verification.

**Required env-var differences vs prod:**
- `CORS_ORIGINS=https://staging.carsalon.pl`
- `FRONTEND_URL=https://staging.carsalon.pl`
- `JWT_SECRET` — distinct from prod (prevents staging tokens being accepted by prod and vice versa)

**Verification before promoting to main:**
1. CI green on staging push
2. `dev.carsalon.pl` smoke test passed earlier
3. Manual regression on `staging.carsalon.pl` (login, search, listing CRUD, financing calculator, rental flow)
4. No new errors in Coolify backend logs over 5–10 min observation window

---

### 12.3 `main` → `carsalon.pl` (production)

**Purpose:** Production. Customer-facing.

**Trigger:** PR from `staging` to `main`. **PR review + green CI required** (branch protection — see Section 13).

**Coolify resource:**
- `COMPOSE_PROJECT_NAME=carscout-prod`
- `IMAGE_TAG=main`
- Coolify branch source: `main`
- Domain: `https://carsalon.pl` (and `https://www.carsalon.pl` redirect if configured)
- Auto-deploy on GHCR webhook: **enabled**, but consider gating manual redeploy for high-risk changes (schema migrations, network changes)

**Database/Redis:** Production instances. **Never** run destructive migrations without a backup and rehearsal on staging.

**Required env-var differences vs staging:**
- `CORS_ORIGINS=https://carsalon.pl`
- `FRONTEND_URL=https://carsalon.pl`
- `JWT_SECRET` — distinct from dev/staging
- Any third-party API keys (payment, email, analytics) point to live accounts, not sandbox

**Verification after deploy:**
1. `curl -I https://carsalon.pl/api/health` → 200
2. Spot-check: login, top of search results, one listing detail page
3. Watch Coolify backend logs and error tracker for 15–30 min
4. Be ready to rollback by redeploying the previous `main` commit (Coolify keeps prior images in GHCR)

---

## 13. Branch Flow & Protection

```
feature branches → dev → staging → main
                   │      │         │
                   │      │         └─ branch protection: PR review + CI required
                   │      └─ recommended PR; CI required
                   └─ direct push allowed; CI required
```

**Rules:**

- All three branches require CI to pass before deployment is meaningful (CI green is a precondition for trusting the deployed image).
- `main` is protected via `gh api`-managed branch protection: required CI checks (`Frontend (lint + typecheck + test)`, `Backend (typecheck)`, `build-and-push`), required PR review, no direct push, no force push.
- `staging` may also be protected (recommended) with the same CI requirements but optional review.
- `dev` is intentionally NOT protected — fast iteration is more important than gatekeeping, and CI still runs on every push.
- Never bypass CI with `[skip ci]` or hook skips on `staging`/`main`. On `dev` only with explicit reason in commit body.

**Promoting changes:**

```bash
# dev → staging
git checkout staging && git pull
git merge --ff-only origin/dev   # or open PR staging ← dev
git push origin staging

# staging → main (always via PR)
gh pr create --base main --head staging --title "release: <summary>"
# wait for review + CI, then merge
```
