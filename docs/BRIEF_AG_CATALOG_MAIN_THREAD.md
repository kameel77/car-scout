# Brief: `/nowe` round 2 — the main thread, not the network

Round 1 (`docs/BRIEF_AG_CATALOG_CRITICAL_PATH.md`, commits `ed0c3aa`, `24e8461`, `df29357`)
did its job: the network is no longer the problem on `/nowe`. This round attacks what is
left, and the measurement says it is JavaScript execution.

Read `CLAUDE.md` §2/§3, `docs/PERF_HOME_REFERENCE.md` §0/§0.5 and
`docs/HOMEPAGE_PERFORMANCE_ARCHITECTURE.md` before starting. The home page must not regress.

---

## Ground truth — PageSpeed Insights, `https://motolia.pl/nowe`, 30 Aug 2026 11:51 CEST, mobile (Moto G Power, Lighthouse 13.4.1, production)

**Field data (CrUX, 28 days) — Core Web Vitals: FAILED**

| LCP | INP | CLS | FCP | TTFB |
|---|---|---|---|---|
| 2.5 s | **361 ms — fail** | 0 | 1.2 s | 0.4 s |

**The assessment fails on INP alone.** LCP and CLS pass in the field. That matters for
prioritisation: everything below that reduces main-thread work helps INP; nothing below that
only shortens the network path would have helped at all.

**Lab: performance 67** — FCP 2.4 s, LCP 3.6 s, **TBT 900 ms**, CLS 0.003, SI 2.1 s.

**The network is already fast. Do not spend another hour on it.**

- Critical path maximum delay: **563 ms**. Document 186 ms / 29.66 KiB, entry bundle 243 ms,
  every route chunk resolved by 563 ms.
- `/api/listings?status=…` resolves at **527 ms**, 57.03 KiB — the Task 3 prefetch works.
- No preconnect candidates ("Żadne dodatkowe źródła nie są dobrymi kandydatami").

**Everything is downloaded by ~600 ms and LCP is 3.6 s.** LCP on this page is bound by the
main thread, not by bytes on the wire.

**Main-thread breakdown — 2.3 s total**

| Category | Time |
|---|---|
| Script Evaluation | **1275 ms** |
| Other | 278 ms |
| Script Parsing & Compilation | 245 ms |
| Style & Layout | 212 ms |
| Garbage Collection | 130 ms |
| Rendering | 98 ms |
| Parse HTML & CSS | 30 ms |

**JS execution — 1.5 s, by attribution**

| Source | CPU total | Evaluation | Parse |
|---|---|---|---|
| `/assets/index-*.js` (entry bundle) | **1000 ms** | **806 ms** | 57 ms |
| `/nowe` (document) | 377 ms | 46 ms | 1 ms |
| `gtag/js?id=G-8N1E16P2DT` | 314 ms | 221 ms | 92 ms |
| `gtm.js?id=GTM-MQB44KPS` | 302 ms | 142 ms | 83 ms |
| Unattributable | 235 ms | 58 ms | — |

**Unused JavaScript — 227 KiB estimated**

| | transferred | unused |
|---|---|---|
| entry bundle | 218.5 KiB | **95.0 KiB** |
| GTM (both files) | 331.8 KiB | 132.1 KiB |

**Images — 132 KiB estimated savings.** Every card picks the `-md` variant (file 1081×675)
and displays it at **422×238 CSS px**. The LCP element is the first card image
(`Hyundai i20`, `loading="eager"` + `fetchpriority="high"`, 21.8 KiB, 21.8 KiB wasted).
`/motolia-placeholder.webp` is 900×562 / 20.6 KiB for the same 422×238 slot.

Also flagged: 10 long tasks, 21 KiB unused CSS, 15 KiB from cache TTLs, browser console
errors logged (Best Practices 92), missing source maps for our own bundles.

**Score arithmetic.** TBT is 30% of the mobile score and LCP 25%. Moving TBT from 900 ms to
~300 ms is worth roughly 15–18 points on its own; the same work is what moves field INP.
Images alone are worth a couple of points. Prioritise accordingly.

---

## Task A — image variants (mechanical, do first, lowest risk)

**The problem:** `image-optimizer.ts` produces 1920 / 1200 / 600 wide variants. A card slot is
422 CSS px; on the test device (DPR 1.75) the browser needs ~740 px, so 600w is just too
small and it takes 1200w. Every card pays roughly double.

