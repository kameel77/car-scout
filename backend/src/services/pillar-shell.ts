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
