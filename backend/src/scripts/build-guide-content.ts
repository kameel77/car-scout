/**
 * Generator treści poradników (KAM-20) i treści huba /leasing.
 *
 * Źródło: backend/content/guides/*.md (frontmatter JSON + markdown z workspace SSEO).
 * Wynik:  backend/src/content/guide-content.ts (backend: SSR, API)
 *         src/components/guide/guidePaths.ts   (frontend: trasy React Router)
 *
 * Uruchomienie (z katalogu backend/):  npx tsx src/scripts/build-guide-content.ts
 * Edycje treści robimy w plikach .md i regenerujemy — nie ręcznie w plikach wynikowych.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = resolve(__dirname, '../..');
const REPO_DIR = resolve(BACKEND_DIR, '..');
const SOURCE_DIR = join(BACKEND_DIR, 'content/guides');
export const OUT_BACKEND = join(BACKEND_DIR, 'src/content/guide-content.ts');
export const OUT_FRONTEND = join(REPO_DIR, 'src/components/guide/guidePaths.ts');

const SITE_ORIGIN = 'https://motolia.pl';

// Trasy, do których wolno linkować z treści. Link do adresu spoza listy (np. poradnik z kolejnej
// fali, który jeszcze nie istnieje) zamieniamy na sam tekst — bez linków do 404 (KAM-20).
const EXISTING_PATHS = new Set([
    '/', '/samochody', '/nowe', '/uzywane', '/leasing', '/leasing-konsumencki', '/kredyt',
    '/wynajem-dlugoterminowy', '/kalkulator-rat', '/dla-firm', '/dla-ciebie', '/faq', '/kontakt',
]);

const FAQ_HEADING = 'Najczęstsze pytania';

interface Frontmatter {
    path: string;
    kind: 'guide' | 'pillar';
    title_tag: string;
    meta_description: string;
    h1: string;
    canonical_query: string;
    breadcrumb: string;
    hub: string;
    author: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    updated_at: string;
    og_image: string;
    figures: Array<{ after_heading: string; src: string; width: number; height: number; alt: string; caption: string }>;
}

interface Parsed {
    fm: Frontmatter;
    lead: string;
    bodyMd: string;
    authorBio: string;
    sourcesMd: string;
    disclaimer: string;
}

const PL_MAP: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[ąćęłńóśźż]/g, (c) => PL_MAP[c])
        .replace(/<[^>]+>/g, '')
        .replace(/&[a-z]+;/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function stripTags(html: string): string {
    return html
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function parseSource(raw: string): Parsed {
    const m = raw.match(/^---json\n([\s\S]*?)\n---\n/);
    if (!m) throw new Error('Missing ---json frontmatter');
    const fm = JSON.parse(m[1]) as Frontmatter;
    let body = raw.slice(m[0].length).trimStart().replace(/^# .*\n/, '').trim();
    if (/^# /m.test(body)) throw new Error(`${fm.path}: second H1 in body`);

    // Stopka redakcyjna: "Autor: ..." → "Źródła:" + lista → nota prawna.
    let authorBio = '';
    let sourcesMd = '';
    let disclaimer = '';
    const authorIdx = body.search(/^Autor: /m);
    if (authorIdx >= 0) {
        const tail = body.slice(authorIdx);
        body = body.slice(0, authorIdx).trim();
        const srcIdx = tail.search(/^Źródła:\s*$/m);
        authorBio = (srcIdx >= 0 ? tail.slice(0, srcIdx) : tail).replace(/^Autor: /, '').trim();
        if (srcIdx >= 0) {
            const after = tail.slice(srcIdx).replace(/^Źródła:\s*\n/, '');
            const discIdx = after.search(/^Artykuł ma charakter/m);
            sourcesMd = (discIdx >= 0 ? after.slice(0, discIdx) : after).trim();
            disclaimer = discIdx >= 0 ? after.slice(discIdx).trim() : '';
        }
    }

    const paragraphs = body.split(/\n{2,}|\n(?=## )/);
    const lead = paragraphs[0].trim();
    if (lead.startsWith('#')) throw new Error(`${fm.path}: lead paragraph missing (body starts with a heading)`);
    const bodyMd = body.slice(body.indexOf(lead) + lead.length).trim();
    return { fm, lead, bodyMd, authorBio, sourcesMd, disclaimer };
}

/** Linki absolutne motolia.pl → względne; linki do nieistniejących tras → sam tekst. */
export function rewriteLinks(html: string, knownPaths: Set<string>, warnings: string[]): string {
    return html.replace(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (full, href: string, text: string) => {
        if (href.startsWith('#')) return `<a href="${href}">${text}</a>`;
        if (!href.startsWith(SITE_ORIGIN) && !href.startsWith('/')) {
            return `<a href="${href}" rel="noopener" target="_blank">${text}</a>`;
        }
        const path = href.startsWith(SITE_ORIGIN) ? href.slice(SITE_ORIGIN.length) || '/' : href;
        const bare = path.split('#')[0].replace(/\/$/, '') || '/';
        if (knownPaths.has(bare)) return `<a href="${path}">${text}</a>`;
        warnings.push(`unlinked (target not live): ${path}`);
        return text;
    });
}

