import React from 'react';
import { Link } from 'react-router-dom';

export const PortalFooter: React.FC = () => {
  return (
    <footer className="border-t border-line bg-white mt-auto py-5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-2">
          <span>&copy; {new Date().getFullYear()} Benefivo. Wszelkie prawa zastrzeżone.</span>
          <span className="hidden sm:inline text-line">|</span>
          <span>
            Powered by{' '}
            <a
              href="https://motolia.pl/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink font-medium hover:underline"
            >
              motolia.
            </a>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/regulamin" className="hover:text-ink transition-colors">
            Regulamin
          </Link>
          <Link to="/prywatnosc" className="hover:text-ink transition-colors">
            Polityka prywatności
          </Link>
        </div>
      </div>
    </footer>
  );
};
