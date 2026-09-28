import { describe, it, expect } from 'vitest';
// Frontend single source of truth — imported only in tests (backend Docker context is ./backend).
import { FOTON_MODELS, FOTON_HUB_FAQ } from '../../../../src/data/foton-models';
import { FOTON_SEO_MODELS, FOTON_SEO_HUB_FAQ, getFotonSeoModel } from '../foton-content';

describe('foton-content mirror parity (KAM-5)', () => {
    it('has the same models in the same order as src/data/foton-models.ts', () => {
        expect(FOTON_SEO_MODELS.map(m => m.id)).toEqual(FOTON_MODELS.map(m => m.id));
    });

    it('mirrors every SEO-relevant field 1:1', () => {
        for (const fe of FOTON_MODELS) {
            const be = getFotonSeoModel(fe.id)!;
            expect(be).toBeDefined();
            expect({
                category: be.category,
                categoryLabel: be.categoryLabel,
                name: be.name,
                tagline: be.tagline,
                heroParams: be.heroParams,
                highlights: be.highlights,
                specs: be.specs,
                faq: be.faq,
                image: be.image,
            }).toEqual({
                category: fe.category,
                categoryLabel: fe.categoryLabel,
                name: fe.name,
                tagline: fe.tagline,
                heroParams: fe.heroParams,
                highlights: fe.highlights,
                specs: fe.specs,
                faq: fe.faq,
                image: fe.images[0] ? { src: fe.images[0].src, alt: fe.images[0].alt } : undefined,
            });
        }
    });

    it('mirrors the hub FAQ', () => {
        expect(FOTON_SEO_HUB_FAQ).toEqual(FOTON_HUB_FAQ);
    });
});
