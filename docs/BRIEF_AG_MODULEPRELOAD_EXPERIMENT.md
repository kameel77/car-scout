# Brief: modulepreload on catalog routes — a measurement, not a fix

Scope: one env-gated switch in `backend/src/routes/render.ts`, plus measurements.
**This is an experiment.** Do not "improve" anything else while you are in there, and do
not implement the refinement described in §6 until the measurement says it is warranted.

Read `CLAUDE.md` §2/§3 and `docs/PERF_HOME_REFERENCE.md` before starting.

---

## 1. The observation

Same site, same server, same brand, comparable HTML size — very different results:

| | `/` | `/nowe` |
|---|---|---|
| HTML | 169 KB | 179 KB |
| `<link rel="modulepreload">` | **0** | **24** |
| `<link rel="preload" href="/api/...">` | 4 (home block) | 5 |
| `<link rel="preload" as="image">` | 2 | 2 |
| FCP | 1.2 s | **4.7 s** |
| LCP | ~1.3 s | **9.2 s** |
| Performance | 93 | **62** |

Measured on `dev.motolia.pl`, Lighthouse mobile, incognito, single runs.

`/` emits no modulepreload because the home page is not a lazy route (`ROUTE_MODULES` in
`render.ts` has no `/` entry). `/nowe` maps to `src/pages/ConditionPage.tsx` and
`routeChunkLinks()` walks its import graph.

## 2. Facts already established — do not re-derive

Verified against the live manifest at `https://dev.motolia.pl/.vite/manifest.json`:

- The 24 chunks are **all direct imports** of `ConditionPage.tsx`. Depth in the graph is 1.
  **A depth limit changes nothing** — do not propose one.
- Total 87.5 KB uncompressed: 4 chunks ≥5 KB carry 57.2 KB (65% of bytes), 20 chunks <5 KB
  carry 30.3 KB (35% of bytes but 83% of the requests).
- Largest: `ListingPagination` 24 KB, `ConditionPage` 15.6 KB, `ListingCard` 12.4 KB,
  `popover` 5.2 KB. Smallest are icon chunks (`chevron-left`, `map-pin`, `ellipsis`, …) at
  well under 1 KB each.
- `preload as="style"` count is 0 — CSS is inlined by the `inline-css` plugin, so
  `entry.css` is empty. That branch of `routeChunkLinks()` is dead in practice.

## 3. The hypothesis (and why it is only a hypothesis)

87.5 KB uncompressed (~25–30 KB over the wire) cannot by itself cost 3.5 s of FCP on
bandwidth alone. The proposed mechanism is **priority contention**, not volume:

All 24 links sit in `<head>`. The preload scanner issues them at high priority *while the
HTML document is still streaming*. Together with 5 API preloads and 2 image preloads, that
is ~31 subresource requests competing with the remainder of a 179 KB HTML response on a
throttled mobile link. First paint needs the HTML (CSS is inlined into it), so starving the
HTML stream delays FCP directly, and LCP follows.

This is plausible and consistent with the numbers. It is not proven. **The point of this
task is to find out, cheaply, before anyone builds something more elaborate.**

## 4. What to implement

One environment-gated switch. Nothing else.

In `backend/src/routes/render.ts`, where `routeChunkLinks()` is called (~line 1082):

```ts
// Eksperyment (docs/BRIEF_AG_MODULEPRELOAD_EXPERIMENT.md): 24 tagi modulepreload na
// trasach katalogowych konkurują ze strumieniem HTML o pasmo, zanim cokolwiek się
// namaluje. Flaga pozwala zmierzyć wariant bez nich bez zmiany kodu.
const modulepreloadEnabled = process.env.SSR_MODULEPRELOAD !== 'off';
```

and skip emitting the chunk links when it is off.

Requirements:

- Default (unset) **must** keep today's behaviour exactly. `'off'` is the only value that
  changes anything; treat every other value, including unset, as on.
- Read the flag **per request**, not into a module-level constant — the page cache must not
  serve HTML built under the other setting. Either read `process.env` inside the handler, or
  include the flag in the cache key. Say which you chose and why.
- Do not touch `routeChunkLinks()` itself, `ROUTE_MODULES`, `getViteManifest()`, the image
  preloads, or the API preloads in `index.html`.
- No new dependency, no manifest changes, no build changes.

## 5. Measurement — this is the actual deliverable

Two arms, on `dev.motolia.pl`, **after confirming SSR is up** (the console snippet in
`docs/PERF_HOME_REFERENCE.md` §0 — if that check fails, stop and report; measurements taken
without SSR are worthless and this project has already lost a day to exactly that).

| Arm | Setting | Expected links |
|---|---|---|
| A (control) | `SSR_MODULEPRELOAD` unset | 24 |
| C | `SSR_MODULEPRELOAD=off` | 0 |

For each arm, on **`/nowe`** and on **`/samochody`**:

- Lighthouse mobile, **incognito**, production build, **5 runs, report the median** of
  FCP, LCP, TBT, Speed Index and Performance.
- One Network panel capture: time to last byte of the HTML document, and the count of
  requests started before FCP.

Also confirm `/` is unaffected in both arms (it emits 0 modulepreload either way) — that is
the control that proves the flag did not change something unrelated.

Report the numbers. **Do not draw the conclusion or implement a follow-up.**

## 6. Do NOT implement this yet

If and only if arm C wins clearly, the refinement worth testing next is a **size threshold**:
emit modulepreload only for chunks ≥5 KB. On `/nowe` that is 4 links instead of 24 while
keeping 65% of the bytes. It needs chunk sizes, which the Vite manifest does not carry, so it
would mean emitting a small `chunk-sizes.json` from `generateBundle` in `vite.config.ts` and
reading it alongside the manifest in `render.ts`.

That is roughly 20 lines of new machinery. It is not worth building before the two-arm
measurement shows there is anything to win. If arm C shows no difference, this hypothesis is
dead, the machinery never gets built, and the next front is server-rendering the first screen
of catalog cards instead of `catalogSkeletonHtml()`.

## 7. Definition of done

- The flag is in, default behaviour byte-identical, cache-key question answered explicitly.
- `tsc --noEmit` clean apart from the known pre-existing `ListingDetailPage.tsx:624` error.
- Backend test suite green.
- Medians for both arms, both routes, reported as a table.
- No follow-up implemented.
