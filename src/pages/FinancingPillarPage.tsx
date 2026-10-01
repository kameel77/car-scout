import React from 'react';
import { Check } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MetaHead } from '@/components/seo/MetaHead';
import { useSeoConfig } from '@/components/seo/SeoManager';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useBrand } from '@/contexts/BrandContext';
import { useFinancingArticle } from '@/components/financing/useFinancingArticle';
import { splitLeadParagraph } from '@/components/financing/splitLeadParagraph';
import type { PillarCalculatorState } from '@/components/PillarFinancingCalculator';
import { PillarPriceBreakdown, PillarSteps } from '@/components/pillar/PillarHowItWorks';
import { PILLAR_BENEFITS, PILLAR_CALC, PILLAR_CALC_MIN_H, PILLAR_META, type PillarType } from '@/components/pillar/pillarContent';

const PillarFinancingCalculator = React.lazy(() =>
  import('@/components/PillarFinancingCalculator').then((m) => ({ default: m.PillarFinancingCalculator })),
);

// Sekcje poniżej folda: osobne chunki, żeby nie opóźniały mountu Reacta (LCP = lead <p>).
const PillarSpecialOffers = React.lazy(() =>
  import('@/components/pillar/PillarSpecialOffers').then((m) => ({ default: m.PillarSpecialOffers })),
);
const FinancingContentSection = React.lazy(() =>
  import('@/components/FinancingContentSection').then((m) => ({ default: m.FinancingContentSection })),
);

/**
 * Strony poradnikowe /leasing (firmy), /leasing-konsumencki i /kredyt: H1 + lead + korzyści obok kalkulatora (z kontaktem pod ratą),
 * 4 oferty specjalne na nowe auta, „jak to działa” i treść poradnika z FAQ. Pełny katalog z filtrami
 * jest na /nowe i /samochody — tu nie dublujemy listingu.
 */
export default function FinancingPillarPage({ type }: { type: PillarType }) {
  const meta = PILLAR_META[type];
  const { data: article } = useFinancingArticle(type);
  const { data: settings } = useAppSettings();
  const { data: seoConfig } = useSeoConfig();
  const { config } = useBrand();
  const [calcState, setCalcState] = React.useState<PillarCalculatorState | null>(null);

  const lead = React.useMemo(() => (article?.html ? splitLeadParagraph(article.html).lead : null), [article?.html]);
  const siteName = settings?.siteNamePl?.trim() || config.name;
  const title = `${meta.title} | ${siteName}`;
  const origin = window.location.origin;

  return (
    <div className="min-h-screen bg-background">
      <MetaHead
        title={title}
        description={meta.description}
        image={seoConfig?.homeOgImage}
        canonical={`/${type}`}
        schema={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'CollectionPage',
              name: title,
              description: meta.description,
              url: `${origin}/${type}`,
              isPartOf: { '@type': 'WebSite', name: siteName, url: origin },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Strona główna', item: origin },
                { '@type': 'ListItem', position: 2, name: meta.crumb, item: `${origin}/${type}` },
              ],
            },
          ],
        }}
      />
      <Header />

      <main className="container pt-6 pb-10">
        {/*
          Desktop: lewa kolumna = treść (intro → podział ceny → kroki → oferty), prawa = kalkulator
          sticky aż do końca sekcji ofert. Mobile: intro → kalkulator → reszta (kolejność DOM).
        */}
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <h1 className="text-3xl font-bold text-foreground leading-tight">{article?.h1 || meta.crumb}</h1>
            {lead && <p className="mt-3 text-base text-muted-foreground leading-relaxed">{lead}</p>}
            <ul className="mt-5 grid gap-2 sm:grid-cols-3">
              {PILLAR_BENEFITS[type].map((b) => (
                <li key={b} className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm text-foreground">
                  <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              <React.Suspense
                fallback={
                  <div className={`${PILLAR_CALC_MIN_H[type]} rounded-2xl border bg-muted/40`} role="status" aria-busy="true" />
                }
              >
                <PillarFinancingCalculator
                  type={PILLAR_CALC[type].financingType}
                  priceIsNet={PILLAR_CALC[type].priceIsNet}
                  sourceSlug={type}
                  variant="card"
                  minHeightClassName={PILLAR_CALC_MIN_H[type]}
                  onStateChange={setCalcState}
                />
              </React.Suspense>
            </div>
          </aside>

          <div className="min-w-0 space-y-12 lg:col-start-1 lg:row-start-2">
            <PillarPriceBreakdown type={type} state={calcState} />
            <PillarSteps type={type} />
            {/* Rezerwa ≈ nagłówek + 4 skeletony kart (1 kolumna na mobile, 2×2 od sm) */}
            <React.Suspense fallback={<div className="min-h-[130rem] sm:min-h-[63rem]" aria-hidden="true" />}>
              <PillarSpecialOffers type={type} />
            </React.Suspense>
          </div>
        </div>

        <React.Suspense fallback={null}>
          <FinancingContentSection type={type} hideTitle />
        </React.Suspense>
      </main>

      <Footer />
    </div>
  );
}
