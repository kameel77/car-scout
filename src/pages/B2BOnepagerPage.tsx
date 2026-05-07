import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { B2BHero } from '@/components/b2b/B2BHero';
import { B2BBenefitGrid } from '@/components/b2b/B2BBenefitGrid';
import { B2BOfferGrid } from '@/components/b2b/B2BOfferGrid';
import { B2BCtaSection } from '@/components/b2b/B2BCtaSection';

export default function B2BOnepagerPage() {
  const [params] = useSearchParams();
  const isPrintMode = params.get('print') === '1';
  const idsParam = params.get('ids');
  const ids = idsParam ? idsParam.split(',') : undefined;

  return (
    <div className="min-h-screen bg-background">
      {!isPrintMode && <Header />}
      <main className="container py-8">
        <B2BHero />
        <B2BBenefitGrid />
        <B2BOfferGrid ids={ids} />
        <B2BCtaSection />
      </main>
      {!isPrintMode && <Footer />}
    </div>
  );
}
