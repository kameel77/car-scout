import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { FinancingCalculator } from '@/components/FinancingCalculator';
import { formatPrice } from '@/utils/formatters';

const MIN_PRICE = 30000;
const MAX_PRICE = 500000;
const DEFAULT_PRICE = 150000;
// Vehis wymaga rocznika pojazdu (bez niego /api/financing/calculate zwraca 422 "Missing vehicle
// year" i kalkulator pokazywał komunikat o braku oferty — KAM-6). Filar liczy ratę dla nowego auta.
const PILLAR_VEHICLE_YEAR = new Date().getFullYear();

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
      <p className="text-xs text-muted-foreground mb-3">Wyliczenie orientacyjne dla nowego samochodu (rocznik {PILLAR_VEHICLE_YEAR}).</p>
      <FinancingCalculator
        price={price}
        financingType={type}
        manufacturingYear={PILLAR_VEHICLE_YEAR}
        mileageKm={0}
        isDuplicateHeading
      />
    </section>
  );
}
