import React, { useState } from 'react';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';
import { Car, Fuel, Shield, Award, LogOut, Building2, UserCircle2, Sparkles, AlertCircle, X } from 'lucide-react';

export const CatalogPage: React.FC = () => {
  const { config, isLoading: isBrandLoading } = useBrandConfig();
  const { user, isLoading: isAuthLoading, logout, sessionError } = useAuth();
  const [logoError, setLogoError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLogoutError(err.message);
      } else {
        setLogoutError('Wystąpił błąd podczas wylogowywania');
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isBrandLoading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-gray-500 text-sm">Ładowanie portalu...</div>
        </div>
      </div>
    );
  }

  const activeError = logoutError || sessionError;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
                  <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 font-medium text-[11px] border border-primary-200">
                    {user.program?.name || 'Program partnerski'}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 shadow-xs text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
              aria-label="Wyloguj"
            >
              <LogOut className="h-4 w-4 text-gray-500" />
              <span className="hidden sm:inline">Wyloguj</span>
            </button>
          </div>
        </div>
      </header>

      {/* Logout / Session Error Alert */}
      {activeError && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-200 px-4 py-3 text-sm text-red-800 flex items-center justify-between shadow-xs"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <span className="font-medium">{activeError}</span>
            </div>
            {logoutError && (
              <button
                type="button"
                onClick={() => setLogoutError(null)}
                className="text-red-500 hover:text-red-700 p-1 rounded-md"
                aria-label="Zamknij powiadomienie"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Program Subheader (Mobile only) */}
      {user && (
        <div className="md:hidden bg-primary-50/60 border-b border-primary-100 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 text-gray-700">
          <div className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5 text-primary-700" />
            <span>Firma: <strong>{user.company?.name}</strong></span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-white text-primary-800 font-medium border border-primary-200 text-[11px]">
            {user.program?.name}
          </span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-white border-b border-gray-100 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-medium mb-3">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            Program aktywny dla organizacji {user?.company?.name || ''}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Dedykowana oferta samochodów dla pracowników
          </h1>
          <p className="mt-2 text-base text-gray-600 max-w-3xl leading-relaxed">
            Nowe samochody w najmie długoterminowym oraz leasingu na preferencyjnych warunkach partnerskich z pakietem benefitów pracowniczych.
          </p>

          <div className="mt-8">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Pakiet benefitów w programie {user?.program?.name || 'partnerskim'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-xs">
                <Shield className="h-6 w-6 text-primary-600 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-gray-900">Specjalne warunki flotowe</div>
                  <div className="text-xs text-gray-500 mt-0.5">Dedykowane matryce i rabaty cenowe</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-xs">
                <Fuel className="h-6 w-6 text-primary-600 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-gray-900">Pakiet paliwowy Moya</div>
                  <div className="text-xs text-gray-500 mt-0.5">Karta z zasileniem i rabat na stacjach</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-xs">
                <Award className="h-6 w-6 text-primary-600 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-gray-900">Opieka doradcy Motolii</div>
                  <div className="text-xs text-gray-500 mt-0.5">Indywidualny kontakt i wsparcie formalności</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Honest Catalog Placeholder behind Authentication */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-xs">
          <div className="mx-auto h-16 w-16 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mb-4">
            <Car className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Katalog pojazdów w przygotowaniu
          </h2>
          <p className="mt-2 text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
            Trwa integracja ofert dedykowanych dla Twojej firmy. Już wkrótce w tym miejscu pojawią się zweryfikowane modele samochodów wraz z kalkulatorem raty pracowniczej i bezpośrednim procesem zamówienia.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 text-xs rounded-lg border border-gray-200 font-mono">
            Status konta: Zweryfikowany pracownik ({user?.email})
          </div>
        </div>
      </main>
    </div>
  );
};
