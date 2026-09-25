import React from 'react';
import { HERO_PRICE_EXAMPLE } from '../content/marketing';

const fmt = (n: number) => n.toLocaleString('pl-PL');

/** Hero card: catalog price vs program price for one named model. */
export const PriceDropCard: React.FC = () => {
  const { catalogPrice, programPrice } = HERO_PRICE_EXAMPLE;
  const saved = catalogPrice - programPrice;
  const barPct = (programPrice / catalogPrice) * 100;

  return (
    <div className="price-drop">
      <div className="price-drop-blob" aria-hidden="true" />
      <div className="price-drop-card">
        <div className="price-drop-image">
          <img
            src={HERO_PRICE_EXAMPLE.imageUrl}
            alt={HERO_PRICE_EXAMPLE.title}
            width="640"
            height="360"
            {...({ fetchpriority: 'high' } as Record<string, string>)}
          />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-heading text-2xl font-bold tracking-tight">{HERO_PRICE_EXAMPLE.title}</p>
            <p className="text-sm text-muted mt-1">{HERO_PRICE_EXAMPLE.subtitle}</p>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-[#E6E2F2] px-3 py-1.5 rounded-full whitespace-nowrap">
            {HERO_PRICE_EXAMPLE.tag}
          </span>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-sm text-muted">Cena katalogowa</span>
          <span className="text-muted line-through">{fmt(catalogPrice)} zł</span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm font-semibold">Twoja cena</span>
          <span className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums leading-none">
            {fmt(programPrice)} zł
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-[#EEF1E8] overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-ink" style={{ width: `${barPct.toFixed(1)}%` }} />
        </div>
        <span className="self-start text-sm font-bold bg-lime px-4 py-2 rounded-full">
          Oszczędzasz {fmt(saved)} zł
        </span>
      </div>
      <div className="price-drop-sticker" aria-hidden="true">
        <span className="font-heading text-2xl font-extrabold tracking-tight">{HERO_PRICE_EXAMPLE.discountLabel}</span>
        <span className="text-[11px] font-semibold text-paper">od katalogu</span>
      </div>
    </div>
  );
};
