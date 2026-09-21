import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';
import {
  Car,
  Fuel,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowRight,
  Gauge,
  Calendar,
  Layers,
  X,
  SlidersHorizontal,
  Briefcase
} from 'lucide-react';
import { fetchEmployeeRentalOffers, EmployeeRentalOfferSummary } from './rental-api';
import { PortalHeader } from '../common/PortalHeader';
import { ImageSwiper } from '../common/ImageSwiper';

function normalizeFuelType(val: string | null): { key: string; label: string } | null {
  if (!val) return null;
  const upper = val.toUpperCase().trim();
  switch (upper) {
    case 'PETROL':
    case 'BENZYNA':
      return { key: 'petrol', label: 'Benzyna' };
    case 'DIESEL':
      return { key: 'diesel', label: 'Diesel' };
    case 'HYBRID':
      return { key: 'hybrid', label: 'Hybryda' };
    case 'MILD_HYBRID':
      return { key: 'mild_hybrid', label: 'Mild Hybrid' };
    case 'PLUG_IN_HYBRID':
      return { key: 'plug_in_hybrid', label: 'Plug-in Hybrid' };
    case 'ELECTRIC':
    case 'ELEKTRYCZNY':
      return { key: 'electric', label: 'Elektryczny' };
    case 'LPG':
      return { key: 'lpg', label: 'LPG' };
    case 'CNG':
      return { key: 'cng', label: 'CNG' };
    default:
      return { key: val.toLowerCase(), label: val };
  }
}

function normalizeTransmission(val: string | null): { key: string; label: string } | null {
  if (!val) return null;
  const upper = val.toUpperCase().trim();
  switch (upper) {
    case 'AUTOMATIC':
    case 'AUTOMAT':
    case 'DSG':
    case 'E-CVT':
    case 'CVT':
      return { key: 'automatic', label: 'Automat' };
    case 'MANUAL':
    case 'MANUALNA':
      return { key: 'manual', label: 'Manualna' };
    default:
      return { key: val.toLowerCase(), label: val };
  }
}

function normalizeBodyType(val: string | null): { key: string; label: string } | null {
  if (!val) return null;
  const lower = val.toLowerCase().trim();
  switch (lower) {
    case 'suv':
      return { key: 'suv', label: 'SUV' };
    case 'sedan':
      return { key: 'sedan', label: 'Sedan' };
    case 'kombi':
    case 'estate':
      return { key: 'kombi', label: 'Kombi' };
    case 'hatchback':
      return { key: 'hatchback', label: 'Hatchback' };
    case 'coupe':
      return { key: 'coupe', label: 'Coupe' };
    case 'cabrio':
    case 'cabriolet':
    case 'convertible':
      return { key: 'cabrio', label: 'Kabriolet' };
    case 'minivan':
    case 'van':
      return { key: 'minivan', label: 'Minivan' };
    case 'liftback':
      return { key: 'liftback', label: 'Liftback' };
    default:
      return { key: lower, label: val.charAt(0).toUpperCase() + val.slice(1) };
  }
}

function formatFuelType(fuelType: string): string {
  return normalizeFuelType(fuelType)?.label || fuelType;
}

function formatTransmission(transmission: string): string {
  return normalizeTransmission(transmission)?.label || transmission;
}

