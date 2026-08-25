# Mobile performance — Phase 1 implementation spec

Scope: two changes only — (1) hero LCP image double-download, (2) font payload.
Everything else from the earlier PageSpeed proposal is explicitly **out of scope**.

Target brand: **motolia** (`VITE_BRAND=motolia`). **CarSalon output must be byte-identical
before and after this change** except for file moves that produce the same CSS.

Read `CLAUDE.md` §2 (simplicity) and §3 (surgical changes) before starting. Do not
"improve" adjacent code. Do not refactor SSR.

---

## Ground truth (verified in the repo — do not re-derive, do not contradict)

1. SSR already emits the **correct** hero markup. `backend/src/services/seo-meta.ts`
   → `homeHeroShellHtml()` (~line 1483) renders:
   ```html
   <picture>
     <source media="(max-width: 767px)" srcset="<mobile>-thumb.webp 600w, <mobile>-md.webp 1200w, <mobile>.webp 1920w">
     <img src="<desktop>.webp"
          srcset="<desktop>-thumb.webp 600w, <desktop>-md.webp 1200w, <desktop>.webp 1920w"
          sizes="100vw" width="1600" height="700"
          fetchpriority="high" decoding="async" loading="eager"
          alt="..." class="absolute inset-0 w-full h-full object-cover">
   </picture>
   ```
2. SSR already emits a **media-scoped LCP preload**. `heroBannerPreloads()` emits
   `media="(max-width: 767px)"` for the mobile asset and `media="(min-width: 768px)"`
   for the desktop asset. On a phone only the mobile file is preloaded. This is correct.
3. The extra download is caused **exclusively by the React component**.
   `src/components/HeroBannerCarousel.tsx` lines ~64–84 render **two** `<OptimizedImage>`
   elements with `priority={idx === 0}`, hidden from each other with `hidden md:block` /
   `md:hidden`. `loading="eager"` + `fetchpriority="high"` are honoured by the preload
   scanner **before** CSS visibility is resolved, so a phone downloads the desktop asset
   as well. Fixing the React component is the whole of task 1.
4. `--font-heading` / `--font-body` are defined in `src/index.css` (~line 111) inside
   `@layer base :root`, defaulting to `'Outfit'` / `'Inter'`, and are overridden at
   runtime by `applyBrandTokens()` (`src/contexts/BrandContext.tsx:56,59`) from
   `src/brands/<brand>/config.ts`.
   - `src/brands/motolia/config.ts` → heading `'Archivo Variable'`, body `'Inter'`.
   - `src/brands/carsalon/config.ts` has **no `fonts` key** → CarSalon keeps the CSS
     default, i.e. **CarSalon genuinely uses Outfit**. Outfit therefore cannot be deleted
     globally; it must be removed **per brand at build time**.
5. `src/index.css` lines 1–8 import 8 `@fontsource` stylesheets (Outfit 400/500/600/700,
   Inter 400/500/600/700). Each yields a `latin` and a `latin-ext` woff2 → up to 16 files.
6. `vite.config.ts` → plugin `font-preload` (~line 109) preloads
   `outfit-latin-700` + `inter-latin-400`. On Motolia **Outfit 700 is never rendered**,
   so this is a high-priority preload of an unused font.
7. The class `font-outfit` appearing in `motoliaHeroShell` (`vite.config.ts` ~line 52)
   is **not a defined Tailwind utility** (`tailwind.config.ts` `fontFamily` only defines
   `heading` and `body`). It is a dead no-op class. **Leave it alone** — out of scope.
8. `vite.config.ts` already resolves brand-specific modules through `resolve.alias`
   (`@brand-home`, `@brand-contact`). Follow that existing convention.
9. All CSS is inlined into `index.html` by the `inline-css` plugin, and `build.manifest`
   is consumed by `backend/src/routes/render.ts`. Do not break either.

---

## Task 1 — Hero: one image per viewport

**Goal:** on a 390px-wide mobile viewport, loading `/` results in **exactly one**
hero image network request, and the React-hydrated DOM requests the **same URL** the
SSR preload already fetched (cache hit, no second paint).

### 1a. `src/components/OptimizedImage.tsx`

Add one optional prop and one branch. No other change to this file.

- Add to `OptimizedImageProps`:
  ```ts
  /** Wariant mobile (<768px). Gdy podany, renderujemy <picture> zamiast dwóch <img>. */
  mobileSrc?: string | null;
  ```
- Extract the existing srcset construction into a local helper so both the `<img>` and
  the `<source>` use identical logic:
  ```ts
  function localVariants(src: string): string | null {
      if (!src.startsWith('/uploads/') || !src.endsWith('.webp')) return null;
      const base = src.slice(0, -'.webp'.length);
      return `${base}-thumb.webp ${THUMB_W}w, ${base}-md.webp 1200w, ${src} 1920w`;
  }
  ```
