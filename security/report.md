# Security Audit Report

Date: 2026-06-20

Scope reviewed:
- `security/findings/auth/reset-token-and-rate-limit.md`
- `security/findings/tenant-isolation/listings-and-users.md`
- `security/findings/secrets-logging/auth-and-financing.md`
- `security/findings/file-upload/static-and-upload-risks.md`
- `backend/src/routes/auth.ts`
- `backend/src/routes/listings.ts`
- `backend/src/routes/users.ts`
- `backend/src/services/csflow-image-downloader.ts`

Additional code inspected to verify referenced findings:
- `backend/src/app.ts`
- `backend/src/routes/listing-upload.ts`
- `backend/src/routes/rental-upload.ts`
- `backend/src/routes/financing.ts`
- `backend/src/middleware/partnerAuth.ts`
- `backend/src/services/email.ts`

## P0

No P0 issues were confirmed in the reviewed code.

The static upload path traversal finding was not confirmed as P0 from the visible routes. Fastify route params such as `:file`, `:listingId`, and `:vehicleId` match a single path segment, which materially reduces the claimed unauthenticated `../` traversal path in `backend/src/app.ts:374`, `backend/src/app.ts:381`, `backend/src/app.ts:388`, and `backend/src/app.ts:395`. The implementation still lacks an explicit containment check and remains a hardening item under P2.

## P1

### P1-1 - Password reset tokens are logged in plaintext

Evidence:
- `backend/src/routes/auth.ts:260` generates a reset token.
- `backend/src/routes/auth.ts:263` to `backend/src/routes/auth.ts:269` stores the token directly on the user record.
- `backend/src/routes/auth.ts:272` to `backend/src/routes/auth.ts:277` logs the full reset link, including the token, to stdout.

Severity rationale:
- Anyone with access to application logs can take over an account that requested a password reset before the token expires.
- The token is a bearer secret and is stored unhashed, increasing blast radius if database or logs are exposed.

OWASP mapping:
- A02:2021 - Cryptographic Failures
- A07:2021 - Identification and Authentication Failures
- A09:2021 - Security Logging and Monitoring Failures

### P1-2 - Login and password reset endpoints have no rate limiting

Evidence:
- `backend/src/routes/auth.ts:8` defines `POST /api/auth/login` without a route-level rate limit.
- `backend/src/routes/auth.ts:240` defines `POST /api/auth/reset-password-request` without a route-level rate limit.
- `backend/src/routes/auth.ts:283` defines `POST /api/auth/reset-password` without a route-level rate limit.
- Repository search found no `@fastify/rate-limit` usage in `backend/src`.

Severity rationale:
- Login is exposed to credential stuffing and password spraying.
- Reset request is exposed to email flooding and user-targeted abuse.
- Reset-token brute force is less likely because tokens are 32 random bytes encoded as hex, but lack of throttling still violates expected auth controls.

OWASP mapping:
- A07:2021 - Identification and Authentication Failures

### P1-3 - Authenticated users can mutate listings outside their scope through image upload routes

Evidence:
- `backend/src/routes/listing-upload.ts:30` authenticates `POST /api/listings/:id/images`, but `backend/src/routes/listing-upload.ts:33` only verifies the listing exists.
- `backend/src/routes/listing-upload.ts:77` updates the listing image fields without checking dealer ownership or resolved user scope.
- `backend/src/routes/listing-upload.ts:90` authenticates image deletion, but `backend/src/routes/listing-upload.ts:98` only verifies the listing exists and `backend/src/routes/listing-upload.ts:119` updates the listing.
- `backend/src/routes/listing-upload.ts:133`, `backend/src/routes/listing-upload.ts:155`, and `backend/src/routes/listing-upload.ts:181` follow the same pattern for primary image, external image URL, and reorder operations.

Severity rationale:
- Any authenticated user with access to these routes can alter another dealer's listing media if they know or guess a listing ID.
- This is a cross-tenant authorization failure on mutable inventory data.

