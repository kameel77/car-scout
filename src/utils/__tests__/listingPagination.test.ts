import { describe, it, expect } from 'vitest';
import { buildPages } from '@/utils/listingPagination';

describe('buildPages', () => {
  it('returns all pages when total <= 5', () => {
    expect(buildPages(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPages(3, 3)).toEqual([1, 2, 3]);
  });

  it('uses [1,2,3,mid,total] when current is in the default set', () => {
    expect(buildPages(1, 10)).toEqual([1, 2, 3, 7, 10]); // mid = round(13/2) = 7
    expect(buildPages(2, 10)).toEqual([1, 2, 3, 7, 10]);
    expect(buildPages(3, 10)).toEqual([1, 2, 3, 7, 10]);
    expect(buildPages(7, 10)).toEqual([1, 2, 3, 7, 10]); // current === mid
    expect(buildPages(10, 10)).toEqual([1, 2, 3, 7, 10]);
  });

  it('swaps mid for current when current sits outside the default set', () => {
    expect(buildPages(4, 10)).toEqual([1, 2, 3, 4, 10]);
    expect(buildPages(8, 10)).toEqual([1, 2, 3, 8, 10]);
    expect(buildPages(9, 10)).toEqual([1, 2, 3, 9, 10]);
  });

  it('never contains duplicates or ellipsis', () => {
    for (let total = 1; total <= 20; total++) {
      for (let current = 1; current <= total; current++) {
        const pages = buildPages(current, total);
        expect(new Set(pages).size).toBe(pages.length);
        pages.forEach((p) => expect(typeof p).toBe('number'));
      }
    }
  });
});
