import React from 'react';
import { formatPrice } from '@/utils/formatters';
import type { PillarCalculatorState } from '@/components/PillarFinancingCalculator';
import { PILLAR_STEPS, type PillarType } from './pillarContent';

interface Segment {
  key: string;
  label: string;
  amount: number;
  className: string;
}

/**
 * „Jak działa leasing / kredyt”: pasek podziału ceny auta liczony z bieżących suwaków kalkulatora
 * (wpłata · część spłacana w ratach · wykup) oraz schemat w 4 krokach. Pasek pokazuje strukturę
 * ceny auta, a nie całkowity koszt — ten zależy od oferty partnera i jest w kalkulatorze.
 */
export function PillarHowItWorks({ type, state }: { type: PillarType; state: PillarCalculatorState | null }) {
  const steps = PILLAR_STEPS[type];
  const price = state?.price ?? 0;
  const cfg = state?.config ?? null;

  const segments: Segment[] = React.useMemo(() => {
    if (!cfg || price <= 0) return [];
    const down = Math.max(0, Math.round(cfg.downPayment));
    const final = type === 'leasing' ? Math.max(0, Math.round(cfg.finalPayment)) : 0;
    const financed = Math.max(0, price - down - final);
    const list: Segment[] = [
      { key: 'down', label: 'Wpłata własna', amount: down, className: 'bg-accent' },
      { key: 'rates', label: `Spłacane w ${cfg.period} ratach`, amount: financed, className: 'bg-primary' },
    ];
    if (final > 0) list.push({ key: 'final', label: 'Wykup na koniec umowy', amount: final, className: 'bg-muted-foreground/60' });
    return list.filter((s) => s.amount > 0);
  }, [cfg, price, type]);

  return (
    <section aria-labelledby="jak-dziala-title" className="mt-12">
      <h2 id="jak-dziala-title" className="text-2xl font-bold mb-2">
        {type === 'leasing' ? 'Jak działa leasing samochodu' : 'Jak działa kredyt samochodowy'}
      </h2>

      {segments.length > 0 && (
        <div className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground mb-3">
            Na co idzie cena auta {formatPrice(price, 'PLN')} przy parametrach z kalkulatora:
          </p>
          <div className="flex h-4 w-full overflow-hidden rounded-full" role="img"
            aria-label={segments.map((s) => `${s.label}: ${formatPrice(s.amount, 'PLN')}`).join(', ')}>
            {segments.map((s) => (
              <div key={s.key} className={s.className} style={{ width: `${(s.amount / price) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
            {segments.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className={`inline-block h-3 w-3 rounded-sm ${s.className}`} aria-hidden="true" />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="ml-auto font-semibold tabular-nums whitespace-nowrap">{formatPrice(s.amount, 'PLN')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Rata zawiera dodatkowo koszt finansowania — jego wysokość pokazuje kalkulator powyżej.
          </p>
        </div>
      )}

      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-2xl border bg-card p-4">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground font-bold text-sm">
              {i + 1}
            </span>
            <h3 className="mt-3 font-semibold text-foreground">{step.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
