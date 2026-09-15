// Reuse SSR's public request only for the same origin, endpoint and parameters.
// Comparing literal strings misses relative-vs-absolute URLs and key ordering.
export function matchesCatalogPrefetch(prefetched: string, requested: string, base: string): boolean {
  try {
    const a = new URL(prefetched, base);
    const b = new URL(requested, base);
    a.searchParams.sort();
    b.searchParams.sort();
    return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search;
  } catch {
    return false;
  }
}