OWASP mapping:
- A01:2021 - Broken Access Control

### P1-4 - Authenticated users can mutate rental vehicle images outside their scope

Evidence:
- `backend/src/routes/rental-upload.ts:36` authenticates `POST /api/rental-vehicles/:id/images`, but `backend/src/routes/rental-upload.ts:42` only verifies the vehicle exists.
- `backend/src/routes/rental-upload.ts:108` updates rental vehicle images without an ownership or tenant check.
- `backend/src/routes/rental-upload.ts:121`, `backend/src/routes/rental-upload.ts:167`, `backend/src/routes/rental-upload.ts:195`, `backend/src/routes/rental-upload.ts:218`, and `backend/src/routes/rental-upload.ts:238` expose additional authenticated rental image or file mutation routes with the same missing scope validation pattern.

Severity rationale:
- Authenticated users can modify another tenant's rental vehicle media or documents if IDs are known.
- This is the same class of cross-tenant write issue as listing image mutations.

OWASP mapping:
- A01:2021 - Broken Access Control

### P1-5 - User membership assignment does not constrain target scope to caller authority

Evidence:
- `backend/src/routes/users.ts:188` protects `POST /api/users/:id/memberships` with `requirePermission('users:write')`.
- `backend/src/routes/users.ts:198` to `backend/src/routes/users.ts:203` validates only that the requested role is valid for the requested scope type.
- `backend/src/routes/users.ts:206` to `backend/src/routes/users.ts:213` creates the membership for arbitrary `scopeType`, `scopeId`, and `role` from the request body.
- The route does not validate that the caller is platform-level for platform memberships or that a dealer-group or dealer admin is assigning only inside their own allowed scope.

Severity rationale:
- If non-platform roles can obtain `users:write`, this becomes privilege escalation and cross-tenant account administration.
- Even if current permission mapping limits this today, the route is fragile because the authorization rule is not local to the sensitive operation.

OWASP mapping:
- A01:2021 - Broken Access Control

## P2

### P2-1 - Password reset request logs submitted email for non-existent users

Evidence:
- `backend/src/routes/auth.ts:251` to `backend/src/routes/auth.ts:255` returns a generic response to the client but logs the submitted non-existent email address.

Severity rationale:
- This does not enumerate users to the API caller, so the original client-side enumeration claim is downgraded.
- It still stores potentially sensitive submitted identifiers in logs and can disclose which addresses were probed to log readers.

OWASP mapping:
- A09:2021 - Security Logging and Monitoring Failures

### P2-2 - Logout does not invalidate active JWTs

Evidence:
- `backend/src/routes/auth.ts:231` to `backend/src/routes/auth.ts:236` returns success and includes a TODO for token blacklist.
- Tokens are signed at `backend/src/routes/auth.ts:63` to `backend/src/routes/auth.ts:72` with a default expiry of 7 days.

Severity rationale:
- This is a known tradeoff with stateless JWTs, but compromised tokens remain usable until expiry.
- Downgraded from higher severity because there is no evidence that server-side session invalidation is promised elsewhere.

OWASP mapping:
- A07:2021 - Identification and Authentication Failures

### P2-3 - Public listing option and expansion queries expose global catalog facets

Evidence:
- `backend/src/routes/listings.ts:14` to `backend/src/routes/listings.ts:43` returns makes, models, and body types across all non-archived listings without tenant or dealer filtering.
- `backend/src/routes/listings.ts:256` to `backend/src/routes/listings.ts:260` expands transmission filter values globally.
- `backend/src/routes/listings.ts:273` to `backend/src/routes/listings.ts:277` expands fuel type filter values globally.

Severity rationale:
- Public catalog facets appear intentional, and the route uses database `distinct`, not event-loop blocking map-heavy aggregation.
- If the business expects tenant-specific storefront filters, this leaks aggregate inventory characteristics across tenants. Treat as P2 until product scope confirms global public inventory is intended.

