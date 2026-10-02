// Shell stron filarowych i wspólny nagłówek shelli SSR. Osobny plik bez importów, żeby test
// w korzeniu (src/pillar-shell.test.ts) mógł go importować bez ciągnięcia całego backendu.
// Nagłówek 1:1 ze statycznym hero motoliaHeroShell (vite.config.ts) — ten sam markup co
// Header.tsx; zmiana loga/nawigacji tam wymaga aktualizacji też tutaj i w vite.config.ts.
export const SHELL_HEADER_HTML = `<header class="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60"><div class="container flex min-h-[72px] py-2 lg:h-[80px] items-center justify-between gap-2"><a class="flex items-center gap-3 flex-shrink-0" href="/"><img src="/brands/motolia/logo-header.svg" alt="Motolia" width="240" height="47" class="h-14 md:h-16 w-auto max-w-[240px] object-contain" fetchpriority="high"></a></div></header>`;

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Shell stron filarowych (/leasing, /leasing-konsumencki, /kredyt) ---
// Markup 1:1 z src/pages/FinancingPillarPage.tsx (intro + placeholder karty kalkulatora), żeby
// podmiana #root przez React (createRoot, bez hydracji) nie powodowała skoku. Kopie stałych
// z src/components/pillar/pillarContent.ts pilnuje src/pillar-shell.test.ts.
export type PillarShellType = 'leasing' | 'leasing-konsumencki' | 'kredyt';

export const PILLAR_BENEFITS: Record<PillarShellType, string[]> = {
    leasing: [
        'Dla JDG i spółek, auta osobowe i dostawcze',
        'Rata netto, wpłatę, okres i wykup ustawiasz w kalkulatorze',
        'Doradca Motolii prowadzi wniosek do podpisania umowy',
    ],
    'leasing-konsumencki': [
        'Dla osoby prywatnej, bez działalności gospodarczej',
        'Rata brutto, wpłatę, okres i wykup ustawiasz w kalkulatorze',
        'Wykup lub zwrot auta, zależnie od firmy leasingowej',
    ],
    kredyt: [
        'Kredyt na auto nowe i używane',
        'Wpłatę i okres spłaty ustawiasz w kalkulatorze',
        'Doradca Motolii prowadzi wniosek do odbioru auta',
    ],
};

export const PILLAR_CALC_MIN_H: Record<PillarShellType, string> = {
    leasing: 'min-h-[805px] md:min-h-[697px] lg:min-h-[732px] xl:min-h-[713px]',
    'leasing-konsumencki': 'min-h-[805px] md:min-h-[697px] lg:min-h-[732px] xl:min-h-[713px]',
    kredyt: 'min-h-[730px] md:min-h-[625px] lg:min-h-[661px] xl:min-h-[642px]',
};

// Odpowiednik src/components/financing/splitLeadParagraph.ts (lead = pierwszy <p> bez tagów)
export function pillarLead(html: string): string | null {
    const match = html.match(/<p[^>]*>[\s\S]*?<\/p>/i);
    if (!match) return null;
    return match[0].replace(/<\/?p[^>]*>/gi, '').trim() || null;
}

// lucide <Check> (24x24, stroke 2) — ten sam box h-5 w-5 co w Reakcie
const PILLAR_CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check h-5 w-5 shrink-0 text-primary" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>';