- In the `isLocalUpload && isWebp && mode === 'srcset'` branch, when `mobileSrc` is set
  and `forceThumbnail` is false, wrap the returned `<img>` in:
  ```tsx
  <picture>
      <source media="(max-width: 767px)" srcSet={localVariants(mobileSrc) ?? mobileSrc} />
      {/* existing <img> unchanged */}
  </picture>
  ```
- Constraints:
  - `mobileSrc` must be ignored when `forceThumbnail` is true or when `mode !== 'srcset'`
    (degraded/fallback paths keep today's behaviour — the `onError` net does not fire for
    `<source>`, so degradation must fall back to the plain `<img>` path).
  - `className` stays on the `<img>`, **not** on `<picture>` (`absolute inset-0` positioning
    depends on the img being the positioned child; `<picture>` is `display:inline` by default).
    If layout breaks, add `className="contents"` to `<picture>` rather than moving classes.

### 1b. `src/components/HeroBannerCarousel.tsx`

Replace the two `<OptimizedImage>` blocks (lines ~64–84) with a single one:

```tsx
{(b.imageUrlDesktop || b.imageUrlMobile) && (
    <OptimizedImage
        src={b.imageUrlDesktop ?? b.imageUrlMobile ?? undefined}
        mobileSrc={b.imageUrlDesktop ? b.imageUrlMobile : null}
        alt={b.altText}
        width="1600"
        height="700"
        sizes="100vw"
        priority={idx === 0}
        className="absolute inset-0 w-full h-full object-cover"
    />
)}
```

Rationale for each attribute — **these must match SSR exactly or the browser issues a
second request**: `width="1600" height="700"` and `sizes="100vw"` are what
`homeHeroShellHtml()` emits. The current mobile `<img>` uses `width="800" height="800"`;
that is part of the bug, not something to preserve.

Edge case: when only `imageUrlMobile` exists, it becomes the `src` and `mobileSrc` is
`null` — one `<img>`, shown at all widths. This mirrors the SSR comment in
`heroBannerPreloads()` ("gdy brak mobile, desktop pokazuje się na wszystkich szerokościach").

### 1c. Fallback rule — decide by measurement, not by preference

The frontend builds `-thumb`/`-md` URLs optimistically; the backend calls
`hasLocalVariants()` and checks the disk. If verification (below) shows **any 404** on a
`-thumb.webp` / `-md.webp` mobile variant:

- **Do not** add client-side probing.
- Instead extend `HomeHeroBanner` in `backend/src/routes/render.ts` (~line 174) with
  precomputed `srcsetDesktop` / `srcsetMobile` strings built by the same helper SSR uses,
  ship them through the existing `window.__HERO_BANNERS__` payload, and consume them in
  the component. Report this before implementing it — it is a scope increase.

If there are no 404s, keep the simple version.

### Verification (task 1)

```
VITE_BRAND=motolia npm run build
```
Then, against a running backend serving the built `dist/`, in Chrome DevTools with device
emulation "Moto G Power" (or any ≤767px viewport) and cache disabled, load `/`:

1. **Network → Img filter: exactly one hero request.** Before the fix there are two
   (one `*-mobile-*.webp`, one `*-desktop-*.webp`). This is the pass/fail criterion.
2. The single request's `Initiator` is the `<link rel=preload>` in `<head>`, and its
   status after hydration is **not** repeated (no second entry for the same file).
3. No 404 on any `-thumb.webp` / `-md.webp` (see 1c).
4. Resize to ≥768px, reload: exactly one request, the desktop asset.
5. Performance panel: **LCP element is still the hero `<img>`** and CLS stays `0`.
6. Carousel still auto-advances every 6s and the dot buttons still scroll to slides.

---

## Task 2 — Fonts: per-brand loading

**Goal:** on Motolia, a cold mobile load fetches **at most 3 woff2 files**
(Archivo latin, Inter Variable latin, plus latin-ext only if Polish diacritics force it),
the `<head>` preloads only fonts that are actually rendered, and CarSalon's output is
unchanged.

### 2a. New dependency

```
npm i @fontsource-variable/inter
```
Keep `@fontsource/inter` and `@fontsource/outfit` in `package.json` — CarSalon still uses them.

### 2b. New files

`src/styles/fonts-carsalon.css` — moved verbatim from `src/index.css` lines 1–8, plus the
tokens moved out of `index.css` in step 2c:
```css
@import '@fontsource/outfit/400.css';
@import '@fontsource/outfit/500.css';
@import '@fontsource/outfit/600.css';
@import '@fontsource/outfit/700.css';
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';

:root {
  --font-heading: 'Outfit', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
}
```

`src/styles/fonts-motolia.css` — Inter Variable + the two Archivo `@font-face` blocks
**moved verbatim** (including the `unicode-range` values) from `src/index.css` lines 10–26:
```css
@import '@fontsource-variable/inter';

/* Archivo Variable — moved from src/index.css, unchanged. */
@font-face { /* ...latin-ext block, verbatim... */ }
@font-face { /* ...latin block, verbatim... */ }

:root {
  --font-heading: 'Archivo Variable', 'Archivo', system-ui, sans-serif;
  --font-body: 'Inter Variable', 'Inter', system-ui, sans-serif;
}
```
No Outfit. Note the family name is `Inter Variable`, **not** `Inter` — that rename is the
single most likely thing to break silently.

