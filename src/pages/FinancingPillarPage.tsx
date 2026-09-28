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
import { FinancingContentSection } from '@/components/FinancingContentSection';
import type { PillarCalculatorState } from '@/components/PillarFinancingCalculator';
import { PillarSpecialOffers } from '@/components/pillar/PillarSpecialOffers';
import { PillarHowItWorks } from '@/components/pillar/PillarHowItWorks';
import { PILLAR_BENEFITS, PILLAR_META, type PillarType } from '@/components/pillar/pillarContent';

const PillarFinancingCalculator = React.lazy(() =>
  import('@/components/PillarFinancingCalculator').then((m) => ({ default: m.PillarFinancingCalculator })),
);

/**
 * Strony poradnikowe /leasing i /kredyt: H1 + lead + korzyści obok kalkulatora (z kontaktem pod ratą),
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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:items-start">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-foreground leading-tight">{article?.h1 || meta.crumb}</h1>
            {lead && <p className="mt-3 text-base text-muted-foreground leading-relaxed">{lead}</p>}
            <ul className="mt-5 space-y-2">
              {PILLAR_BENEFITS[type].map((b) => (
                <li key={b} className="flex items-start gap-2 text-foreground">
                  <Check className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <React.Suspense
            fallback={<div className="h-96 rounded-2xl border bg-muted/40" role="status" aria-busy="true" />}
          >
            <PillarFinancingCalculator type={type} variant="card" onStateChange={setCalcState} />
          </React.Suspense>
        </div>

        <PillarSpecialOffers type={type} />
        <PillarHowItWorks type={type} state={calcState} />

        <FinancingContentSection type={type} hideTitle />
      </main>

      <Footer />
    </div>
  );
}
