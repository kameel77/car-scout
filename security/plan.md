# Application Security Audit Plan

Scope: application-layer security for Car Scout. Infrastructure hardening already covered in `.agents/SECURITY_HARDENING.md` - Nginx UA blocking, path blocking, rate limiting, Cloudflare WAF. This plan focuses on TypeScript, Fastify, Prisma, PostgreSQL, React, and Vite code paths.

Severity:
- P0 - likely account, tenant, data, or secret compromise
- P1 - high-risk security control gap or broad abuse path
- P2 - medium-risk hardening, defense in depth, or narrower abuse path
- P3 - low-risk hygiene, documentation, or verification improvement

## P0 Checklist

- [ ] Audit admin route authorization coverage, not just authentication.
  - Files/folders: `backend/src/routes/*.ts`, `backend/src/routes/external/*.ts`, `backend/src/middleware/permissions.ts`, `backend/src/middleware/authorize.ts`
  - Verify every privileged route uses `requirePermission(...)` or an equivalent scope-aware check. Flag routes using only `fastify.authenticate`, `preValidation: [fastify.authenticate]`, or legacy `authorizeRoles(...)`.
  - Confirm write/delete/import/settings/user-management endpoints cannot be reached by lower-privilege JWTs.

- [ ] Audit tenant isolation for every Prisma query returning or mutating dealer-scoped data.
  - Files/folders: `backend/src/routes/listings.ts`, `backend/src/routes/leads.ts`, `backend/src/routes/dealers-admin.ts`, `backend/src/routes/dealer-groups.ts`, `backend/src/routes/rental-vehicles.ts`, `backend/src/routes/rental-companies.ts`, `backend/src/routes/rental-matrix.ts`, `backend/src/routes/users.ts`, `backend/src/middleware/permissions.ts`, `backend/src/utils/scope-resolver.ts`, `backend/prisma/schema.prisma`
  - Verify `dealerId`, `dealerGroupId`, `ownerUserId`, and membership filters are applied on read, update, delete, archive, duplicate, import, and export flows.
  - Add negative tests for cross-dealer access, group-to-dealer access, and platform context switching.

- [ ] Audit JWT lifecycle and context switching.
  - Files/folders: `backend/src/routes/auth.ts`, `backend/src/app.ts`, `src/contexts/AuthContext.tsx`, `frontend/src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`, `frontend/src/components/ProtectedRoute.tsx`
  - Verify JWTs are signed with a strong `JWT_SECRET` in every non-dev environment, have appropriate expiry, and are not accepted after user deactivation, role change, or membership removal.
  - Confirm `/api/auth/context` cannot mint a token for a scope the user cannot access.
  - Decide whether localStorage token storage is acceptable for admin sessions or whether migration to secure HttpOnly cookies is required.

- [ ] Remove sensitive secrets from logs and API responses.
  - Files/folders: `backend/src/routes/auth.ts`, `backend/src/middleware/partnerAuth.ts`, `backend/src/services/email.ts`, `backend/src/routes/settings.ts`, `backend/src/routes/financing.ts`, `src/pages/admin/ApiPartnersPage.tsx`, `src/pages/admin/FinancingPage.tsx`, `src/components/admin/SettingsModule.tsx`
  - Confirm password reset tokens, API keys, SMTP passwords, financing API secrets, bearer tokens, and database errors are never logged or returned.
  - Replace reset-link console logging with a secure email-only flow or explicit dev-only guard.

- [ ] Audit file upload and static file serving for path traversal and unsafe content.
  - Files/folders: `backend/src/app.ts`, `backend/src/routes/listing-upload.ts`, `backend/src/routes/rental-upload.ts`, `backend/src/routes/import.ts`, `backend/src/routes/rental-vehicles.ts`, `backend/src/routes/settings.ts`, `backend/src/services/image-optimizer.ts`, `backend/src/services/csflow-image-downloader.ts`, `backend/uploads`
  - Verify filenames cannot escape `uploadsRoot` through `..`, encoded separators, symlinks, or path joins.
  - Validate MIME type and magic bytes for images, PDFs, and CSV files. Confirm SVG upload is forbidden or sanitized.
  - Reassess `bodyLimit: 500 * 1024 * 1024` and multipart limits for authenticated and public endpoints.

## P1 Checklist

