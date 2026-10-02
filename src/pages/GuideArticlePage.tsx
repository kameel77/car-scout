import React from 'react';
import { Link } from 'react-router-dom';
import { Calculator, ChevronRight, Clock, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MetaHead } from '@/components/seo/MetaHead';
import { useGuideArticle } from '@/components/guide/useGuideArticle';
import { GUIDES_INDEX } from '@/components/guide/guidePaths';

const HUB_LABELS: Record<string, { label: string; cta: string; guideTitle: string }> = {
  '/leasing': { label: 'Leasing', cta: 'Policz ratę leasingu', guideTitle: 'Leasing samochodu dla firm' },
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Podświetla w spisie treści sekcję, którą użytkownik właśnie czyta. */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (ids.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -60% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

/** Pasek CTA na mobile pokazuje się dopiero po przewinięciu wstępu, żeby nie zasłaniał odpowiedzi. */
function useScrolledPast(px: number): boolean {
  const [past, setPast] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setPast(window.scrollY > px);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [px]);
  return past;
}

/**
 * Poradnik pod hubem (np. /leasing/vat). Układ pod czytelność: odpowiedź w ramce „W skrócie”,
 * spis treści (desktop: sticky obok tekstu, mobile: rozwijany), szerokość tekstu ~70 znaków,
 * grafiki objaśniające w treści, FAQ jako karty, źródła zwinięte. Jedno główne CTA na widok:
 * karta w kolumnie bocznej (desktop) albo dolny pasek (mobile).
 */
export default function GuideArticlePage({ path }: { path: string }) {
  const { data: guide, isError, refetch } = useGuideArticle(path);
  const tocIds = React.useMemo(() => (guide?.toc ?? []).map((t) => t.id), [guide?.toc]);
  const active = useActiveSection(tocIds);
  const showMobileCta = useScrolledPast(500);

  // Link z kotwicą (#sekcja) z wyszukiwarki lub innej strony: shell SSR nie ma id sekcji,
  // więc przewijamy dopiero po wyrenderowaniu treści.
  React.useEffect(() => {
    if (!guide || !window.location.hash) return;
    const el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    el?.scrollIntoView();
  }, [guide]);

  if (!guide) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-10" aria-busy={guide === undefined && !isError}>
          {guide === null && (
            <div className="max-w-xl">
              <h1 className="text-2xl font-bold text-foreground">Nie znaleźliśmy tego poradnika</h1>
              <p className="mt-2 text-muted-foreground">Adres mógł się zmienić. Wszystkie informacje o finansowaniu znajdziesz w przewodniku.</p>
              <Link to="/leasing" className="mt-4 inline-block font-semibold text-primary underline underline-offset-2">Przejdź do przewodnika po leasingu</Link>
            </div>
          )}
          {isError && (
            <div className="max-w-xl">
              <p className="text-muted-foreground">Nie udało się wczytać poradnika.</p>
              <button type="button" onClick={() => refetch()} className="mt-3 font-semibold text-primary underline underline-offset-2">Spróbuj ponownie</button>
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  const hub = HUB_LABELS[guide.hub] ?? { label: 'Poradnik', cta: 'Policz ratę', guideTitle: 'Przewodnik' };
  const related = GUIDES_INDEX.filter((g) => g.hub === guide.hub && g.path !== guide.path);

  return (
    <div className="min-h-screen bg-background pb-[76px] lg:pb-0">
      <MetaHead title={guide.title} description={guide.description} image={guide.ogImage} canonical={guide.path} type="article" />
      <Header />

      <main className="container pt-4 pb-14">
        <nav aria-label="Ścieżka nawigacji" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link to="/" className="hover:text-foreground hover:underline">Strona główna</Link></li>
            <li aria-hidden="true"><ChevronRight className="h-4 w-4" /></li>
            <li><Link to={guide.hub} className="hover:text-foreground hover:underline">{hub.label}</Link></li>
            <li aria-hidden="true"><ChevronRight className="h-4 w-4" /></li>
            <li aria-current="page" className="text-foreground">{guide.breadcrumb}</li>
          </ol>
        </nav>

        <div className="mt-4 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="min-w-0 max-w-[720px]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Poradnik · {hub.label}</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground md:text-[2.5rem]">{guide.h1}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">
                  {initials(guide.author.name)}
                </span>
                <span className="font-semibold text-foreground">{guide.author.name}</span>
              </span>
              <span>Aktualizacja: <time dateTime={guide.updatedAt}>{formatDate(guide.updatedAt)}</time></span>
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" />{guide.readingMinutes} min czytania</span>
              {guide.reviewedBy && (
                <span className="flex items-center gap-1 font-semibold text-[hsl(var(--mt-success-700))]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Zweryfikował: {guide.reviewedBy}
                </span>
              )}
            </div>

            <section aria-label="W skrócie" className="mt-6 rounded-xl border-l-4 border-accent bg-accent/10 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground">W skrócie</p>
              <div className="guide-lead mt-2" dangerouslySetInnerHTML={{ __html: guide.leadHtml }} />
            </section>

            {guide.toc.length > 0 && (
              <details className="mt-6 rounded-xl border bg-card p-4 lg:hidden">
                <summary className="cursor-pointer text-base font-semibold text-foreground">Spis treści</summary>
                <ol className="mt-3 space-y-2 text-[0.9375rem]">
                  {guide.toc.map((t) => (
                    <li key={t.id}><a href={`#${t.id}`} className="text-primary underline-offset-2 hover:underline">{t.text}</a></li>
                  ))}
                </ol>
              </details>
            )}

            <div className="guide-prose mt-8" dangerouslySetInnerHTML={{ __html: guide.html }} />

            <section aria-label="Autor" className="mt-12 flex gap-4 rounded-xl border bg-card p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground" aria-hidden="true">
                {initials(guide.author.name)}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Autor</p>
                <p className="mt-1 font-semibold text-foreground">{guide.author.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.author.bio}</p>
              </div>
            </section>

            {guide.sourcesHtml && (
              <details className="guide-sources mt-6 rounded-xl border p-4">
                <summary className="cursor-pointer font-semibold text-foreground">Źródła i podstawa prawna</summary>
                <div className="mt-3" dangerouslySetInnerHTML={{ __html: guide.sourcesHtml }} />
              </details>
            )}

            {guide.disclaimer && <p className="mt-6 text-sm text-muted-foreground">{guide.disclaimer}</p>}

            {guide.hub && (
              <section aria-label="Czytaj też" className="mt-10">
                <h2 className="text-xl font-bold text-foreground">Czytaj też</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  <li>
                    <Link to={guide.hub} className="block h-full rounded-xl border bg-card p-4 transition-colors hover:border-primary">
                      <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Przewodnik</span>
                      <span className="mt-1 block font-semibold text-foreground">{hub.guideTitle}</span>
                    </Link>
                  </li>
                  {related.map((g) => (
                    <li key={g.path}>
                      <Link to={g.path} className="block h-full rounded-xl border bg-card p-4 transition-colors hover:border-primary">
                        <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Poradnik</span>
                        <span className="mt-1 block font-semibold text-foreground">{g.breadcrumb}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {guide.toc.length > 0 && (
                <nav aria-label="Spis treści" className="max-h-[calc(100vh-18rem)] overflow-y-auto">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Spis treści</p>
                  <ol className="mt-3 space-y-1 border-l text-sm">
                    {guide.toc.map((t) => (
                      <li key={t.id}>
                        <a
                          href={`#${t.id}`}
                          className={`-ml-px block border-l-2 py-1.5 pl-3 leading-snug transition-colors ${
                            active === t.id
                              ? 'border-primary font-semibold text-foreground'
                              : 'border-transparent text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {t.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <p className="font-semibold text-foreground">Masz już auto na oku?</p>
                <p className="mt-1 text-sm text-muted-foreground">Ustaw wpłatę, okres i wykup, a kalkulator pokaże ratę dla konkretnego samochodu.</p>
                <Link
                  to={guide.hub}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 font-bold text-accent-foreground hover:brightness-95"
                >
                  <Calculator className="h-5 w-5" aria-hidden="true" />
                  {hub.cta}
                </Link>
                <Link to="/kontakt" className="mt-3 block text-center text-sm font-semibold text-primary underline underline-offset-2">
                  Zapytaj doradcę
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur transition-transform lg:hidden ${
          showMobileCta ? 'translate-y-0' : 'translate-y-full'
        }`}
        aria-hidden={!showMobileCta}
      >
        <Link
          to={guide.hub}
          tabIndex={showMobileCta ? 0 : -1}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-accent font-bold text-accent-foreground"
        >
          <Calculator className="h-5 w-5" aria-hidden="true" />
          {hub.cta}
        </Link>
      </div>

      <Footer />
    </div>
  );
}
