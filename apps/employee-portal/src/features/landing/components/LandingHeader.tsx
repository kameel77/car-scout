import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useBrandConfig } from '../../../config/BrandContext';
import { trackEvent } from '../../analytics/analytics';

export interface LandingHeaderProps {
  onOpenEmployeeDialog?: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = () => {
  const { user, logout } = useAuth();
  const { config } = useBrandConfig();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isDlaFirmPage = location.pathname === '/dla-firm';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLoginClick = () => {
    trackEvent('click_login_menu', { from: location.pathname }, config.apiUrl, config.analyticsEnabled);
  };

  return (
    <header className="site-header wrap">
      <Link to="/" className="brand" aria-label="Benefivo - strona główna">
        <img
          className="brand-logo"
          src="/static/logo-dark.svg"
          alt="benefivo"
          width="182"
          height="37"
        />
      </Link>

      <button
        className="menu-button"
        type="button"
        aria-label={menuOpen ? 'Zamknij menu' : 'Otwórz menu nawigacji'}
        aria-controls="landing-navigation"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? (
          <X className="h-5 w-5 text-ink" aria-hidden="true" />
        ) : (
          <div className="w-5 h-3.5 flex flex-col justify-between items-center" aria-hidden="true">
            <span className="w-full h-0.5 bg-ink rounded-full" />
            <span className="w-full h-0.5 bg-ink rounded-full" />
            <span className="w-full h-0.5 bg-ink rounded-full" />
          </div>
        )}
      </button>

      <nav
        id="landing-navigation"
        className={`navigation ${menuOpen ? 'is-open' : ''}`}
        aria-label="Główna nawigacja"
      >
        {isDlaFirmPage ? (
          <>
            <a href="#korzysci" onClick={() => setMenuOpen(false)}>Korzyści</a>
            <a href="#wdrozenie" onClick={() => setMenuOpen(false)}>Jak wdrażamy</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          </>
        ) : (
          <>
            <a href="/#oferta" onClick={() => setMenuOpen(false)}>Samochody</a>
            <a href="/#benefity" onClick={() => setMenuOpen(false)}>Benefity</a>
            <a href="/#jak-to-dziala" onClick={() => setMenuOpen(false)}>Jak to działa</a>
          </>
        )}

        {!isDlaFirmPage ? (
          <Link to="/dla-firm" className="nav-company" onClick={() => setMenuOpen(false)}>
            Dla pracodawcy
          </Link>
        ) : (
          <Link to="/" className="nav-company" onClick={() => setMenuOpen(false)}>
            Dla pracownika <span aria-hidden="true">&rarr;</span>
          </Link>
        )}

        {isDlaFirmPage && (
          <a
            href="#kontakt-b2b"
            className="nav-login"
            onClick={() => {
              setMenuOpen(false);
              trackEvent('b2b_nav_cta', {}, config.apiUrl, config.analyticsEnabled);
            }}
          >
            Umów rozmowę
          </a>
        )}

        {/* Opcja logowania do konta w menu */}
        {user ? (
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="nav-login"
              onClick={() => {
                setMenuOpen(false);
                handleLoginClick();
              }}
            >
              Pulpit ({user.firstName})
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="text-xs text-stone-500 hover:text-stone-800 p-2"
              title="Wyloguj się"
            >
              Wyloguj
            </button>
          </div>
        ) : (
          <Link
            to="/logowanie"
            className="nav-login"
            onClick={() => {
              setMenuOpen(false);
              handleLoginClick();
            }}
          >
            Zaloguj się &rarr;
          </Link>
        )}
      </nav>
    </header>
  );
};
