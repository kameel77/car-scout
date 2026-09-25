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
          <p className="eyebrow">DWIE DROGI DO AUTA</p>
          <h2 id="offer-title">Najem czy finansowanie?</h2>
        </div>
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
              <h3>Jedna rata, wszystko w cenie</h3>
              <p>
                Nowe auto na ustalony okres ze stałą ratą. Ubezpieczenie, serwis i assistance masz w racie.
              </p>
              <p className="font-heading text-xl font-bold mt-2">od 1 281 zł brutto/mies.</p>
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
            <span className="image-chip">NOWE AUTO W FINANSOWANIU</span>
          </div>
          <div className="offer-body">
            <div>
              <h3>Rabat od ceny katalogowej</h3>
              <p>
                Kredyt lub leasing, prywatnie albo na działalność. Przy każdej ofercie widzisz cenę katalogową i swoją cenę. Auto zostaje u Ciebie.
              </p>
              <p className="font-heading text-xl font-bold mt-2">np. Tucson N Line 62 062 zł taniej</p>
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
