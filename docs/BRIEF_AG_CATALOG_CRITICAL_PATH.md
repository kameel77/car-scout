# Brief: catalog critical path — `/nowe` and `/uzywane`

Goal: remove serialised round trips and dead requests from the LCP path of the two condition
pages, **without moving the home page off 99**.

Five tasks. Task 0 is measurement and must be reported before any code lands. Tasks 1–3 are
implementation and are ordered by risk (lowest first). Task 4 is a measurement plus a
recommendation — it contains a business trade-off that is **not yours to decide**. Task 5 is
an optional experiment, only if Tasks 1–3 do not move the number enough.

Read before starting: `CLAUDE.md` §2 (simplicity) and §3 (surgical changes),
`docs/PERF_HOME_REFERENCE.md` §0 and §0.5, `docs/HOMEPAGE_PERFORMANCE_ARCHITECTURE.md`.

**Explicitly out of scope, do not touch:** anything i18n or translation related
(`src/i18n/*`, `DynamicTranslationsLoader`, `/api/translations`). Motolia is PL-only for now
and this is not where the time goes. Also out of scope: the inlined CSS strategy, splitting
the entry bundle, `React.lazy` on `HomePage`, AVIF, and the image pipeline.

---

## Ground truth — verified in the repo, do not re-derive

1. `/nowe` and `/uzywane` render `src/pages/ConditionPage.tsx`, a lazy route. Listings are
   fetched client-side; SSR emits a skeleton (`catalogSkeletonHtml()` in
   `backend/src/services/seo-meta.ts`), not real cards.
2. **The listings request is gated on the settings request.** `useListings()`
   (`src/hooks/useListings.ts`) ends with `enabled: !waitForSettings || settingsFetched`, and
   `ConditionPage` calls it with `waitForSettings = true`. `settingsFetched` comes from
   `useAppSettings()` (`src/hooks/useAppSettings.ts`), i.e. `/api/settings`.
   The LCP chain is therefore: HTML → entry JS → route chunk → `/api/settings` →
   `/api/listings` → first card image. Two round trips in series.
   The gate exists for a real reason (`perPage` is 30 or 32 depending on
   `settings.searchGridColumns`; without it the page fires two listing requests). Do not
   simply delete it — Task 2 removes the *reason* for waiting.
3. `ConditionPage` also derives its skeleton state from the same flag:
   `const saleLoading = !settingsFetched || saleQueryLoading;`.
4. The server already knows everything the client waits for:
   `getSsrPerPage()` (`render.ts:75`), `getGridColumns()` (`render.ts:94`),
   `getCarsOrderBy()` (`render.ts:133`, mapped identically to `listings.ts`).
5. SSR already runs a `prisma.listing.findMany()` for these paths (`render.ts:793`) and
   already preloads the first card's image — `cardPreloads()` / `CARD_IMAGE_SIZES`
   (`seo-meta.ts:97,126`), emitted for `LIST_FIRST_PATHS` (`seo-meta.ts:1403`). The `sizes`
   string matches `CARD_SIZES` in `src/components/ImageSwiper.tsx`. **This part is correct —
   leave it alone.**
6. The precedent for injecting server data into the client is `window.__HERO_BANNERS__`
   (`render.ts`, replace on `</head>`), consumed as React Query `initialData`. Follow that
   convention; do not invent a second mechanism.
7. `render.ts` already rewrites the preload block per route: the `<!--home-preload-->` block
   is stripped off `/`, `/api/rental/vehicles?limit=1` is stripped outside rental routes, and
   `/api/listings/options` gets `?status=new` on `/`. That is where route-scoped preload
   changes belong.
8. Route `modulepreload` is **off** by default (`SSR_MODULEPRELOAD=on` is the escape hatch)
   after the experiment in `docs/BRIEF_AG_MODULEPRELOAD_EXPERIMENT.md`. Do not turn it on.
9. SSR HTML is cached in Redis with SWR, keyed by path + page (`render.ts`, `ssr-cache.ts`).
   **Anything you inject into the HTML inherits that TTL and must be identical for every
   visitor of that URL.** Nothing user-specific may go in.
10. `src/services/api.ts → listingsApi.getListings()` builds the `/api/listings` query string.
    It is the single source of truth for that URL. Do not duplicate its logic anywhere.

---

## Task 0 — baseline, before any code

Lighthouse mobile, incognito, production build, **median of 5 runs**, on:

- `https://motolia.pl/` (the number we must not break)
- `https://motolia.pl/nowe`
- `https://motolia.pl/uzywane`

Record per URL: performance score, FCP, LCP, TBT, CLS, SI, and the **LCP element identity**
from the "Largest Contentful Paint element" audit.

Also record, from DevTools Network on `/nowe` (Moto G Power emulation, cache disabled), the
timestamps of: HTML response end, entry JS execution start, `/api/settings` start/end,
`/api/listings` start/end, first card image start/end. This waterfall is the thing Tasks 2–3
are supposed to change; without the "before" the "after" is unreadable.

