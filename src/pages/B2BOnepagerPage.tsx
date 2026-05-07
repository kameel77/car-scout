import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { B2BHero } from '@/components/b2b/B2BHero';

export default function B2BOnepagerPage() {
  const [params] = useSearchParams();
  const isPrintMode = params.get('print') === '1';

  return (
    <div className="min-h-screen bg-background">
      {!isPrintMode && <Header />}
      <main className="container py-8">
        <B2BHero />
        <div data-testid="b2b-onepager-root">
          {/* Benefits, Offers, CTA — kolejne taski */}
        </div>
      </main>
      {!isPrintMode && <Footer />}
    </div>
  );
}
