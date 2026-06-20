# Auth findings — mimo-v2.5-free

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1 | `backend/src/routes/auth.ts:254` | Email enumeration via `fastify.log.warn` for non-existent users | Replace with generic log: `fastify.log.warn('Password reset requested')` |
| 2 | `backend/src/routes/auth.ts:272-277` | Password reset token logged to console — secret leak in logs | Remove `console.log` lines; send token via email only |
| 3 | `backend/src/routes/auth.ts:236` | Logout does not invalidate JWT — compromised token stays valid until expiry | Implement Redis token blacklist or short-lived tokens with refresh |
| 4 | `backend/src/routes/auth.ts:283` | No rate limiting on `/reset-password` — enables brute-force of reset tokens | Add `@fastify/rate-limit` or manual rate limiter per IP |
| 5 | `backend/src/routes/auth.ts:8` | No rate limiting on `/login` — enables credential stuffing | Add `@fastify/rate-limit` (e.g. 5 attempts/min per IP) |

Most urgent: finding 2 (reset token logged).
