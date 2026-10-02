import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    OUT_BACKEND,
    OUT_FRONTEND,
    addHeadingIds,
    build,
    extractFaq,
    insertFigures,
    parseSource,
    rewriteLinks,
    slugify,
    wrapFaqSection,
} from '../build-guide-content';
import { MOTOLIA_GENERATED_PILLARS, MOTOLIA_GUIDES, getGuideArticle, listGuidePaths } from '../../content/guide-content';

describe('build-guide-content helpers', () => {
    it('slugify handles Polish diacritics and punctuation', () => {
        expect(slugify('Ile VAT odliczysz od samochodu w firmie?')).toBe('ile-vat-odliczysz-od-samochodu-w-firmie');
        expect(slugify('Najczęstsze pytania')).toBe('najczestsze-pytania');
    });

    it('rewriteLinks makes motolia.pl links relative and unwraps links to paths that are not live', () => {
        const warnings: string[] = [];
        const html =
            '<p><a href="https://motolia.pl/leasing">leasing samochodu</a> i <a href="https://motolia.pl/leasing/wykup">wykup</a> ' +
            '<a href="https://www.podatki.gov.pl/x">źródło</a></p>';
        const out = rewriteLinks(html, new Set(['/leasing']), warnings);
        expect(out).toContain('<a href="/leasing">leasing samochodu</a>');
        expect(out).toContain(' wykup ');
        expect(out).not.toContain('/leasing/wykup');
        expect(out).toContain('<a href="https://www.podatki.gov.pl/x" rel="noopener" target="_blank">źródło</a>');
        expect(warnings).toEqual(['unlinked (target not live): /leasing/wykup']);
    });

    it('insertFigures puts the figure after the first answer paragraph under the heading', () => {
        const warnings: string[] = [];
        const html = '<h2>Jak to działa?</h2>\n<p>Odpowiedź.</p>\n<p>Dalej.</p>';
        const out = insertFigures(
            html,
            [{ after_heading: 'Jak to działa?', src: '/x.webp', width: 10, height: 20, alt: 'A "q"', caption: 'C' }],
            warnings,
        );
        expect(out).toMatch(/<p>Odpowiedź\.<\/p>\n<figure class="guide-figure"><a href="\/x\.webp" target="_blank" rel="noopener" title="Otwórz grafikę w pełnym rozmiarze"><img src="\/x\.webp" width="10" height="20" alt="A &quot;q&quot;" loading="lazy" decoding="async"><\/a><figcaption>C<\/figcaption><\/figure>\n<p>Dalej\.<\/p>/);
        expect(warnings).toEqual([]);
        insertFigures(html, [{ after_heading: 'Brak', src: '/y.webp', width: 1, height: 1, alt: '', caption: '' }], warnings);
        expect(warnings).toEqual(['figure heading not found: Brak']);
    });

    it('addHeadingIds builds a table of contents; extractFaq and wrapFaqSection read the FAQ section', () => {
        const { html, toc } = addHeadingIds(
            '<h2>Pierwsza sekcja</h2><p>a</p><h2>Najczęstsze pytania</h2><h3>Czy tak?</h3><p>Tak, bo <strong>X</strong>.</p><h3>Pusty?</h3>',
        );
        expect(toc).toEqual([
            { id: 'pierwsza-sekcja', text: 'Pierwsza sekcja' },
            { id: 'najczestsze-pytania', text: 'Najczęstsze pytania' },
        ]);
        expect(extractFaq(html)).toEqual([{ question: 'Czy tak?', answer: 'Tak, bo X.' }]);
        expect(wrapFaqSection(html)).toContain('<section class="guide-faq"><h2 id="najczestsze-pytania">');
    });

    it('parseSource splits frontmatter, lead, body and the editorial footer', () => {
        const raw =
            '---json\n{"path":"/leasing/x","kind":"guide","figures":[]}\n---\n# Tytuł\nLead zdanie.\n## Sekcja\nTreść.\n\n' +
            'Autor: Jan Kowalski, ekspert.\n\nŹródła:\n\n- A: [https://a.pl](https://a.pl)\n\nArtykuł ma charakter informacyjny.\n';
        const p = parseSource(raw);
        expect(p.fm.path).toBe('/leasing/x');
        expect(p.lead).toBe('Lead zdanie.');
        expect(p.bodyMd).toBe('## Sekcja\nTreść.');
        expect(p.authorBio).toBe('Jan Kowalski, ekspert.');
        expect(p.sourcesMd).toContain('https://a.pl');
        expect(p.disclaimer).toBe('Artykuł ma charakter informacyjny.');
    });
});

describe('generated guide content (wave 1)', () => {
    it('serves the first guides only for the motolia brand', () => {
        expect(listGuidePaths('motolia')).toEqual(expect.arrayContaining(['/leasing/limity-podatkowe-2026', '/leasing/vat']));
        expect(getGuideArticle('carsalon', '/leasing/vat')).toBeUndefined();
    });

    it('has no em or en dashes in any generated text (editorial rule)', () => {
        const all = JSON.stringify(MOTOLIA_GUIDES) + JSON.stringify(MOTOLIA_GENERATED_PILLARS);
        expect(all).not.toMatch(/[\u2013\u2014]/);
    });

    it('every guide has a lead, a table of contents, FAQ for FAQPage and figures with dimensions', () => {
        for (const g of Object.values(MOTOLIA_GUIDES)) {
            expect(g.leadHtml, g.path).toMatch(/^<p>/);
            expect(g.toc.length, g.path).toBeGreaterThan(3);
            expect(g.faq.length, g.path).toBeGreaterThan(3);
            expect(g.html, g.path).toMatch(/<img src="\/poradnik\/grafiki\/[a-z0-9-]+\.webp" width="\d+" height="\d+"/);
            expect(g.reviewedBy, g.path).toBeNull();
        }
    });

    it('the late VAT-26 rule says "from the day of filing" (art. 86a ust. 13), never "first day of the month"', () => {
        const vat = getGuideArticle('motolia', '/leasing/vat')!;
        expect(vat.html).toContain('na dzień, w którym złożysz informację');
        expect(vat.html).toContain('od 14 kwietnia 2026 r.');
        expect(JSON.stringify(MOTOLIA_GUIDES) + JSON.stringify(MOTOLIA_GENERATED_PILLARS)).not.toMatch(/pierwsz\w+ (dnia|dzień) miesiąca (jej )?złożenia/);
    });
});

describe('generated files are in sync with backend/content/guides/*.md', () => {
    it('guide-content.ts and guidePaths.ts equal a fresh build (run the generator after editing .md)', () => {
        const fresh = build();
        expect(readFileSync(OUT_BACKEND, 'utf8')).toBe(fresh.backend);
        expect(readFileSync(OUT_FRONTEND, 'utf8')).toBe(fresh.frontend);
    });
});
