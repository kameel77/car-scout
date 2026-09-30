import { describe, it, expect } from 'vitest';
import { buildStaticMeta, BrandCtx } from '../seo-meta';

const ctx: BrandCtx = {
    brand: 'motolia',
    baseUrl: 'https://motolia.pl',
    brandName: 'Motolia',
    defaultTitle: 'Motolia',
    defaultDescription: 'Motolia',
    logoUrl: 'https://motolia.pl/brands/motolia/logo.png',
    homeH1: 'Motolia',
};

const org = (orgSettings: object) =>
    (buildStaticMeta('/', ctx, [], [], '/oferta', undefined, undefined, orgSettings)!.jsonLd as any[])
        .find(j => j['@type'] === 'Organization');

describe('home Organization JSON-LD - primary phone (KAM-8)', () => {
    it('uses the sales line as the primary phone (same as the header)', () => {
        const o = org({ salesContactPhone: '+48 455 455 485', legalContactPhone: '+48 22 000 00 00', legalContactEmail: 'kontakt@motolia.pl' });
        expect(o.telephone).toBe('+48 455 455 485');
        expect(o.contactPoint.telephone).toBe('+48 455 455 485');
        expect(o.email).toBe('kontakt@motolia.pl');
    });

    it('falls back to the legal phone when no sales line is set', () => {
        expect(org({ legalContactPhone: '+48 22 000 00 00' }).telephone).toBe('+48 22 000 00 00');
    });

    it('is the only Organization on the home page', () => {
        const all = buildStaticMeta('/', ctx, [], [], '/oferta', undefined, undefined, {})!.jsonLd as any[];
        expect(all.filter(j => j['@type'] === 'Organization')).toHaveLength(1);
    });
});
