# Home page performance — reference

What makes `/` fast, why each piece exists, and what silently breaks it.
Read this before changing anything in the hero, the fonts, or the SSR shell.

Devlog with the full story: `Vault/projects/motolia/log/2026-08-25_lighthouse-mobile-home-ssr.md`

---

## 0. Before you trust ANY Lighthouse number

Three of the four measurements taken while writing this were invalid. Check all of it:

| Check | Why |
|---|---|
| Chrome **extensions off** (incognito) | Cost 43 points in one run: 31 → 74 on identical code |
| **Not** `localhost:8080` | That is the Vite dev server — unminified, unbundled, HMR |
| The page has SSR — see §1 | Without it you are measuring a different application |
| Production build (`npm run build`), not `npm run dev` | |
| Median of 5 runs | Lighthouse varies ±8 points |

The SSR check is the one people forget. Paste into the console on the page under test:

```js
fetch(location.href,{cache:'reload'}).then(r=>r.text()).then(t=>console.log(
  'canonical:', t.includes('rel="canonical"'),
  '| __HERO_BANNERS__:', t.includes('__HERO_BANNERS__'),
  '| <picture>:', t.includes('<picture>'),
  '| preload image:', (t.match(/rel="preload" as="image"/g)||[]).length
))
```

All `true` / `2` on `/` with active banners. Anything else means nginx fell through to
`@spa_fallback` and you are measuring the static shell, not the app — fix the deployment
before reading a single metric. See §5.

---

## 0.5 Which number answers which question

**Priorities come from CrUX (field), never from Lighthouse (lab).** This distinction cost a
day and a half before it was written down.

| | Lab (Lighthouse / PSI bottom half) | Field (CrUX / PSI top half) |
|---|---|---|
| What it is | one synthetic run: 1.6 Mbps, 150 ms RTT, 4x CPU | p75 of real visitors, trailing 28 days |
| Good for | *why* something is slow — element identity, waterfalls, breakdowns | *whether* it is worth fixing at all |
| Reacts to a deploy | immediately | after weeks, and only partially |

Measured 2026-08-26: catalog lab LCP was 9–10 s while field LCP on the same routes was
**2.2–2.7 s, green**. A planned change to inject listings server-side — half a day of work
plus `fastify.inject()` in the SSR request path — was cancelled on that evidence alone.

Use the lab to diagnose. Use the field to decide. If a lab audit screams and the field metric
is green, the audit is describing the emulation, not your users.

### Traps that produced wrong numbers here

- **Chrome extensions.** Cost 43 points on identical code (31 → 74). Lighthouse prints the
  warning at the top of its own report — read it before reading the score.
- **`localhost:8080` is the Vite dev server**, not a build. Never measure it.
- **`dev` and `prod` run different GTM containers** (`GTM-M93CF6GJ` vs `GTM-MQB44KPS`).
  Production carries Meta Pixel (137.9 KB), Clarity, Google Ads and Thulium; dev does not.
  **Third-party impact, TBT and INP can only be measured on production.**
- **"Server responded slowly (observed 801 ms)"** was mostly emulated connection setup —
  DNS + TCP + TLS at 150 ms RTT. Measured directly, TTFB was 86–158 ms warm *and* on a
  forced cache miss. Check before optimising a server that is already fast:
  ```js
  (async()=>{const t0=performance.now();const r=await fetch(location.href,{cache:'reload'});
   await r.body.getReader().read();console.log('TTFB ~', Math.round(performance.now()-t0),'ms')})()
  ```
- **A dev SEO score of 100 is a red flag**, not a win — see §3.
- **PSI medians are per metric.** A row of medians does not describe any single run, so it
  will not reconcile against the score. Fine for comparing arms, useless for sanity checks.

---

## 1. The LCP element must be in the initial HTML

The home page LCP is the hero banner image. It reaches the browser through three
mechanisms that must agree with each other, byte for byte:

1. **`<link rel="preload" as="image">`** with `media="(max-width: 767px)"` /
   `(min-width: 768px)`, `imagesrcset` and `imagesizes` — emitted by `heroBannerPreloads()`
   in `backend/src/services/seo-meta.ts`. The phone downloads only the mobile file.
2. **The SSR shell** — `homeHeroShellHtml()` replaces the `<!--home-shell-->` block with a
   real `<picture><source media="(max-width: 767px)">…<img …></picture>`.
3. **`window.__HERO_BANNERS__`** — injected before `</head>`, consumed as React Query
   `initialData` in `MotoliaHomePage`, so the first React render already knows there are
   banners and never renders the text hero.

**Invariant: React's hero markup must match the SSR markup attribute for attribute.**
`sizes="100vw"`, `width="1600"`, `height="700"`, the same `srcset` descriptors
(`600w / 1200w / 1920w`), the same `media` query. Any divergence and the browser issues a
second request after hydration, and LCP is measured from the repaint instead of the SSR paint.

**Invariant: 2 and 3 are gated on the same condition** (`path === '/' && heroBanners.length > 0`).
Never split them. If the shell says "banner" and the client says "no banners", the client
repaints the whole hero and LCP collapses.

### Two ways this was broken before