- [ ] Add or verify schema validation for all request bodies, params, and query strings.
  - Files/folders: `backend/src/routes/*.ts`, `backend/src/routes/external/*.ts`, `backend/src/services/*`, `src/services/api.ts`, `src/services/rental-api.ts`
  - Prioritize routes casting `request.body as any`, `request.query as ...`, or `request.params as ...` without Zod, TypeBox, Fastify schema, or equivalent validation.
  - Validate numeric bounds, enum values, UUID/CUID formats, pagination limits, URLs, email addresses, phone numbers, and free-text length.

- [ ] Audit external partner API key handling.
  - Files/folders: `backend/src/middleware/partnerAuth.ts`, `backend/src/routes/external/listings.ts`, `backend/src/routes/partners.ts`, `src/pages/admin/ApiPartnersPage.tsx`, `backend/prisma/schema.prisma`
  - Confirm partner API keys are stored hashed, compared using a timing-safe approach, rotate cleanly, and are only displayed once after creation or regeneration.
  - Verify partner listing create/update/delete operations are scoped strictly to mapped dealer IDs.

- [ ] Audit password reset and password policy.
  - Files/folders: `backend/src/routes/auth.ts`, `backend/reset-password.ts`, `backend/add-admin.cjs`, `backend/src/scripts/create-admin.ts`, `src/pages/admin/ForgotPasswordPage.tsx`, `src/pages/admin/ResetPasswordPage.tsx`
  - Require minimum password strength and length. Confirm reset tokens are random, single-use, short-lived, not logged, and preferably stored hashed.
  - Add throttling and monitoring for login and password reset attempts at application level, independent of Nginx.

- [ ] Audit CORS and trust proxy behavior.
  - Files/folders: `backend/src/app.ts`, `backend/src/server.ts`, `vite.config.ts`, `.env.prod.example`, `backend/.env.example`, `docker-compose.coolify.yml`
  - Confirm production/staging do not allow wildcard-like origins such as broad `sslip.io` matches unless explicitly needed.
  - Verify `credentials: true` is paired only with tightly controlled origins.
  - Confirm `trustProxy: true` is safe behind Coolify/Traefik and does not let clients spoof IP-sensitive logic.

- [ ] Audit secure headers and CSP.
  - Files/folders: `backend/src/app.ts`, `nginx.conf`, `index.html`, `src/components/seo/MetaHead.tsx`, `src/components/MarkdownText.tsx`
  - Review `helmet` configuration, especially `contentSecurityPolicy: false`.
  - Design a CSP that allows required vehicle image/CDN sources without opening script execution.
  - Verify `X-Frame-Options` or `frame-ancestors` requirements for admin pages and widget embed pages.

- [ ] Audit cache poisoning and tenant-aware Redis keys.
  - Files/folders: `backend/src/routes/listings.ts`, `backend/src/routes/rental-public.ts`, `backend/src/routes/onepager.ts`, `backend/src/routes/featured.ts`, `backend/src/routes/faq.ts`, `backend/src/routes/translations.ts`, `backend/src/routes/settings.ts`, `backend/src/routes/seo.ts`, `backend/src/routes/partnerAds.ts`, `backend/src/routes/__tests__`
  - Confirm cache keys include every response-shaping input: tenant/context, brand, language, query filters, auth/public mode, pagination, host-derived data, and feature flags.
  - Verify no authenticated response can be cached and served to another user, tenant, or public route.
  - Validate cache invalidation on writes to settings, translations, listings, partner ads, SEO, and banners.

## P2 Checklist

- [ ] Audit dependency vulnerabilities and supply-chain exposure.
  - Files/folders: `package.json`, `package-lock.json`, `backend/package.json`, `backend/package-lock.json`, `bun.lockb`, `Dockerfile`, `backend/Dockerfile`
  - Run `npm audit` in root and `backend/`, plus `npm outdated` for security-sensitive packages.
  - Review Fastify plugins, Prisma, Vite, React, image processing, Puppeteer, CSV parsing, and markdown rendering packages.
  - Confirm lockfiles are consistent and unused package managers or stale locks are removed or documented.

- [ ] Audit logging for personal data and operational secrets.
  - Files/folders: `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/routes/*.ts`, `backend/src/services/*.ts`, `backend/query_logs.js`, `src/services/api.ts`
  - Confirm request logs do not include authorization headers, request bodies, reset links, partner keys, SMTP credentials, financing secrets, lead messages, or unnecessary PII.
  - Add redaction rules for Pino/Fastify logs and standardize error responses.

