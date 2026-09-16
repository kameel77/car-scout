import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';
import {
  Car,
  Fuel,
  LogOut,
  Building2,
  UserCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowRight,
  Gauge,
  Calendar,
  Layers
} from 'lucide-react';
import { fetchEmployeeRentalOffers, EmployeeRentalOfferSummary } from './rental-api';

function formatFuelType(fuelType: string | null): string {
  if (!fuelType) return 'Brak danych';
  switch (fuelType.toUpperCase()) {
    case 'HYBRID':
      return 'Hybryda';
    case 'MILD_HYBRID':
      return 'Mild Hybrid';
    case 'PLUG_IN_HYBRID':
      return 'Plug-in Hybrid';
    case 'PETROL':
    case 'BENZYNA':
      return 'Benzyna';
    case 'DIESEL':
      return 'Diesel';
    case 'ELECTRIC':
      return 'Elektryczny';
    case 'LPG':
      return 'LPG';
    default:
      return fuelType;
  }
}

export const RentalCatalogPage: React.FC = () => {
  const { config, isLoading: isBrandLoading } = useBrandConfig();
  const { user, isLoading: isAuthLoading, logout, sessionError } = useAuth();
  const navigate = useNavigate();
  const [logoError, setLogoError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Rental State
  const [offers, setOffers] = useState<EmployeeRentalOfferSummary[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState<boolean>(true);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadOffers = useCallback(async (searchQuery?: string, signal?: AbortSignal) => {
    setIsLoadingOffers(true);
    setOffersError(null);
    try {
      const res = await fetchEmployeeRentalOffers(
        config.apiUrl || '/api',
        { search: searchQuery?.trim() || undefined },
        signal
      );
      setOffers(res.offers || []);
    } catch (err: unknown) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : 'Nie udało się pobrać listy ofert najmu';
      setOffersError(msg);
    } finally {
      if (!signal?.aborted) {
        setIsLoadingOffers(false);
      }
    }
  }, [config.apiUrl]);

  useEffect(() => {
    const controller = new AbortController();
    loadOffers(searchTerm, controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadOffers, searchTerm]);

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
                className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Katalog ofert
              </Link>
              <Link
                to="/najem"
                className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-indigo-50 text-indigo-700 transition-colors"
              >
                Najem długoterminowy
              </Link>
              <Link
                to="/zapytania"
                className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
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
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium text-[11px] border border-indigo-200">
                    {user.program?.name || 'Program partnerski'}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 shadow-xs text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
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
              <span>{activeError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setLogoutError(null);
                navigate('/logowanie');
              }}
              className="text-xs font-semibold text-red-900 underline hover:text-red-700"
            >
              Zaloguj ponownie
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header & Search */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
              <Layers className="h-6 w-6 text-indigo-600" />
              Najem długoterminowy
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Nowe samochody w stałym abonamencie z pełnym pakietem serwisowym i ubezpieczeniem.
            </p>
          </div>

          <div className="relative max-w-md w-full">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Szukaj po marce lub modelu..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs"
            />
          </div>
        </div>

        {/* 1. Loading Skeleton */}
        {isLoadingOffers ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="rental-skeleton">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs animate-pulse flex flex-col justify-between"
              >
                <div className="h-48 bg-gray-200" />
                <div className="p-5 space-y-3 flex-1">
                  <div className="h-5 bg-gray-200 rounded-md w-3/4" />
                  <div className="h-4 bg-gray-200 rounded-md w-1/2" />
                  <div className="h-6 bg-gray-200 rounded-md w-1/3 pt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : offersError ? (
          /* 2. Error State */
          <div
            role="alert"
            className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-xs my-10"
          >
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Nie udało się pobrać ofert najmu</h3>
            <p className="text-sm text-gray-600 mt-2 mb-6">{offersError}</p>
            <button
              type="button"
              onClick={() => loadOffers(searchTerm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs"
            >
              <RefreshCw className="h-4 w-4" />
              Spróbuj ponownie
            </button>
          </div>
        ) : offers.length === 0 ? (
          /* 3. Empty State */
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs my-10">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Car className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Brak dostępnych ofert najmu</h3>
            <p className="text-sm text-gray-500 mt-2 mb-6">
              {searchTerm
                ? 'Żadna oferta nie pasuje do wyszukiwanej frazy. Spróbuj zmienić kryteria wyszukiwania.'
                : 'W Twoim programie partnerskim nie skonfigurowano jeszcze ofert najmu długoterminowego.'}
            </p>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Wyczyść wyszukiwanie
              </button>
            )}
          </div>
        ) : (
          /* 4. Offers Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {offers.map((offer) => {
              const primaryImg =
                offer.vehicle.primaryImageUrl ||
                (offer.vehicle.imageUrls && offer.vehicle.imageUrls[0]);

              return (
                <div
                  key={offer.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    {/* Vehicle Photo Container */}
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      {primaryImg ? (
                        <img
                          src={primaryImg}
                          alt={`${offer.vehicle.make} ${offer.vehicle.model}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Car className="h-16 w-16" />
                        </div>
                      )}

                      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                        {offer.rateSource === 'PARTNER_MATRIX' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white shadow-xs">
                            Stawka partnerska
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800/80 text-white shadow-xs backdrop-blur-xs">
                            Stawka katalogowa
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded backdrop-blur-xs">
                        Dostawca: {offer.rentalCompany.name}
                      </div>
                    </div>

                    {/* Vehicle Specs and Pricing */}
                    <div className="p-5 space-y-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 leading-snug">
                          {offer.vehicle.make} {offer.vehicle.model}
                        </h3>
                        {offer.vehicle.version && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                            {offer.vehicle.version}
                          </p>
                        )}
                      </div>

                      {/* Specs Tags */}
                      <div className="flex flex-wrap gap-2 text-xs text-gray-600 pt-1 border-t border-gray-100">
                        <span className="inline-flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          {offer.vehicle.productionYear}
                        </span>
                        {offer.vehicle.fuelType && (
                          <span className="inline-flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                            <Fuel className="h-3 w-3 text-gray-400" />
                            {formatFuelType(offer.vehicle.fuelType)}
                          </span>
                        )}
                        {offer.vehicle.transmission && (
                          <span className="inline-flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                            <Gauge className="h-3 w-3 text-gray-400" />
                            {offer.vehicle.transmission}
                          </span>
                        )}
                      </div>

                      {/* Monthly Rate Range */}
                      <div className="pt-2 border-t border-gray-100 flex items-baseline justify-between">
                        <div>
                          <div className="text-2xs uppercase tracking-wider text-gray-400 font-semibold">
                            Rata abonamentu
                          </div>
                          <div className="text-lg font-bold text-indigo-700 tracking-tight">
                            od {offer.minMonthlyRateNet.toLocaleString('pl-PL')} zł{' '}
                            <span className="text-xs font-normal text-gray-500">netto / mc</span>
                          </div>
                          <div className="text-[11px] text-gray-400">
                            od {offer.minMonthlyRateGross.toLocaleString('pl-PL')} zł brutto
                          </div>
                        </div>
                        <div className="text-2xs text-gray-400">
                          {offer.optionsCount} wariantów
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 bg-gray-50/70 border-t border-gray-100">
                    <Link
                      to={`/najem/${offer.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-xs"
                    >
                      Konfiguruj ratę i zapytaj
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
