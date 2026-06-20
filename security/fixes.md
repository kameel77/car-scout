# Security Fix Plan

Date: 2026-06-20

This plan is prioritized for implementation. Each item should include focused tests for the affected route and a short entry in `features_desc.md` if behavior changes.

## P0

No P0 fixes are required from the confirmed audit findings.

## P1

### 1. Remove password reset token disclosure and hash stored reset tokens

Files:
- `backend/src/routes/auth.ts`

Actions:
- Delete the `console.log` reset-link block at `backend/src/routes/auth.ts:272` to `backend/src/routes/auth.ts:277`.
- Send reset links through the configured email service instead of stdout.
- Store only a hash of the reset token in `resetPasswordToken`.
- On `POST /api/auth/reset-password`, hash the submitted token and compare hashes.
- Clear reset fields after successful use, as the route already does.
- Add tests proving reset tokens are not logged and raw tokens are not stored.

### 2. Add rate limiting to authentication routes

Files:
- `backend/src/app.ts`
- `backend/src/routes/auth.ts`

Actions:
- Register `@fastify/rate-limit` globally or add route-level limits.
- Apply a strict IP and email based limit to `POST /api/auth/login`.
- Apply IP and email based limits to `POST /api/auth/reset-password-request`.
- Apply IP based limits to `POST /api/auth/reset-password`.
- Return generic auth errors and avoid revealing whether an email exists.
- Add tests for rate-limit status codes and reset/login happy paths.

Suggested starting limits:
- Login: 5 failed attempts per minute per IP plus slower email-based limit.
- Reset request: 3 requests per 15 minutes per email plus IP cap.
- Reset submit: 10 attempts per 15 minutes per IP.

### 3. Add scope checks to listing image mutation routes

Files:
- `backend/src/routes/listing-upload.ts`
- Reuse `backend/src/utils/scope-resolver.ts` and the ownership pattern already present in `backend/src/routes/listings.ts`.

Actions:
- Resolve caller scope for every listing image mutation route.
- Load the target listing's `dealerId`.
- For non-platform users, allow mutation only when `dealerId` is included in `scope.dealerFilter.dealerId`.
- Apply to upload, delete, primary image, external URL add, reorder, and spec routes in the same file.
- Add tests that a dealer user cannot modify another dealer's listing images.

### 4. Add scope checks to rental upload and document mutation routes

Files:
- `backend/src/routes/rental-upload.ts`
- Potentially `backend/src/routes/rental-vehicles.ts`, depending on rental ownership model.

Actions:
- Identify the rental tenant ownership field, such as company, dealer, or group.
- Add a helper equivalent to listing ownership checks.
- Apply it to image upload, image delete, primary image, reorder, and document upload/delete routes.
- Add cross-tenant negative tests.

### 5. Constrain membership assignment to caller authority

Files:
- `backend/src/routes/users.ts`
- `backend/src/middleware/permissions.ts`

Actions:
- In `POST /api/users/:id/memberships`, inspect caller memberships and active context.
- Permit platform membership creation only to platform superadmin or platform manager, depending on business rules.
- Permit dealer-group membership changes only to authorized users in that same group.
- Permit dealer membership changes only to platform users, the owning dealer group admin, or the dealer admin for that dealer, depending on intended policy.
- Validate that `scopeId` exists before creating the membership, mirroring user creation.
- Add tests for allowed same-scope assignment and forbidden cross-scope assignment.

## P2

### 6. Make public listing detail visibility match public listing list visibility

Files:
- `backend/src/routes/listings.ts`

Actions:
- Keep `GET /api/listings/:id` and `GET /api/listings/by-slug/:slug` public for SEO and storefront behavior.
- Add public visibility constraints equivalent to list behavior: `isArchived: false` and `pricePln: { gt: 0 }` for unauthenticated callers.
- If authenticated, apply scope filtering where appropriate when returning archived or otherwise non-public details.
- Add regression tests for archived listing detail returning 404 to public callers.

### 7. Fix refresh-images authentication and authorization

Files:
- `backend/src/routes/listings.ts`

