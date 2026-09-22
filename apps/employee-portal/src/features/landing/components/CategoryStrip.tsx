import React from 'react';

export const CategoryStrip: React.FC = () => {
  return (
    <div className="category-strip wrap" aria-label="Oferta Benefivo">
      <span>
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4 10 2-6h12l2 6M3 10h18v8H3zM6 18v2m12-2v2M6 14h2m8 0h2" />
        </svg>
        Najem długoterminowy
      </span>
      <span>
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="3" />
          <path d="M2 10h20M6 15h4" />
        </svg>
        Leasing samochodów
      </span>
      <span>
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 21V3h10v18M2 21h14M4 10h10m0 3h3v5a2 2 0 0 0 4 0V9l-4-4m2 2v4h2" />
        </svg>
        Korzyści na paliwo
      </span>
      <span>
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" />
        </svg>
        Usługi dla kierowców
      </span>
    </div>
  );
};
