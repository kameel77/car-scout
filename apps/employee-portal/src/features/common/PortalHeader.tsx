import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  UserCircle2,
  Building2,
  LogOut,
  ChevronDown,
  KeyRound,
  Settings,
  FileText,
  LayoutDashboard,
  Car,
  CalendarDays,
  X
} from 'lucide-react';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';

export interface PortalHeaderProps {
  onLogout?: () => void;
  isLoggingOut?: boolean;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({ onLogout, isLoggingOut = false }) => {
  const { config } = useBrandConfig();
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [logoError, setLogoError] = useState(false);
  const [internalLoggingOut, setInternalLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const pathname = location.pathname;
  const isKatalogActive = pathname.startsWith('/katalog');
  const isNajemActive = pathname.startsWith('/najem');
  const isDashboardActive = pathname === '/dashboard';
  const isZapytaniaActive = pathname.startsWith('/zapytania');
  const isKontoActive = pathname.startsWith('/konto');

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close desktop menu on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };

    if (menuOpen || mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, mobileMenuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
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
    <header className="bg-white border-b border-line sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand logo + Desktop navigation tabs */}
        <div className="flex items-center gap-6">
          <Link
            to={isAuthenticated || isLoading ? '/dashboard' : '/'}
            className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-forest rounded-lg"
          >
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

          {/* Desktop Navigation Tabs (Hidden on mobile) */}
          <nav className="hidden md:flex items-center gap-2">
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
          </nav>
        </div>

        {/* Right Desktop: User Dropdown + Desktop Logout */}
        <div className="hidden md:flex items-center gap-3">
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
                <span className="inline text-line">|</span>
                <div className="flex items-center gap-1.5 text-xs text-muted">
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
                  <Link
                    to="/dashboard"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-ink hover:bg-paper transition-colors font-medium min-h-[44px]"
                  >
                    <LayoutDashboard className="h-4 w-4 text-muted" />
                    <span>Pulpit programu</span>
                  </Link>

                  <Link
                    to="/zapytania"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-ink hover:bg-paper transition-colors font-medium min-h-[44px]"
                  >
                    <FileText className="h-4 w-4 text-muted" />
                    <span>Moje zapytania</span>
                  </Link>

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
                    onClick={handleLogout}
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
            <span>Wyloguj</span>
          </button>
        </div>

        {/* Right Mobile: Branded 3-line Hamburger Menu Button */}
        <div className="flex md:hidden items-center">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Zamknij menu' : 'Otwórz menu nawigacji'}
            aria-expanded={mobileMenuOpen}
            className="p-2.5 rounded-xl border border-line bg-paper/60 hover:bg-paper text-ink transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-forest cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-ink" />
            ) : (
              <div className="w-5 h-3.5 flex flex-col justify-between items-center" aria-hidden="true">
                <span className="w-full h-0.5 bg-ink rounded-full" />
                <span className="w-full h-0.5 bg-ink rounded-full" />
                <span className="w-full h-0.5 bg-ink rounded-full" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-line bg-white px-4 py-5 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* User profile card */}
          {user && (
            <div className="p-3.5 bg-paper rounded-2xl border border-line flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-forest text-lime flex items-center justify-center font-bold text-xs">
                  {user.firstName ? user.firstName[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="font-bold text-sm text-ink font-heading">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                    <Building2 className="h-3 w-3" />
                    <span>{user.company?.name || 'Firma'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1">
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isDashboardActive
                  ? 'bg-lime text-ink'
                  : 'text-ink hover:bg-paper'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-forest" />
              <span>Pulpit programu</span>
            </Link>

            <Link
              to="/katalog"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isKatalogActive
                  ? 'bg-lime text-ink'
                  : 'text-ink hover:bg-paper'
              }`}
            >
              <Car className="h-4 w-4 text-forest" />
              <span>Samochody</span>
            </Link>

            <Link
              to="/najem"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isNajemActive
                  ? 'bg-lime text-ink'
                  : 'text-ink hover:bg-paper'
              }`}
            >
              <CalendarDays className="h-4 w-4 text-forest" />
              <span>Najem długoterminowy</span>
            </Link>

            <Link
              to="/zapytania"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isZapytaniaActive
                  ? 'bg-lime text-ink'
                  : 'text-ink hover:bg-paper'
              }`}
            >
              <FileText className="h-4 w-4 text-forest" />
              <span>Moje zapytania</span>
            </Link>

            <Link
              to="/konto"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isKontoActive
                  ? 'bg-lime text-ink'
                  : 'text-ink hover:bg-paper'
              }`}
            >
              <Settings className="h-4 w-4 text-forest" />
              <span>Moje dane i konto</span>
            </Link>
          </nav>

          <div className="pt-2 border-t border-line">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-red-200 bg-red-50 text-red-700 font-semibold text-sm hover:bg-red-100 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Wyloguj się</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