### 2c. `src/index.css`

- Delete lines 1–8 (the 8 `@fontsource` imports).
- Delete the two Archivo `@font-face` blocks (lines ~10–26) and their comment.
- Delete `--font-heading` and `--font-body` from the `@layer base :root` block (~line 111),
  including the trailing comment.
- Change nothing else in this file.

### 2d. `src/main.tsx`

```ts
import "./index.css";
import "@brand-fonts";
```
Order matters: the brand file must come **after** `index.css` so its unlayered `:root`
wins the cascade. Verify this in the built output, don't assume it.

### 2e. `vite.config.ts` — alias

Add to the existing `resolve.alias` object, next to `@brand-home`:
```ts
"@brand-fonts": path.resolve(__dirname, `./src/styles/fonts-${brand}.css`),
```

### 2f. `vite.config.ts` — `font-preload` plugin

Make it brand-aware. Motolia must preload the two fonts that actually paint above the fold;
CarSalon must keep exactly today's behaviour.

```ts
// carsalon: unchanged
const CRITICAL_FONT_RE = brand === 'motolia'
  ? /(-|\/)inter-latin-wght-normal-[^/]*\.woff2$/
  : /(-|\/)(outfit-latin-700|inter-latin-400)-normal-[^/]*\.woff2$/;
```
Archivo is served from `public/fonts/` and is **not** part of the bundle, so it has no
hashed name. For `brand === 'motolia'` append a literal link:
```html
<link rel="preload" href="/fonts/archivo-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
```
Confirm the exact hashed filename `@fontsource-variable/inter` emits before committing the
regex — check `dist/assets/` after the first build and adjust if it differs.

Keep the existing early-return guard: if no critical font matches, emit nothing rather than
emitting a broken link.

### 2g. `src/brands/motolia/config.ts`

```ts
fonts: {
    heading: "'Archivo Variable', 'Archivo', system-ui, sans-serif",
    body: "'Inter Variable', 'Inter', system-ui, sans-serif",
},
```
Only `body` changes.

### 2h. `tailwind.config.ts`

```ts
body: ["var(--font-body)", "Inter Variable", "Inter", "system-ui", "sans-serif"],
```
Adding an undefined family is inert for CarSalon, so this is safe for both brands.
`heading` stays as it is.

### 2i. Sweep

`grep -rn "'Inter'\|\"Inter\"\|Outfit" src backend/src --include=*.ts --include=*.tsx --include=*.css`
and report anything that hard-codes a family name outside the files listed above.
**Report, do not fix** — that is a separate decision.

### Verification (task 2)

```
VITE_BRAND=motolia npm run build && ls -la dist/assets/*.woff2
VITE_BRAND=carsalon npm run build && ls -la dist/assets/*.woff2
```

1. **Motolia build contains no `outfit-*` woff2.** Hard pass/fail.
2. `dist/index.html` (motolia) contains exactly two `<link rel=preload as=font>`:
   Inter Variable latin and `/fonts/archivo-latin-wght-normal.woff2`.
3. **CarSalon build: `git stash` the change, build, record `sha256sum dist/index.html`
   and the woff2 file list; unstash, rebuild, compare.** The font file list must be
   identical and the preload links must be the same two files as before.
4. Runtime, motolia, mobile emulation, cache disabled, `/`:
   - Network → Font: **≤3 requests**.
   - Computed styles: `h1` resolves to `Archivo Variable`, `body` to `Inter Variable`.
   - Rendering → "Font rendering": no synthetic bold/oblique on any weight
     (`font-bold`, `font-semibold`, `font-medium` all render from the variable axis).
   - Polish diacritics (ą ć ę ł ń ó ś ź ż) render in Archivo/Inter, not a system fallback.
     This is the latin-ext check — if they fall back, the `unicode-range` split is wrong.
5. Runtime, carsalon home page: headings still Outfit, no visual diff.

---

## Definition of done

- Both tasks verified by the checks above, with the numbers recorded.
- A single PageSpeed mobile run on the deployed result is **not** acceptable evidence;
  run 5 and report median LCP/FCP. Expect LCP improvement in the 1.5–3s range and FCP
  around 1–2s. If measured improvement is materially smaller, stop and report rather than
  reaching for the out-of-scope items.
- Report: file list changed, LOC delta, the Network numbers from each verification step,
  anything in §2i, and whether task 1c's escalation was needed.

## Explicitly out of scope

Thulium facade, GTM `requestIdleCallback` timing, `window.__INITIAL_CONFIG__` /
API-preload removal, `manualChunks`, `sizes` changes in `ImageSwiper` / listing cards,
lazy-loading of carousel slides 2–3 and feature tiles, CSP report tuning.
Do not touch `backend/src/services/seo-meta.ts` or `backend/src/routes/render.ts`
unless task 1c escalation is approved first.