export const RentalCatalogPage: React.FC = () => {
  const { config, isLoading: isBrandLoading } = useBrandConfig();
  const { isLoading: isAuthLoading, logout, sessionError } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Rental State
  const [offers, setOffers] = useState<EmployeeRentalOfferSummary[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState<boolean>(true);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filters State
  const [selectedMake, setSelectedMake] = useState<string>('');
  const [selectedFuel, setSelectedFuel] = useState<string>('');
  const [selectedTransmission, setSelectedTransmission] = useState<string>('');
  const [selectedBodyType, setSelectedBodyType] = useState<string>('');
  const [selectedB2bOnly, setSelectedB2bOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'default' | 'rate_asc' | 'rate_desc'>('default');

  const loadOffers = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingOffers(true);
    setOffersError(null);
    try {
      const res = await fetchEmployeeRentalOffers(
        config.apiUrl || '/api',
        {},
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
    loadOffers(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadOffers]);

  // Compute available facet options from loaded offers
  const availableMakes = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      if (o.vehicle.make) set.add(o.vehicle.make);
    });
    return Array.from(set).sort();
  }, [offers]);

  const availableFuels = useMemo(() => {
    const map = new Map<string, string>();
    offers.forEach((o) => {
      const norm = normalizeFuelType(o.vehicle.fuelType);
      if (norm) map.set(norm.key, norm.label);
    });
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pl'));
  }, [offers]);

  const availableTransmissions = useMemo(() => {
    const map = new Map<string, string>();
    offers.forEach((o) => {
      const norm = normalizeTransmission(o.vehicle.transmission);
      if (norm) map.set(norm.key, norm.label);
    });
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pl'));
  }, [offers]);

  const availableBodyTypes = useMemo(() => {
    const map = new Map<string, string>();
    offers.forEach((o) => {
      const norm = normalizeBodyType(o.vehicle.bodyType);
      if (norm) map.set(norm.key, norm.label);
    });
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pl'));
  }, [offers]);

  const filteredOffers = useMemo(() => {
    let result = [...offers];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.vehicle.make.toLowerCase().includes(q) ||
          o.vehicle.model.toLowerCase().includes(q) ||
          (o.vehicle.version && o.vehicle.version.toLowerCase().includes(q))
      );
    }

    if (selectedMake) {
      result = result.filter(
        (o) => o.vehicle.make.toLowerCase() === selectedMake.toLowerCase()
      );
    }

    if (selectedFuel) {
      result = result.filter(
        (o) => normalizeFuelType(o.vehicle.fuelType)?.key === selectedFuel
      );
    }

    if (selectedTransmission) {
      result = result.filter(
        (o) => normalizeTransmission(o.vehicle.transmission)?.key === selectedTransmission
      );
    }

    if (selectedBodyType) {
      result = result.filter(
        (o) => normalizeBodyType(o.vehicle.bodyType)?.key === selectedBodyType
      );
    }

    if (selectedB2bOnly) {
      result = result.filter((o) => Boolean(o.isB2b));
    }

    if (sortBy === 'rate_asc') {
      result.sort((a, b) => a.minMonthlyRateNet - b.minMonthlyRateNet);
    } else if (sortBy === 'rate_desc') {
      result.sort((a, b) => b.minMonthlyRateNet - a.minMonthlyRateNet);
    }

    return result;
  }, [offers, searchTerm, selectedMake, selectedFuel, selectedTransmission, selectedBodyType, selectedB2bOnly, sortBy]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    selectedMake ||
    selectedFuel ||
    selectedTransmission ||
    selectedBodyType ||
    selectedB2bOnly ||
    sortBy !== 'default'
  );

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedMake('');
    setSelectedFuel('');
    setSelectedTransmission('');
    setSelectedBodyType('');
    setSelectedB2bOnly(false);
    setSortBy('default');
  };

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
      <PortalHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />

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
              <Layers className="h-6 w-6 text-primary-600" />
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
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white shadow-xs"
            />
          </div>
        </div>

        {/* Filters Bar */}
        {!offersError && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <SlidersHorizontal className="h-4 w-4 text-primary-600" />
                <span>Filtry</span>
                <span className="text-xs font-normal text-gray-400">
                  (Dostępne oferty: <strong>{filteredOffers.length}</strong>)
                </span>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Wyczyść filtry
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {/* Marka */}
              <div>
                <label className="block text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Marka
                </label>
                <select
                  value={selectedMake}
                  onChange={(e) => setSelectedMake(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Wszystkie</option>
                  {availableMakes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Paliwo */}
              <div>
                <label className="block text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Paliwo
                </label>
                <select
                  value={selectedFuel}
                  onChange={(e) => setSelectedFuel(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Wszystkie</option>
                  {availableFuels.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skrzynia */}
              <div>
                <label className="block text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Skrzynia
                </label>
                <select
                  value={selectedTransmission}
                  onChange={(e) => setSelectedTransmission(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Wszystkie</option>
                  {availableTransmissions.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nadwozie */}
              <div>
                <label className="block text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Nadwozie
                </label>
                <select
                  value={selectedBodyType}
                  onChange={(e) => setSelectedBodyType(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Wszystkie</option>
                  {availableBodyTypes.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Oferta B2B toggle button */}
              <div>
                <label className="block text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Opcja B2B
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedB2bOnly(!selectedB2bOnly)}
                  className={`w-full text-xs py-2 px-2.5 rounded-xl border font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    selectedB2bOnly
                      ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>Tylko B2B</span>
                </button>
              </div>

              {/* Sortowanie */}
              <div>
                <label className="block text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Sortowanie
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'default' | 'rate_asc' | 'rate_desc')}
                  className="w-full text-xs py-2 px-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="default">Domyślne</option>
                  <option value="rate_asc">Rata: od najniższej</option>
                  <option value="rate_desc">Rata: od najwyższej</option>
                </select>
              </div>
            </div>
          </div>
        )}

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
              onClick={() => loadOffers()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs"
            >
              <RefreshCw className="h-4 w-4" />
              Spróbuj ponownie
            </button>
          </div>
        ) : filteredOffers.length === 0 ? (
          /* 3. Empty State */
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs my-10">
            <div className="w-14 h-14 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Car className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Brak dostępnych ofert najmu</h3>
            <p className="text-sm text-gray-500 mt-2 mb-6">
              {hasActiveFilters
                ? 'Żadna oferta nie pasuje do wybranych filtrów. Spróbuj zmienić lub zresetować kryteria.'
                : 'W Twoim programie partnerskim nie skonfigurowano jeszcze ofert najmu długoterminowego.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Wyczyść filtry
              </button>
            )}
          </div>
        ) : (
          /* 4. Offers Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOffers.map((offer) => {
              const rentalImages = Array.from(
                new Set([offer.vehicle.primaryImageUrl, ...(offer.vehicle.imageUrls || [])].filter(Boolean))
              ) as string[];

              return (
                <div
                  key={offer.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    {/* Vehicle Photo Container - Link to offer */}
                    <Link
                      to={`/najem/${offer.id}`}
                      className="relative h-48 bg-gray-100 overflow-hidden block group cursor-pointer"
                      aria-label={`${offer.vehicle.make} ${offer.vehicle.model}`}
                    >
                      <ImageSwiper
                        images={rentalImages}
                        alt={`${offer.vehicle.make} ${offer.vehicle.model}`}
                        aspectClassName="h-48 w-full"
                      />

                      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
                        {offer.isB2b && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white shadow-xs">
                            Oferta B2B
                          </span>
                        )}
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
                    </Link>

                    {/* Vehicle Specs and Pricing */}
                    <div className="p-5 space-y-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 leading-snug">
                          <Link to={`/najem/${offer.id}`} className="hover:text-primary-600 transition-colors">
                            {offer.vehicle.make} {offer.vehicle.model}
                          </Link>
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
                            {formatTransmission(offer.vehicle.transmission)}
                          </span>
                        )}
                      </div>

                      {/* Monthly Rate Range */}
                      <div className="pt-2 border-t border-gray-100 flex items-baseline justify-between">
                        <div>
                          <div className="text-2xs uppercase tracking-wider text-gray-400 font-semibold">
                            Rata abonamentu
                          </div>
                          <div className="text-lg font-bold text-primary-700 tracking-tight">
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
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-xs"
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
