import { describe, it, expect } from 'vitest';
import { buildFotonHubMeta, buildFotonModelMeta, BrandCtx } from '../seo-meta';
import { FOTON_SEO_MODELS, getFotonSeoModel } from '../../content/foton-content';

const ctx: BrandCtx = {
    brand: 'motolia',
    baseUrl: 'https://motolia.pl',
    brandName: 'Motolia',
    defaultTitle: 'Motolia',
    defaultDescription: 'Motolia',
    logoUrl: 'https://motolia.pl/brands/motolia/logo.png',
    homeH1: 'Motolia',
};

const types = (jsonLd: unknown) => (jsonLd as { '@type': string }[]).map(j => j['@type']);

describe('buildFotonHubMeta (KAM-5)', () => {
    const m = buildFotonHubMeta(ctx);

    it('is indexable 200 with self-canonical and the SPA title', () => {
        expect(m.status).toBe(200);
        expect(m.noindex).toBeFalsy();
        expect(m.canonical).toBe('https://motolia.pl/foton');
        expect(m.title).toBe('FOTON – Pojazdy Użytkowe i Pickupy 4x4 | Motolia');
    });

    it('has exactly one h1 and links every model', () => {
        expect(m.bodyHtml!.match(/<h1>/g)).toHaveLength(1);
        for (const model of FOTON_SEO_MODELS) expect(m.bodyHtml).toContain(`href="/foton/${model.id}"`);
    });

    it('renders FAQ answers in HTML and a matching FAQPage', () => {
        expect(m.bodyHtml).toContain('Power Truck Poland');
        expect(types(m.jsonLd)).toEqual(['BreadcrumbList', 'ItemList', 'FAQPage']);
    });
});

describe('buildFotonModelMeta (KAM-5)', () => {
    it('renders every model with h1 = name, spec table and financing pillar link', () => {
        for (const model of FOTON_SEO_MODELS) {
            const m = buildFotonModelMeta(model, ctx);
            expect(m.status).toBe(200);
            expect(m.canonical).toBe(`https://motolia.pl/foton/${model.id}`);
            expect(m.bodyHtml!.match(/<h1>/g)).toHaveLength(1);
            expect(m.bodyHtml).toContain('<table>');
            expect(m.bodyHtml).toMatch(/href="\/(leasing|wynajem-dlugoterminowy)"/);
            expect(types(m.jsonLd)).toEqual(['BreadcrumbList', 'FAQPage']);
        }
    });

    it('links lifestyle pickups to /leasing and fleet vans to /wynajem-dlugoterminowy', () => {
        expect(buildFotonModelMeta(getFotonSeoModel('tunland-g7')!, ctx).bodyHtml).toContain('href="/leasing"');
        expect(buildFotonModelMeta(getFotonSeoModel('etoano-pro')!, ctx).bodyHtml).toContain('href="/wynajem-dlugoterminowy"');
    });

    it('escapes HTML in content', () => {
        const m = buildFotonModelMeta({ ...getFotonSeoModel('cavan')!, name: 'X <script>' }, ctx);
        expect(m.bodyHtml).not.toContain('<script>');
    });
});
