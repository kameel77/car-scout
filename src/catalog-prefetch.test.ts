import { afterEach, describe, expect, it, vi } from 'vitest';
import { listingsApi } from './services/api';
import { runInNewContext } from 'node:vm';
import { buildCatalogPrefetchScript } from '../backend/src/utils/catalog-prefetch';
import { matchesCatalogPrefetch } from './utils/catalogPrefetch';

function execute(path: string, search = '', configuredPath = path) {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ listings: [] }) });
  const window: Record<string, any> = {};
  const script = buildCatalogPrefetchScript(configuredPath, 30, 'price_asc', 'PLN');
  runInNewContext(script.replace(/^<script>|<\/script>\n$/g, ''), { window, location: { pathname: path, search }, fetch });
  return { window, fetch };
}

describe('catalog fetch-ahead', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).__CATALOG_PREFETCH__;
  });
  it('consumes the same public request once without a duplicate fetch', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ listings: ['fresh'] }) });
    vi.stubGlobal('fetch', fetch);
    (window as any).__CATALOG_PREFETCH__ = { url: '/api/listings?page=1', p: Promise.resolve({ listings: ['prefetched'] }) };
    expect(await listingsApi.getListings({ page: 1 })).toEqual({ listings: ['prefetched'] });
    expect(fetch).not.toHaveBeenCalled();
    expect(await listingsApi.getListings({ page: 1 })).toEqual({ listings: ['fresh'] });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('falls back to the ordinary request after a failed prefetch', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ listings: [] }) });
    vi.stubGlobal('fetch', fetch);
    (window as any).__CATALOG_PREFETCH__ = { url: '/api/listings?page=1', p: Promise.resolve(null) };
    await listingsApi.getListings({ page: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('never substitutes a public prefetch for an authenticated request', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ listings: ['scoped'] }) });
    vi.stubGlobal('fetch', fetch);
    (window as any).__CATALOG_PREFETCH__ = { url: '/api/listings?page=1', p: Promise.resolve({ listings: ['public'] }) };
    expect(await listingsApi.getListings({ page: 1 }, 'test-token')).toEqual({ listings: ['scoped'] });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(['/samochody', '/nowe', '/uzywane'])('starts a public request before React on %s', async path => {
    const { window, fetch } = execute(path);
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(fetch.mock.calls[0][0], 'https://dev.motolia.pl');
    expect(url.searchParams.get('status')).toBe(path === '/samochody' ? null : path === '/nowe' ? 'NEW' : 'USED');
    expect(url.searchParams.get('perPage')).toBe('30');
    await expect(window.__CATALOG_PREFETCH__.p).resolves.toEqual({ listings: [] });
  });
  it.each(['?make=BMW', '?page=2', '?sortBy=year_desc', '?clientType=business'])('does not issue the default request on %s even from cached HTML', search => {
    expect(execute('/samochody', search).fetch).not.toHaveBeenCalled();
  });
  it('does not prefetch on the wrong route', () => {
    expect(execute('/samochody/bmw', '', '/samochody').fetch).not.toHaveBeenCalled();
  });
  it('reuses equivalent absolute/relative URLs, regardless of parameter order', () => {
    expect(matchesCatalogPrefetch('/api/listings?a=1&b=2', 'https://dev.motolia.pl/api/listings?b=2&a=1', 'https://dev.motolia.pl/')).toBe(true);
  });
  it.each(['https://other.example/api/listings?a=1', '/api/listings?a=2', '/api/admin/listings?a=1'])('rejects different origin, filters or endpoint: %s', requested => {
    expect(matchesCatalogPrefetch('/api/listings?a=1', requested, 'https://dev.motolia.pl/')).toBe(false);
  });
});