OWASP mapping:
- A01:2021 - Broken Access Control, if tenant-scoped storefronts are required

### P2-4 - `GET /api/listings/by-ids` is public and unscoped

Evidence:
- `backend/src/routes/listings.ts:543` defines public `GET /api/listings/by-ids`.
- `backend/src/routes/listings.ts:559` to `backend/src/routes/listings.ts:567` returns non-archived listings for supplied IDs with dealer data and no authentication or tenant filter.

Severity rationale:
- The route is documented as used for personal offer or CRM selection, but it returns only non-archived public inventory.
- Downgraded because public listing inventory appears intentional. Risk remains if CRM-only or dealer-specific offer data should not be public by ID.

OWASP mapping:
- A01:2021 - Broken Access Control, if this endpoint is meant to be CRM-only or tenant-scoped

### P2-5 - Public listing detail routes return archived or zero-price records

Evidence:
- `backend/src/routes/listings.ts:573` to `backend/src/routes/listings.ts:617` returns a listing by slug without checking `isArchived` or public price eligibility.
- `backend/src/routes/listings.ts:621` to `backend/src/routes/listings.ts:643` returns a listing by ID without checking `isArchived` or public price eligibility.
- The public list endpoint applies `isArchived: false` by default and applies `pricePln: { gt: 0 }` for unauthenticated callers at `backend/src/routes/listings.ts:393` to `backend/src/routes/listings.ts:404`.

Severity rationale:
- The original finding that `GET /api/listings/:id` being public is a bug is not supported. Public listing detail pages appear intentional for SEO and storefront usage.
- The supported issue is narrower: public detail endpoints do not match the list endpoint's public visibility rules and may expose archived or not-public listings when an ID or old slug is known.

OWASP mapping:
- A01:2021 - Broken Access Control

### P2-6 - Refresh images endpoint trusts any bearer-looking Authorization header

Evidence:
- `backend/src/routes/listings.ts:949` defines public `POST /api/listings/:id/refresh-images`.
- `backend/src/routes/listings.ts:953` to `backend/src/routes/listings.ts:954` treats any `Authorization` header starting with `Bearer ` as authenticated.
- `backend/src/routes/listings.ts:956` to `backend/src/routes/listings.ts:974` checks `autoRefreshImages` only when no bearer-looking header is present.
- `backend/src/routes/listings.ts:977` refreshes listing images with no ownership check.

Severity rationale:
- This is not just missing ownership for authenticated users. A caller can include `Authorization: Bearer anything` and bypass the public auto-refresh setting check because the token is never verified.
- Impact depends on `refreshListingImages` side effects, but the route performs a mutation and should not be triggerable this way.

OWASP mapping:
- A01:2021 - Broken Access Control
- A07:2021 - Identification and Authentication Failures

### P2-7 - Financing and partner auth logs expose sensitive provider data

Evidence:
- `backend/src/routes/financing.ts:180` to `backend/src/routes/financing.ts:185` logs Inbank URL, payload, API key prefix, shop UUID, and product code.
- `backend/src/routes/financing.ts:198` to `backend/src/routes/financing.ts:200` logs full Inbank response bodies.
- `backend/src/routes/financing.ts:227` to `backend/src/routes/financing.ts:229` returns parsed provider response data to clients when monthly installment extraction fails.
- `backend/src/routes/financing.ts:376` to `backend/src/routes/financing.ts:378` logs full Vehis response bodies.
- `backend/src/middleware/partnerAuth.ts:29` logs the first 5 characters of a failed partner API token.
- `backend/src/services/email.ts:85` to `backend/src/services/email.ts:86` enables Nodemailer logger and debug output unconditionally for this transporter.

