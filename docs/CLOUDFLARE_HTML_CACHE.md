# Cloudflare Edge Cache Configuration for motolia.pl (SSR HTML)

## Overview
By default, Cloudflare **does not cache HTML responses**, even if the origin server emits `Cache-Control: s-maxage=300`. Without an explicit **Cache Rule** in Cloudflare, every crawler and visitor hit will bypass Cloudflare's edge cache (`cf-cache-status: DYNAMIC`) and hit the origin infrastructure.

Enabling edge caching for SSR HTML serves HTML directly from Cloudflare PoP locations globally, reducing response times for crawlers (TTFB) to low double-digit milliseconds.

---

## 1. Cloudflare Dashboard Setup (Cache Rule)

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and select the **motolia.pl** zone.
2. Navigate to **Caching** → **Cache Rules**.
3. Click **Create rule**.
4. Set **Rule name**: `SSR HTML Edge Cache (motolia.pl)`.
5. Under **When incoming requests match...** (Expression Builder / Custom filter):
   - Set condition:
     ```text
     (http.host eq "motolia.pl" or http.host eq "www.motolia.pl") and not starts_with(http.request.uri.path, "/admin") and not starts_with(http.request.uri.path, "/api/")
     ```
     (`/api/render` is internal-only — nginx's `@render` location rewrites public URLs like
     `/`, `/samochody`, `/oferta/...` to it server-side, it is never requested directly by a
     browser or Cloudflare, so excluding all of `/api/` is simpler and equally correct.)

     > `starts_with` is a **function** in the Cloudflare Rules language, not an infix
     > operator — `http.request.uri.path starts_with "/admin"` fails to parse with
     > *"expected ComparisonOp"*. Keep the parentheses around the host alternation too:
     > `and` binds tighter than `or`, so without them the exclusions would not apply to
     > the apex host. Do not rewrite this as `matches` with a regex — regex in rule
     > expressions requires a Business plan; this zone is on Free.
6. Under **Cache eligibility**:
   - Select **Eligible for cache**.
7. Under **Setting overrides**:
   - **Edge TTL**: Select **Use cache-control header if present, bypass cache if not** (or **Use cache-control header from origin**).
   - **Browser TTL**: Select **Respect existing headers**.
8. Save and Deploy the rule.

> [!IMPORTANT]
> **Why this rule is mandatory**:
> Cloudflare's default caching policy categorizes `.html` and extensionless page requests as uncacheable dynamic content. Creating this Cache Rule is the **only** way to instruct Cloudflare to respect `s-maxage` from `/api/render`.

---

## 2. Recommended Exclusions & Safety Checks

The origin `backend/src/routes/render.ts` already enforces safety by sending `Cache-Control: private, no-store` whenever:
- Path is under `/admin`
- Route is marked `noindex` or is form-bearing (`/lead`, `/negotiate`, `/zapytanie`)
- Request carries an `Authorization` header
- Response status code is not `200`

Cloudflare automatically respects `Cache-Control: private, no-store` from the origin and will **never** cache those responses.

> [!CAUTION]
> `getCacheControlHeader` currently has **no cookie check** — this app has no cookie-based
> authentication today (JWT is read from the `Authorization` header only). If cookie-based
> sessions are ever introduced, `getCacheControlHeader` must gate on that cookie *before*
> this edge-caching setup is safe to keep enabled, otherwise authenticated HTML could be
> served from the shared edge cache to anonymous visitors.

---

## 3. Verification

To verify that edge caching is working:

1. Run `curl` from a terminal:
   ```bash
   curl -I -H "User-Agent: Mozilla/5.0" https://motolia.pl/
   ```
2. Inspect the HTTP response headers:
   - First request:
     ```text
     cf-cache-status: MISS
     cache-control: public, max-age=0, s-maxage=300, stale-while-revalidate=86400
     ```
   - Second request (within 5 minutes):
     ```text
     cf-cache-status: HIT
     age: 12
     cache-control: public, max-age=0, s-maxage=300, stale-while-revalidate=86400
     ```

---

## 4. Cache Purging Strategy

When new listings are imported or prices are updated via CSFlow/admin:
- **Automatic Expiry**: With `s-maxage=300`, cache entries expire naturally after 5 minutes across Cloudflare PoPs.
- **Manual Purge (if instant update is required)**:
  - In Cloudflare Dashboard → **Caching** → **Configuration** → **Purge Cache**.
  - Choose **Custom Purge** → **URL** (e.g. `https://motolia.pl/oferta/bmw-320i-12345`) or **Purge Everything**.

---

## 5. Business Decision: Edge TTL Duration (300 s vs 60 s)

| TTL (`s-maxage`) | Edge Cache Hit Ratio | Price Update Delay to Visitors | Recommendation |
|---|---|---|---|
| **300 seconds (5 min)** | Higher (unvalidated estimate — no measured figure yet) | Up to 5 minutes | **Recommended**: Best TTFB reduction for Googlebot and PSI score. |
| **60 seconds (1 min)** | Lower (unvalidated estimate — no measured figure yet) | Up to 1 minute | **Conservative Alternative**: Faster price updates, slightly lower cache efficiency. |

*Note: You can change `s-maxage=300` in `backend/src/routes/render.ts` at any time if business requirements favor shorter cache retention.*