function figureHtml(f: Frontmatter['figures'][number]): string {
    return (
        // Link do pełnej grafiki: na telefonie schemat 640 px bywa za drobny, a powiększenie jest jednym tapnięciem.
        `<figure class="guide-figure"><a href="${f.src}" target="_blank" rel="noopener" title="Otwórz grafikę w pełnym rozmiarze">` +
        `<img src="${f.src}" width="${f.width}" height="${f.height}" alt="${escapeAttr(f.alt)}" loading="lazy" decoding="async"></a>` +
        `<figcaption>${escapeAttr(f.caption)}</figcaption></figure>`
    );
}

/** Ilustracja trafia za pierwszy akapit odpowiedzi pod wskazanym nagłówkiem (h2 lub h3). */
export function insertFigures(html: string, figures: Frontmatter['figures'], warnings: string[]): string {
    let out = html;
    for (const f of figures) {
        // Nagłówek w HTML z marked ma encje (&amp;, &quot;) — porównujemy z tą samą postacią.
        const heading = f.after_heading.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Pierwszy akapit odpowiedzi, ale nie dalej niż do kolejnego nagłówka.
        const re = new RegExp(`(<h[23][^>]*>${escaped}</h[23]>(?:(?!<h[23])[\\s\\S])*?</p>)`);
        if (!re.test(out)) {
            warnings.push(`figure heading not found: ${f.after_heading}`);
            continue;
        }
        out = out.replace(re, (m) => `${m}\n${figureHtml(f)}`);
    }
    return out;
}

/** Id nagłówków h2 (spis treści, kotwice) + spis treści. */
export function addHeadingIds(html: string): { html: string; toc: Array<{ id: string; text: string }> } {
    const toc: Array<{ id: string; text: string }> = [];
    const used = new Set<string>();
    const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
        let id = slugify(stripTags(inner));
        while (used.has(id)) id += '-2';
        used.add(id);
        toc.push({ id, text: stripTags(inner) });
        return `<h2 id="${id}">${inner}</h2>`;
    });
    return { html: out, toc };
}

/** FAQ z sekcji "Najczęstsze pytania": pary h3 → akapity (plain text do FAQPage). */
export function extractFaq(html: string): Array<{ question: string; answer: string }> {
    const start = html.indexOf(`>${FAQ_HEADING}</h2>`);
    if (start < 0) return [];
    const section = html.slice(start).split(/<h2[^>]*>/)[0];
    const faq: Array<{ question: string; answer: string }> = [];
    const re = /<h3>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3>|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(section))) {
        const answer = stripTags(m[2]);
        if (answer) faq.push({ question: stripTags(m[1]), answer });
    }
    return faq;
}

/** Sekcja FAQ w osobnym kontenerze (styl kart pytań w .guide-faq). */
export function wrapFaqSection(html: string): string {
    const start = html.indexOf(`<h2 id="${slugify(FAQ_HEADING)}">`);
    if (start < 0) return html;
    const nextH2 = html.indexOf('<h2', start + 4);
    const end = nextH2 < 0 ? html.length : nextH2;
    return `${html.slice(0, start)}<section class="guide-faq">${html.slice(start, end)}</section>${html.slice(end)}`;
}

/** Tabele w kontenerze z przewijaniem poziomym (mobile). */
function wrapTables(html: string): string {
    return html.replace(/<table>/g, '<div class="guide-table"><table>').replace(/<\/table>/g, '</table></div>');
}

function md(text: string): string {
    return marked.parse(text, { async: false, gfm: true }) as string;
}

function readingMinutes(text: string): number {
    const words = stripTags(text).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
}