Actions:
- Replace bearer-header string detection with actual `request.jwtVerify()` inside a try/catch.
- For verified authenticated callers, resolve scope and enforce listing ownership before refreshing images.
- For unauthenticated callers, keep the `autoRefreshImages` check, but consider restricting by listing state and adding a rate limit.
- Add tests for invalid bearer token, unauthenticated disabled setting, and cross-tenant authenticated calls.

### 8. Reduce sensitive logging in financing, partner auth, and email

Files:
- `backend/src/routes/financing.ts`
- `backend/src/middleware/partnerAuth.ts`
- `backend/src/services/email.ts`

Actions:
- Remove API key prefixes, partner token prefixes, full provider responses, and full provider request payloads from logs.
- Log stable request IDs, provider name, status code, and sanitized error categories.
- Do not return raw provider response objects to clients. Return a generic provider error with an internal correlation ID.
- Enable Nodemailer `logger` and `debug` only in development or behind an explicit safe debug flag.
- Add tests or snapshot checks for sanitized error responses.

### 9. Harden upload path deletion and static serving

Files:
- `backend/src/app.ts`
- `backend/src/routes/listing-upload.ts`
- `backend/src/routes/rental-upload.ts`

Actions:
- Add a shared helper that resolves a candidate path and verifies it remains inside an expected base directory.
- Use the helper before every `fs.unlink`, `fs.rm`, and static `createReadStream`.
- Require rental image deletion paths to start with the expected `/uploads/rental-images/{id}/` prefix.
- Confirm the submitted image URL exists in the entity's current `imageUrls` before deleting from disk.
- Return 400 for invalid paths rather than silently ignoring them.
- Add tests for encoded traversal attempts and cross-directory deletion attempts.

### 10. Decide and enforce SVG handling

Files:
- `backend/src/routes/listing-upload.ts`
- `backend/src/routes/rental-upload.ts`
- `backend/src/services/image-optimizer.ts`

Actions:
- Preferred: remove `image/svg+xml` from upload allowlists for vehicle photos.
- If SVG support is required, sanitize SVGs and serve them with restrictive headers, or rasterize them before storage.
- Verify `optimizeAndSaveImage` behavior for SVG input.
- Add tests that raw SVG script payloads are rejected or rasterized.

### 11. Validate CSFlow image responses before buffering

Files:
- `backend/src/services/csflow-image-downloader.ts`

Actions:
- Restrict accepted URL protocols to `https:` and `http:` if both are required.
- Reject private, loopback, and link-local targets if CSFlow URLs can be user-influenced.
- Require `Content-Type` to start with `image/`.
- Enforce a maximum response size before or during download.
- Stream with byte counting instead of `response.buffer()` for untrusted content.
- Keep timeout and concurrency limits.
- Add tests with non-image and oversized mocked responses.

### 12. Lower global body limit and move large limits to upload routes

Files:
- `backend/src/app.ts`
- Upload route registration if multipart limits are configured there.

Actions:
- Reduce global Fastify `bodyLimit` to the smallest size needed by normal JSON APIs.
- Configure larger multipart limits only for upload routes.
- Ensure upload code rejects oversized files before expensive processing.
- Add tests for large JSON request rejection and allowed upload sizes.

### 13. Confirm intended scope for public catalog facets and by-ids

Files:
- `backend/src/routes/listings.ts`

Actions:
- Product decision: confirm whether public inventory is global across all dealers or storefront-specific.
- If storefront-specific, add dealer or tenant context to `/api/listings/options`, canonical expansion queries, facets, and `/api/listings/by-ids`.
- If global public inventory is intended, document that decision and leave these routes public.
- Add tests matching the chosen policy.

### 14. Improve logout semantics if token revocation is required

Files:
- `backend/src/routes/auth.ts`
- Redis integration in `backend/src/app.ts`

Actions:
- Decide whether logout must revoke server-side access or only clear the client token.
- If revocation is required, add JWT IDs and store revoked IDs in Redis until token expiry.
- Otherwise reduce access token TTL and introduce refresh tokens with rotation.
- Add tests for revoked token rejection.