**What to change:** `mediumWidth: 1200 → 900` in the defaults of
`backend/src/services/image-optimizer.ts`, and the `-md` descriptor from `1200w` to `900w` in
**both** places that build a srcset:

- `localVariants()` in `src/components/OptimizedImage.tsx`
- `buildImagePreload()` in `backend/src/services/seo-meta.ts`

Filenames do not change, so there is **no 404 risk** — this is deliberately not the AVIF
situation (`025a103`), where new filenames were referenced before they existed. Images that
have not been backfilled yet simply serve a 1200 px file under a 900w descriptor: a
conservative selection, never a broken one.

Then backfill with `backend/src/scripts/optimize-existing-images.ts` over
`uploads/listing-images` and `uploads/specification-images`. **Check first that the script
accepts a target directory and options**; if it does not, report and stop rather than
widening its scope.

Separately: `public/motolia-placeholder.webp` is 900×562 / 20.6 KiB for a flat placeholder.
Re-encode it small (it should be low single-digit KiB) — but keep the same filename and the
same intrinsic aspect ratio, because `cardPreloads()` preloads it when the first offer has no
photo.

**Verify:** on a 412 px viewport the cards request the `-md` file and it is roughly half its
current weight; "Ulepsz dostarczanie obrazów" drops from 132 KiB well below 50 KiB; the LCP
element is still the first card image; the detail-page gallery (which also uses `-md`) still
looks sharp on a desktop 2× display — **look at it, do not assume**.

---

## Task B — GTM: 616 ms of CPU (this is round 1's Task 4, still not done)

`src/components/seo/SeoManager.tsx` injects GTM at
`requestIdleCallback(injectGTM, { timeout: 2000 })`. With LCP at 3.6 s the timeout fires
*inside* the LCP window, and the container costs **616 ms of CPU and 132 KiB of unused JS**.
It is also the most likely single contributor to the field INP failure, because GTM installs
listeners and runs tags on interaction.

Run the three arms from round 1's Task 4 (A: current, B: `timeout: 4000`, C: defer to
`window.load` + idle), median of 5 on production, and report TBT, LCP and third-party CPU per
arm. State what each arm costs in lost GA4 sessions.

**Recommend, do not merge.** The trade-off (CRO_AUDIT P0.6: GA4 blind to sub-5 s bounces) is
a business decision. Price the server-side `page_view` alternative (Measurement Protocol from
`render.ts`) in the same report — it is the only option that buys the CPU back without losing
measurement.

---

## Task C — the entry bundle: 806 ms of script evaluation, 95 KiB unused

This is the biggest single item on the page and it is bigger than GTM. **This task is
measurement first, then one change at a time**, because the entry bundle is what the home
page's 99 depends on.

### C1 — measure before touching anything

Chrome DevTools → Coverage, on `/nowe`, production build. Report the top unused ranges of
`/assets/index-*.js` by module. State plainly which of these carry the 95 KiB:

- home-page code (`HomePage` is a **deliberate** static import — invariant, do not make it
  lazy), specifically `HeroBannerCarousel`, `HeroVehicleFilter`, `CallbackForm`
- the provider stack in `App.tsx` (`AuthProvider`, `SpecialOfferProvider`,
  `CrmTrackingProvider`, `PersonalOfferProvider`, `BrandProvider`, `HelmetProvider`)
- `react-helmet-async` (see C3)
- radix primitives pulled in by `Toaster` / `TooltipProvider`
- i18next + `src/i18n/translations.ts` (44 KB of source, three languages)

Do not act on the list yet. Report it.

### C2 — chunk granularity

The critical path shows ~30 route chunks between 0.95 KiB and 2.5 KiB — one per lucide icon
(`chevron-up`, `ellipsis`, `map-pin`, `fuel`, `gauge`, `calendar`, `user`, `info`, …) plus one
per radix primitive. Each is a separate module evaluation and a separate request; together
they are a large part of the 245 ms of parse/compile and of the "Other" 278 ms. This is also
what made the modulepreload experiment (`docs/BRIEF_AG_MODULEPRELOAD_EXPERIMENT.md`) fail.

