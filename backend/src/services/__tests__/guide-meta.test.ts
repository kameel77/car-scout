import { describe, expect, it } from 'vitest';
import { buildGuideMeta, resolveBrandCtx } from '../seo-meta';
import { formatPlDate, guideShellHtml } from '../pillar-shell';
import { getGuideArticle } from '../../content/guide-content';

describe('buildGuideMeta', () => {
    const ctx = { ...resolveBrandCtx(), baseUrl: 'https://motolia.pl', brandName: 'Motolia' };
    const guide = getGuideArticle('motolia', '/leasing/vat')!;

    it('uses frontmatter title/description, self canonical and the OG image', () => {
        const meta = buildGuideMeta(guide, ctx);
        expect(meta.status).toBe(200);
        expect(meta.title).toBe(guide.title);
        expect(meta.description).toBe(guide.description);
        expect(meta.canonical).toBe('https://motolia.pl/leasing/vat');
        expect(meta.ogImage).toBe('https://motolia.pl/poradnik/og/og-samochod-firma-vat.jpg');
    });

    it('emits Article + BreadcrumbList + FAQPage; reviewedBy only after a real review', () => {
        const meta = buildGuideMeta(guide, ctx);
        const ld = meta.jsonLd as Array<Record<string, any>>;
        expect(ld.map((x) => x['@type'])).toEqual(['Article', 'BreadcrumbList', 'FAQPage']);
        expect(ld[0].headline).toBe(guide.h1);
        expect(ld[0].author).toEqual({ '@type': 'Person', name: 'Kamil Tonkowicz' });
        expect(ld[0].reviewedBy).toBeUndefined();
        expect(ld[1].itemListElement.map((i: any) => i.name)).toEqual(['Strona główna', 'Leasing', guide.breadcrumb]);
        expect(ld[2].mainEntity).toHaveLength(guide.faq.length);

        const reviewed = buildGuideMeta({ ...guide, reviewedBy: 'Michał Grzywacz', reviewedAt: '2026-10-07' }, ctx);
        const art = (reviewed.jsonLd as Array<Record<string, any>>)[0];
        expect(art.reviewedBy).toEqual({ '@type': 'Person', name: 'Michał Grzywacz' });
        expect(art.lastReviewed).toBe('2026-10-07');
    });

    it('bodyHtml for crawlers has the full article but no <h1> (the visible shell owns it)', () => {
        const meta = buildGuideMeta(guide, ctx);
        expect(meta.bodyHtml).not.toMatch(/<h1[\s>]/);
        expect(meta.bodyHtml).toContain('id="najczestsze-pytania"');
        expect(meta.bodyHtml).toContain('<figure class="guide-figure">');
    });

    it('guide shell renders exactly one <h1> with the lead in the "W skrócie" box', () => {
        const shell = guideShellHtml(guide, 'Leasing');
        expect(shell.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(shell).toContain('W skrócie');
        expect(shell).toContain(guide.leadHtml);
        expect(shell).toContain('<!--guide-shell-->');
    });

    it('shell meta row matches the React page (author, Polish date, reading time)', () => {
        expect(formatPlDate('2026-10-02')).toBe('2 października 2026');
        const shell = guideShellHtml(guide, 'Leasing');
        expect(shell).toContain('Kamil Tonkowicz');
        expect(shell).toContain(`${guide.readingMinutes} min czytania`);
        expect(shell).toContain('lucide-chevron-right');
    });

    it('lookup ignores object prototype keys (no 500 on /api/render?path=constructor)', () => {
        expect(getGuideArticle('motolia', 'constructor')).toBeUndefined();
        expect(getGuideArticle('motolia', '__proto__')).toBeUndefined();
    });
});
