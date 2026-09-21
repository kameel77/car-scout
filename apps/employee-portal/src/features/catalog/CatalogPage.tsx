import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';
import {
  Car,
  Fuel,
  Shield,
  Award,
  Building2,
  Sparkles,
  AlertCircle,
  X,
  RefreshCw,
  Tag,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { fetchEmployeeOffers, EmployeeOffer, EmployeeFinancingConfig } from './catalog-api';
import { RateRangeFilter } from './RateRangeFilter';
import { calculateDefaultOfferInstallment } from './financing';
import { InquiryModal } from '../inquiries/InquiryModal';
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

export const CatalogPage: React.FC = () => {
  const { config, isLoading: isBrandLoading } = useBrandConfig();
  const { user, isLoading: isAuthLoading, logout, sessionError } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Catalog State
  const [offers, setOffers] = useState<EmployeeOffer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState<boolean>(true);
  const [offersError, setOffersError] = useState<string | null>(null);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMake, setSelectedMake] = useState<string>('');
  const [selectedFuel, setSelectedFuel] = useState<string>('');
  const [selectedTransmission, setSelectedTransmission] = useState<string>('');
  const [selectedBodyType, setSelectedBodyType] = useState<string>('');
  const [minRate, setMinRate] = useState<number | ''>('');
  const [maxRate, setMaxRate] = useState<number | ''>('');
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);
  const [financingConfig, setFinancingConfig] = useState<EmployeeFinancingConfig | null>(null);
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'discount_desc' | 'rate_asc' | 'rate_desc'>('default');

  // Inquiry Modal State
  const [selectedOfferForInquiry, setSelectedOfferForInquiry] = useState<EmployeeOffer | null>(null);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);

  const loadOffers = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingOffers(true);
    setOffersError(null);
    try {
      const res = await fetchEmployeeOffers(config.apiUrl || '/api', {}, signal);
      setOffers(res.offers || []);
      setFinancingConfig(res.financing ?? null);
    } catch (err: unknown) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : 'Nie udało się pobrać listy ofert';
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

  const offersWithInstallments = useMemo(() => {
    return offers.map((offer) => ({
      offer,
      installment: calculateDefaultOfferInstallment(offer, financingConfig)
    }));
  }, [offers, financingConfig]);

  const filteredOffers = useMemo(() => {
    let result = [...offersWithInstallments];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        ({ offer: o }) =>
          o.vehicle.make.toLowerCase().includes(q) ||
          o.vehicle.model.toLowerCase().includes(q) ||
          (o.vehicle.version && o.vehicle.version.toLowerCase().includes(q))
      );
    }

    if (selectedMake) {
      result = result.filter(
        ({ offer: o }) => o.vehicle.make.toLowerCase() === selectedMake.toLowerCase()
      );
    }

    if (selectedFuel) {
      result = result.filter(
        ({ offer: o }) => normalizeFuelType(o.vehicle.fuelType)?.key === selectedFuel
      );
    }

    if (selectedTransmission) {
      result = result.filter(
        ({ offer: o }) => normalizeTransmission(o.vehicle.transmission)?.key === selectedTransmission
      );
    }

    if (selectedBodyType) {
      result = result.filter(
        ({ offer: o }) => normalizeBodyType(o.vehicle.bodyType)?.key === selectedBodyType
      );
    }

    if (minRate !== '') {
      result = result.filter(({ installment }) => installment.installmentGross >= Number(minRate));
    }

    if (maxRate !== '') {
      result = result.filter(({ installment }) => installment.installmentGross <= Number(maxRate));
    }

    if (sortBy === 'price_asc') {
      result.sort((a, b) => a.offer.pricing.employeePricePln - b.offer.pricing.employeePricePln);
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.offer.pricing.employeePricePln - a.offer.pricing.employeePricePln);
    } else if (sortBy === 'discount_desc') {
      result.sort((a, b) => b.offer.pricing.discountPct - a.offer.pricing.discountPct);
    } else if (sortBy === 'rate_asc') {
      result.sort((a, b) => a.installment.installmentGross - b.installment.installmentGross);
    } else if (sortBy === 'rate_desc') {
      result.sort((a, b) => b.installment.installmentGross - a.installment.installmentGross);
    }

    return result.map((item) => item.offer);
  }, [offersWithInstallments, searchTerm, selectedMake, selectedFuel, selectedTransmission, selectedBodyType, minRate, maxRate, sortBy]);

  const secondaryFiltersCount = (selectedFuel ? 1 : 0) + (selectedTransmission ? 1 : 0) + (selectedBodyType ? 1 : 0);

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    selectedMake ||
    selectedFuel ||
    selectedTransmission ||
    selectedBodyType ||
    minRate !== '' ||
    maxRate !== '' ||
    sortBy !== 'default'
  );

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedMake('');
    setSelectedFuel('');
    setSelectedTransmission('');
    setSelectedBodyType('');
    setMinRate('');
    setMaxRate('');
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
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" />
          <div className="text-muted text-sm font-medium">Ładowanie oferty samochodów...</div>
        </div>
      </div>
    );
  }

  const activeError = logoutError || sessionError;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
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

      {/* Program Subheader (Mobile only) */}
      {user && (
        <div className="md:hidden bg-lime/20 border-b border-line px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 text-ink">
          <div className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5 text-forest" />
            <span>Firma: <strong>{user.company?.name}</strong></span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-white text-ink font-semibold border border-line text-[11px]">
            {user.program?.name}
          </span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-white border-b border-line py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-lime text-ink rounded-full text-xs font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5 text-ink" />
            Program aktywny dla organizacji {user?.company?.name || ''}
          </div>
          <h1 className="text-3xl font-bold font-heading text-ink tracking-tight">
            Dedykowana oferta samochodów dla pracowników
          </h1>
          <p className="mt-2 text-base text-muted max-w-3xl leading-relaxed">
            Nowe samochody w najmie długoterminowym oraz leasingu na preferencyjnych warunkach partnerskich z pakietem benefitów pracowniczych.
          </p>

          <div className="mt-8">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Pakiet benefitów w programie {user?.program?.name || 'partnerskim'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 bg-paper rounded-2xl border border-line shadow-xs">
                <Shield className="h-6 w-6 text-forest flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-ink">Specjalne warunki flotowe</div>
                  <div className="text-xs text-muted mt-0.5">Dedykowane matryce i rabaty cenowe</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-paper rounded-2xl border border-line shadow-xs">
                <Fuel className="h-6 w-6 text-forest flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-ink">Pakiet paliwowy Moya</div>
                  <div className="text-xs text-muted mt-0.5">Karta z zasileniem i rabat na stacjach</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-paper rounded-2xl border border-line shadow-xs">
                <Award className="h-6 w-6 text-forest flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-ink">Opieka doradcy Motolii</div>
                  <div className="text-xs text-muted mt-0.5">Indywidualny kontakt i wsparcie formalności</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real Catalog Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
        {/* Filters Bar */}
        {!offersError && (
          <div className="bg-white border border-line rounded-2xl p-4 mb-6 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <SlidersHorizontal className="h-4 w-4 text-ink" />
                <span>Filtry</span>
                <span className="text-xs font-normal text-muted">
                  (Dostępne oferty: <strong>{filteredOffers.length}</strong>)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Szukaj po marce lub modelu..."
                    className="w-full pl-9 pr-3 py-1.5 border border-line rounded-xl text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ink bg-white shadow-xs"
                  />
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:underline transition-colors shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                    Wyczyść filtry
                  </button>
                )}
              </div>
            </div>

            {/* Primary filters row: Rate (1st), Make (2nd), Sort, More filters button */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-start">
              {/* 1. Rata miesięczna */}
              <div className="lg:col-span-5">
                <RateRangeFilter
                  minRate={minRate}
                  maxRate={maxRate}
                  onChange={(min, max) => {
                    setMinRate(min);
                    setMaxRate(max);
                  }}
                />
              </div>

              {/* 2. Marka */}
              <div className="lg:col-span-3">
                <label className="block text-2xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Marka
                </label>
                <select
                  value={selectedMake}
                  onChange={(e) => setSelectedMake(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-paper border border-line rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                >
                  <option value="">Wszystkie marki</option>
                  {availableMakes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Sortowanie */}
              <div className="lg:col-span-2">
                <label className="block text-2xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Sortowanie
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'default' | 'price_asc' | 'price_desc' | 'discount_desc' | 'rate_asc' | 'rate_desc')}
                  className="w-full text-xs py-2 px-2.5 bg-paper border border-line rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                >
                  <option value="default">Domyślne</option>
                  <option value="rate_asc">Rata: od najniższej</option>
                  <option value="rate_desc">Rata: od najwyższej</option>
                  <option value="price_asc">Cena: od najniższej</option>
                  <option value="price_desc">Cena: od najwyższej</option>
                  <option value="discount_desc">Największy rabat</option>
                </select>
              </div>

              {/* 4. Przycisk "Więcej filtrów" */}
              <div className="lg:col-span-2 flex sm:justify-start lg:justify-end pt-5">
                <button
                  type="button"
                  onClick={() => setShowMoreFilters((prev) => !prev)}
                  className={`w-full lg:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl border transition-colors ${
                    showMoreFilters || secondaryFiltersCount > 0
                      ? 'bg-ink text-white border-ink'
                      : 'bg-paper text-ink border-line hover:bg-white'
                  }`}
                  aria-expanded={showMoreFilters}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Więcej filtrów</span>
                  {secondaryFiltersCount > 0 && (
                    <span className="ml-1 bg-lime text-ink text-2xs font-bold px-1.5 py-0.5 rounded-full">
                      {secondaryFiltersCount}
                    </span>
                  )}
                  {showMoreFilters ? (
                    <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Secondary filters row (collapsible) */}
            {showMoreFilters && (
              <div className="pt-3 border-t border-line grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Paliwo */}
                <div>
                  <label className="block text-2xs font-semibold text-muted uppercase tracking-wider mb-1">
                    Paliwo
                  </label>
                  <select
                    value={selectedFuel}
                    onChange={(e) => setSelectedFuel(e.target.value)}
                    className="w-full text-xs py-2 px-2.5 bg-paper border border-line rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ink"
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
                  <label className="block text-2xs font-semibold text-muted uppercase tracking-wider mb-1">
                    Skrzynia
                  </label>
                  <select
                    value={selectedTransmission}
                    onChange={(e) => setSelectedTransmission(e.target.value)}
                    className="w-full text-xs py-2 px-2.5 bg-paper border border-line rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ink"
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
                  <label className="block text-2xs font-semibold text-muted uppercase tracking-wider mb-1">
                    Nadwozie
                  </label>
                  <select
                    value={selectedBodyType}
                    onChange={(e) => setSelectedBodyType(e.target.value)}
                    className="w-full text-xs py-2 px-2.5 bg-paper border border-line rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  >
                    <option value="">Wszystkie</option>
                    {availableBodyTypes.map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {isLoadingOffers && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            data-testid="catalog-loading-skeleton"
            aria-busy="true"
            aria-label="Ładowanie ofert samochodów"
          >
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs animate-pulse flex flex-col"
              >
                <div className="aspect-[16/10] bg-gray-200 w-full" />
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-5 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="flex gap-2 pt-2">
                      <div className="h-5 bg-gray-200 rounded w-14" />
                      <div className="h-5 bg-gray-200 rounded w-16" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-100 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-24" />
                    <div className="h-7 bg-gray-200 rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoadingOffers && offersError && (
          <div
            className="bg-white rounded-2xl border border-red-200 p-8 text-center shadow-xs max-w-xl mx-auto"
            role="alert"
          >
            <div className="mx-auto h-12 w-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-3">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Nie udało się załadować ofert</h2>
            <p className="mt-1 text-sm text-gray-600 leading-relaxed">{offersError}</p>
            <button
              type="button"
              onClick={() => {
                loadOffers();
              }}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-ink hover:bg-ink/90 text-paper text-sm font-semibold rounded-full shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink"
            >
              <RefreshCw className="h-4 w-4" />
              Spróbuj ponownie
            </button>
          </div>
        )}

        {!isLoadingOffers && !offersError && filteredOffers.length === 0 && (
          <div
            className="bg-white rounded-2xl border border-line p-12 text-center shadow-xs max-w-xl mx-auto"
            data-testid="catalog-empty-state"
          >
            <div className="mx-auto h-14 w-14 bg-paper text-muted rounded-2xl flex items-center justify-center mb-4">
              <Car className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold font-heading text-ink">
              {hasActiveFilters
                ? 'Brak ofert spełniających kryteria'
                : 'Brak ofert przypisanych do Twojego programu'}
            </h2>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              {hasActiveFilters
                ? 'Żadna oferta nie pasuje do wybranych filtrów. Spróbuj zmienić lub zresetować kryteria wyszukiwania.'
                : 'W tej chwili w Twoim programie partnerskim nie ma dostępnych ofert specjalnych. Skontaktuj się z opiekunem programu w swojej firmie lub doradcą Motolii, aby dowiedzieć się o planowanych transzach pojazdów.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-ink hover:bg-ink/90 text-paper text-xs font-semibold rounded-full transition-colors shadow-xs"
              >
                Wyczyść filtry
              </button>
            )}
          </div>
        )}

        {!isLoadingOffers && !offersError && filteredOffers.length > 0 && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            data-testid="catalog-offers-grid"
          >
            {filteredOffers.map((offer) => {
              const carImages = [
                offer.vehicle.primaryImageUrl,
                ...(offer.vehicle.imageUrls || []).filter((u) => u !== offer.vehicle.primaryImageUrl),
              ].filter(Boolean) as string[];

              return (
                <article
                  key={offer.id}
                  className="bg-white rounded-2xl border border-line overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Image Box */}
                  <Link
                    to={`/katalog/${offer.id}`}
                    className="relative aspect-[16/10] bg-paper overflow-hidden block group"
                  >
                    <ImageSwiper
                      images={carImages}
                      alt={`${offer.vehicle.make} ${offer.vehicle.model}`}
                      aspectClassName="aspect-[16/10]"
                    />

                    {/* Discount Badge */}
                    {offer.pricing.discountPct > 0 && (
                      <div className="absolute top-3 left-3 bg-ink text-paper font-semibold text-xs px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1 z-10 pointer-events-none">
                        <Tag className="h-3 w-3" />
                        <span>-{String(offer.pricing.discountPct).replace('.', ',')}%</span>
                      </div>
                    )}
                  </Link>

                {/* Content Box */}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold font-heading text-ink leading-snug">
                      <Link
                        to={`/katalog/${offer.id}`}
                        className="hover:underline transition-colors"
                      >
                        {offer.vehicle.make} {offer.vehicle.model}
                      </Link>
                    </h3>
                    {offer.vehicle.version && (
                      <p className="text-xs text-muted line-clamp-1 mt-0.5">
                        {offer.vehicle.version}
                      </p>
                    )}

                    {/* Specs Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-3 text-[11px] text-muted font-medium">
                      <span className="px-2 py-0.5 bg-paper rounded-md">
                        {offer.vehicle.productionYear}
                      </span>
                      {offer.vehicle.fuelType && (
                        <span className="px-2 py-0.5 bg-paper rounded-md">
                          {formatFuelType(offer.vehicle.fuelType)}
                        </span>
                      )}
                      {offer.vehicle.transmission && (
                        <span className="px-2 py-0.5 bg-paper rounded-md">
                          {formatTransmission(offer.vehicle.transmission)}
                        </span>
                      )}
                    </div>

                    {/* Benefit Policy Badge */}
                    {offer.benefit && (
                      <div className="mt-3.5 p-2.5 bg-paper border border-line rounded-xl flex items-start gap-2 text-xs text-ink">
                        <Shield className="h-4 w-4 text-forest flex-shrink-0 mt-0.5" />
                        <div className="leading-tight">
                          <div className="font-semibold text-ink">{offer.benefit.name}</div>
                          {(offer.benefit.moyaCardAmount || offer.benefit.fuelDiscount) && (
                            <div className="text-[11px] text-muted mt-0.5">
                              {offer.benefit.moyaCardAmount && `Karta ${offer.benefit.moyaCardAmount} zł`}
                              {offer.benefit.moyaCardAmount && offer.benefit.fuelDiscount && ' • '}
                              {offer.benefit.fuelDiscount && `Rabat ${offer.benefit.fuelDiscount}`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing Block */}
                  <div className="pt-4 border-t border-line flex flex-col justify-end">
                    {offer.pricing.savingsPln > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted mb-1">
                        <span className="line-through">
                          Cena katalogowa: {offer.pricing.listPricePln.toLocaleString('pl-PL')} zł
                        </span>
                        <span className="text-ink font-semibold bg-lime px-2 py-0.5 rounded-full text-[11px]">
                          Oszczędzasz {offer.pricing.savingsPln.toLocaleString('pl-PL')} zł
                        </span>
                      </div>
                    )}

                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-xs font-medium text-muted block">Cena pracownicza</span>
                        <span className="text-2xl font-black text-ink tracking-tight">
                          {offer.pricing.employeePricePln.toLocaleString('pl-PL')} zł
                        </span>
                      </div>
                      <span className="text-xs text-muted font-medium">brutto</span>
                    </div>

                    <div className="mt-3.5 flex flex-col gap-2">
                      <Link
                        to={`/katalog/${offer.id}`}
                        className="w-full py-3 px-4 bg-ink hover:bg-ink/90 text-paper font-semibold text-sm rounded-full transition-colors shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <span>Szczegóły i kalkulator raty</span>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOfferForInquiry(offer);
                          setIsInquiryModalOpen(true);
                        }}
                        className="w-full py-2 px-3 text-xs font-semibold text-muted hover:text-ink hover:bg-paper rounded-full transition-colors text-center"
                      >
                        Zapytaj o tę ofertę
                      </button>
                    </div>
                  </div>
                </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal zapytania o ofertę */}
      <InquiryModal
        isOpen={isInquiryModalOpen}
        onClose={() => {
          setIsInquiryModalOpen(false);
          setSelectedOfferForInquiry(null);
        }}
        offer={selectedOfferForInquiry}
        onViewMyInquiries={() => navigate('/zapytania')}
      />
    </div>
  );
};