Add a `build.rollupOptions.output.manualChunks` in `vite.config.ts` that groups
`lucide-react` into one chunk and `@radix-ui/*` into one chunk. Nothing else. Measure
median of 5 on `/nowe` **and** on `/` before and after — grouping changes what the home page
loads too, so `/` is part of the pass/fail, not an afterthought.

### C3 — `react-helmet-async` on SSR-rendered routes

`MetaHead` in `ConditionPage` rewrites the title, description and JSON-LD that
`backend/src/services/seo-meta.ts` already injected server-side. That is DOM work during
hydration, in the TBT window, to produce markup that is already correct.

Measure what helmet costs in the Coverage/Performance trace first. If it is material,
propose (do not implement in this task) skipping the client-side head writes on routes that
the SSR already covers — the route list is `ROUTE_MODULES` / the static route table in
`seo-meta.ts`. Google reads the SSR HTML, so this must not change what a crawler sees:
verify with `curl` that the served HTML is byte-identical before and after.

### C4 — i18n: report the number, then ask

Out of scope in round 1 by explicit decision (Motolia is PL-only), and it stays out of scope
for implementation here. But the Coverage report from C1 will show what i18next plus the
three-language `translations.ts` actually cost in the entry bundle. **Put that number in the
report and stop there.** If it is a large share of the 806 ms, it becomes a business decision
about dropping EN/DE from the build, and that decision is not yours or mine to take silently.

---

## Task D — console errors and source maps (cheap, do last)

Best Practices 92 flags browser console errors and missing source maps for our own bundles.
List the actual console errors on `/nowe` in production and report them — an error thrown
during hydration is both a Best Practices hit and a possible TBT contributor. Fix only what
is trivially ours (for example the leftover `console.log('Making API call to:', url)` in
`listingsApi.getListings`); anything else, report first.

---

## Order and stopping rule

A → B (measure) → C1 (measure) → C2 → C3/C4 (measure) → D.

Re-run PSI mobile, median of 5, on `/nowe` **and** `/` after each of A, B and C2. The target
for this round is **TBT under 300 ms and lab performance ≥ 85 on `/nowe`, with `/` not below
its current score.** If a change does not move TBT by at least 50 ms, revert it and say so —
we are not accumulating complexity for noise.

Field INP is the real goal and it lags 28 days. Do not expect it to move in this session; note
in the report which changes are expected to affect it.

## Out of scope

The inlined-CSS strategy, splitting `HomePage` off the entry bundle, AVIF (blocked on a
backfill that Task A does not cover), `/samochody` and the rental routes (same patterns, next
round once these numbers are proven), and anything in the GTM container itself.

---

# Round 2 — follow-up after the implementation report (30 Aug 2026)

Reviewed against the repo at `90a03b0`. Task D and the placeholder are accepted as-is.
Three items are not done or not safe, in order of severity.

## F1 — BLOCKER: `manualChunks` put all of Radix on the home page's critical path

`dist/.vite/manifest.json` after `c9af3f9`:

```
ENTRY index.html -> assets/index-BHIvG_zT.js
  imports: [ _vendor-radix-BE6lnyhG.js, _vendor-lucide-gu164Iu7.js ]
```

Those are **static** imports of the entry, so every route — `/` included — now downloads and
evaluates `vendor-radix` (294.33 KiB raw / 92.96 KiB gz) and `vendor-lucide`
(60.47 KiB raw / 11.13 KiB gz).

Only **two** Radix packages are reachable from the entry graph: `react-tooltip`
(`TooltipProvider` in `App.tsx`) and `react-toast` (`ui/toaster` → `ui/toast`). Everything
else — dropdown-menu, popover, sheet, select, dialog, checkbox, collapsible, slider,
accordion, alert-dialog, progress — was previously in **lazy** route chunks and is now eager.

Eagerly evaluated JavaScript, before → after:

| | before | after |
|---|---|---|
| raw (what the main thread parses and evaluates) | 601.8 KiB | **673.4 KiB** |
| gzip (what crosses the wire) | 218.5 KiB | 201.2 KiB |

The report presents "index dropped from 601.8 to 318.63 KiB" as the win. It is not a win —
the code moved to a sibling chunk that loads at the same time. TBT tracks **raw** parse and
evaluation, so this change moves the number we are optimising in the **wrong** direction, and
`/nowe`'s 806 ms of script evaluation was the whole reason for Task C.

