import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
        aria-controls="landing-navigation"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        Menu <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
      </button>

      <nav
        id="landing-navigation"
        className={`navigation ${menuOpen ? 'is-open' : ''}`}
        aria-label="Główna nawigacja"
      >
        <a href="/#oferta" onClick={() => setMenuOpen(false)}>Samochody</a>
        <a href="/#benefity" onClick={() => setMenuOpen(false)}>Benefity</a>
        <a href="/#jak-to-dziala" onClick={() => setMenuOpen(false)}>Jak to działa</a>

        {!isDlaFirmPage ? (
          <Link to="/dla-firm" className="nav-company" onClick={() => setMenuOpen(false)}>
            Dla pracodawcy <span aria-hidden="true">↗</span>
          </Link>
        ) : (
          <Link to="/" className="nav-company" onClick={() => setMenuOpen(false)}>
            Dla pracownika <span aria-hidden="true">&rarr;</span>
          </Link>
        )}

        {/* Opcja logowania do konta w menu */}
        {user ? (
          <div className="flex items-center gap-2">
            <Link
              to="/katalog"
              className="nav-login"
              onClick={() => {
                setMenuOpen(false);
                handleLoginClick();
              }}
            >
              Samochody ({user.firstName})
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
