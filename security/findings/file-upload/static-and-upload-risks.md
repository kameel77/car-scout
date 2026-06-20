# File upload and static serving findings — mimo-v2.5-free

| # | File | Line | Severity | Issue |
|---|------|------|----------|-------|
| 1 | `backend/src/app.ts` | 374-398 | CRITICAL | Path traversal in static file routes: `:file`, `:vehicleId`, `:listingId` joined without containment check |
| 2 | `backend/src/routes/listing-upload.ts`, `backend/src/routes/rental-upload.ts` | 14, 18 | HIGH | SVG upload allowed without sanitization -> stored XSS |
| 3 | `backend/src/routes/listing-upload.ts`, `backend/src/routes/rental-upload.ts` | 108-109, 153-155 | HIGH | Unsafe delete path from user-supplied URL -> arbitrary file deletion |
| 4 | `backend/src/routes/settings.ts` | 437-438 | MEDIUM | Logo SVG stored raw as base64 -> potential XSS if rendered inline |
| 5 | `backend/src/services/csflow-image-downloader.ts` | 64-86 | MEDIUM | External image response not validated by content-type before saving |
| 6 | `backend/src/app.ts` | 125, 216-219 | LOW | 500 MB multipart/body limits allow memory exhaustion |

Model: opencode/mimo-v2.5-free
