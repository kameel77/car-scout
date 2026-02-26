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
git push → GitHub Actions → build Docker images → push to GHCR → Coolify webhook → redeploy
```

- **Images are built by GitHub Actions**, not by Coolify. Coolify only pulls pre-built images from GHCR.
- Image tags match branch names: `dev`, `staging`, `main` (controlled by `IMAGE_TAG` env var in Coolify).
- Coolify build pack: **dockercompose** (not Nixpacks, not single Dockerfile).
- `docker-compose.coolify.yml` references `ghcr.io/kameel77/car-scout-backend:${IMAGE_TAG}` and `ghcr.io/kameel77/car-scout-frontend:${IMAGE_TAG}`.
- Never switch build pack to Nixpacks — it will fail (no GHCR auth).

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

## 5. IPv4 Requirement

The application must communicate over **IPv4**, not IPv6. This particularly affects Nginx health checks and upstream connections.

- Nginx must bind to `0.0.0.0` (not `::` / IPv6).
- Health check: `curl -f http://localhost:3000/health` (explicit IPv4 localhost, not `::1`).
- If Nginx fails to connect to the backend, ensure it's resolving to IPv4. Use `resolver 127.0.0.11 ipv6=off;` in Nginx config if needed.
- Docker's default DNS (`127.0.0.11`) returns IPv4 for service names on bridge networks — do not add `--network=host` or other overrides that bypass this.

---

## 6. Coolify-Managed Databases

Standalone databases created in Coolify (PostgreSQL, Redis):
- Live on the `coolify` network with their UUID as hostname (e.g., `uw40cw8c4wsg0s4kckw4cgoo:5432`).
- Connection strings are stored in Coolify env vars (`DATABASE_URL`, `REDIS_URL`).
- **Never remove the backend from the `coolify` network** — it will lose database connectivity.
- If the backend can't reach the DB (`P1001: Can't reach database server`), first check if `DATABASE_URL` hostname matches the actual database UUID visible in Coolify UI.

---

## 7. Key Environment Variables (set in Coolify UI, not in code)

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

## 8. Deployment Procedure

1. Commit & push to the appropriate branch (`dev`, `staging`, or `main`).
2. GitHub Actions builds images and pushes to GHCR automatically.
3. In Coolify: click **Redeploy** (not just Restart) to pull the new image and recreate containers.
4. When changing `docker-compose.coolify.yml` network/service config: **always Redeploy**, not restart — networks only reconfigure on container recreation.
5. Preferred deployment order: staging first → verify → production.

---

## 9. Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| 401 on `/api/auth/me` after staging+prod both deployed | DNS collision: both backends share same alias on `coolify` network | Ensure aliases are unique per env (`${COMPOSE_PROJECT_NAME}-backend`) |
| `Can't reach database server` | Backend removed from `coolify` network, or wrong DB UUID in `DATABASE_URL` | Restore `coolify` network in `carscout-api`, verify UUID |
| 502 Bad Gateway | Traefik can't reach frontend, or frontend Nginx can't reach backend | Check port exposure (frontend exposes 80), check `BACKEND_URL` |
| Frontend calls wrong backend | `VITE_API_URL` set to absolute URL pointing to wrong env | Set back to `/api` |
| Build fails with 403 from GHCR | Coolify trying to build with Nixpacks instead of pulling image | Ensure build pack = `dockercompose`, images are pre-built by GHA |
