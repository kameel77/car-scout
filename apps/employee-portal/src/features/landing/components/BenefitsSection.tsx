import React from 'react';

export const BenefitsSection: React.FC = () => {
  return (
    <section id="benefity" className="benefits-section wrap" aria-labelledby="benefits-title">
      <div className="benefits-layout">
        <div className="benefits-copy">
          <p className="eyebrow">DOBRE RZECZY W PAKIECIE</p>
          <h2 id="benefits-title">
            Auto to dopiero<br />
            początek.
          </h2>
          <p>
            Codzienne wydatki? Pomyśleliśmy i o nich.
            <br />
            Poznaj korzyści planowane w programie Benefivo.
          </p>
          <a className="text-link mt-4" href="#jak-to-dziala">
            Zobacz, jak dołączyć <span aria-hidden="true">&rarr;</span>
          </a>
        </div>

        <div className="member-card" aria-label="Wizualizacja karty benefitowej Benefivo">
          <div className="card-top">
            <span className="brand">
              benefivo<span aria-hidden="true">↗</span>
            </span>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" />
            </svg>
          </div>
          <span className="member-label">WIĘCEJ Z KAŻDEJ DROGI.</span>
          <div className="card-bottom">
            <span>Twój pakiet korzyści</span>
            <span>powered by motolia</span>
          </div>
          <div className="card-path" aria-hidden="true"></div>
        </div>

        <div className="benefit-list">
          <div>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 21V3h10v18M2 21h14M4 10h10m0 3h3v5a2 2 0 0 0 4 0V9l-4-4m2 2v4h2" />
            </svg>
            <h3>Karta paliwowa</h3>
            <p>Wygodne rozliczenia i korzyści przy tankowaniu.</p>
          </div>
          <div>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m4 10 2-6h12l2 6M3 10h18v8H3zM6 18v2m12-2v2M6 14h2m8 0h2" />
            </svg>
            <h3>Serwis i opony</h3>
            <p>Kompleksowa opieka i zniżki na obsługę samochodu.</p>
          </div>
          <div>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" />
            </svg>
            <h3>Myjnie i pielęgnacja</h3>
            <p>Czystość i komfort na każdej trasie.</p>
          </div>
        </div>

        <p className="fine-print col-span-full">
          Zakres benefitów i partnerzy zostaną sprecyzowani w ofercie programu dla danej firmy. Prezentowana karta jest wizualizacją koncepcji.
        </p>
      </div>
    </section>
  );
};
