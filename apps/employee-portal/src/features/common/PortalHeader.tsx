import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserCircle2, Building2, LogOut, ChevronDown, KeyRound, Settings } from 'lucide-react';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';

export interface PortalHeaderProps {
  onLogout?: () => void;
  isLoggingOut?: boolean;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({ onLogout, isLoggingOut = false }) => {
  const { config } = useBrandConfig();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [logoError, setLogoError] = useState(false);
  const [internalLoggingOut, setInternalLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const pathname = location.pathname;
  const isKatalogActive = pathname.startsWith('/katalog');
  const isNajemActive = pathname.startsWith('/najem');
  const isZapytaniaActive = pathname.startsWith('/zapytania');

  // Close menu on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    setInternalLoggingOut(true);
    try {
      await logout();
    } finally {
      setInternalLoggingOut(false);
    }
  };

  const loggingOut = isLoggingOut || internalLoggingOut;

  return (
    <header className="bg-white border-b border-line sticky top-0 z-20 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/katalog" className="flex items-center">
            {config.brandLogoUrl && !logoError ? (
              <img
                src={config.brandLogoUrl}
                alt={config.brandName}
                onError={() => setLogoError(true)}
                className="h-8 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <span className="font-heading font-extrabold text-xl text-ink tracking-tight lowercase">
                benefivo
              </span>
            )}
          </Link>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-2">
            <Link
              to="/katalog"
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                isKatalogActive
                  ? 'font-semibold bg-lime text-ink'
                  : 'font-medium text-muted hover:text-ink hover:bg-paper'
              }`}
            >
              Samochody
            </Link>
            <Link
              to="/najem"
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                isNajemActive
                  ? 'font-semibold bg-lime text-ink'
                  : 'font-medium text-muted hover:text-ink hover:bg-paper'
              }`}
            >
              Najem długoterminowy
            </Link>
            <Link
              to="/zapytania"
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                isZapytaniaActive
                  ? 'font-semibold bg-lime text-ink'
                  : 'font-medium text-muted hover:text-ink hover:bg-paper'
              }`}
            >
              Moje zapytania
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Menu użytkownika: ${user.firstName} ${user.lastName}`}
                className="flex items-center gap-2 text-sm text-ink bg-paper border border-line py-1.5 px-3.5 rounded-full hover:bg-paper/80 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink"
              >
                <UserCircle2 className="h-4 w-4 text-muted" />
                <span className="font-medium text-ink">
                  {user.firstName} {user.lastName}
                </span>
                <span className="hidden md:inline text-line">|</span>
                <div className="hidden md:flex items-center gap-1.5 text-xs text-muted">
                  <Building2 className="h-3.5 w-3.5 text-muted" />
                  <span className="font-medium text-ink">{user.company?.name || 'Firma'}</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-line shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  <div className="px-4 py-2 border-b border-line md:hidden">
                    <p className="text-[11px] text-muted uppercase tracking-wider font-bold">Firma</p>
                    <p className="text-xs font-semibold text-ink">{user.company?.name || 'Firma'}</p>
                  </div>

                  <Link
                    to="/konto"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-ink hover:bg-paper transition-colors font-medium min-h-[44px]"
                  >
                    <Settings className="h-4 w-4 text-muted" />
                    <span>Moje dane</span>
                  </Link>

                  <Link
                    to="/konto#haslo"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-ink hover:bg-paper transition-colors font-medium min-h-[44px]"
                  >
                    <KeyRound className="h-4 w-4 text-muted" />
                    <span>Zmiana hasła</span>
                  </Link>

                  <div className="border-t border-line my-1" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    disabled={loggingOut}
                    className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-700 hover:bg-red-50 transition-colors font-medium min-h-[44px] cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 text-red-600" />
                    <span>Wyloguj</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-line shadow-xs text-sm font-medium rounded-full text-muted bg-white hover:text-ink hover:bg-paper focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink disabled:opacity-50 transition-colors cursor-pointer"
            aria-label="Wyloguj"
          >
            <LogOut className="h-4 w-4 text-muted" />
            <span className="hidden sm:inline">Wyloguj</span>
          </button>
        </div>
      </div>
    </header>
  );
};
