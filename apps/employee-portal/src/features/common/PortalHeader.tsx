import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserCircle2, Building2, LogOut } from 'lucide-react';
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

  const pathname = location.pathname;
  const isKatalogActive = pathname.startsWith('/katalog');
  const isNajemActive = pathname.startsWith('/najem');
  const isZapytaniaActive = pathname.startsWith('/zapytania');

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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/katalog" className="flex items-center gap-3">
            {config.brandLogoUrl && !logoError ? (
              <img
                src={config.brandLogoUrl}
                alt={config.brandName}
                onError={() => setLogoError(true)}
                className="h-8 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                {config.brandName.charAt(0) || 'P'}
              </div>
            )}
            <span className="font-semibold text-gray-900 hidden sm:inline">{config.brandName}</span>
          </Link>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-2">
            <Link
              to="/katalog"
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
                isKatalogActive
                  ? 'font-semibold bg-primary-50 text-primary-700'
                  : 'font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Katalog ofert
            </Link>
            <Link
              to="/najem"
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
                isNajemActive
                  ? 'font-semibold bg-primary-50 text-primary-700'
                  : 'font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Najem długoterminowy
            </Link>
            <Link
              to="/zapytania"
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
                isZapytaniaActive
                  ? 'font-semibold bg-primary-50 text-primary-700'
                  : 'font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Moje zapytania
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 py-1.5 px-3 rounded-lg">
              <UserCircle2 className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900">
                {user.firstName} {user.lastName}
              </span>
              <span className="hidden md:inline text-gray-300">|</span>
              <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-600">
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium text-gray-800">{user.company?.name || 'Firma'}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 shadow-xs text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors cursor-pointer"
            aria-label="Wyloguj"
          >
            <LogOut className="h-4 w-4 text-gray-500" />
            <span className="hidden sm:inline">Wyloguj</span>
          </button>
        </div>
      </div>
    </header>
  );
};