export function pillarShellHtml(type: PillarShellType, article: { h1: string; html: string } | null): string {
    if (!article) return ''; // brand bez artykułu filarowego — React sam narysuje stronę
    const lead = pillarLead(article.html);
    const benefits = PILLAR_BENEFITS[type]
        .map(b => `<li class="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm text-foreground">${PILLAR_CHECK_SVG}<span>${escapeHtml(b)}</span></li>`)
        .join('');
    return `<!--pillar-shell--><div class="min-h-screen bg-background">${SHELL_HEADER_HTML}<main class="container pt-6 pb-10">` +
        `<div class="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">` +
        `<div class="min-w-0 lg:col-start-1 lg:row-start-1"><h1 class="text-3xl font-bold text-foreground leading-tight">${escapeHtml(article.h1)}</h1>` +
        (lead ? `<p class="mt-3 text-base text-muted-foreground leading-relaxed">${escapeHtml(lead)}</p>` : '') +
        `<ul class="mt-5 grid gap-2 sm:grid-cols-3">${benefits}</ul></div>` +
        `<aside class="lg:col-start-2 lg:row-start-1 lg:row-span-2"><div class="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">` +
        `<div class="${PILLAR_CALC_MIN_H[type]} rounded-2xl border bg-muted/40" aria-hidden="true"></div></div></aside>` +
        `</div></main></div><!--/pillar-shell-->`;
}

// --- Shell poradników (/leasing/vat itd.) ---
// Markup 1:1 z górą src/pages/GuideArticlePage.tsx (ścieżka, nadtytuł, H1, ramka „W skrócie”),
// żeby podmiana #root przez React nie powodowała skoku. Pełna treść dla botów jest w bodyHtml (seo-meta).
const PL_MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

/** "2026-10-02" → "2 października 2026" (jak toLocaleDateString('pl-PL') w GuideArticlePage). */
export function formatPlDate(iso: string): string {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${Number(m[3])} ${PL_MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
}

// lucide <ChevronRight> h-4 w-4 i <Clock> h-4 w-4 — te same ikony co w React
const CHEVRON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right h-4 w-4"><path d="m9 18 6-6-6-6"/></svg>';
const CLOCK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock h-4 w-4" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

function initialsOf(name: string): string {
    return name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

export function guideShellHtml(
    guide: { h1: string; leadHtml: string; breadcrumb: string; hub: string; author: { name: string }; updatedAt: string; readingMinutes: number },
    hubLabel: string,
): string {
    return `<!--guide-shell--><div class="min-h-screen bg-background pb-[76px] lg:pb-0">${SHELL_HEADER_HTML}<main class="container pt-4 pb-14">` +
        `<nav aria-label="Ścieżka nawigacji" class="text-sm text-muted-foreground"><ol class="flex flex-wrap items-center gap-1">` +
        `<li><a href="/" class="hover:text-foreground hover:underline">Strona główna</a></li><li aria-hidden="true">${CHEVRON_SVG}</li>` +
        `<li><a href="${escapeHtml(guide.hub)}" class="hover:text-foreground hover:underline">${escapeHtml(hubLabel)}</a></li>` +
        `<li aria-hidden="true">${CHEVRON_SVG}</li><li aria-current="page" class="text-foreground">${escapeHtml(guide.breadcrumb)}</li></ol></nav>` +
        `<div class="mt-4 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_300px]"><article class="min-w-0 max-w-[720px]">` +
        `<p class="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Poradnik · ${escapeHtml(hubLabel)}</p>` +
        `<h1 class="mt-2 text-3xl font-bold leading-tight text-foreground md:text-[2.5rem]">${escapeHtml(guide.h1)}</h1>` +
        `<div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">` +
        `<span class="flex items-center gap-2"><span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">${escapeHtml(initialsOf(guide.author.name))}</span>` +
        `<span class="font-semibold text-foreground">${escapeHtml(guide.author.name)}</span></span>` +
        `<span>Aktualizacja: <time datetime="${escapeHtml(guide.updatedAt)}">${escapeHtml(formatPlDate(guide.updatedAt))}</time></span>` +
        `<span class="flex items-center gap-1">${CLOCK_SVG}${guide.readingMinutes} min czytania</span></div>` +
        `<section aria-label="W skrócie" class="mt-6 rounded-xl border-l-4 border-accent bg-accent/10 p-5">` +
        `<p class="text-xs font-bold uppercase tracking-[0.08em] text-foreground">W skrócie</p>` +
        `<div class="guide-lead mt-2">${guide.leadHtml}</div></section>` +
        `</article></div></main></div><!--/guide-shell-->`;
}