export function build(): { backend: string; frontend: string; warnings: string[] } {
    const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.md')).sort();
    const parsed = files.map((f) => ({ file: f, ...parseSource(readFileSync(join(SOURCE_DIR, f), 'utf8')) }));
    const known = new Set([...EXISTING_PATHS, ...parsed.map((p) => p.fm.path)]);
    const warnings: string[] = [];
    const guides: Record<string, unknown> = {};
    const pillars: Record<string, unknown> = {};

    for (const p of parsed) {
        const w: string[] = [];
        let bodyHtml = wrapTables(rewriteLinks(md(p.bodyMd), known, w));
        bodyHtml = insertFigures(bodyHtml, p.fm.figures, w);
        const withIds = addHeadingIds(bodyHtml);
        const toc = withIds.toc;
        const faq = extractFaq(withIds.html);
        const html = wrapFaqSection(withIds.html);
        const leadHtml = rewriteLinks(md(p.lead), known, w);
        const sourcesHtml = p.sourcesMd ? rewriteLinks(md(p.sourcesMd), known, w) : '';
        warnings.push(...w.map((x) => `${p.file}: ${x}`));

        if (/<h1[\s>]/.test(leadHtml + html)) throw new Error(`${p.fm.path}: <h1> in generated body`);
        if (w.some((x) => x.startsWith('figure heading not found'))) throw new Error(`${p.file}: ${w.join('; ')}`);

        if (p.fm.kind === 'pillar') {
            // Lead huba trafia do szablonu filaru jako czysty tekst (FinancingPillarPage, pillarShellHtml).
            if (/<(?!\/?p>)|&/.test(leadHtml)) throw new Error(`${p.file}: pillar lead must be plain text`);
            // Hub korzysta z istniejącego szablonu strony filarowej: {h1, html}, lead = pierwszy <p>.
            const footer =
                (p.authorBio ? `<p class="guide-author-note"><strong>Autor:</strong> ${stripTags(md(p.authorBio))}</p>` : '') +
                (sourcesHtml ? `<details class="guide-sources"><summary>Źródła</summary>${sourcesHtml}</details>` : '') +
                (p.disclaimer ? `<p class="guide-disclaimer">${stripTags(md(p.disclaimer))}</p>` : '');
            pillars[p.fm.path] = {
                h1: p.fm.h1,
                title: p.fm.title_tag,
                description: p.fm.meta_description,
                html: `${leadHtml}\n${html}\n${footer}`,
                faq,
            };
            continue;
        }

        guides[p.fm.path] = {
            path: p.fm.path,
            h1: p.fm.h1,
            title: p.fm.title_tag,
            description: p.fm.meta_description,
            breadcrumb: p.fm.breadcrumb,
            hub: p.fm.hub,
            author: { name: p.fm.author, bio: stripTags(md(p.authorBio)) },
            reviewedBy: p.fm.reviewed_by,
            reviewedAt: p.fm.reviewed_at,
            updatedAt: p.fm.updated_at,
            ogImage: p.fm.og_image,
            readingMinutes: readingMinutes(leadHtml + html),
            leadHtml,
            html,
            toc,
            faq,
            sourcesHtml,
            disclaimer: stripTags(md(p.disclaimer)),
        };
    }

    const header =
        '// GENERATED by backend/src/scripts/build-guide-content.ts from backend/content/guides/*.md.\n' +
        '// Nie edytuj ręcznie: zmień plik .md i uruchom `npx tsx src/scripts/build-guide-content.ts` w backend/.\n\n';

    const backend =
        header +
        `export interface GuideFaq {\n    question: string;\n    answer: string;\n}\n\n` +
        `export interface GuideArticle {\n    path: string;\n    h1: string;\n    title: string;\n    description: string;\n    breadcrumb: string;\n    hub: string;\n` +
        `    author: { name: string; bio: string };\n    reviewedBy: string | null;\n    reviewedAt: string | null;\n    updatedAt: string;\n    ogImage: string;\n` +
        `    readingMinutes: number;\n    leadHtml: string;\n    html: string;\n    toc: Array<{ id: string; text: string }>;\n    faq: GuideFaq[];\n    sourcesHtml: string;\n    disclaimer: string;\n}\n\n` +
        `export interface GeneratedPillar {\n    h1: string;\n    title: string;\n    description: string;\n    html: string;\n    faq: GuideFaq[];\n}\n\n` +
        `export const MOTOLIA_GUIDES: Record<string, GuideArticle> = ${JSON.stringify(guides, null, 4)};\n\n` +
        `export const MOTOLIA_GENERATED_PILLARS: Record<string, GeneratedPillar> = ${JSON.stringify(pillars, null, 4)};\n\n` +
        `const GUIDES_BY_BRAND: Record<string, Record<string, GuideArticle>> = { motolia: MOTOLIA_GUIDES };\n\n` +
        `export function getGuideArticle(brand: string, path: string): GuideArticle | undefined {\n    const guides = GUIDES_BY_BRAND[brand];\n    return guides && Object.prototype.hasOwnProperty.call(guides, path) ? guides[path] : undefined;\n}\n\n` +
        `export function listGuidePaths(brand: string): string[] {\n    return Object.keys(GUIDES_BY_BRAND[brand] ?? {});\n}\n`;

    if (!pillars['/leasing']) throw new Error('pillar-leasing.md missing: financing-content.ts imports MOTOLIA_GENERATED_PILLARS["/leasing"]');

    const frontend =
        header +
        `/** Ścieżki poradników — trasy statyczne mają pierwszeństwo przed /leasing/:slug (oferty). */\n` +
        `export const GUIDE_PATHS: string[] = ${JSON.stringify(Object.keys(guides), null, 4)};\n\n` +
        `/** Lista do bloku „Czytaj też” (bez treści — treść przychodzi z API/SSR). */\n` +
        `export const GUIDES_INDEX: Array<{ path: string; hub: string; breadcrumb: string; h1: string }> = ${JSON.stringify(
            Object.values(guides).map((g) => {
                const x = g as { path: string; hub: string; breadcrumb: string; h1: string };
                return { path: x.path, hub: x.hub, breadcrumb: x.breadcrumb, h1: x.h1 };
            }),
            null,
            4,
        )};\n`;

    return { backend, frontend, warnings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { backend, frontend, warnings } = build();
    writeFileSync(OUT_BACKEND, backend);
    writeFileSync(OUT_FRONTEND, frontend);
    for (const w of warnings) console.warn(`[guides] ${w}`);
    console.log(`[guides] written ${OUT_BACKEND} and ${OUT_FRONTEND}`);
}