Severity rationale:
- Partial API keys are not equivalent to full credential disclosure, so the original high severity API key-prefix claim is downgraded.
- Full provider request and response logging can still leak application data, customer financial inputs, provider identifiers, or operational details into logs.

OWASP mapping:
- A02:2021 - Cryptographic Failures, for secret handling
- A09:2021 - Security Logging and Monitoring Failures

### P2-8 - SVG image uploads are accepted on image routes

Evidence:
- `backend/src/routes/listing-upload.ts:14` includes `image/svg+xml` in `ALLOWED_MIME_TYPES`.
- `backend/src/routes/rental-upload.ts:14` to `backend/src/routes/rental-upload.ts:19` includes `image/svg+xml`.
- Uploaded buffers are passed to `optimizeAndSaveImage` at `backend/src/routes/listing-upload.ts:64` and `backend/src/routes/rental-upload.ts:82`, so impact depends on the optimizer's SVG handling. No sanitizer is visible in the reviewed upload route code.

Severity rationale:
- If SVGs are stored or served as SVG, this can become stored XSS. If the optimizer reliably rasterizes or rejects SVGs, impact is reduced.
- Keep as P2 pending verification of `optimizeAndSaveImage`.

OWASP mapping:
- A03:2021 - Injection

### P2-9 - Delete paths are derived from client-controlled URLs without containment checks

Evidence:
- `backend/src/routes/listing-upload.ts:108` to `backend/src/routes/listing-upload.ts:113` converts a submitted URL into a filesystem path with `path.join` and deletes it.
- `backend/src/routes/rental-upload.ts:153` to `backend/src/routes/rental-upload.ts:158` does the same with `imageUrl`.

Severity rationale:
- Listing deletion is partially constrained by `url.startsWith('/uploads/listing-images/')`.
- Rental deletion does not require an uploads prefix before path construction.
- Both should enforce that the canonical resolved path stays under the expected per-entity upload directory and that the URL exists in the entity's stored image list before unlinking.

OWASP mapping:
- A01:2021 - Broken Access Control
- A05:2021 - Security Misconfiguration

### P2-10 - CSFlow image downloader fetches external URLs without content-type or size validation

Evidence:
- `backend/src/services/csflow-image-downloader.ts:64` to `backend/src/services/csflow-image-downloader.ts:70` fetches external URLs with broad `Accept: image/*,*/*`.
- `backend/src/services/csflow-image-downloader.ts:80` reads the full response into memory with `response.buffer()`.
- `backend/src/services/csflow-image-downloader.ts:81` to `backend/src/services/csflow-image-downloader.ts:84` sends the buffer to image optimization without checking response `Content-Type` or size.

Severity rationale:
- A malicious or compromised external image source can cause memory pressure or force the image pipeline to parse unexpected content.
- Timeout and concurrency limits reduce but do not remove the risk.

OWASP mapping:
- A05:2021 - Security Misconfiguration

### P2-11 - Global body limit allows very large request bodies

Evidence:
- `backend/src/app.ts:124` to `backend/src/app.ts:126` sets Fastify `bodyLimit` to 500 MB.

Severity rationale:
- Large global body limits increase denial-of-service risk on routes that do not need large bodies.
- Upload routes apply a 10 MB per-file check after buffering each part, but the global limit still permits large request handling across the app.

OWASP mapping:
- A05:2021 - Security Misconfiguration

## Removed Or Downgraded Findings

- `GET /api/listings/:id` public access as a standalone bug - removed. Public listing detail access appears intentional for SEO and storefront pages. The retained issue is only the missing public visibility filter for archived or zero-price records.
- Email enumeration via reset response - downgraded. Client receives a generic response for missing users, but logs include submitted non-existent emails.
- Static upload path traversal as critical - downgraded. Current route shape does not confirm arbitrary unauthenticated traversal, but explicit containment checks are still recommended.
- API key prefix logging as high severity - downgraded. Prefix logging is sensitive and unnecessary, but it is not full credential disclosure by itself.