Measure on **production**, not `dev.motolia.pl`. Dev runs a different GTM container with no
Meta Pixel / Clarity / Ads, so its TBT is not our TBT (`PERF_HOME_REFERENCE.md` §0.5). A
Lighthouse SEO score of ~69 means you are on dev; ~100 means production.

Report the table before starting Task 1.

---

## Task 1 — delete the dead `/api/geo` preload

`index.html` carries `<link rel="preload" href="/api/geo" as="fetch" crossorigin="anonymous" />`
in the "globalne" block. **No frontend code ever calls it.** The endpoint exists
(`backend/src/routes/consent.ts:48`) but `src/lib/consent.ts` only posts to `/api/consent`;
a grep for `geo` across `src/` returns nothing but Peugeot.

Delete the line from `index.html`. That is the whole task.

Before deleting, re-run the grep yourself (`rg -n "api/geo" src backend/src`) and paste the
result into the report. If something does consume it, stop and report instead of guessing.

Verify: `/nowe` and `/` no longer request `/api/geo`; nothing in the console changes.

---

## Task 2 — SSR-inject app settings, remove the settings hop

**Why:** kills one full round trip in front of the listings request, on every route including
`/` (where it can only help — the home page waits on the same settings for its own queries).

### Implementation

1. `backend/src/routes/render.ts`: inject `window.__APP_SETTINGS__` before `</head>`, exactly
   like `__HERO_BANNERS__`, on **all** routes.
   - The payload must be **the same object `/api/settings` returns**. Call the same
     service/handler the route uses — do not hand-assemble a subset, or the client will get a
     shape that differs from the refetch and things will change under the user's feet.
   - If `/api/settings` returns anything visitor-specific or auth-dependent, stop and report:
     that would make the Redis-cached HTML unsafe (ground truth 9).
   - JSON-escape it the way `__HERO_BANNERS__` is escaped (`<`/`</script>` handling). Do not
     invent a new serialiser.
2. `src/hooks/useAppSettings.ts`: consume it.
   ```ts
   initialData: (window as any).__APP_SETTINGS__ ?? undefined,
   initialDataUpdatedAt: 0,   // treat as stale → background revalidation, non-blocking
   ```
3. **The trap — read this twice.** In TanStack Query v5, `initialData` gives you
   `status: 'success'` but **`isFetched` stays `false` until a real network fetch resolves.**
   Both gates in the app read `isFetched`:
   - `useListings()` → `enabled: !waitForSettings || settingsFetched`
   - `ConditionPage` → `const saleLoading = !settingsFetched || saleQueryLoading;`

   Left as-is with `initialDataUpdatedAt: 0` it happens to work (a revalidation fires), but it
   still blocks on that fetch — i.e. the whole task achieves nothing. Change both gates to
   "do we have settings?" semantics (`settings !== undefined` / `isSuccess`) rather than "did
   we fetch?". Check for other `isFetched` readers of `useAppSettings` before you change it
   (`rg -n "settingsFetched|isFetched" src`) and fix them in the same commit if they have the
   same meaning; do not touch unrelated ones.
4. Keep the `<link rel="preload" href="/api/settings">` in `index.html` for now — the
   background revalidation still uses it. Removing it is a separate measurement.

### Verify

- `/nowe`, mobile emulation, cache disabled: `/api/listings` now starts **without waiting for
  `/api/settings` to finish**. This is the pass/fail criterion — show the two waterfall rows.
- Exactly **one** `/api/listings` request on first paint (not two with different `perPage`).
- The card grid shows 30 or 32 cards per page exactly as before; `searchGridColumns = 3` in
  admin still produces a 3-column grid and 30 cards.
- `/` unchanged: score, LCP element, no hero flash, no CLS.

---

## Task 3 — fetch-ahead of the default catalog query

**Why:** even with Task 2, `/api/listings` cannot start until the entry bundle and the route
chunk have been downloaded and executed (~2–3 s on throttled mobile). The server can start
that request while the HTML is still parsing.

**Do not inject the listings payload into the HTML.** It was considered and rejected: the SSR
`select` (`render.ts:793`) carries 9 fields for the prerender, while `ListingCard` needs the
full mapped shape from `mapBackendListingToFrontend` — widening it would add tens of KB to a
Redis-cached HTML document, and HTML weight on these routes is exactly what the modulepreload
experiment showed to be expensive.

### Implementation

1. `render.ts`, for `path === '/nowe' || path === '/uzywane'` **and page 1 only**: build the
   canonical listings URL from data the server already has — `condition`, `getSsrPerPage()`,
   `getCarsOrderBy()`'s sort key, `settings.displayCurrency` (default `PLN`), `page=1`.
2. Inject a small inline script before `</head>`:
   ```html
   <script>window.__CATALOG_PREFETCH__={url:"…",p:fetch("…").then(function(r){return r.ok?r.json():null}).catch(function(){return null})}</script>
   ```
   `fetch` is async and does not block the parser. Keep it to one line, no dependencies.
