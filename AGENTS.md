# AGENTS: Car Scout

Minimal guide for AI/code assistants (Cursor, Codex, Antigravity).

## Environment & URLs
- Do not hardcode URLs. Frontend reads `VITE_API_URL`; set it to backend origin **without** `/api` (e.g. `https://api.example.com`). Client appends `/api/...` itself. In dev, leave empty to use Vite proxy.
- Dev proxy target comes from `VITE_DEV_API_URL` or `VITE_API_URL` (fallback `http://localhost:3000`); defined in `vite.config.ts`.
- Backend CORS whitelist reads comma-separated envs: `FRONTEND_URL`, `VITE_FRONTEND_URL`, `CORS_ORIGINS`, `ALLOWED_ORIGINS`. Include all front origins (staging/prod) there.
- `docker-compose.prod.yml` forwards `CORS_ORIGINS` to backend and builds frontend with `VITE_API_URL`.

## CORS rules (backend/src/server.ts)
- Allowed if origin is in the env lists above, localhost (dev), or matches `*.sslip.io`.
- No hardcoded production domains—use env lists.
- If adding a new frontend domain, update envs rather than code.

## Safety & tooling
- Use `rg` for searches; avoid destructive git commands (no `reset --hard` or `checkout --`).
- Default to ASCII edits; keep existing formatting.
- For edits, prefer `apply_patch`. Do not revert unrelated user changes.

## Testing/build
- Backend dev: `npm run dev` in `backend/`.
- Frontend dev: `npm run dev` in repo root (Vite). Ensure envs loaded.
- Run tests only if relevant or requested; note when not run.

## Deployment notes
- Prod/staging should set:
  - Backend: `CORS_ORIGINS` (front origins), optional `FRONTEND_URL`, `VITE_FRONTEND_URL`.
  - Frontend: `VITE_API_URL` = backend origin (no `/api`).
- Reverse proxy provides `/api` path; client always calls `/api/...`.

## Data handling
- Do not log secrets or tokens. Avoid touching DB/backups unless asked.
