import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';
import {
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  ChevronRight,
  Calculator,
  Layers
} from 'lucide-react';
import {
  fetchEmployeeRentalOfferDetails,
  EmployeeRentalOfferDetails,
  RentalOptionItem
} from './rental-api';
import { InquiryModal } from '../inquiries/InquiryModal';
import { PortalHeader } from '../common/PortalHeader';
import { PortalFooter } from '../common/PortalFooter';
import { ImageGallery } from '../common/ImageGallery';

function formatFuelType(fuelType: string | null | undefined): string {
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

function formatTransmission(tx: string | null | undefined): string {
  if (!tx) return 'Brak danych';
  const val = tx.toUpperCase();
  if (val.includes('AUTO')) return 'Automatyczna';
  if (val.includes('MANUAL')) return 'Manualna';
  return tx;
}

function formatMileageChip(mileage: number): string {
  if (mileage >= 1000 && mileage % 1000 === 0) {
    return `${mileage / 1000} tys.`;
  }
  return `${mileage.toLocaleString('pl-PL')} km`;
}

export const RentalOfferDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { config, isLoading: isBrandLoading } = useBrandConfig();
  const { isLoading: isAuthLoading, logout, sessionError } = useAuth();
  const navigate = useNavigate();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Data & details state
  const [offer, setOffer] = useState<EmployeeRentalOfferDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Client Type State: B2B vs Consumer (defaults to CONSUMER for employees unless offer is B2B-only)
  const [clientType, setClientType] = useState<'B2B' | 'CONSUMER'>('CONSUMER');

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

      if (data.isB2b) {
        setClientType('B2B');
      }

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

  const minRate = useMemo(() => {
    if (!offer?.rentalOptions.length) return { net: 0, gross: 0 };
    return offer.rentalOptions.reduce(
      (acc, opt) => ({
        net: Math.min(acc.net, opt.monthlyRateNet),
        gross: Math.min(acc.gross, opt.monthlyRateGross)
      }),
      { net: Infinity, gross: Infinity }
    );
  }, [offer]);

  const allImages = offer
    ? (Array.from(
        new Set([offer.vehicle.primaryImageUrl, ...(offer.vehicle.imageUrls || [])].filter(Boolean))
      ) as string[])
    : [];

  const downPaymentChoices = offer?.downPaymentOptions && offer.downPaymentOptions.length > 0
    ? offer.downPaymentOptions
    : (offer?.downPaymentPctOptions || []).map((pct) => ({
        pct,
        amountNet: 0,
        amountGross: 0,
        label: `${pct}%`
      }));

  if (isBrandLoading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" />
          <div className="text-muted text-sm">Ładowanie portalu...</div>
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

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/najem"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Wróć do listy najmu
          </Link>
          <div className="text-xs text-muted font-medium">
            Najem długoterminowy
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-24 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-line">
            <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" />
            <div className="text-muted text-sm">Pobieranie oferty najmu...</div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && (error || !offer) && (
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink hover:bg-forest text-paper text-sm font-semibold rounded-xl transition-colors shadow-xs"
            >
              Wróć do katalogu najmu
            </Link>
          </div>
        )}

        {/* Offer Details Content */}
        {!isLoading && offer && (
          <div className="space-y-8">
            {/* Header / Titles Card */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-line shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {offer.isB2b ? (
                      <span className="bg-ink text-white font-bold text-xs px-3 py-1 rounded-full shadow-xs">
                        Tylko B2B
                      </span>
                    ) : (
                      <span className="bg-paper text-ink font-semibold text-xs px-3 py-1 rounded-full border border-line">
                        Dla firm i osób prywatnych
                      </span>
                    )}
                    {offer.rateSource === 'PARTNER_MATRIX' ? (
                      <span className="bg-lime text-ink font-bold text-xs px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        Stawka partnerska programu
                      </span>
                    ) : (
                      <span className="bg-paper text-muted font-semibold text-xs px-3 py-1 rounded-full border border-line">
                        Stawka katalogowa Motolia
                      </span>
                    )}
                    {offer.vehicle.productionYear && (
                      <span className="bg-paper text-muted font-semibold text-xs px-3 py-1 rounded-full border border-line">
                        Rocznik {offer.vehicle.productionYear}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-heading">
                    {offer.vehicle.make} {offer.vehicle.model}
                  </h1>
                  {offer.vehicle.version && (
                    <p className="text-sm sm:text-base text-muted mt-1">
                      {offer.vehicle.version}
                    </p>
                  )}
                </div>

                {/* Top Pricing Summary Pill */}
                <div className="bg-paper border border-line rounded-2xl p-4 lg:text-right min-w-[240px]">
                  <div className="text-xs text-muted font-medium">
                    {clientType === 'CONSUMER' ? 'Rata najmu brutto' : 'Rata najmu netto'}
                  </div>
                  <div className="flex lg:justify-end items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-ink tracking-tight font-heading">
                      {(clientType === 'CONSUMER'
                        ? (activeOption?.monthlyRateGross ?? (minRate.gross < Infinity ? minRate.gross : 0))
                        : (activeOption?.monthlyRateNet ?? (minRate.net < Infinity ? minRate.net : 0))
                      ).toLocaleString('pl-PL')} zł
                    </span>
                    <span className="text-xs text-muted font-medium">
                      {clientType === 'CONSUMER' ? 'brutto / mies.' : 'netto / mies.'}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-forest mt-0.5">
                    Abonament all-inclusive
                  </div>
                </div>
              </div>
            </div>

            {/* Grid: Photos + Calculator & Benefits */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Gallery + Specs + Equipment (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                {/* Image Gallery with Lightbox */}
                <div className="bg-white p-4 rounded-2xl border border-line shadow-xs overflow-hidden">
                  <ImageGallery
                    images={allImages}
                    title={`${offer.vehicle.make} ${offer.vehicle.model}`}
                    aspectClassName="aspect-[16/10]"
                  />
                </div>

                {/* Vehicle Specifications Grid */}
                <div className="bg-white p-6 rounded-2xl border border-line shadow-xs">
                  <h3 className="text-base font-bold text-ink mb-4 flex items-center gap-2 font-heading">
                    <Layers className="h-5 w-5 text-forest" />
                    Dane techniczne
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div className="p-3 bg-paper rounded-xl border border-line">
                      <span className="text-xs text-muted block">Rok produkcji</span>
                      <span className="font-semibold text-ink">{offer.vehicle.productionYear}</span>
                    </div>
                    <div className="p-3 bg-paper rounded-xl border border-line">
                      <span className="text-xs text-muted block">Paliwo</span>
                      <span className="font-semibold text-ink">{formatFuelType(offer.vehicle.fuelType)}</span>
                    </div>
                    <div className="p-3 bg-paper rounded-xl border border-line">
                      <span className="text-xs text-muted block">Skrzynia biegów</span>
                      <span className="font-semibold text-ink">{formatTransmission(offer.vehicle.transmission)}</span>
                    </div>
                    {offer.vehicle.bodyType && (
                      <div className="p-3 bg-paper rounded-xl border border-line">
                        <span className="text-xs text-muted block">Nadwozie</span>
                        <span className="font-semibold text-ink">{offer.vehicle.bodyType}</span>
                      </div>
                    )}
                    {Boolean(offer.vehicle.powerHp) && (
                      <div className="p-3 bg-paper rounded-xl border border-line">
                        <span className="text-xs text-muted block">Moc silnika</span>
                        <span className="font-semibold text-ink">{offer.vehicle.powerHp} KM</span>
                      </div>
                    )}
                    {Boolean(offer.vehicle.engineCapacityCm3) && (
                      <div className="p-3 bg-paper rounded-xl border border-line">
                        <span className="text-xs text-muted block">Pojemność</span>
                        <span className="font-semibold text-ink">{offer.vehicle.engineCapacityCm3?.toLocaleString('pl-PL')} cm³</span>
                      </div>
                    )}
                    {offer.vehicle.drive && (
                      <div className="p-3 bg-paper rounded-xl border border-line">
                        <span className="text-xs text-muted block">Napęd</span>
                        <span className="font-semibold text-ink">{offer.vehicle.drive}</span>
                      </div>
                    )}
                    {offer.vehicle.color && (
                      <div className="p-3 bg-paper rounded-xl border border-line">
                        <span className="text-xs text-muted block">Kolor</span>
                        <span className="font-semibold text-ink">{offer.vehicle.color}</span>
                      </div>
                    )}
                    {Boolean(offer.vehicle.doors || offer.vehicle.seats) && (
                      <div className="p-3 bg-paper rounded-xl border border-line">
                        <span className="text-xs text-muted block">Drzwi / Miejsca</span>
                        <span className="font-semibold text-ink">
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
                  <div className="bg-white p-6 rounded-2xl border border-line shadow-xs space-y-6">
                    <h3 className="text-base font-bold text-ink flex items-center gap-2 font-heading">
                      <ShieldCheck className="h-5 w-5 text-forest" />
                      Wyposażenie pojazdu
                    </h3>

                    {offer.vehicle.equipmentSafety && offer.vehicle.equipmentSafety.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                          Bezpieczeństwo i asystenci
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ink">
                          {offer.vehicle.equipmentSafety.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-forest shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {offer.vehicle.equipmentComfortExtras && offer.vehicle.equipmentComfortExtras.length > 0 && (
                      <div className="pt-4 border-t border-line">
                        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                          Komfort i funkcjonalność
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ink">
                          {offer.vehicle.equipmentComfortExtras.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-forest shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {offer.vehicle.equipmentAudioMultimedia && offer.vehicle.equipmentAudioMultimedia.length > 0 && (
                      <div className="pt-4 border-t border-line">
                        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                          Multimedia i łączność
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ink">
                          {offer.vehicle.equipmentAudioMultimedia.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-forest shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {offer.vehicle.equipmentOther && offer.vehicle.equipmentOther.length > 0 && (
                      <div className="pt-4 border-t border-line">
                        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                          Pozostałe elementy
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ink">
                          {offer.vehicle.equipmentOther.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-muted shrink-0 mt-0.5" />
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
                  <div className="bg-white p-6 rounded-2xl border border-line shadow-xs">
                    <h3 className="text-base font-bold text-ink mb-3 font-heading">
                      {offer.vehicle.additionalInfoHeader || 'Dodatkowe informacje o pojeździe'}
                    </h3>
                    <p className="text-sm text-muted whitespace-pre-line leading-relaxed">
                      {offer.vehicle.additionalInfoContent}
                    </p>
                  </div>
                )}

                {/* Benefits in Rental */}
                <div className="p-5 bg-paper border border-line rounded-2xl shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-ink font-bold text-base font-heading">
                    <ShieldCheck className="h-5 w-5 text-forest" />
                    <h4>Co zawiera abonament najmu długoterminowego?</h4>
                  </div>
                  <p className="text-xs text-muted mb-2">
                    Stała rata miesięczna obejmuje kompleksową obsługę Twojego pojazdu bez nieprzewidzianych wydatków:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-ink">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-forest shrink-0" />
                      <span>Pełne ubezpieczenie OC / AC / NNW</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-forest shrink-0" />
                      <span>Kompletny pakiet serwisowy i przeglądy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-forest shrink-0" />
                      <span>Auto zastępcze w razie awarii lub kolizji</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-forest shrink-0" />
                      <span>Dedykowany doradca flotowy Benefivo</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Rate Calculator & Inquiry (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-line shadow-sm space-y-6 sticky top-24">
                  <div className="flex items-center justify-between border-b border-line pb-4">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-forest" />
                      <h3 className="font-bold text-ink text-base font-heading">Konfigurator abonamentu</h3>
                    </div>
                    <span className="text-xs font-semibold text-ink bg-lime px-2.5 py-1 rounded-full">
                      Abonament all-inclusive
                    </span>
                  </div>

                  {/* B2B Exclusive Notice Banner */}
                  {offer.isB2b && (
                    <div className="p-3.5 bg-lime/30 border border-line rounded-xl flex items-center gap-2.5 text-xs font-semibold text-ink">
                      <AlertCircle className="h-4 w-4 text-forest shrink-0" />
                      <span>Ta oferta jest dostępna wyłącznie dla firm (rozliczenie B2B).</span>
                    </div>
                  )}

                  {/* Client Type Toggle (B2B vs Consumer) */}
                  <div>
                    <span className="text-xs font-medium text-muted block mb-2">Klient / Forma umowy</span>
                    <div className="grid grid-cols-2 gap-2 bg-paper p-1 rounded-xl border border-line">
                      <button
                        type="button"
                        disabled={offer.isB2b}
                        onClick={() => setClientType('CONSUMER')}
                        title={offer.isB2b ? 'Oferta dostępna wyłącznie dla firm (B2B)' : undefined}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                          offer.isB2b
                            ? 'opacity-40 cursor-not-allowed text-muted'
                            : clientType === 'CONSUMER'
                            ? 'bg-white text-ink shadow-xs'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        Prywatnie
                      </button>
                      <button
                        type="button"
                        onClick={() => setClientType('B2B')}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                          clientType === 'B2B'
                            ? 'bg-white text-ink shadow-xs'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        Rozliczam B2B
                      </button>
                    </div>
                  </div>

                  {/* Okres umowy */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-ink">Okres umowy</span>
                      <span className="text-xs font-bold text-forest">{selectedMonths} miesięcy</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {offer.contractMonthsOptions.map((months) => (
                        <button
                          key={months}
                          type="button"
                          onClick={() => setSelectedMonths(months)}
                          className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                            selectedMonths === months
                              ? 'border-forest bg-forest/5 text-forest ring-2 ring-forest/20'
                              : 'border-line text-ink hover:bg-paper'
                          }`}
                        >
                          {months} msc
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Limity przebiegu (km/rok) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-ink">Limity przebiegu (km/rok)</span>
                      <span className="text-xs font-bold text-forest">
                        {selectedMileage >= 1000 ? `${selectedMileage / 1000} tys. km/rok` : `${selectedMileage} km/rok`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {offer.annualMileageOptions.map((mileage) => {
                        const label = formatMileageChip(mileage);
                        return (
                          <button
                            key={mileage}
                            type="button"
                            onClick={() => setSelectedMileage(mileage)}
                            className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                              selectedMileage === mileage
                                ? 'border-forest bg-forest/5 text-forest ring-2 ring-forest/20'
                                : 'border-line text-ink hover:bg-paper'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Wpłata wstępna */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-ink">Wpłata wstępna</span>
                      <span className="text-xs font-bold text-forest">
                        {selectedDownPayment?.label || '0%'}
                        {selectedDownPayment && selectedDownPayment.amountNet > 0
                          ? ` (${(clientType === 'CONSUMER' ? Math.round(selectedDownPayment.amountNet * 1.23) : selectedDownPayment.amountNet).toLocaleString('pl-PL')} zł ${clientType === 'CONSUMER' ? 'brutto' : 'netto'})`
                          : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {downPaymentChoices.map((downOpt) => {
                        const isSelected =
                          selectedDownPayment &&
                          selectedDownPayment.pct === downOpt.pct &&
                          selectedDownPayment.amountNet === downOpt.amountNet;
                        return (
                          <button
                            key={`${downOpt.pct}-${downOpt.amountNet}`}
                            type="button"
                            onClick={() => setSelectedDownPayment(downOpt)}
                            className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                              isSelected
                                ? 'border-forest bg-forest/5 text-forest ring-2 ring-forest/20'
                                : 'border-line text-ink hover:bg-paper'
                            }`}
                          >
                            {downOpt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Wynik Kalkulacji */}
                  <div className="pt-4 border-t border-line bg-paper -mx-6 -mb-6 p-6 rounded-b-2xl">
                    {activeOption ? (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted font-medium">Typ stawki:</span>
                          {activeOption.rateSource === 'PARTNER_MATRIX' ? (
                            <span className="text-xs font-semibold text-ink bg-lime px-2 py-0.5 rounded-full">
                              Stawka partnerska
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-muted bg-white px-2 py-0.5 rounded-full border border-line">
                              Stawka katalogowa
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline justify-between mb-3">
                          {clientType === 'CONSUMER' ? (
                            <>
                              <div>
                                <span className="text-xs font-medium text-muted block">Rata abonamentowa brutto</span>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-3xl font-black text-ink tracking-tight font-heading">
                                    {activeOption.monthlyRateGross.toLocaleString('pl-PL')} zł
                                  </span>
                                  <span className="text-xs font-semibold text-muted">brutto / mies.</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-bold text-muted block font-heading">
                                  {activeOption.monthlyRateNet.toLocaleString('pl-PL')} zł
                                </span>
                                <span className="text-[11px] text-muted">netto / mies.</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <span className="text-xs font-medium text-muted block">Rata abonamentowa netto</span>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-3xl font-black text-ink tracking-tight font-heading">
                                    {activeOption.monthlyRateNet.toLocaleString('pl-PL')} zł
                                  </span>
                                  <span className="text-xs font-semibold text-muted">netto / mies.</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-bold text-muted block font-heading">
                                  {activeOption.monthlyRateGross.toLocaleString('pl-PL')} zł
                                </span>
                                <span className="text-[11px] text-muted">brutto / mies.</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="text-xs text-muted flex justify-between border-t border-line pt-2.5">
                          <span>Wpłata wstępna:</span>
                          <span className="font-semibold text-ink">
                            {activeOption.downPaymentAmountPln > 0
                              ? `${(clientType === 'CONSUMER' ? Math.round(activeOption.downPaymentAmountPln * 1.23) : activeOption.downPaymentAmountPln).toLocaleString('pl-PL')} zł ${clientType === 'CONSUMER' ? 'brutto' : 'netto'}`
                              : activeOption.downPaymentPct > 0
                              ? `${activeOption.downPaymentPct}%`
                              : '0 zł'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="p-3 text-center text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200">
                        Wybrana kombinacja parametrów nie jest dostępna w matrycy stawek. Zmień okres lub limit kilometrów.
                      </div>
                    )}

                    {/* Przycisk Akcji */}
                    <button
                      type="button"
                      disabled={!activeOption}
                      onClick={() => setIsInquiryModalOpen(true)}
                      className="w-full mt-4 inline-flex items-center justify-center gap-2 py-3.5 px-6 bg-ink hover:bg-forest text-paper font-bold text-base rounded-xl transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Zapytaj o tę ofertę i ratę
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    <p className="text-2xs text-muted text-center mt-3">
                      Przesłanie zapytania jest bezpłatne i niezobowiązujące. Doradca Benefivo skontaktuje się z Tobą w ciągu 24 godzin.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <PortalFooter />

      {/* Modal Zapytania o Ofertę */}
      {offer && activeOption && (
        <InquiryModal
          isOpen={isInquiryModalOpen}
          onClose={() => setIsInquiryModalOpen(false)}
          initialContractParty={clientType === 'CONSUMER' ? 'CONSUMER' : 'EMPLOYEE_B2B'}
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
            isConsumer: clientType === 'CONSUMER'
          }}
          onViewMyInquiries={() => navigate('/zapytania')}
        />
      )}
    </div>
  );
};
