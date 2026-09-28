import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTrack } from '../../analytics/useTrack';
import { PriceDropCard } from './PriceDropCard';

export interface HeroSectionProps {
  onOpenEmployeeDialog: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenEmployeeDialog }) => {
  const { isAuthenticated } = useAuth();
  const track = useTrack();

  return (
    <section className="hero wrap" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="status-dot"></span> PROGRAM PRACOWNICZY · DOBRE RZECZY JADĄ Z TOBĄ.
        </p>
        <h1 id="hero-title">Nowe auto na warunkach dla pracowników Twojej firmy.</h1>
        <p className="hero-description">
          Nowe auto w najmie lub w finansowaniu, z rabatem od ceny katalogowej. W najmie ubezpieczenie i serwis są w racie. Do każdego auta karta Moya z 500 zł na paliwo i zakupy oraz osobisty doradca.
        </p>

        <div className="hero-actions">
          {isAuthenticated ? (
            <Link className="button button-lime" to="/dashboard">
              Przejdź do ofert <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : (
            <>
              <Link
                className="button button-lime"
                to="/rejestracja"
                onClick={() => track('cta_activate_code', { from: 'hero' })}
              >
                Mam kod firmy <span aria-hidden="true">&rarr;</span>
              </Link>
              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  track('cta_no_benefivo_hr', { from: 'hero' });
                  onOpenEmployeeDialog();
                }}
              >
                Moja firma nie ma Benefivo
              </button>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm text-stone-600">
          <Link
            to="/dla-firm"
            className="hover:text-stone-900 inline-flex items-center gap-1 transition-colors"
          >
            Odpowiadasz za benefity? Oferta dla firm <span aria-hidden="true">&rarr;</span>
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
      </div>

      <PriceDropCard />
    </section>
  );
};
