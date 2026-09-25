import { describe, it, expect } from 'vitest';
import { generateListingSlug } from '@/utils/url-utils';

describe('generateListingSlug', () => {
    it('includes the production year when present', () => {
        const slug = generateListingSlug('BMW', '3 Series', '320d', 2020, 'sedan', 'diesel', 'abc123');
        expect(slug).toBe('bmw-3-series-320d-2020-sedan-diesel-abc123');
    });

    // Task E: call sites without the year loaded yet used to pass undefined/null, and
    // `String(year)` turned that into the literal segment "undefined" in the URL — a link
    // Google indexed and kept re-crawling (backend/src/utils/url-utils.ts must match).
    it('skips the year segment instead of emitting "undefined" when year is missing', () => {
        const slug = generateListingSlug('BMW', '3 Series', '320d', undefined, 'sedan', 'diesel', 'abc123');
        expect(slug).not.toContain('undefined');
        expect(slug).toBe('bmw-3-series-320d-sedan-diesel-abc123');
    });

    it('skips the year segment when year is null', () => {
        const slug = generateListingSlug('BMW', '3 Series', '320d', null, 'sedan', 'diesel', 'abc123');
        expect(slug).not.toContain('undefined');
        expect(slug).toBe('bmw-3-series-320d-sedan-diesel-abc123');
    });
});
