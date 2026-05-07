import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function B2BOnepagerPage() {
  const [params] = useSearchParams();
  const isPrintMode = params.get('print') === '1';

  return (
    <div className="min-h-screen bg-background">
      {!isPrintMode && <Header />}
      <main className="container py-8">
        <div data-testid="b2b-onepager-root">
          {/* Sections to be added: Hero, Benefits, Offers, CTA */}
        </div>
      </main>
      {!isPrintMode && <Footer />}
    </div>
  );
}
