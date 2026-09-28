import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { FinancingCalculator, type CalculatorFinancingConfig } from '@/components/FinancingCalculator';
import { CallbackForm } from '@/components/CallbackForm';
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
export interface PillarCalculatorState {
  price: number;
  config: CalculatorFinancingConfig | null;
}

interface PillarFinancingCalculatorProps {
  type: 'leasing' | 'kredyt';
  /** Wariant karty dla strony poradnikowej: bez H2, z przyciskiem kontaktu pod ratą. */
  variant?: 'section' | 'card';
  onStateChange?: (state: PillarCalculatorState) => void;
}

export function PillarFinancingCalculator({ type, variant = 'section', onStateChange }: PillarFinancingCalculatorProps) {
  const [price, setPrice] = React.useState(DEFAULT_PRICE);
  const [config, setConfig] = React.useState<CalculatorFinancingConfig | null>(null);

  React.useEffect(() => {
    onStateChange?.({ price, config });
  }, [onStateChange, price, config]);

  const priceSlider = (
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
        aria-label="Cena pojazdu"
      />
      <p className="text-xs text-muted-foreground">Wyliczenie orientacyjne dla nowego samochodu (rocznik {PILLAR_VEHICLE_YEAR}).</p>
    </div>
  );

  const calculator = (
    <FinancingCalculator
      price={price}
      financingType={type}
      manufacturingYear={PILLAR_VEHICLE_YEAR}
      mileageKm={0}
      isDuplicateHeading
      onConfigChange={setConfig}
    />
  );

  if (variant === 'card') {
    const rateLine = config
      ? `Rata ${Math.round(config.installment)} zł/mies., ${config.period} mies., wpłata ${Math.round(config.downPayment)} zł${config.finalPayment ? `, wykup ${Math.round(config.finalPayment)} zł` : ''}`
      : '';
    return (
      <section id="kalkulator" aria-label="Kalkulator finansowania" className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm">
        {priceSlider}
        {calculator}
        <CallbackForm
          compact
          className="mt-4"
          title="Ta rata Ci pasuje?"
          titleHighlight="Oddzwonimy"
          description="Zostaw numer — doradca Motolii sprawdzi ofertę dla tych parametrów."
          submitLabel="Zapytaj o tę ratę"
          formId={`pillar_${type}_calculator`}
          financingType={type}
          message={`Zapytanie z kalkulatora /${type}: cena auta ${Math.round(price)} zł. ${rateLine}`.trim()}
          financingParams={config ?? undefined}
        />
      </section>
    );
  }

  return (
    <section id="kalkulator" className="mt-8 mb-2">
      <h2 className="text-2xl font-bold mb-4">Kalkulator finansowania</h2>
      {priceSlider}
      {calculator}
    </section>
  );
}
