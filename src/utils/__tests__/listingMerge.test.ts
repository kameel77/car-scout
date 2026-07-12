import { describe, it, expect } from 'vitest';
import { mergeFacets, popularBrandsFromFacets } from '@/utils/listingMerge';

describe('mergeFacets', () => {
  it('returns undefined when neither sale nor rental facets have loaded yet', () => {
    expect(mergeFacets(undefined, undefined)).toBeUndefined();
  });
});

describe('popularBrandsFromFacets', () => {
  // Regresja: na SearchPage `mergedFacets` jest `undefined` dopóki zapytania sale/rental
  // się nie rozstrzygną (pierwszy render /samochody i /samochody/:marka). Wcześniej kod
  // czytał `mergedFacets.make` bez optional chaining, co rzucało
  // "Cannot read properties of undefined (reading 'make')" i wywalało cały SearchPage
  // w globalny error boundary.
  it('does not throw and returns an empty list when facets are undefined', () => {
    expect(() => popularBrandsFromFacets(undefined)).not.toThrow();
    expect(popularBrandsFromFacets(undefined)).toEqual([]);
  });

  it('sorts brands by count descending and respects the limit', () => {
    const facets = {
      make: { Audi: 5, BMW: 20, Škoda: 12 },
      model: {},
      fuelType: {},
      bodyType: {},
      transmission: {},
      drive: {},
      city: {},
    };
    expect(popularBrandsFromFacets(facets, 2)).toEqual([
      ['BMW', 20],
      ['Škoda', 12],
    ]);
  });
});
