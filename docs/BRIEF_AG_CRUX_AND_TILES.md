# Brief: CrUX for catalog routes + feature-tile image weight

Two independent tasks. **A is measurement only — no code.** B is a small pipeline change
plus a backfill. Do A first and report it before starting B, because A decides what we work
on next week and B does not depend on it.

Read `docs/PERF_HOME_REFERENCE.md` §0 before any measuring.

---

# Task A — Is there a field-data problem on catalog routes?

## Why

PageSpeed Insights on `https://motolia.pl/` shows real-user (CrUX) data for the home page:

| Metric | Value | Verdict |
|---|---|---|
| LCP | 2.2 s | pass |
| **INP** | **291 ms** | **fail** (needs ≤ 200 ms) |
| CLS | 0 | pass |
| FCP | 1.3 s | pass |
| TTFB | 0.6 s | pass |

Core Web Vitals assessment: **failed, on INP alone.** Lab LCP on catalog routes is 9–10 s,
but the home page's field LCP is 2.2 s — the lab's 1.6 Mbps / 4× CPU emulation is far
harsher than the median Polish mobile visitor. **We do not know whether the catalog routes
have their own field problem.** That single fact decides whether a planned server-side
listings-injection change (removing `/api/listings` from the critical path) is worth
building at all.

## What to collect

Run PageSpeed Insights, **form factor: Komórka / Mobile**, on each of:

1. `https://motolia.pl/nowe`
2. `https://motolia.pl/wynajem-dlugoterminowy`
3. `https://motolia.pl/wynajem-dlugoterminowy?offerType=b2b`
4. `https://motolia.pl/uzywane`
5. `https://motolia.pl/` (baseline, already known — re-run so all rows come from one session)

