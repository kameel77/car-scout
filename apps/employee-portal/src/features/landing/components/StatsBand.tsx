import React from 'react';
import { PROGRAM_STATS, PROGRAM_STATS_FOOTNOTE } from '../content/marketing';

export const StatsBand: React.FC = () => (
  <section className="wrap" aria-label="Przykłady z oferty programu">
    <div className="bg-forest text-paper rounded-3xl px-6 py-8 sm:px-10 sm:py-10">
      <dl className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {PROGRAM_STATS.map((stat) => (
          <div key={stat.value} className="border-t-2 border-lime pt-5 flex flex-col-reverse gap-2">
            <dt className="text-sm leading-relaxed text-[#DDE1D5]">{stat.label}</dt>
            <dd className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight text-lime tabular-nums m-0">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-xs text-[#C9D3C4]">{PROGRAM_STATS_FOOTNOTE}</p>
    </div>
  </section>
);
