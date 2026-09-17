import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { buildRentalPrefetchScript } from '../backend/src/utils/rental-prefetch';
import { rentalPublicApi } from './services/rental-api';

const params = { page: '1', limit: '12', sortBy: 'minMonthlyRateNet', sortOrder: 'asc', offerType: 'b2b' };
function execute(segment: string | null, search = '', blockedStorage = false, vehicles: any[] = []) {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ vehicles }) });
  const appendChild = vi.fn();
  const window: Record<string, any> = {};
  runInNewContext(buildRentalPrefetchScript().replace(/^<script>|<\/script>\n$/g, ''), {
    window, fetch, location: { pathname: '/wynajem-dlugoterminowy', search },
    document: { head: { appendChild }, createElement: () => ({ setAttribute: vi.fn() }) },
    localStorage: { getItem: () => { if (blockedStorage) throw new Error('blocked'); return segment; } },
  });
  return { fetch, window, appendChild };
}
describe('rental fetch-ahead', () => {
  afterEach(() => { vi.unstubAllGlobals(); delete (window as any).__RENTAL_PREFETCH__; });
  it.each([[null, 'b2b'], ['consumer', 'b2c'], ['business', 'b2b'], ['invalid', 'b2b']])('matches saved segment %s', (saved, type) => {
    const { fetch } = execute(saved);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`offerType=${type}`));
  });
  it('handles blocked storage', () => {
    expect(execute(null, '', true).fetch).toHaveBeenCalledWith(expect.stringContaining('offerType=b2b'));
  });
  it('hints the placeholder for the first imageless offer, not a later photo', async () => {
    const { window, appendChild } = execute(null, '', false, [{ primaryImageUrl: null, imageUrls: [] }, { primaryImageUrl: '/later.webp' }]);
    await window.__RENTAL_PREFETCH__.p;
    expect(appendChild).toHaveBeenCalledWith(expect.objectContaining({ rel: 'preload', as: 'image', href: '/motolia-placeholder.webp' }));
  });
  it('does not hint image for empty results', async () => {
    const { window, appendChild } = execute(null, '', false, []);
    await window.__RENTAL_PREFETCH__.p;
    expect(appendChild).not.toHaveBeenCalled();
  });
  it('hints real image for an image-bearing first offer', async () => {
    const { window, appendChild } = execute(null, '', false, [{ primaryImageUrl: '/uploads/rental-images/1/car.webp' }]);
    await window.__RENTAL_PREFETCH__.p;
    expect(appendChild).toHaveBeenCalledWith(expect.objectContaining({ rel: 'preload', as: 'image', href: '/uploads/rental-images/1/car-lg.webp' }));
  });
  it.each(['?make=BMW', '?page=2', '?offerType=b2c', '?sortBy=createdAt'])('skips filtered cached HTML %s', search => {
    expect(execute(null, search).fetch).not.toHaveBeenCalled();
  });
  it('consumes a matching response once', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ vehicles: ['fresh'] }) });
    vi.stubGlobal('fetch', fetch);
    (window as any).__RENTAL_PREFETCH__ = { url: `/api/rental/vehicles?${new URLSearchParams(params)}`, p: Promise.resolve({ vehicles: ['prefetched'] }) };
    expect(await rentalPublicApi.listVehicles(params)).toEqual({ vehicles: ['prefetched'] });
    expect(fetch).not.toHaveBeenCalled();
    expect(await rentalPublicApi.listVehicles(params)).toEqual({ vehicles: ['fresh'] });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([null, { vehicles: ['wrong-segment'] }])('falls back for failure or different segment', async data => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ vehicles: ['fresh'] }) });
    vi.stubGlobal('fetch', fetch);
    (window as any).__RENTAL_PREFETCH__ = { url: `/api/rental/vehicles?${new URLSearchParams({ ...params, offerType: data ? 'b2c' : 'b2b' })}`, p: Promise.resolve(data) };
    expect(await rentalPublicApi.listVehicles(params)).toEqual({ vehicles: ['fresh'] });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
