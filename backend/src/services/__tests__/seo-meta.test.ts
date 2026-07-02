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
    logoUrl: 'https://dev.motolia.pl/brands/motolia/logo.png',
};

const LISTING = {
    make: 'Ford',
    model: 'Puma',
    version: '1.0 EcoBoost',
    productionYear: 2024,
    pricePln: 99900,
    mileageKm: 10,
    condition: 'NEW',
    fuelType: 'benzyna',
    bodyType: 'suv',
    transmission: 'manualna',
    primaryImageUrl: '/uploads/listings/puma.webp',
    additionalInfoContent: '<p>Bogate <b>wyposażenie</b></p>',
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
        if (prev.BRAND === undefined) delete process.env.BRAND; else process.env.BRAND = prev.BRAND;
        if (prev.FRONTEND_URL === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = prev.FRONTEND_URL;
    });

    it('defaults to carsalon', () => {
        const prev = process.env.BRAND;
        delete process.env.BRAND;
        expect(resolveBrandCtx().brandName).toBe('CarSalon');
        if (prev === undefined) delete process.env.BRAND; else process.env.BRAND = prev;
    });
});

describe('buildListingMeta', () => {
    it('oferta: self-canonical, Vehicle + BreadcrumbList JSON-LD, price in title', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        expect(m.title).toContain('Ford Puma 1.0 EcoBoost 2024');
        expect(m.title).toContain('| Motolia');
        expect(m.canonical).toBe('https://dev.motolia.pl/oferta/ford-puma-abc123');
        expect(m.status).toBe(200);
        const ld = m.jsonLd as any[];
        expect(ld[0]['@type']).toBe('Vehicle');
        expect(ld[0].offers.price).toBe(99900);
        expect(ld[0].itemCondition).toBe('https://schema.org/NewCondition');
        expect(ld[0].image).toBe('https://dev.motolia.pl/uploads/listings/puma.webp');
        expect(ld[1]['@type']).toBe('BreadcrumbList');
    });

    it('oferta: bodyHtml has h1, spec table, absolute image and stripped description', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        expect(m.bodyHtml).toContain('<h1>Ford Puma 1.0 EcoBoost 2024</h1>');
        expect(m.bodyHtml).toContain('src="https://dev.motolia.pl/uploads/listings/puma.webp"');
        expect(m.bodyHtml).toContain('Bogate wyposażenie');
        expect(m.bodyHtml).not.toContain('<b>');
        expect(m.ogImage).toBe('https://dev.motolia.pl/uploads/listings/puma.webp');
    });

    it('leasing variant: canonical points to /oferta, variant in title, breadcrumb-only JSON-LD', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'leasing', ctx);
        expect(m.title).toContain('— leasing');
        expect(m.canonical).toBe('https://dev.motolia.pl/oferta/ford-puma-abc123');
        expect((m.jsonLd as any)['@type']).toBe('BreadcrumbList');
        expect(m.bodyHtml).toContain('<h2>Leasing tego pojazdu</h2>');
    });

    it('kredyt variant: financing section and escaped FAQ in bodyHtml, no FAQPage JSON-LD', () => {
        const faq = [
            { questionPl: 'Jaki wkład własny?', answerPl: '<p>Od <b>0%</b> wartości auta.</p>' },
        ];
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'kredyt', ctx, [], faq);
        expect(m.bodyHtml).toContain('<h2>Kredyt samochodowy na ten pojazd</h2>');
        expect(m.bodyHtml).toContain('<h2>Najczęstsze pytania o kredyt</h2>');
        expect(m.bodyHtml).toContain('<h3>Jaki wkład własny?</h3>');
        expect(m.bodyHtml).toContain('Od 0% wartości auta.');
        expect(m.bodyHtml).not.toContain('<b>0%</b>');
        expect(JSON.stringify(m.jsonLd)).not.toContain('FAQPage');
    });

    it('oferta variant: no financing section', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        expect(m.bodyHtml).not.toContain('Kredyt samochodowy na ten pojazd');
        expect(m.bodyHtml).not.toContain('Leasing tego pojazdu');
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

    it('does not interpret $-patterns in vehicle data', () => {
        const m = buildListingMeta({ ...LISTING, version: 'GT $& $1 $$' }, 's-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).toContain('GT $&amp; $1 $$');
        expect(html).not.toContain('OLDD');
    });

    it('keeps escaped JSON-LD when data contains </script>', () => {
        const m = buildListingMeta({ ...LISTING, version: '</script><b>' }, 's-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).toContain('\\u003c/script>');
    });
});
