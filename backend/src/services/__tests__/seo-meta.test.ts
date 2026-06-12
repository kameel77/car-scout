import { describe, it, expect } from 'vitest';
import {
    buildListingMeta,
    buildRentalMeta,
    buildStaticMeta,
    defaultMeta,
    injectHead,
    resolveBrandCtx,
    BrandCtx,
} from '../seo-meta';

const ctx: BrandCtx = {
    baseUrl: 'https://dev.motolia.pl',
    brandName: 'Motolia',
    defaultTitle: 'Motolia - leasing, kredyt i wynajem samochodów',
    defaultDescription: 'Szeroki wybór aut. Proste finansowanie. Leasing, kredyt i wynajem długoterminowy.',
};

const LISTING = {
    make: 'Ford',
    model: 'Puma',
    version: '1.0 EcoBoost',
    productionYear: 2024,
    pricePln: 99900,
    mileageKm: 10,
    fuelType: 'benzyna',
    bodyType: 'suv',
};

const TEMPLATE = `<!doctype html><html><head><title>OLD</title><meta name="description" content="OLDD" /><meta property="og:title" content="OLD" /><meta property="og:description" content="OLDD" /><meta property="og:url" content="https://old.example" /><meta name="twitter:title" content="OLD" /><meta name="twitter:description" content="OLDD" /></head><body><div id="root"></div></body></html>`;

describe('resolveBrandCtx', () => {
    it('resolves motolia brand from env', () => {
        const prev = { BRAND: process.env.BRAND, FRONTEND_URL: process.env.FRONTEND_URL };
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://dev.motolia.pl/';
        const c = resolveBrandCtx();
        expect(c.brandName).toBe('Motolia');
        expect(c.baseUrl).toBe('https://dev.motolia.pl'); // trailing slash stripped
        process.env.BRAND = prev.BRAND;
        process.env.FRONTEND_URL = prev.FRONTEND_URL;
    });

    it('defaults to carsalon', () => {
        const prev = process.env.BRAND;
        delete process.env.BRAND;
        expect(resolveBrandCtx().brandName).toBe('CarSalon');
        process.env.BRAND = prev;
    });
});

describe('buildListingMeta', () => {
    it('oferta: self-canonical, Vehicle JSON-LD, price in title', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        expect(m.title).toContain('Ford Puma 1.0 EcoBoost 2024');
        expect(m.title).toContain('| Motolia');
        expect(m.canonical).toBe('https://dev.motolia.pl/oferta/ford-puma-abc123');
        expect(m.status).toBe(200);
        expect((m.jsonLd as any)['@type']).toBe('Vehicle');
        expect((m.jsonLd as any).offers.price).toBe(99900);
    });

    it('leasing variant: canonical points to /oferta, variant in title, no JSON-LD', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'leasing', ctx);
        expect(m.title).toContain('— leasing');
        expect(m.canonical).toBe('https://dev.motolia.pl/oferta/ford-puma-abc123');
        expect(m.jsonLd).toBeUndefined();
    });
});

describe('buildRentalMeta', () => {
    it('self-canonical under /wynajem-dlugoterminowy', () => {
        const m = buildRentalMeta(
            { make: 'Toyota', model: 'Corolla', version: null, productionYear: 2024 },
            'toyota-corolla-x1',
            ctx
        );
        expect(m.title).toContain('najem długoterminowy');
        expect(m.canonical).toBe('https://dev.motolia.pl/wynajem-dlugoterminowy/toyota-corolla-x1');
    });
});

describe('buildStaticMeta', () => {
    it('known route gets unique title and self-canonical', () => {
        const m = buildStaticMeta('/uzywane', ctx)!;
        expect(m.title).toContain('używane');
        expect(m.canonical).toBe('https://dev.motolia.pl/uzywane');
    });

    it('/search canonicalizes to /samochody', () => {
        expect(buildStaticMeta('/search', ctx)!.canonical).toBe('https://dev.motolia.pl/samochody');
    });

    it('home uses brand defaults and Organization JSON-LD', () => {
        const m = buildStaticMeta('/', ctx)!;
        expect(m.title).toBe(ctx.defaultTitle);
        expect((m.jsonLd as any)['@type']).toBe('Organization');
    });

    it('unknown route returns null', () => {
        expect(buildStaticMeta('/nie-ma-takiej-strony', ctx)).toBeNull();
    });
});

describe('defaultMeta', () => {
    it('carries noindex and status', () => {
        const m = defaultMeta(ctx, { noindex: true, status: 404 });
        expect(m.noindex).toBe(true);
        expect(m.status).toBe(404);
        expect(m.title).toBe(ctx.defaultTitle);
    });
});

describe('injectHead', () => {
    it('replaces title/description/og/twitter and appends canonical + JSON-LD', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).not.toContain('<title>OLD</title>');
        expect(html).toContain('Ford Puma');
        expect(html).toContain('<link rel="canonical" href="https://dev.motolia.pl/oferta/ford-puma-abc123" />');
        expect(html).toContain('application/ld+json');
        expect(html).toContain('og:url" content="https://dev.motolia.pl/oferta/ford-puma-abc123"');
        expect(html).not.toContain('noindex');
    });

    it('adds robots noindex when meta.noindex', () => {
        const html = injectHead(TEMPLATE, defaultMeta(ctx, { noindex: true, status: 404 }));
        expect(html).toContain('<meta name="robots" content="noindex" />');
    });

    it('escapes </script> in JSON-LD', () => {
        const m = buildListingMeta({ ...LISTING, version: '</script><b>' }, 's-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).not.toContain('</script><b>');
    });
});
