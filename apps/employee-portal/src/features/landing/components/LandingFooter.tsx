import React from 'react';
import { Link } from 'react-router-dom';

export interface LandingFooterProps {
  onOpenAbout?: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onOpenAbout }) => {
  return (
    <footer className="site-footer wrap">
      <div>
        <Link to="/" className="brand" aria-label="Benefivo - strona główna">
          <img
            className="brand-logo"
            src="/static/logo-dark.svg"
            alt="benefivo"
            width="156"
            height="32"
          />
        </Link>
        <p>Dobre rzeczy jadą z Tobą.</p>
      </div>

      <div className="footer-right">
        <span className="powered">
          Powered by{' '}
          <a href="https://motolia.pl/" target="_blank" rel="noopener noreferrer">
            motolia.
          </a>
        </span>
        <div>
          <Link to="/dla-firm">Dla firm</Link>
          <Link to="/regulamin">Regulamin</Link>
          <Link to="/prywatnosc">Polityka prywatności</Link>
          <button
            className="plain-button"
            type="button"
            onClick={onOpenAbout}
          >
            O programie
          </button>
        </div>
      </div>
    </footer>
  );
};