- **Two `<img>` hidden by CSS.** `hidden md:block` / `md:hidden` does not stop the preload
  scanner — it reads `loading="eager"` and `fetchpriority="high"` before CSS is applied and
  downloads both files. Use `<picture>` + `<source media>`, never CSS-hidden twins.
- **`React.lazy` on the hero.** It added a third hop to the critical chain
  (HTML → `index.js` → chunk, 1036 ms) *and* replaced the SSR-painted banner with the
  Suspense skeleton, which users saw as a flash that looked like an error.

**Invariant: nothing above the fold on `/` is `React.lazy`.** The 11 KB it costs in
`index.js` is worth far less than a round trip plus a repaint of the LCP element.

If you remove a `<Suspense>` wrapper above the fold, move its height reservation to the
wrapper (`min-h-[360px] md:min-h-[460px] lg:min-h-[520px]`). The search card is
`lg:absolute`, so without it the wrapper collapses to 0 and everything below jumps (CLS).

---

## 2. Fonts are per brand, and the preload must match the brand

`VITE_BRAND` selects `src/styles/fonts-<brand>.css` through the `@brand-fonts` alias in
`vite.config.ts`, imported in `main.tsx` **after** `index.css`.

- **motolia** — Archivo Variable (headings) + Inter Variable (body). No Outfit.
- **carsalon** — Outfit + Inter, static weights. Unchanged from before the split.

`--font-heading` / `--font-body` are defined **only** in those two files. Do not reintroduce
defaults in `index.css`; one definition per brand is what makes the cascade unambiguous.

**Invariant: the `font-preload` plugin in `vite.config.ts` must preload fonts the brand
actually renders.** It previously preloaded `outfit-latin-700` for Motolia, which never
paints — a high-priority download of an unused file while Archivo waited for CSS parsing.

### CE subsets

Stock `latin-ext` is 85 KB (Inter) for ~18 Polish codepoints and was discovered late, on the
critical path. `public/fonts/*-latin-ext-pl-*.woff2` are our own subsets:

| | before | after |
|---|---|---|
| Inter latin-ext | 85 068 B | 14 612 B |
| Archivo latin-ext | 32 608 B | 16 216 B |

Coverage: PL/CZ/SK/HU/HR/SI/RO. `Š` is included deliberately — "Škoda" appears on catalog
pages. The variable `wght 100–900` axis is preserved.

Regenerate with the command in the header comment of `src/styles/fonts-motolia.css`.
If you change the covered range, update the `unicode-range` in that file to match the
file's actual contents, or characters silently fall back to a system font.

**Filenames carry no content hash**, so cache-busting is by rename (same trade-off the
Archivo files already had). `location /fonts/` in `nginx.conf` gives them a long `max-age`
without `immutable` for that reason — rename the file when you change its bytes.

---

## 3. What is NOT a problem

Do not "fix" these:

- **`modulepreload: 0` on `/`.** `ROUTE_MODULES` in `render.ts` has no `/` entry because the
  home page is not a lazy route — it is already in the entry bundle. Nothing to preload.
- **`noindex` on dev.** Deliberate: `render.ts` sets `meta.noindex` for non-production hosts
  and `app.ts` adds `X-Robots-Tag: noindex, nofollow, noarchive`. It stops Google indexing
  the dev copy as duplicate content. Covered by `deindexing-guard.test.ts`. Lighthouse SEO
  will read ~69 on dev and ~100 on production. **A dev SEO score of 100 is a red flag** — it
  means the de-indexing guard did not run, which means SSR is down.
- **`Cache-Control: no-store` on the document.** Only `@spa_fallback` sets it. Seeing it on a
  page that should be server-rendered is a symptom, not a cause — see §5.

---

## 4. Known gaps

- `getHomeHeroBanners()` in `render.ts` caches the *error* result: one transient DB failure
  serves the text hero for 60 s, with the late banner swap and broken LCP. Cache successful
  reads only.
- `/api/hero-banners/public` is still fetched at startup despite `initialData` — off the
  critical path, but a redundant round trip. Likely a second `queryKey` inside the carousel.

---

## 5. When the numbers make no sense: check `@spa_fallback`

`nginx.conf` routes `/` to `@render`, which proxies to the backend. On 502/503/504 it falls
back to `@spa_fallback`, which serves the raw `dist/index.html`. The site keeps working —
without canonical, JSON-LD, the LCP image preload, or the SSR hero. **Nothing alerts.**

Symptoms, all at once: no canonical, no JSON-LD, no `noindex` on a non-prod host,
`<!--home-shell-->` still in the source, the `vite.config.ts` brand title, 0 image preloads,
`Cache-Control: no-store`, a text hero flashing before the banner, and an LCP several
seconds worse than FCP.

Usual cause: `BACKEND_URL` not resolving. It must be the unique per-environment alias
`http://${COMPOSE_PROJECT_NAME}-backend:3000` — **not** the compose service name
`carscout-api`, which every environment shares on the `coolify` network.

Coolify caches its own copy of the compose file and does not always re-read it. If the value
in the Coolify UI disagrees with the repo, use **Reload Compose File**, then redeploy.
Editing the env var by hand is not the fix; it hides the drift.