- [ ] Audit crypto usage and token generation.
  - Files/folders: `backend/src/routes/auth.ts`, `backend/src/routes/partners.ts`, `backend/src/routes/external/listings.ts`, `backend/src/services/*`, `src/utils/crmTracking.ts`, `src/services/api.ts`
  - Confirm random identifiers and credentials use `crypto.randomBytes` or `crypto.randomUUID` appropriately.
  - Verify no security-sensitive token uses `Math.random`, timestamps, predictable IDs, or unhashed persistence.

- [ ] Audit frontend XSS and unsafe rendering.
  - Files/folders: `src/components/MarkdownText.tsx`, `src/components/seo/MetaHead.tsx`, `src/components/public/DynamicWidget.tsx`, `src/pages/*`, `src/pages/admin/*`, `src/services/api.ts`, `src/i18n/*`
  - Search for `dangerouslySetInnerHTML`, markdown rendering, dynamic meta tags, external URLs, and translation strings rendered as HTML.
  - Validate all admin-controlled text that reaches public pages is escaped or sanitized.

- [ ] Audit SSRF and external URL fetching.
  - Files/folders: `backend/src/services/csflow-image-downloader.ts`, `backend/src/services/image-refresh.service.ts`, `backend/src/services/image-optimizer.ts`, `backend/src/services/csflow.service.ts`, `backend/src/utils/csflow-client.ts`, `backend/src/routes/render.ts`, `backend/src/services/puppeteer.ts`
  - Validate remote image URLs and partner-provided URLs. Block private IP ranges, localhost, file URLs, metadata IPs, and non-HTTP schemes.
  - Add outbound request timeouts, max download size, content-type checks, and redirect limits.

- [ ] Audit admin UI exposure of secrets.
  - Files/folders: `src/pages/admin/ApiPartnersPage.tsx`, `src/pages/admin/FinancingPage.tsx`, `src/components/admin/SettingsModule.tsx`, `src/services/api.ts`
  - Ensure API keys, SMTP passwords, and financing secrets are masked after creation and never returned from list/detail endpoints unless explicitly needed.
  - Confirm copy-to-clipboard controls cannot expose secrets to users without the correct permission.

## P3 Checklist

- [ ] Build a route inventory with auth, permission, validation, and cache status.
  - Files/folders: `backend/src/routes`, `backend/src/app.ts`, `security/`
  - Produce a table listing method, path, public/authenticated/admin/partner access, required permission, validation schema, cache behavior, and tenant filter.

- [ ] Add security regression tests for high-risk flows.
  - Files/folders: `backend/src/routes/__tests__`, `backend/src/services/__tests__`, `src/**/*.test.tsx`
  - Cover unauthenticated access, wrong-role access, cross-tenant access, invalid payloads, upload rejections, reset token reuse, partner API ownership checks, and cache separation.

- [ ] Review environment examples and secret naming.
  - Files/folders: `.env.prod.example`, `backend/.env.example`, `apps/*/.env.example`, `apps/*/.env.prod.example`, `docker-compose.coolify.yml`
  - Confirm examples avoid real credentials, document required secret strength, and do not encourage insecure defaults outside local development.

- [ ] Review generated OpenAPI docs exposure.
  - Files/folders: `backend/src/app.ts`, `backend/src/routes/external/listings.ts`
  - Decide whether `/api/v1/external/docs` should be public, partner-authenticated, or restricted by environment.
  - Confirm docs do not disclose internal route details or example secrets.

- [ ] Review public forms and anti-abuse controls.
  - Files/folders: `backend/src/routes/leads.ts`, `backend/src/routes/consent.ts`, `src/components/Turnstile.tsx`, `src/components/CallbackForm.tsx`, `src/pages/LeadFormPage.tsx`, `src/pages/RentalLeadFormPage.tsx`, `src/pages/ContactPage.tsx`
  - Verify Turnstile or equivalent checks are enforced server-side where required.
  - Validate consent records, lead fields, email sending, duplicate submission controls, and abuse logging.

- [ ] Document accepted residual risks and owners.
  - Files/folders: `security/plan.md`, `new_features.md`, `features_desc.md`
  - For each deferred item, record owner, target date, rationale, and mitigation.
  - Add application behavior changes to `features_desc.md` only when implementation changes are made.