For each URL record, from the **field-data section only** (the top block, "Dowiedz się, jakie
są wrażenia użytkowników"):

- the **This URL / Origin** toggle state — record **both** where both exist
- LCP, INP, CLS, FCP, TTFB (value + colour)
- the overall Core Web Vitals verdict (passed / failed)
- **whether URL-level data exists at all**

Report as one table, one row per URL per toggle state.

## Things that will trip you up

- **URL-level CrUX needs enough traffic.** Low-traffic URLs return no field data and PSI
  silently falls back to origin-level. If that happens, say so explicitly — "no URL-level
  data" is a finding, not a gap in the report. Do not present origin numbers as if they
  were the URL's.
- **Query strings.** `?offerType=b2b` is listed separately on purpose: CrUX may or may not
  key on it. If both 2 and 3 return identical numbers, note that they are the same record.
- **The field window is 28 days and trailing.** Everything we shipped in the last two days
  is invisible here. That is expected — this task is about the pre-existing state.
- Do **not** report the lab score from the bottom of the PSI page in this table. Different
  question, and mixing them is what made yesterday's numbers unreadable.

## Decision rule (state which branch the data lands in, do not act on it)

- **Catalog LCP is green in the field** → the listings-injection change drops down the
  priority list; INP becomes the only real target.
- **Catalog LCP is amber/red in the field** → the listings-injection change stays at the top
  and gets specced next.
- **INP fails on catalogs too** → INP is a site-wide problem, not a home-page one, and the
  fix belongs in the GTM container rather than in application code.

---

# Task B — Feature tiles are the heaviest image on the home page

## The measurement

PSI "Ulepsz dostarczanie obrazów" on `https://motolia.pl/` — **266 KiB** estimated savings
overall. The single largest item:

```
/uploads/feature-tiles/cmru9y93b000olmvl0ye4l15j0-...webp    95.6 KiB
  → 48.8 KiB from better compression (same dimensions)
  → 78.4 KiB from correct sizing (file 479x600, displayed 228x228)
```

**95.6 KiB for a tile that renders at roughly 175–230 CSS px on a phone.**

## Ground truth — verified, do not re-derive

- `backend/src/routes/feature-tiles.ts:316` calls `optimizeAndSaveImage()` with **no size or
  quality options**, so it inherits the defaults in
  `backend/src/services/image-optimizer.ts`: `largeWidth 1920`, `mediumWidth 1200`,
  `thumbWidth 600`, `quality 80`.
- Those defaults are tuned for car photography on detail pages. A feature tile never renders
  wider than about 280 CSS px (5 columns inside `.container` on desktop).
- `sharp` uses `resize(width, null, { withoutEnlargement: true })`, so a source narrower than
  the target is re-encoded at its original dimensions. The 95.6 KiB file is 479×600 — the
  source was never downscaled, only re-encoded at q80.
- The grid is `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` inside `.container`
  (`FeatureTilesSection.tsx:47`), aspect `4/5`.
- `FeatureTilesSection.tsx:64` passes `forceThumbnail={true}`. That branch of
  `OptimizedImage` returns a bare `<img src={thumbSrc}>` with **no `srcset`** — every device
  gets the same 600w file.
- `ImageGallery.tsx:157` also uses `forceThumbnail`. **Leave it alone** — there it is a
  thumbnail strip and the behaviour is correct.

**Note carefully:** removing `forceThumbnail` on its own will **not** shrink this file. With
a correct `sizes`, a phone would still select the 600w candidate. The weight comes from the
encode settings, not from candidate selection. Both parts are needed.

## What to change

**1. Tile-specific optimizer options** — `backend/src/routes/feature-tiles.ts`, at the
`optimizeAndSaveImage()` call:

```ts
const { largeFilename } = await optimizeAndSaveImage(buffer, {
    targetDir: TILES_DIR,
    baseFilename,
    // Kafelek renderuje się najwyżej ~280 px CSS (5 kolumn w .container na desktopie),
    // więc domyślne 1920/1200/600 z pipeline'u fotografii aut są tu bezużyteczne.
    largeWidth: 900,
    mediumWidth: 600,
    thumbWidth: 400,
    quality: 72,
});
```

Treat `quality: 72` as a **proposal, not a decision** — see the visual check below.

**2. Frontend** — `FeatureTilesSection.tsx`: drop `forceThumbnail`, add a `sizes` that
matches the grid:

```tsx
sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw"
```

Keep `width="400" height="500"` — they carry the 4:5 aspect ratio that prevents layout shift.

**3. Backfill.** New options only affect new uploads. Re-run
`backend/src/scripts/optimize-existing-images.ts` over `uploads/feature-tiles` with the same
options. **Check first whether that script accepts a target directory and options** — if it
does not, say so and stop rather than widening its scope on your own.

## Visual check — this is a brand asset, not a bug fix

Before committing the quality change, render **three real tiles** (pick the darkest and most
detailed ones — the "Toyota i Lexus" night shot is the worst case) at q80 and q72 and put
them side by side at actual mobile display size. If q72 is visibly worse on any of them,
report the comparison and use q76 instead. Do not trade brand quality for bytes without
looking.

## Verify

- New tile upload through the admin panel produces `-md` and `-thumb` files at the new sizes.
- The rendered `<img>` now carries `srcset` and the new `sizes`.
- PSI on `https://motolia.pl/` after backfill: the feature-tile entry in "Ulepsz dostarczanie
  obrazów" drops out of the top items; record the new total savings figure against the
  current 266 KiB.
- Report before/after bytes for the three tiles you eyeballed.

## Known consequence to state in the report

`nginx.conf` serves `/uploads/` with `expires 30d`. The backfill rewrites bytes at unchanged
URLs, so returning visitors keep the old heavy files for up to 30 days. New visitors get the
new ones immediately. This is acceptable — do not invent a cache-busting scheme for it — but
it means the field-data effect will lag.

## Out of scope

AVIF output, changing the global optimizer defaults, touching any other upload route,
`ImageGallery`'s `forceThumbnail`, and the `sizes` values on listing cards. Those belong to
a separate image-pipeline project.