**Do not deploy this to production until `/` is re-measured.**

### The fix that keeps the grouping and removes the regression

Make the only two entry-reachable Radix consumers lazy, so `vendor-radix` leaves the entry
graph entirely and becomes an async chunk shared by the lazy routes that actually use it:

1. `App.tsx`: wrap `Toaster` the way `Sonner` is already wrapped —
   `const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })))`
   inside the existing `<Suspense fallback={null}>`. A toast cannot fire before hydration, so
   there is nothing to see.
2. `TooltipProvider` is a context provider and cannot simply disappear — its children must
   keep rendering. Either lazy-load it with a passthrough fallback that renders `children`
   unchanged, or drop the root-level provider and mount it where tooltips are actually used.
   **Report which you chose and why before implementing.**
3. Re-check the manifest afterwards: the entry's `imports` array must no longer contain
   `vendor-radix`. That is the pass/fail criterion, not the file sizes.

If step 2 turns out to be invasive, the fallback is to **revert `c9af3f9`** and keep only the
`lucide-react` grouping, which is small and where the micro-chunk count actually came from.

## F2 — Task A's main win was never delivered

`optimize-existing-images.ts` skips existing `.webp` files and takes no target directory, so
**nothing was backfilled**. Every `-md` file on disk is still 1200 px wide, now advertised as
`900w`. The browser still needs ~740 px on the test device, still picks that candidate, and
still downloads the same bytes. Delivered so far: 11.6 KiB from the placeholder. The 132 KiB
PSI reported is untouched.

Write a **separate, single-purpose** script (do not widen the existing one):
re-encode `uploads/listing-images` and `uploads/specification-images`, regenerating only the
`-md.webp` variant at 900 px, same filenames, same quality setting as the pipeline. Run it
against a copy first, report before/after total bytes for the directory and eyeball three
images at mobile display size. `nginx.conf` serves `/uploads/` with `expires 30d`, so
returning visitors keep the old files for up to 30 days — state that in the report, do not
invent a cache-busting scheme.

Until this runs, Task A is not finished and must not be reported as such.

## F3 — Task B's numbers are not from production, and the recommendation has a hole

The measured arms report TBT ~237 ms and LCP ~6178 ms for the current code. PSI on production
the same morning measured **TBT 900 ms and LCP 3.6 s**. Those are different environments; the
absolute values cannot be compared with anything and must not be used for a decision. The
relative ranking (C < B < A) is plausible and is the only usable output.

Re-run the three arms as the brief specified: **production, mobile, median of 5**, and report
TBT/LCP/third-party CPU per arm from PSI itself.

Second: "0% utraty danych o sesjach" for the server-side `page_view` is **not correct**. A
Measurement Protocol hit needs a `client_id`. A first-time visitor who bounces before GTM
loads has no `_ga` cookie, so the server would mint a new id per request — inflating users,
breaking session stitching and destroying paid-campaign attribution, which is precisely the
data P0.6 was protecting. Doing this properly means the server issuing a first-party id
cookie that GTM then adopts as its `client_id`, plus Consent Mode v2 handling. That is more
than 2–3 hours. Re-estimate it honestly, or recommend arm C with a stated, quantified
measurement loss instead.

## F4 — missing verification

The stopping rule was: PSI mobile, median of 5, on `/nowe` **and** `/` after each of A, B and
C2, target TBT < 300 ms and `/` not below its baseline. No post-change measurement appears in
the report, so nothing shipped is currently validated. Run it before anything reaches
production.

## F5 — Task C1 has no numbers

The Coverage report lists module names but no byte attribution, so it does not answer which
modules carry the 95 KiB. Re-run it and report the top unused ranges with sizes. Without that
we cannot tell whether C3 (~20–30 ms) and C4 (~20–25 KiB gz) are worth doing at all.

---

# Round 2 — second follow-up (reviewed at `49d0d31`)

## F1 — accepted

`dist/.vite/manifest.json` confirms the entry now imports only `_vendor-lucide-*.js`.
`Toaster` is lazy, the root `TooltipProvider` is gone, and the one file that renders
`<Tooltip>` without a local provider (`admin/PriceAnalyticsDashboard.tsx`) uses **recharts'**
`Tooltip`, not Radix — no runtime risk. Radix is fully async again.

## F6 — the `lucide-react` grouping is now a wash; settle it with a measurement

