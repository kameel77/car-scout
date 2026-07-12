/**
 * CMS treści SEO dla stron marek/modeli (F2). Markdown redakcyjny (SeoContentPage.contentMd)
 * renderowany na backendzie do sanitizowanego HTML — ten sam HTML trafia do SSR (render.ts)
 * i do SPA przez publiczny endpoint (GET /api/seo-content), więc treść jest identyczna dla
 * każdego User-Agenta (zero cloakingu, zgodnie ze spec §2).
 *
 * FAQ redakcyjne: nagłówki `## Pytanie?` (kończące się pytajnikiem) w markdownie są
 * wykrywane osobno i emitowane jako lista {questionPl, answerPl} (plain text) — do
 * doklejenia w widocznym FAQ i w FAQPage JSON-LD (spójność treść↔schema, spec §3).
 */
import { FastifyInstance } from 'fastify';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { FaqItem } from './seo-meta.js';

const ALLOWED_TAGS = [
    'p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'code',
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href'] },
    // Linki tylko http(s) — bez javascript:/data: itp.
    allowedSchemes: ['http', 'https'],
};

/** Markdown → sanitizowany HTML (whitelist wg spec §2). */
export function renderContentHtml(contentMd: string): string {
    const rawHtml = marked.parse(contentMd, { async: false, gfm: true }) as string;
    return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}

/** Odpowiedź → plain text (do FAQPage JSON-LD, spójne z stripTags w seo-meta.ts). */
function markdownToPlainText(md: string): string {
    const html = marked.parse(md, { async: false, gfm: true }) as string;
    return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
        .replace(/\s+/g, ' ')
        .trim();
}

const FAQ_HEADING_RE = /^##\s+(.+?)\s*$/;

/**
 * Wykrywa nagłówki `## ...?` w markdownie CMS — treść do następnego nagłówka `##` (lub
 * końca dokumentu) to odpowiedź. Nagłówki bez pytajnika są pomijane (to zwykłe sekcje treści,
 * nie FAQ). Puste odpowiedzi są pomijane — brak sensu w pustym pytaniu w FAQPage.
 */
export function parseFaqFromMarkdown(contentMd: string): FaqItem[] {
    const lines = contentMd.split(/\r?\n/);
    const faq: FaqItem[] = [];
    let i = 0;
    while (i < lines.length) {
        const heading = lines[i].match(FAQ_HEADING_RE);
        if (heading && heading[1].trim().endsWith('?')) {
            const questionPl = heading[1].trim();
            const bodyLines: string[] = [];
            i++;
            while (i < lines.length && !FAQ_HEADING_RE.test(lines[i])) {
                bodyLines.push(lines[i]);
                i++;
            }
            const answerPl = markdownToPlainText(bodyLines.join('\n').trim());
            if (answerPl) faq.push({ questionPl, answerPl });
        } else {
            i++;
        }
    }
    return faq;
}

export interface SeoContentResult {
    html: string;
    faq: FaqItem[];
    metaTitle: string | null;
    metaDescription: string | null;
    updatedAt: Date;
}

interface CacheEntry {
    html: string;
    faq: FaqItem[];
    updatedAt: number;
}

// Klucz = urlPath. Inwalidacja porównaniem updatedAt z bazy — render/sanityzacja markdownu
// (koszt, nie sam SELECT po unique indeksie) są cache'owane, nie samo istnienie wpisu.
const renderCache = new Map<string, CacheEntry>();

export async function getSeoContentPage(fastify: FastifyInstance, urlPath: string): Promise<SeoContentResult | null> {
    const row = await fastify.prisma.seoContentPage.findUnique({ where: { urlPath } });
    if (!row || !row.isPublished) return null;

    const updatedAtMs = row.updatedAt.getTime();
    let cached = renderCache.get(urlPath);
    if (!cached || cached.updatedAt !== updatedAtMs) {
        cached = {
            html: renderContentHtml(row.contentMd),
            faq: parseFaqFromMarkdown(row.contentMd),
            updatedAt: updatedAtMs,
        };
        renderCache.set(urlPath, cached);
    }

    return {
        html: cached.html,
        faq: cached.faq,
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription,
        updatedAt: row.updatedAt,
    };
}

export function __resetSeoContentCache() {
    renderCache.clear();
}
