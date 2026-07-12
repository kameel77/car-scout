import { describe, it, expect } from 'vitest';
import { buildBrandCatalog, buildModelCatalog } from '../brand-pages.service';

describe('buildBrandCatalog', () => {
    it('transliterates Polish diacritics in slugs', () => {
        const catalog = buildBrandCatalog([
            { make: 'Skoda', count: 3 },
            { make: 'Citroen', count: 2 },
        ]);
        const skoda = catalog.find(b => b.slug === 'skoda');
        expect(skoda).toBeTruthy();
        expect(skoda!.make).toBe('Škoda'); // normalizeBrand canonical form
        expect(skoda!.count).toBe(3);

        const citroen = catalog.find(b => b.slug === 'citroen');
        expect(citroen!.make).toBe('Citroën');
    });

    it('collapses spelling variants of the same brand into one entry (raw variants summed)', () => {
        const catalog = buildBrandCatalog([
            { make: 'skoda', count: 2 },
            { make: 'Škoda', count: 5 },
            { make: 'ŠKODA', count: 1 },
        ]);
        expect(catalog).toHaveLength(1);
        expect(catalog[0].slug).toBe('skoda');
        expect(catalog[0].count).toBe(8);
        expect(catalog[0].rawMakes.sort()).toEqual(['skoda', 'ŠKODA', 'Škoda'].sort());
    });

    it('resolves slug collisions by first match in alphabetical order, dropping the rest', () => {
        // "Weird Brand" and "Weird-Brand" are distinct canonical names (normalizeBrand only
        // title-cases unknown brands, it does not merge them) but both sanitize to "weird-brand".
        const catalog = buildBrandCatalog([
            { make: 'Weird-Brand', count: 1 },
            { make: 'Weird Brand', count: 4 },
        ]);
        const collided = catalog.filter(b => b.slug === 'weird-brand');
        expect(collided).toHaveLength(1);
        // "Weird Brand" sorts before "Weird-brand" (pl locale) — first match wins, the other is dropped
        expect(collided[0].make).toBe('Weird Brand');
        expect(collided[0].count).toBe(4);
    });

    it('produces distinct slugs for distinct brands', () => {
        const catalog = buildBrandCatalog([
            { make: 'BMW', count: 1 },
            { make: 'Audi', count: 1 },
            { make: 'Mercedes-Benz', count: 1 },
        ]);
        const slugs = catalog.map(b => b.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        expect(slugs).toContain('bmw');
        expect(slugs).toContain('audi');
        expect(slugs).toContain('mercedes-benz');
    });

    it('empty input yields empty catalog', () => {
        expect(buildBrandCatalog([])).toEqual([]);
    });
});

describe('buildModelCatalog', () => {
    it('builds slugs for models with counts and raw variants', () => {
        const catalog = buildModelCatalog([
            { model: 'Octavia', count: 4 },
            { model: 'Superb', count: 1 },
        ]);
        expect(catalog.find(m => m.slug === 'octavia')?.count).toBe(4);
        expect(catalog.find(m => m.slug === 'superb')?.count).toBe(1);
    });

    it('transliterates Polish diacritics in model names', () => {
        const catalog = buildModelCatalog([{ model: 'Żuk', count: 1 }]);
        expect(catalog[0].slug).toBe('zuk');
    });

    it('resolves slug collisions by first match in alphabetical order, dropping the rest', () => {
        // "Fabia RS" and "Fabia-RS" are distinct model names (normalizeModel only trims)
        // but both sanitize to "fabia-rs".
        const catalog = buildModelCatalog([
            { model: 'Fabia-RS', count: 1 },
            { model: 'Fabia RS', count: 3 },
        ]);
        const collided = catalog.filter(m => m.slug === 'fabia-rs');
        expect(collided).toHaveLength(1);
        expect(collided[0].model).toBe('Fabia RS');
        expect(collided[0].count).toBe(3);
    });
});