3. `src/services/api.ts → listingsApi.getListings()`: after it builds `url`, if
   `window.__CATALOG_PREFETCH__` exists and its `url` is **string-equal** to the URL just
   built, await the stored promise instead of issuing a new `fetch`, and clear the global so
   it is consumed exactly once. On `null` (failed prefetch) fall through to the normal fetch.
   - String equality is deliberate: any drift between server and client — a filter in the
     URL, a different sort, a different `perPage` — makes the strings differ and the prefetch
     is simply ignored. That is the safety mechanism. **Do not "improve" it into a fuzzy
     match.**
4. Because the client builds its URL from `URLSearchParams` in a fixed field order, the
   server must emit the parameters in that same order. Read `getListings()` and mirror it.
   If you find yourself unable to produce an identical string, stop and report — a
   near-miss silently costs a duplicate download of the whole listings payload.

### Verify

- `/nowe`, cache disabled: `/api/listings` starts within a few hundred ms of the HTML, long
  before the entry bundle finishes executing. Exactly **one** `/api/listings` request in the
  whole page load.
- `/nowe?make=bmw`: the prefetch URL does **not** match, exactly one `/api/listings` request
  is issued by the app, and the results are the filtered ones. No flash of unfiltered cards.
- `/nowe?page=2`: no prefetch emitted, behaviour unchanged.
- `/samochody`: unchanged (not in scope — see below).
- LCP element on `/nowe` is still the first card image and it now starts downloading earlier.

---

## Task 4 — GTM injection timing (measure and propose; do not decide)

`src/components/seo/SeoManager.tsx` injects GTM via
`requestIdleCallback(injectGTM, { timeout: 2000 })`. With LCP around 3.8 s on mobile, the
2 s timeout forces the container — plus Meta Pixel (137.9 KB), Clarity, Google Ads, Thulium —
onto the main thread **inside the LCP window**. The 2 s value is deliberate
(`docs/CRO_AUDIT_MOTOLIA_2026-07.md` P0.6: GA4 was blind to sessions bouncing in under 5 s),
so this is a measurement task, not a refactor.

Measure on production, `/nowe`, mobile, median of 5, three arms:

| arm | change |
|---|---|
| A | current (`timeout: 2000`) |
| B | `timeout: 4000` |
| C | injection deferred to `window.load` + `requestIdleCallback` |

Report TBT, LCP and the "Reduce the impact of third-party code" figure per arm, plus the
main-thread breakdown by third party. Then state, in one paragraph, what each arm costs in
lost GA4 sessions (bounces shorter than the delay), using real bounce-time distribution from
GA4 or Clarity if you can get it.

**Recommend, do not merge.** The alternative worth pricing in the same report: emit the
`page_view` server-side from `render.ts` via the GA4 Measurement Protocol (the server already
knows the path and the request) and let GTM load at true idle — that buys the TBT without
losing measurement. Estimate the effort; do not build it.

---

## Task 5 — optional experiment: `/api/listings/options` preload on catalog routes

Only if Tasks 1–3 leave the number short of target.

`index.html` preloads `/api/listings/options` at high priority on every route. On `/nowe` it
feeds `TopFilterBar` facets, which are **not above the fold on mobile**, while competing for
bandwidth with the entry bundle, the LCP image and now the listings prefetch.

Experiment: strip that preload for `/nowe` and `/uzywane` only, in the same place `render.ts`
already strips the rental preload. The endpoint stays; only the preload hint goes. Measure
median of 5 before/after on `/nowe` and check that filter chips still populate without a
visible delay. Keep or revert on the numbers, and say which.

---

## Regression gate for `/` — non-negotiable

Every task above is either route-scoped to the catalogs or a shared reduction. None of them
may touch the invariants in `docs/HOMEPAGE_PERFORMANCE_ARCHITECTURE.md`: static `HomePage`
import, no `Suspense` above the fold on `/`, SSR shell matching React's first render attribute
for attribute, one LCP image preload.

Before the final commit:

1. `bun run test`, `bun run lint`, `bun run build` — all green.
2. The SSR sanity check from `PERF_HOME_REFERENCE.md` §0 on `/` and on `/nowe`.
3. Lighthouse mobile, median of 5, on `/` — **must not drop below the Task 0 baseline.**
   If it drops, that is a blocker, not a rounding error: re-measure, and if it holds, revert
   the offending task and report.
4. Manual: `/` direct load, SPA navigation `/` → `/nowe` → back button, and `/nowe` direct
   load. No hero flash, no layout jump, no console errors.

---

## Reporting

One report per task, in this order, each with: what changed (diff summary), the before/after
waterfall or table, and anything you found that contradicts the ground truth above. If a task
turns out to be wrong or unnecessary once you are in the code, say so and stop — that is a
better outcome than a clean implementation of the wrong thing.

Commit granularity: one commit per task, message prefixed `perf:`, so any single change can
be reverted independently.
