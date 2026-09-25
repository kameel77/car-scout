import { describe, it, expect } from 'vitest';
import { generateListingSlug } from '../url-utils.js';

describe('generateListingSlug', () => {
    it('includes the production year when present', () => {
        const slug = generateListingSlug('BMW', '3 Series', '320d', 2020, 'sedan', 'diesel', 'abc123');
        expect(slug).toBe('bmw-3-series-320d-2020-sedan-diesel-abc123');
    });

    // Task E: caller sites that don't have the year loaded yet (e.g. partial `select`,
    // external feed shapes) used to pass `undefined`/`null`, and `String(year)` turned that
    // into the literal segment "undefined" — a link Google indexed and kept re-crawling.
    it('skips the year segment instead of emitting "undefined" when year is missing', () => {
        const slug = generateListingSlug('BMW', '3 Series', '320d', undefined as unknown as number, 'sedan', 'diesel', 'abc123');
        expect(slug).not.toContain('undefined');
        expect(slug).toBe('bmw-3-series-320d-sedan-diesel-abc123');
    });

    it('skips the year segment when year is null', () => {
        const slug = generateListingSlug('BMW', '3 Series', '320d', null as unknown as number, 'sedan', 'diesel', 'abc123');
        expect(slug).not.toContain('undefined');
        expect(slug).toBe('bmw-3-series-320d-sedan-diesel-abc123');
    });

    it('skips the year segment when year is NaN', () => {
        const slug = generateListingSlug('BMW', '3 Series', '320d', NaN, 'sedan', 'diesel', 'abc123');
        expect(slug).not.toContain('nan');
        expect(slug).toBe('bmw-3-series-320d-sedan-diesel-abc123');
    });
});
