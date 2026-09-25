import React from 'react';
import { Link } from 'react-router-dom';

/** One-line pointer to /dla-firm for HR visitors of the employee homepage. */
export const EmployerTeaserSection: React.FC = () => {
  return (
    <section id="dla-firm" className="wrap" aria-label="Oferta dla firm">
      <div className="bg-forest text-paper rounded-3xl px-6 py-6 sm:px-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="font-heading text-xl font-semibold m-0">Odpowiadasz za benefity w firmie?</p>
        <Link to="/dla-firm" className="button button-lime self-start sm:self-auto">
          Zobacz ofertę dla firm <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </section>
  );
};
