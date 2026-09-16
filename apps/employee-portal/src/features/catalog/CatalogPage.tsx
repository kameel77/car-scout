import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';
import {
  Car,
  Fuel,
  Shield,
  Award,
  LogOut,
  Building2,
  UserCircle2,
  Sparkles,
  AlertCircle,
  X,
  RefreshCw,
  Tag,
  ChevronRight
} from 'lucide-react';
import { fetchEmployeeOffers, EmployeeOffer } from './catalog-api';
import { InquiryModal } from '../inquiries/InquiryModal';
import { PortalHeader } from '../common/PortalHeader';

function formatFuelType(fuelType: string): string {
  switch (fuelType.toUpperCase()) {
    case 'HYBRID':
      return 'Hybryda';
    case 'MILD_HYBRID':
      return 'Mild Hybrid';
    case 'PLUG_IN_HYBRID':
      return 'Plug-in Hybrid';
    case 'PETROL':
      return 'Benzyna';
    case 'DIESEL':
      return 'Diesel';
    case 'ELECTRIC':
      return 'Elektryczny';
    case 'LPG':
      return 'LPG';
    case 'CNG':
      return 'CNG';
    default:
      return fuelType;
  }
}

function formatTransmission(transmission: string): string {
  switch (transmission.toUpperCase()) {
    case 'AUTOMATIC':
      return 'Automat';
    case 'MANUAL':
      return 'Manualna';
    default:
      return transmission;
  }
}

export const CatalogPage: React.FC = () => {
  const { config, isLoading: isBrandLoading } = useBrandConfig();
  const { user, isLoading: isAuthLoading, logout, sessionError } = useAuth();
  const navigate = useNavigate();
  const [logoError, setLogoError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Catalog State
  const [offers, setOffers] = useState<EmployeeOffer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState<boolean>(true);
  const [offersError, setOffersError] = useState<string | null>(null);

  // Inquiry Modal State
  const [selectedOfferForInquiry, setSelectedOfferForInquiry] = useState<EmployeeOffer | null>(null);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);

  const loadOffers = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingOffers(true);
    setOffersError(null);
    try {
      const res = await fetchEmployeeOffers(config.apiUrl || '/api', {}, signal);
      setOffers(res.offers || []);
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

      {/* Real Catalog Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
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
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <RefreshCw className="h-4 w-4" />
              Spróbuj ponownie
            </button>
          </div>
        )}

        {!isLoadingOffers && !offersError && offers.length === 0 && (
          <div
            className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-xs max-w-xl mx-auto"
            data-testid="catalog-empty-state"
          >
            <div className="mx-auto h-14 w-14 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center mb-4">
              <Car className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              Brak ofert przypisanych do Twojego programu
            </h2>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              W tej chwili w Twoim programie partnerskim nie ma dostępnych ofert specjalnych. Skontaktuj się z opiekunem programu w swojej firmie lub doradcą Motolii, aby dowiedzieć się o planowanych transzach pojazdów.
            </p>
          </div>
        )}

        {!isLoadingOffers && !offersError && offers.length > 0 && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            data-testid="catalog-offers-grid"
          >
            {offers.map((offer) => (
              <article
                key={offer.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Image Box */}
                <Link
                  to={`/katalog/${offer.id}`}
                  className="relative aspect-[16/10] bg-gray-100 overflow-hidden block group"
                >
                  {offer.vehicle.primaryImageUrl ? (
                    <img
                      src={offer.vehicle.primaryImageUrl}
                      alt={`${offer.vehicle.make} ${offer.vehicle.model}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-1 bg-gray-50">
                      <Car className="h-10 w-10 text-gray-300" />
                      <span className="text-xs">Brak zdjęcia</span>
                    </div>
                  )}

                  {/* Discount Badge */}
                  {offer.pricing.discountPct > 0 && (
                    <div className="absolute top-3 left-3 bg-emerald-600 text-white font-bold text-xs px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      <span>-{String(offer.pricing.discountPct).replace('.', ',')}%</span>
                    </div>
                  )}
                </Link>

                {/* Content Box */}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 leading-snug">
                      <Link
                        to={`/katalog/${offer.id}`}
                        className="hover:text-primary-600 transition-colors"
                      >
                        {offer.vehicle.make} {offer.vehicle.model}
                      </Link>
                    </h3>
                    {offer.vehicle.version && (
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {offer.vehicle.version}
                      </p>
                    )}

                    {/* Specs Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-3 text-[11px] text-gray-600 font-medium">
                      <span className="px-2 py-0.5 bg-gray-100 rounded-md">
                        {offer.vehicle.productionYear}
                      </span>
                      {offer.vehicle.fuelType && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded-md">
                          {formatFuelType(offer.vehicle.fuelType)}
                        </span>
                      )}
                      {offer.vehicle.transmission && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded-md">
                          {formatTransmission(offer.vehicle.transmission)}
                        </span>
                      )}
                    </div>

                    {/* Benefit Policy Badge */}
                    {offer.benefit && (
                      <div className="mt-3.5 p-2.5 bg-primary-50/70 border border-primary-100 rounded-xl flex items-start gap-2 text-xs text-primary-900">
                        <Shield className="h-4 w-4 text-primary-600 flex-shrink-0 mt-0.5" />
                        <div className="leading-tight">
                          <div className="font-semibold text-primary-900">{offer.benefit.name}</div>
                          {(offer.benefit.moyaCardAmount || offer.benefit.fuelDiscount) && (
                            <div className="text-[11px] text-primary-700 mt-0.5">
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
                  <div className="pt-4 border-t border-gray-100 flex flex-col justify-end">
                    {offer.pricing.savingsPln > 0 && (
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span className="line-through">
                          Cena katalogowa: {offer.pricing.listPricePln.toLocaleString('pl-PL')} zł
                        </span>
                        <span className="text-emerald-700 font-medium">
                          Oszczędzasz {offer.pricing.savingsPln.toLocaleString('pl-PL')} zł
                        </span>
                      </div>
                    )}

                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-xs font-medium text-gray-500 block">Cena pracownicza</span>
                        <span className="text-2xl font-black text-primary-600 tracking-tight">
                          {offer.pricing.employeePricePln.toLocaleString('pl-PL')} zł
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">brutto</span>
                    </div>

                    <div className="mt-3.5 flex flex-col gap-2">
                      <Link
                        to={`/katalog/${offer.id}`}
                        className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5"
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
                        className="w-full py-2 px-3 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors text-center"
                      >
                        Zapytaj o tę ofertę
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
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
