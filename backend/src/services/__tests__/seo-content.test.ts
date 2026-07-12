import { describe, it, expect } from 'vitest';
import { parseFaqFromMarkdown, renderContentHtml } from '../seo-content';

describe('parseFaqFromMarkdown', () => {
    it('extracts a question heading (ends with "?") with its body as plain-text answer', () => {
        const md = `## Ile kosztuje Škoda Octavia?\n\nCeny zaczynają się od **89 900 zł**.\n\n## Inna sekcja\n\nTo nie jest FAQ.`;
        const faq = parseFaqFromMarkdown(md);
        expect(faq).toHaveLength(1);
        expect(faq[0].questionPl).toBe('Ile kosztuje Škoda Octavia?');
        expect(faq[0].answerPl).toBe('Ceny zaczynają się od 89 900 zł.');
    });

    it('ignores headings without a trailing question mark', () => {
        const md = `## Historia marki\n\nSzkoda powstała w 1895 roku.`;
        expect(parseFaqFromMarkdown(md)).toEqual([]);
    });

    it('skips a question heading with an empty body (no fabricated FAQ entries)', () => {
        const md = `## Czy to działa?\n\n## Kolejny nagłówek?\n\nOdpowiedź na drugie pytanie.`;
        const faq = parseFaqFromMarkdown(md);
        expect(faq).toHaveLength(1);
        expect(faq[0].questionPl).toBe('Kolejny nagłówek?');
    });

    it('collects multiple FAQ entries in document order', () => {
        const md = `## Pytanie pierwsze?\nOdpowiedź 1.\n\n## Pytanie drugie?\nOdpowiedź 2.`;
        const faq = parseFaqFromMarkdown(md);
        expect(faq.map(f => f.questionPl)).toEqual(['Pytanie pierwsze?', 'Pytanie drugie?']);
        expect(faq.map(f => f.answerPl)).toEqual(['Odpowiedź 1.', 'Odpowiedź 2.']);
    });

    it('returns an empty list for markdown without any headings', () => {
        expect(parseFaqFromMarkdown('Zwykły akapit bez nagłówków.')).toEqual([]);
    });

    it('strips markdown/HTML from the answer, leaving plain text', () => {
        const md = `## Czy jest dostępny?\n\nTak, [sprawdź ofertę](/samochody/skoda) już dziś.`;
        const faq = parseFaqFromMarkdown(md);
        expect(faq[0].answerPl).toBe('Tak, sprawdź ofertę już dziś.');
    });
});

describe('renderContentHtml (markdown → sanitized HTML)', () => {
    it('renders headings, paragraphs, lists and links within the whitelist', () => {
        const html = renderContentHtml('## Nagłówek\n\nAkapit z **pogrubieniem**.\n\n- Pozycja 1\n- Pozycja 2\n\n[Link](/samochody/skoda)');
        expect(html).toContain('<h2>Nagłówek</h2>');
        expect(html).toContain('<strong>pogrubieniem</strong>');
        expect(html).toContain('<ul>');
        expect(html).toContain('<li>Pozycja 1</li>');
        expect(html).toContain('<a href="/samochody/skoda">Link</a>');
    });

    it('renders GFM tables', () => {
        const html = renderContentHtml('| A | B |\n| - | - |\n| 1 | 2 |');
        expect(html).toContain('<table>');
        expect(html).toContain('<th>A</th>');
        expect(html).toContain('<td>1</td>');
    });

    it('strips <script> tags and their content entirely', () => {
        const html = renderContentHtml('Tekst<script>alert(1)</script>dalej');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('alert(1)');
    });

    it('strips onclick/onerror attributes from allowed tags', () => {
        const html = renderContentHtml('<p onclick="alert(1)">Klik</p>');
        expect(html).not.toContain('onclick');
        expect(html).toContain('Klik');
    });

    it('drops disallowed tags (e.g. h1, img) while keeping inner text where present', () => {
        const html = renderContentHtml('# Duży nagłówek\n\n<img src="x.jpg" onerror="alert(1)" />');
        expect(html).not.toContain('<h1>');
        expect(html).not.toContain('<img');
        expect(html).toContain('Duży nagłówek');
    });

    it('strips javascript: links', () => {
        const html = renderContentHtml('[Klik](javascript:alert(1))');
        expect(html).not.toContain('javascript:');
    });
});
