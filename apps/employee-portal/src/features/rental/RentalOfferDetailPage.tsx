import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  ArrowLeft,
  Calendar,
  Gauge,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react';
import {
  fetchEmployeeRentalOfferDetails,
  EmployeeRentalOfferDetails,
  RentalOptionItem
} from './rental-api';
import { InquiryModal } from '../inquiries/InquiryModal';
import { PortalHeader } from '../common/PortalHeader';

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

export const RentalOfferDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { config, isLoading: isBrandLoading } = useBrandConfig();
  const { user, isLoading: isAuthLoading, logout, sessionError } = useAuth();
  const navigate = useNavigate();

  const [logoError, setLogoError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Data & details state
  const [offer, setOffer] = useState<EmployeeRentalOfferDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);

  // Calculator State
  const [selectedMonths, setSelectedMonths] = useState<number>(36);
  const [selectedMileage, setSelectedMileage] = useState<number>(20000);
  const [selectedDownPayment, setSelectedDownPayment] = useState<{ pct: number; amountNet: number; label: string } | null>(null);

  // Inquiry Modal State
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState<boolean>(false);

  const loadDetails = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchEmployeeRentalOfferDetails(config.apiUrl || '/api', id, signal);
      setOffer(data);

      // Inicjalizacja domyślnych wartości kalkulatora z dostępnych opcji
      if (data.contractMonthsOptions?.length) {
        const defaultM = data.contractMonthsOptions.includes(36) ? 36 : data.contractMonthsOptions[0];
        setSelectedMonths(defaultM);
      }
      if (data.annualMileageOptions?.length) {
        const defaultMil = data.annualMileageOptions.includes(20000)
          ? 20000
          : data.annualMileageOptions[0];
        setSelectedMileage(defaultMil);
      }
      if (data.downPaymentOptions && data.downPaymentOptions.length > 0) {
        setSelectedDownPayment(data.downPaymentOptions[0]);
      } else if (data.downPaymentPctOptions?.length) {
        const pct = data.downPaymentPctOptions[0];
        setSelectedDownPayment({ pct, amountNet: 0, label: `${pct}%` });
      }
    } catch (err: unknown) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : 'Nie udało się pobrać szczegółów oferty najmu';
      setError(msg);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [config.apiUrl, id]);

  useEffect(() => {
    const controller = new AbortController();
    loadDetails(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadDetails]);

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

  // Znalezienie wybranego wariantu stawek
  const activeOption: RentalOptionItem | undefined = offer?.rentalOptions.find((opt) => {
    if (opt.contractMonths !== selectedMonths || opt.annualMileage !== selectedMileage) {
      return false;
    }
    if (!selectedDownPayment) return false;
    if (opt.downPaymentPct !== selectedDownPayment.pct) {
      return false;
    }
    if (selectedDownPayment.amountNet > 0) {
      return Math.abs(opt.downPaymentAmountPln - selectedDownPayment.amountNet) < 1;
    }
    const hasZeroAmountOption = offer.rentalOptions.some(
      (o) =>
        o.contractMonths === selectedMonths &&
        o.annualMileage === selectedMileage &&
        o.downPaymentPct === selectedDownPayment.pct &&
        o.downPaymentAmountPln === 0
    );
    if (hasZeroAmountOption) {
      return opt.downPaymentAmountPln === 0;
    }
    return true;
  });

  const allImages = offer
    ? [
        offer.vehicle.primaryImageUrl,
        ...(offer.vehicle.imageUrls || []).filter((u) => u !== offer.vehicle.primaryImageUrl)
      ].filter(Boolean) as string[]
    : [];

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
        {/* Back Link */}
        <div className="mb-6">
          <Link
            to="/najem"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Wróć do katalogu najmu
          </Link>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-xs animate-pulse">
            <div className="h-64 bg-gray-200 rounded-xl mb-6 max-w-xl mx-auto" />
            <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto mb-3" />
            <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto" />
          </div>
        ) : error || !offer ? (
          /* Error State */
          <div
            role="alert"
            className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-xs my-10"
          >
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Nie znaleziono oferty najmu</h3>
            <p className="text-sm text-gray-600 mt-2 mb-6">
              {error || 'Podana oferta nie istnieje lub została wycofana z programu.'}
            </p>
            <Link
              to="/najem"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs"
            >
              Wróć do katalogu
            </Link>
          </div>
        ) : (
          /* Offer Details & Discrete Calculator */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Photos & Vehicle Specs (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Main Photo Gallery */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="relative h-80 sm:h-96 bg-gray-100 overflow-hidden flex items-center justify-center">
                  {allImages.length > 0 ? (
                    <img
                      src={allImages[activeImageIdx] || allImages[0]}
                      alt={`${offer.vehicle.make} ${offer.vehicle.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Car className="h-20 w-20 text-gray-300" />
                  )}

                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                    {offer.isB2b && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-xs">
                        Oferta B2B
                      </span>
                    )}
                    {offer.rateSource === 'PARTNER_MATRIX' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white shadow-xs">
                        <Sparkles className="h-3.5 w-3.5" />
                        Stawka partnerska programu
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-900/80 text-white shadow-xs backdrop-blur-xs">
                        Stawka katalogowa Motolia
                      </span>
                    )}
                  </div>
                </div>

                {/* Thumbnails */}
                {allImages.length > 1 && (
                  <div className="p-3 bg-gray-50 border-t border-gray-100 flex gap-2 overflow-x-auto">
                    {allImages.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIdx(idx)}
                        className={`w-16 h-12 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-colors ${
                          activeImageIdx === idx ? 'border-indigo-600' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img src={img} alt={`Widok ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Vehicle Specifications */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
                  Dane techniczne pojazdu
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-gray-500 block">Rok produkcji</span>
                    <span className="font-semibold text-gray-900">{offer.vehicle.productionYear}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Rodzaj paliwa</span>
                    <span className="font-semibold text-gray-900">{formatFuelType(offer.vehicle.fuelType)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Skrzynia biegów</span>
                    <span className="font-semibold text-gray-900">{offer.vehicle.transmission || 'Brak danych'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Nadwozie</span>
                    <span className="font-semibold text-gray-900">{offer.vehicle.bodyType || 'Brak danych'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Wersja wyposażenia</span>
                    <span className="font-semibold text-gray-900">{offer.vehicle.version || 'Standardowa'}</span>
                  </div>
                  {offer.vehicle.powerHp && (
                    <div>
                      <span className="text-xs text-gray-500 block">Moc silnika</span>
                      <span className="font-semibold text-gray-900">{offer.vehicle.powerHp} KM</span>
                    </div>
                  )}
                  {offer.vehicle.engineCapacityCm3 && (
                    <div>
                      <span className="text-xs text-gray-500 block">Pojemność</span>
                      <span className="font-semibold text-gray-900">{offer.vehicle.engineCapacityCm3.toLocaleString('pl-PL')} cm³</span>
                    </div>
                  )}
                  {offer.vehicle.drive && (
                    <div>
                      <span className="text-xs text-gray-500 block">Napęd</span>
                      <span className="font-semibold text-gray-900">{offer.vehicle.drive}</span>
                    </div>
                  )}
                  {offer.vehicle.color && (
                    <div>
                      <span className="text-xs text-gray-500 block">Kolor</span>
                      <span className="font-semibold text-gray-900">{offer.vehicle.color}</span>
                    </div>
                  )}
                  {(offer.vehicle.doors || offer.vehicle.seats) && (
                    <div>
                      <span className="text-xs text-gray-500 block">Drzwi / Miejsca</span>
                      <span className="font-semibold text-gray-900">
                        {offer.vehicle.doors ? `${offer.vehicle.doors} drzwi` : ''}
                        {offer.vehicle.doors && offer.vehicle.seats ? ' / ' : ''}
                        {offer.vehicle.seats ? `${offer.vehicle.seats} miejsc` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Wyposażenie pojazdu */}
              {(offer.vehicle.equipmentSafety?.length ||
                offer.vehicle.equipmentComfortExtras?.length ||
                offer.vehicle.equipmentAudioMultimedia?.length ||
                offer.vehicle.equipmentOther?.length) ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-6">
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
                    Wyposażenie pojazdu
                  </h3>

                  {offer.vehicle.equipmentSafety && offer.vehicle.equipmentSafety.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                        Bezpieczeństwo i asystenci
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                        {offer.vehicle.equipmentSafety.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {offer.vehicle.equipmentComfortExtras && offer.vehicle.equipmentComfortExtras.length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                        Komfort i funkcjonalność
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                        {offer.vehicle.equipmentComfortExtras.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {offer.vehicle.equipmentAudioMultimedia && offer.vehicle.equipmentAudioMultimedia.length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                        Multimedia i łączność
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                        {offer.vehicle.equipmentAudioMultimedia.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {offer.vehicle.equipmentOther && offer.vehicle.equipmentOther.length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                        Pozostałe elementy
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                        {offer.vehicle.equipmentOther.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Dodatkowe informacje o pojeździe */}
              {offer.vehicle.additionalInfoContent && (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    {offer.vehicle.additionalInfoHeader || 'Dodatkowe informacje o pojeździe'}
                  </h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                    {offer.vehicle.additionalInfoContent}
                  </p>
                </div>
              )}

              {/* Benefits in Rental */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 space-y-3">
                <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-600" />
                  Co zawiera rata najmu długoterminowego?
                </h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-indigo-950">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Pełne ubezpieczenie OC / AC / NNW</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Pakiet serwisowy i przeglądy okresowe</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Samochód zastępczy w razie awarii</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Wsparcie i opieka dedykowanego doradcy</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column: Discrete Rate Calculator & Inquiry Button (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-6 sticky top-24">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                      Konfigurator abonamentu
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mt-1">
                    {offer.vehicle.make} {offer.vehicle.model}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {offer.vehicle.version || 'Wersja wyposażenia standardowa'}
                  </p>
                </div>

                {/* Kalkulator Dyskretny */}
                <div className="space-y-5 border-t border-gray-100 pt-5">
                  {/* Wybór Okresu Umowy */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Okres umowy (miesiące)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {offer.contractMonthsOptions.map((months) => (
                        <button
                          key={months}
                          type="button"
                          onClick={() => setSelectedMonths(months)}
                          className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all ${
                            selectedMonths === months
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {months} mies.
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Wybór Rocznego Limitu Przebiegu */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Roczny limit kilometrów
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {offer.annualMileageOptions.map((mileage) => (
                        <button
                          key={mileage}
                          type="button"
                          onClick={() => setSelectedMileage(mileage)}
                          className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all ${
                            selectedMileage === mileage
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {mileage.toLocaleString('pl-PL')} km / rok
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Wybór Wpłaty Wstępnej */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Wpłata wstępna
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(offer.downPaymentOptions && offer.downPaymentOptions.length > 0
                        ? offer.downPaymentOptions
                        : (offer.downPaymentPctOptions || []).map((pct) => ({
                            pct,
                            amountNet: 0,
                            amountGross: 0,
                            label: `${pct}%`
                          }))
                      ).map((downOpt) => {
                        const isSelected =
                          selectedDownPayment &&
                          selectedDownPayment.pct === downOpt.pct &&
                          selectedDownPayment.amountNet === downOpt.amountNet;
                        return (
                          <button
                            key={`${downOpt.pct}-${downOpt.amountNet}`}
                            type="button"
                            onClick={() => setSelectedDownPayment(downOpt)}
                            className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {downOpt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Wynik Kalkulacji */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  {activeOption ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">Typ stawki:</span>
                        {activeOption.rateSource === 'PARTNER_MATRIX' ? (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Stawka partnerska
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            Stawka katalogowa
                          </span>
                        )}
                      </div>

                      <div className="border-t border-gray-200/80 pt-2 flex items-baseline justify-between">
                        <div>
                          <div className="text-2xs uppercase tracking-wider text-gray-400 font-semibold">
                            Miesięczna rata netto
                          </div>
                          <div className="text-2xl font-black text-indigo-700 tracking-tight">
                            {activeOption.monthlyRateNet.toLocaleString('pl-PL')} zł
                            <span className="text-xs font-normal text-gray-500 ml-1">netto / mc</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xs uppercase tracking-wider text-gray-400 font-semibold">
                            Rata brutto
                          </div>
                          <div className="text-base font-bold text-gray-900">
                            {activeOption.monthlyRateGross.toLocaleString('pl-PL')} zł
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 flex justify-between border-t border-gray-200/80 pt-2">
                        <span>Wpłata wstępna:</span>
                        <span className="font-semibold text-gray-900">
                          {activeOption.downPaymentAmountPln > 0
                            ? `${activeOption.downPaymentAmountPln.toLocaleString('pl-PL')} zł`
                            : activeOption.downPaymentPct > 0
                            ? `${activeOption.downPaymentPct}%`
                            : '0 zł'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 text-center text-xs text-amber-700 bg-amber-50 rounded-lg">
                      Wybrana kombinacja parametrów nie jest dostępna w matrycy. Zmień okres lub limit kilometrów.
                    </div>
                  )}
                </div>

                {/* Przycisk Akcji */}
                <button
                  type="button"
                  disabled={!activeOption}
                  onClick={() => setIsInquiryModalOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base rounded-xl transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Zapytaj o tę ofertę
                  <ChevronRight className="h-5 w-5" />
                </button>

                <p className="text-2xs text-gray-400 text-center">
                  Przesłanie zapytania jest bezpłatne i niezobowiązujące. Doradca skontaktuje się z Tobą w ciągu 24 godzin.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Zapytania o Ofertę */}
      {offer && activeOption && (
        <InquiryModal
          isOpen={isInquiryModalOpen}
          onClose={() => setIsInquiryModalOpen(false)}
          offer={{
            id: offer.id,
            sourceType: 'RENTAL',
            vehicle: offer.vehicle
          }}
          rentalSelection={{
            assignmentId: activeOption.assignmentId || offer.rentalCompany?.id || '',
            contractMonths: selectedMonths,
            annualMileageKm: selectedMileage,
            annualMileage: selectedMileage,
            initialPaymentPct: activeOption.downPaymentPct,
            downPaymentPct: activeOption.downPaymentPct,
            initialPaymentAmountNet: activeOption.downPaymentAmountPln || 0
          }}
          rentalDisplay={{
            contractMonths: selectedMonths,
            annualMileage: selectedMileage,
            downPaymentPct: activeOption.downPaymentPct,
            monthlyRateNet: activeOption.monthlyRateNet,
            monthlyRateGross: activeOption.monthlyRateGross,
            rentalCompanyName: offer.rentalCompany.name
          }}
          onViewMyInquiries={() => navigate('/zapytania')}
        />
      )}
    </div>
  );
};
