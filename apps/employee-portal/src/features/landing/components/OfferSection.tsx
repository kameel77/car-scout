import React from 'react';

export interface OfferSectionProps {
  onOpenRental: () => void;
  onOpenLeasing: () => void;
}

export const OfferSection: React.FC<OfferSectionProps> = ({ onOpenRental, onOpenLeasing }) => {
  return (
    <section id="oferta" className="section wrap" aria-labelledby="offer-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AUTO DO TWOJEGO ŻYCIA</p>
          <h2 id="offer-title">Dokąd teraz?</h2>
        </div>
        <p>
          Do pracy, po dzieci, przed siebie.
          <br />
          Wybierz sposób na swoje auto.
        </p>
      </div>

      <div className="offer-grid">
        <article className="offer-card">
          <div className="offer-image">
            <img
              src="/static/driver.webp"
              srcSet="/static/driver-small.webp 760w, /static/driver.webp 1500w"
              sizes="(max-width: 720px) 92vw, 46vw"
              width="1500"
              height="1000"
              loading="lazy"
              alt="Kobieta z uśmiechem ogląda wnętrze samochodu"
            />
            <span className="image-chip">NAJEM DŁUGOTERMINOWY</span>
          </div>
          <div className="offer-body">
            <div>
              <h3>Nowe auto. Twój rytm.</h3>
              <p>
                Użytkujesz samochód przez ustalony czas.
                <br />
                Dobierasz przebieg i zakres usług.
              </p>
            </div>
            <button
              className="circle-button"
              type="button"
              onClick={onOpenRental}
              aria-label="Poznaj najem długoterminowy"
            >
              ↗
            </button>
          </div>
        </article>

        <article className="offer-card">
          <div className="offer-image">
            <img
              src="/static/weekend.webp"
              srcSet="/static/weekend-small.webp 507w, /static/weekend.webp 1500w"
              sizes="(max-width: 720px) 92vw, 46vw"
              width="1500"
              height="2250"
              loading="lazy"
              alt="Uśmiechnięta para w samochodzie podczas weekendowej wycieczki"
            />
            <span className="image-chip">LEASING SAMOCHODÓW</span>
          </div>
          <div className="offer-body">
            <div>
              <h3>Więcej własnych planów.</h3>
              <p>
                Finansujesz wybrane auto z opcją wykupu.
                <br />
                Warunki dopasowujemy do Twojej sytuacji.
              </p>
            </div>
            <button
              className="circle-button"
              type="button"
              onClick={onOpenLeasing}
              aria-label="Poznaj leasing samochodów"
            >
              ↗
            </button>
          </div>
        </article>
      </div>

      <p className="fine-print">
        Zdjęcia są ilustracyjne. Dostępność aut, finansowania i warunki zależą od oferty oraz programu Twojej firmy.
      </p>
    </section>
  );
};