Eagerly loaded JavaScript, measured on the built output:

| | raw (parsed + evaluated) | gzip (over the wire) |
|---|---|---|
| before `c9af3f9` (the PSI baseline) | 601.8 KiB | 218.5 KiB |
| now (`index` 572.7 + `vendor-lucide` 67.0) | **639.7 KiB** | 193.9 KiB |

`vendor-lucide` holds every icon used anywhere in the app, admin included, and the entry
imports it statically — so ~38 KiB raw of previously-lazy icon code is now parsed on every
route, `/` included, in exchange for 24.6 KiB less transfer.

TBT tracks raw parse and evaluation. The network is not the bottleneck here (critical path
563 ms). So this trade currently runs against the metric we are optimising, by a small margin.

**Decide it with numbers, not with preference:** PSI mobile, median of 5, on `/nowe` and `/`,
with and without the `manualChunks` rule. Keep it only if TBT actually improves on both. If it
does not, drop the rule — the ~20 micro-chunks it removes were lazy and off the critical path.

## F7 — BLOCKER: the backfill ran on the wrong machine

The script is correct and its default directory list is right. The run is not.

`backend/uploads/` on the dev machine contains only `csflow-images` and `cookies` — there is
no `listing-images` or `specification-images` there. The 644 MB saved is a **local dev copy**.

Every image PSI flagged is served from production:
`https://motolia.pl/uploads/listing-images/…-md.webp` and
`https://motolia.pl/uploads/specification-images/…-md.webp`. Production still serves 1200 px
files. **The 132 KiB is still entirely on the table.**

Run it inside the production container. Per `CLAUDE.md` §6 the image ships compiled without
`src/`, so it is:

```
node dist/scripts/backfill-medium-images.js
```

Confirm first that the script is included in the build output (`dist/scripts/`); if it is not,
that is a build-config fix, not a reason to run `npx tsx`.

Before running: it re-encodes ~18k images and is CPU-bound — run it off-peak, watch container
CPU so it does not starve the SSR route, and make sure the volume is backed up. Report
before/after directory bytes and the PSI "Ulepsz dostarczanie obrazów" figure afterwards.

## F8 — Task B: decision accepted, numbers still not measured

Arm C is the right call and the corrected server-side estimate (15–20 h, server-side GTM
container, first-party `client_id` cookie, Consent Mode v2) is honest — it correctly takes
that option off the table for now.

But the recalculated table is still an estimate, not a measurement, and it describes arm A as
"GTM eager w `<head>`" — the current code is `requestIdleCallback` with `timeout: 2000`. Its
"~140–190 ms CPU" contradicts the PSI report of the same morning, which attributes **616 ms**
to the two GTM files. The 1–3 % instant-bounce figure is likewise asserted, not taken from
GA4 or Clarity as the brief asked.

Ship arm C, then measure it on production and report the real numbers. Do not put estimates in
a table that reads like measurements.

## F9 — "HomePage is untouchable" is too broad

C1 puts 118.4 KiB raw (43.7 % of the unused code) in the home-page graph and marks it
untouchable. The invariant in `HOMEPAGE_PERFORMANCE_ARCHITECTURE.md` protects **the hero LCP
path on `/`** — a static `HomePage`, no lazy boundary above the fold, SSR shell matching the
first React render. It does not say every module the home page imports must be eager.

`HeroBannerCarousel` and the `MotoliaHomePage` shell stay static — they are the LCP element.
But `CallbackForm` is below the fold, and `HeroVehicleFilter` is the search card
(`lg:absolute`), not the LCP element. Both are candidates for `React.lazy`.

Measure what those two weigh in the entry bundle and report it. If it is a meaningful share
of the 118.4 KiB, propose the split — with the height reservation from
`PERF_HOME_REFERENCE.md` §1 (`min-h-[360px] md:min-h-[460px] lg:min-h-[520px]` on the wrapper)
so removing them cannot collapse the layout and produce CLS. Do not implement it before the
`/` baseline from F4 exists to compare against.

## Order

F7 (production backfill) → arm C → **F4: PSI median of 5 on `/nowe` and `/`, this is what
validates everything above** → C4 (i18n, now justified at 68.2 KiB raw / 23.8 KiB gz for a
PL-only site) → F6 decision → F9 measurement.
