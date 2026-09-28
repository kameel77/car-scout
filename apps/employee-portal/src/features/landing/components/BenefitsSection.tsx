import React from 'react';
import { EMPLOYEE_BENEFITS } from '../content/marketing';

export const BenefitsSection: React.FC = () => {
  return (
    <section id="benefity" className="section wrap" aria-labelledby="benefits-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CO DOSTAJESZ</p>
          <h2 id="benefits-title">Co dostajesz w programie</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {EMPLOYEE_BENEFITS.map((b, i) => (
          <div key={b.title} className="bg-white p-7 rounded-3xl border border-line flex flex-col gap-2">
            <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
            <h3>{b.title}</h3>
            <p className="text-sm text-muted leading-relaxed">{b.text}</p>
          </div>
        ))}
      </div>
      <p className="fine-print">Szczegóły pakietu zależą od programu Twojej firmy.</p>
    </section>
  );
};
