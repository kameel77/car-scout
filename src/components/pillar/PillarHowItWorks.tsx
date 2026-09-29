import React from 'react';
import { formatPrice } from '@/utils/formatters';
import type { PillarCalculatorState } from '@/components/PillarFinancingCalculator';
import { PILLAR_STEPS, type PillarType } from './pillarContent';

interface Segment {
  key: string;
  label: string;
  detail?: string;
  amount: number;
  barClass: string;
  dotClass: string;
}

/**
 * Pasek podziału ceny auta liczony na żywo z suwaków kalkulatora (wpłata · część spłacana w ratach
 * · wykup). Stoi w lewej kolumnie obok kalkulatora, więc użytkownik widzi zmianę przy każdym ruchu
 * suwaka. Pasek pokazuje strukturę ceny auta, a nie całkowity koszt — ten zależy od oferty partnera.
 */
export function PillarPriceBreakdown({ type, state }: { type: PillarType; state: PillarCalculatorState | null }) {
  const price = state?.price ?? 0;
  const cfg = state?.config ?? null;

  const segments: Segment[] = React.useMemo(() => {
    if (!cfg || price <= 0) return [];
    const down = Math.max(0, Math.round(cfg.downPayment));
    const final = type === 'leasing' ? Math.max(0, Math.round(cfg.finalPayment)) : 0;
    const financed = Math.max(0, price - down - final);
    const list: Segment[] = [
      { key: 'down', label: 'Wpłata własna', detail: 'płacisz na start', amount: down, barClass: 'bg-accent', dotClass: 'bg-accent' },
      {
        key: 'rates',
        label: `Spłacane w ${cfg.period} ratach`,
        detail: cfg.installment > 0 ? `rata ${formatPrice(cfg.installment, 'PLN')} / mies.` : undefined,
        amount: financed,
        barClass: 'bg-primary',
        dotClass: 'bg-primary',
      },
    ];
    if (final > 0) {
      list.push({ key: 'final', label: 'Wykup', detail: 'na koniec umowy', amount: final, barClass: 'bg-slate-400', dotClass: 'bg-slate-400' });
    }
    return list.filter((s) => s.amount > 0);
  }, [cfg, price, type]);

  return (
    <section aria-labelledby="podzial-ceny-title" className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 id="podzial-ceny-title" className="text-lg font-bold text-foreground">
        {type === 'leasing' ? 'Jak rozkłada się cena auta w leasingu' : 'Jak rozkłada się cena auta w kredycie'}
      </h2>
      {segments.length === 0 ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted/60" aria-hidden="true" />
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Auto za <strong className="text-foreground">{formatPrice(price, 'PLN')}</strong> przy parametrach z kalkulatora — przesuń suwak, a podział zmieni się od razu.
          </p>
          <div
            className="mt-4 flex h-10 w-full overflow-hidden rounded-xl"
            role="img"
            aria-label={segments.map((s) => `${s.label}: ${formatPrice(s.amount, 'PLN')}`).join(', ')}
          >
            {segments.map((s) => {
              const pct = (s.amount / price) * 100;
              return (
                <div
                  key={s.key}
                  className={`${s.barClass} flex items-center justify-center text-xs font-semibold text-white transition-[width] duration-300 ease-out`}
                  style={{ width: `${pct}%` }}
                >
                  {pct >= 12 ? `${Math.round(pct)}%` : null}
                </div>
              );
            })}
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {segments.map((s) => (
              <li key={s.key} className="flex items-start gap-2">
                <span className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-sm ${s.dotClass}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground leading-tight">{s.label}</p>
                  <p className="font-semibold tabular-nums text-foreground">{formatPrice(s.amount, 'PLN')}</p>
                  {s.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Raty zawierają dodatkowo koszt finansowania — jego wysokość pokazuje kalkulator.
          </p>
        </>
      )}
    </section>
  );
}

/** „Jak działa leasing / kredyt” — 4 kroki w pionie (oś czasu). */
export function PillarSteps({ type }: { type: PillarType }) {
  const steps = PILLAR_STEPS[type];
  return (
    <section aria-labelledby="jak-dziala-title">
      <h2 id="jak-dziala-title" className="text-2xl font-bold text-foreground">
        {type === 'leasing' ? 'Jak działa leasing samochodu' : 'Jak działa kredyt samochodowy'}
      </h2>
      <ol className="mt-5 space-y-0">
        {steps.map((step, i) => (
          <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && (
              <span className="absolute left-4 top-9 bottom-0 w-px -translate-x-1/2 bg-border" aria-hidden="true" />
            )}
            <span className="relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
              {i + 1}
            </span>
            <div className="pt-1">
              <h3 className="font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
