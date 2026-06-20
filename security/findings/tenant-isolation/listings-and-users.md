# Tenant isolation findings — mimo-v2.5-free

| # | File | Line | Endpoint | Issue |
|---|------|------|----------|-------|
| 1 | `backend/src/routes/listings.ts` | 16-37 | `GET /api/listings/options` | No `dealerId` filter on makes/models/bodyTypes |
| 2 | `backend/src/routes/listings.ts` | 256, 273 | `GET /api/listings` (expansion) | Global distinct queries bypass tenant filter |
| 3 | `backend/src/routes/listings.ts` | 559 | `GET /api/listings/by-ids` | Unauthenticated, no tenant filter |
| 4 | `backend/src/routes/listings.ts` | 977 | `POST /api/listings/:id/refresh-images` | No ownership check before mutation |
| 5 | `backend/src/routes/listings.ts` | 624 | `GET /api/listings/:id` | Public detail endpoint with no scope guard |
| 6 | `backend/src/routes/users.ts` | 206 | `POST /api/users/:id/memberships` | Caller can assign memberships to any scope |

Model: opencode/mimo-v2.5-free
