import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { FinancingCalculator } from '@/components/FinancingCalculator';
import { formatPrice } from '@/utils/formatters';

const MIN_PRICE = 30000;
const MAX_PRICE = 500000;
const DEFAULT_PRICE = 150000;

/**
 * Sekcja kalkulatora finansowania na stronach filarowych (/leasing, /kredyt) — nad listingiem,
 * pod akapitem definicyjnym artykułu. Bez konkretnego pojazdu, więc cenę auta do wyliczenia
 * raty wybiera użytkownik suwakiem (FinancingCalculator działa poprawnie bez listingId —
 * pomija jedynie przycisk "Kontynuuj z tym finansowaniem", który wymaga konkretnej oferty).
 */
export function PillarFinancingCalculator({ type }: { type: 'leasing' | 'kredyt' }) {
  const [price, setPrice] = React.useState(DEFAULT_PRICE);

  return (
    <section id="kalkulator" className="mt-8 mb-2">
      <h2 className="text-2xl font-bold mb-4">Kalkulator finansowania</h2>
      <div className="mb-4 space-y-2">
        <div className="flex justify-between items-baseline">
          <Label className="text-sm">Cena pojazdu</Label>
          <span className="font-semibold text-sm">{formatPrice(price, 'PLN')}</span>
        </div>
        <Slider
          value={[price]}
          min={MIN_PRICE}
          max={MAX_PRICE}
          step={1000}
          onValueChange={(v) => setPrice(v[0])}
        />
      </div>
      <FinancingCalculator price={price} financingType={type} isDuplicateHeading />
    </section>
  );
}
