import React from 'react';
import { Link } from 'react-router-dom';

export const EmployerTeaserSection: React.FC = () => {
  return (
    <section id="dla-firm" className="employer-section wrap" aria-labelledby="employer-title">
      <div className="employer-copy">
        <p className="eyebrow">DLA ŚREDNICH I DUŻYCH FIRM</p>
        <h2 id="employer-title">
          Dobry pracodawca<br />
          daje więcej<br />
          <span>możliwości.</span>
        </h2>
        <p>
          Dołącz samochody i usługi motoryzacyjne do pakietu benefitów Twojego zespołu. Zero kosztów wdrożenia, kompleksowe wsparcie operacyjne i preferencyjne warunki.
        </p>
        <Link to="/dla-firm" className="button button-lime">
          Poznaj ofertę dla firm <span aria-hidden="true">↗</span>
        </Link>
      </div>

      <div className="employer-visual">
        <img
          src="/static/charging.webp"
          srcSet="/static/charging-small.webp 570w, /static/charging.webp 1500w"
          sizes="(max-width: 720px) 92vw, 40vw"
          width="1500"
          height="2000"
          loading="lazy"
          alt="Biały samochód elektryczny podłączony do stacji ładowania"
        />
        <div className="employer-caption">
          <span>BENEFIT, KTÓRY WYCHODZI POZA BIURO</span>
          <p>
            Dla ludzi.<br />
            Na co dzień.
          </p>
        </div>
      </div>
    </section>
  );
};
