import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export interface HeroSectionProps {
  onOpenEmployeeDialog: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenEmployeeDialog }) => {
  const { isAuthenticated } = useAuth();

  return (
    <section className="hero wrap" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="status-dot"></span> TWÓJ BENEFIT. TWOJE AUTO.
        </p>
        <h1 id="hero-title">
          Dobre rzeczy<br />
          jadą{' '}
          <span className="accent-word">
            z Tobą.
            <svg viewBox="0 0 340 20" aria-hidden="true">
              <path d="M5 13C96 0 210 4 334 10" />
            </svg>
          </span>
        </h1>
        <p className="hero-description">
          Najem i leasing auta na warunkach dla pracowników. Do tego korzyści, które zostają z Tobą na każdej trasie.
        </p>

        <div className="hero-actions">
          {isAuthenticated ? (
            <Link className="button button-lime" to="/katalog">
              Przejdź do katalogu <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : (
            <>
              <Link className="button button-lime" to="/rejestracja">
                Mam kod firmy - aktywuj dostęp <span aria-hidden="true">&rarr;</span>
              </Link>
              <button
                className="button button-outline"
                type="button"
                onClick={onOpenEmployeeDialog}
              >
                Mojej firmy nie ma w programie <span aria-hidden="true">&rarr;</span>
              </button>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm text-stone-600">
          <Link
            to="/dla-firm"
            className="hover:text-stone-900 inline-flex items-center gap-1 transition-colors"
          >
            Jesteś pracodawcą? Przejdź do oferty dla firm <span aria-hidden="true">&rarr;</span>
          </Link>
          {!isAuthenticated && (
            <Link
              to="/logowanie"
              className="hover:text-stone-900 inline-flex items-center gap-1 transition-colors"
            >
              Masz już konto? Zaloguj się <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
        </div>

        <div className="endorsement">
          <span className="endorsement-line"></span>
          <div>
            Twój kierunek. Nasze doświadczenie.
            <br />
            <span className="powered">
              Powered by{' '}
              <a href="https://motolia.pl/" target="_blank" rel="noopener noreferrer">
                motolia<span aria-hidden="true">.</span>
              </a>
            </span>
          </div>
        </div>
      </div>

      <div className="hero-collage">
        <figure className="hero-photo photo-tile">
          <img
            src="/static/friends.webp"
            srcSet="/static/friends-small.webp 760w, /static/friends.webp 1500w"
            sizes="(max-width: 720px) 92vw, 48vw"
            width="1500"
            height="989"
            {...({ fetchpriority: 'high' } as any)}
            alt="Uśmiechnięte przyjaciółki podczas wspólnej podróży samochodem"
          />
          <span className="photo-label">Mniej rutyny. Więcej drogi.</span>
          <span className="round-arrow" aria-hidden="true">
            ↗
          </span>
        </figure>

        <div className="collage-bottom">
          <a className="benefit-tile" href="#benefity">
            <span className="eyebrow">NIE TYLKO SAMOCHÓD</span>
            <h2>
              Dobry pakiet<br />na drogę.
            </h2>
            <div className="tile-foot">
              <span>Paliwo. Serwis. I więcej.</span>
              <span aria-hidden="true">↗</span>
            </div>
            <svg className="tile-flower" viewBox="0 0 120 120" aria-hidden="true">
              <path d="M60 5v110M5 60h110M21 21l78 78M21 99l78-78" />
            </svg>
          </a>

          <figure className="driver-tile photo-tile">
            <img
              src="/static/driver-small.webp"
              width="760"
              height="507"
              loading="lazy"
              alt="Uśmiechnięta kobieta za kierownicą nowoczesnego samochodu"
            />
            <figcaption>
              Po swojemu.<br />Także po pracy.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
};
