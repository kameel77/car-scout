import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  Layers,
  Calculator,
  Tag,
  Info
} from 'lucide-react';
import {
  fetchEmployeeOfferDetails,
  EmployeeOffer,
  EmployeeFinancingOption
} from './catalog-api';
import { InquiryModal } from '../inquiries/InquiryModal';
import { PortalHeader } from '../common/PortalHeader';
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

// Etykieta formy finansowania budowana z kategorii produktu (brief E2 §Zakres 4)
function getFinancingCategoryLabel(category: string): string {
  if (category === 'CREDIT') return 'Kredyt / finansowanie konsumenckie';
  if (category === 'LEASING') return 'Leasing operacyjny (B2B)';
  return category;
}

function nearestPeriodTo36(periods: number[]): number {
  if (periods.length === 0) return 36;
  return periods.reduce((best, p) => (Math.abs(p - 36) < Math.abs(best - 36) ? p : best), periods[0]);
}

const DOWN_PAYMENT_PRESETS = [0, 10, 20, 30, 45];
function buildDownPaymentChipOptions(min: number, max: number): number[] {
  const filtered = DOWN_PAYMENT_PRESETS.filter((p) => p >= min && p <= max);
  if (filtered.length > 0) return filtered;
  return Array.from(new Set([min, max]));
}

const RESIDUAL_PRESETS = [1, 10, 20, 30];
function buildResidualChipOptions(max: number): number[] {
  const filtered = RESIDUAL_PRESETS.filter((p) => p <= max);
  if (filtered.length > 0) return filtered;
  return [max];
}

export const NewCarOfferDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { config, isLoading: isBrandLoading } = useBrandConfig();
  const { isLoading: isAuthLoading, logout, sessionError } = useAuth();
  const navigate = useNavigate();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Data state
  const [offer, setOffer] = useState<EmployeeOffer | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Financing Calculator State
  const [contractType, setContractType] = useState<'LEASING_B2B' | 'CONSUMER'>('LEASING_B2B');
  const [months, setMonths] = useState<number>(36);
  const [downPaymentPct, setDownPaymentPct] = useState<number>(20);
  const [residualPct, setResidualPct] = useState<number>(20);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);

  // Inquiry Modal State
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState<boolean>(false);

  const loadDetails = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchEmployeeOfferDetails(config.apiUrl || '/api', id, signal);
      setOffer(data);
    } catch (err: unknown) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : 'Nie udało się pobrać szczegółów oferty';
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

  // E2: Konfiguracja finansowania z programu pracowniczego (nadpisania produktów). Gdy brak
  // konfiguracji lub pusta lista options — zachowanie kalkulatora identyczne jak przed E2.
  const financingOptions = offer?.financing?.options ?? [];
  const hasFinancingConfig = financingOptions.length > 0;
  const selectedOption: EmployeeFinancingOption | null = hasFinancingConfig
    ? (financingOptions[selectedOptionIndex] ?? financingOptions[0])
    : null;

  // Przy załadowaniu oferty lub zmianie wybranej opcji: dopasuj formę finansowania i skoryguj
  // bieżące wartości kalkulatora do dopuszczonego zakresu wybranej opcji.
  useEffect(() => {
    if (!hasFinancingConfig || !selectedOption) return;
    setContractType(selectedOption.category === 'CREDIT' ? 'CONSUMER' : 'LEASING_B2B');
    setMonths((prev) => (selectedOption.periods.includes(prev) ? prev : nearestPeriodTo36(selectedOption.periods)));
    setDownPaymentPct((prev) => Math.min(Math.max(prev, selectedOption.minDownPaymentPct), selectedOption.maxDownPaymentPct));
    setResidualPct((prev) => Math.min(prev, selectedOption.maxResidualPct));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOptionIndex, offer?.id]);

  // Kalkulacja finansowania
  // Standardowy algorytm leasingowy PMT używany w platformie Motolia
  const calculation = useMemo(() => {
    if (!offer) return null;

    const employeeGross = offer.pricing.employeePricePln;
    const employeeNet = Math.round(employeeGross / 1.23);

    const basePrice = contractType === 'LEASING_B2B' ? employeeNet : employeeGross;
    const initialPaymentAmount = Math.round((basePrice * downPaymentPct) / 100);
    const residualAmount = Math.round((basePrice * residualPct) / 100);
    const amountToFinance = Math.max(0, basePrice - initialPaymentAmount);

    // Stopa roczna: z konfiguracji programu (annualRatePct), a bez nadpisań — dotychczasowe 7.5%
    const annualRate = hasFinancingConfig && selectedOption ? selectedOption.annualRatePct : 7.5;
    const monthlyRate = annualRate / 100 / 12;

    let monthlyInstallment = 0;
    if (monthlyRate === 0) {
      monthlyInstallment = (amountToFinance - residualAmount) / (months || 1);
    } else {
      const pow = Math.pow(1 + monthlyRate, months);
      monthlyInstallment = (amountToFinance * monthlyRate - (residualAmount * monthlyRate) / pow) / (1 - 1 / pow);
    }

    const installmentRounded = Math.max(0, Math.round(monthlyInstallment));
    const installmentNet = contractType === 'LEASING_B2B' ? installmentRounded : Math.round(installmentRounded / 1.23);
    const installmentGross = contractType === 'LEASING_B2B' ? Math.round(installmentRounded * 1.23) : installmentRounded;

    return {
      basePrice,
      employeeNet,
      employeeGross,
      initialPaymentAmount,
      residualAmount,
      amountToFinance,
      installmentNet,
      installmentGross
    };
  }, [offer, contractType, months, downPaymentPct, residualPct, hasFinancingConfig, selectedOption]);

  // Tekst podsumowujący konfigurację do przekazania w zapytaniu
  const inquiryInitialNotes = useMemo(() => {
    if (!calculation || !offer) return '';
    const typeLabel = contractType === 'LEASING_B2B' ? 'Leasing operacyjny (B2B)' : 'Kredyt / Finansowanie konsumenckie';
    const productLabelLine = hasFinancingConfig && selectedOption
      ? `\n- Wybrany produkt finansowania: ${selectedOption.label}`
      : '';
    return `[Konfiguracja kalkulatora finansowania]:
- Typ finansowania: ${typeLabel}
- Okres umowy: ${months} miesięcy
- Wpłata własna: ${downPaymentPct}% (${calculation.initialPaymentAmount.toLocaleString('pl-PL')} zł ${contractType === 'LEASING_B2B' ? 'netto' : 'brutto'})
- Wykup końcowy: ${residualPct}% (${calculation.residualAmount.toLocaleString('pl-PL')} zł ${contractType === 'LEASING_B2B' ? 'netto' : 'brutto'})
- Szacowana rata: ${calculation.installmentNet.toLocaleString('pl-PL')} zł netto (${calculation.installmentGross.toLocaleString('pl-PL')} zł brutto) / mies.${productLabelLine}`;
  }, [calculation, offer, contractType, months, downPaymentPct, residualPct, hasFinancingConfig, selectedOption]);

  if (isBrandLoading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" />
          <div className="text-muted text-sm">Ładowanie oferty...</div>
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <span>{activeError}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/katalog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Wróć do listy samochodów
          </Link>
          <div className="text-xs text-muted font-medium">
            Samochody
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-24 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-line">
            <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" />
            <div className="text-muted text-sm">Pobieranie szczegółów pojazdu...</div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-8 bg-white rounded-2xl border border-red-200 text-center max-w-xl mx-auto my-12 shadow-xs">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Nie udało się załadować oferty</h2>
            <p className="text-sm text-red-600 mb-6">{error}</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => loadDetails()}
                className="px-5 py-2.5 bg-ink hover:bg-forest text-paper text-sm font-semibold rounded-xl transition-colors"
              >
                Spróbuj ponownie
              </button>
              <button
                type="button"
                onClick={() => navigate('/katalog')}
                className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
              >
                Wróć do katalogu
              </button>
            </div>
          </div>
        )}

        {/* Offer Detail Content */}
        {!isLoading && offer && (
          <div className="space-y-8">
            {/* Header / Titles */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {offer.pricing.discountPct > 0 && (
                      <span className="bg-forest text-paper font-bold text-xs px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        Rabat -{String(offer.pricing.discountPct).replace('.', ',')}%
                      </span>
                    )}
                    <span className="bg-lime text-ink font-semibold text-xs px-3 py-1 rounded-full">
                      Oferta pracownicza
                    </span>
                    {offer.vehicle.productionYear && (
                      <span className="bg-paper text-ink font-semibold text-xs px-3 py-1 rounded-full border border-line">
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
                  {offer.pricing.savingsPln > 0 && (
                    <div className="text-xs text-muted line-through">
                      Katalogowa: {offer.pricing.listPricePln.toLocaleString('pl-PL')} zł brutto
                    </div>
                  )}
                  <div className="flex lg:justify-end items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-ink tracking-tight font-heading">
                      {offer.pricing.employeePricePln.toLocaleString('pl-PL')} zł
                    </span>
                    <span className="text-xs text-muted font-medium">brutto</span>
                  </div>
                  {offer.pricing.savingsPln > 0 && (
                    <div className="text-xs font-semibold text-forest mt-0.5">
                      Oszczędzasz {offer.pricing.savingsPln.toLocaleString('pl-PL')} zł
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Grid: Photos + Calculator & Benefits */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Gallery + Specs + Equipment */}
              <div className="lg:col-span-7 space-y-6">
                {/* Image Gallery */}
                <div className="bg-white p-4 rounded-2xl border border-line shadow-xs overflow-hidden">
                  <ImageGallery
                    images={Array.from(
                      new Set([offer.vehicle.primaryImageUrl, ...(offer.vehicle.imageUrls || [])].filter(Boolean))
                    ) as string[]}
                    title={`${offer.vehicle.make} ${offer.vehicle.model}`}
                    aspectClassName="aspect-[16/10]"
                  />
                </div>

                {/* Technical Specifications Grid */}
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

                {/* Equipment Sections */}
                {(offer.vehicle.equipmentSafety?.length ||
                  offer.vehicle.equipmentComfortExtras?.length ||
                  offer.vehicle.equipmentAudioMultimedia?.length ||
                  offer.vehicle.equipmentOther?.length) ? (
                  <div className="bg-white p-6 rounded-2xl border border-line shadow-xs space-y-6">
                    <h3 className="text-base font-bold text-ink flex items-center gap-2 font-heading">
                      <ShieldCheck className="h-5 w-5 text-forest" />
                      Wyposażenie pojazdu
                    </h3>

                    {/* Bezpieczeństwo */}
                    {offer.vehicle.equipmentSafety && offer.vehicle.equipmentSafety.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                          Bezpieczeństwo i asystenci
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ink">
                          {offer.vehicle.equipmentSafety.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-forest flex-shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Komfort i dodatki */}
                    {offer.vehicle.equipmentComfortExtras && offer.vehicle.equipmentComfortExtras.length > 0 && (
                      <div className="pt-4 border-t border-line">
                        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                          Komfort i funkcjonalność
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ink">
                          {offer.vehicle.equipmentComfortExtras.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-forest flex-shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Audio i Multimedia */}
                    {offer.vehicle.equipmentAudioMultimedia && offer.vehicle.equipmentAudioMultimedia.length > 0 && (
                      <div className="pt-4 border-t border-line">
                        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                          Multimedia i łączność
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ink">
                          {offer.vehicle.equipmentAudioMultimedia.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-forest flex-shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inne */}
                    {offer.vehicle.equipmentOther && offer.vehicle.equipmentOther.length > 0 && (
                      <div className="pt-4 border-t border-line">
                        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                          Pozostałe elementy
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ink">
                          {offer.vehicle.equipmentOther.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-muted flex-shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Additional info / description if present */}
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
              </div>

              {/* Right Column: Financing Calculator & Inquiry Card */}
              <div className="lg:col-span-5 space-y-6">
                {/* Employee Benefit Package Box */}
                {offer.benefit && (
                  <div className="p-5 bg-paper border border-line rounded-2xl shadow-xs">
                    <div className="flex items-center gap-2 mb-2 text-ink font-bold text-base font-heading">
                      <Sparkles className="h-5 w-5 text-forest" />
                      <span>{offer.benefit.name}</span>
                    </div>
                    <p className="text-xs text-muted mb-4">
                      Specjalny pakiet benefitów przyznany w ramach programu partnerskiego Twojego pracodawcy.
                    </p>
                    <div className="space-y-2 text-sm">
                      {offer.benefit.moyaCardAmount && (
                        <div className="flex items-center gap-2 text-ink">
                          <CheckCircle className="h-4 w-4 text-forest flex-shrink-0" />
                          <span>Karta paliwowa Moya na kwotę <strong>{offer.benefit.moyaCardAmount.toLocaleString('pl-PL')} zł</strong></span>
                        </div>
                      )}
                      {offer.benefit.fuelDiscount && (
                        <div className="flex items-center gap-2 text-ink">
                          <CheckCircle className="h-4 w-4 text-forest flex-shrink-0" />
                          <span>Stały rabat na paliwo: <strong>{offer.benefit.fuelDiscount}</strong></span>
                        </div>
                      )}
                      {offer.benefit.consultantCare && (
                        <div className="flex items-center gap-2 text-ink">
                          <CheckCircle className="h-4 w-4 text-forest flex-shrink-0" />
                          <span>Dedykowany doradca flotowy i obsługa formalności door-to-door</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Financing Calculator Box */}
                <div className="bg-white p-6 rounded-2xl border border-line shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-line pb-4">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-forest" />
                      <h3 className="font-bold text-ink text-base font-heading">Kalkulator finansowania</h3>
                    </div>
                    <span className="text-xs font-semibold text-ink bg-lime px-2.5 py-1 rounded-full">
                      Cena pracownicza
                    </span>
                  </div>

                  {/* Contract Type Toggle */}
                  <div>
                    <span className="text-xs font-medium text-gray-500 block mb-2">Forma finansowania</span>
                    {hasFinancingConfig ? (
                      <div className={`grid gap-2 bg-gray-100 p-1 rounded-xl ${financingOptions.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {financingOptions.map((option, idx) => (
                          <button
                            key={option.productId}
                            type="button"
                            onClick={() => setSelectedOptionIndex(idx)}
                            className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                              selectedOptionIndex === idx
                                ? 'bg-white text-gray-900 shadow-xs'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            {getFinancingCategoryLabel(option.category)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setContractType('LEASING_B2B')}
                          className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                            contractType === 'LEASING_B2B'
                              ? 'bg-white text-gray-900 shadow-xs'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          Leasing (B2B)
                        </button>
                        <button
                          type="button"
                          onClick={() => setContractType('CONSUMER')}
                          className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                            contractType === 'CONSUMER'
                              ? 'bg-white text-gray-900 shadow-xs'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          Kredyt / Prywatnie
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Months Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-ink">Okres finansowania</span>
                      <span className="text-xs font-bold text-forest">{months} miesięcy</span>
                    </div>
                    {hasFinancingConfig && selectedOption ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedOption.periods.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMonths(m)}
                            className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                              months === m
                                ? 'border-forest bg-forest/5 text-forest ring-2 ring-forest/20'
                                : 'border-line text-ink hover:bg-paper'
                            }`}
                          >
                            {m} msc
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {[24, 36, 48, 60].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMonths(m)}
                            className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                              months === m
                                ? 'border-forest bg-forest/5 text-forest ring-2 ring-forest/20'
                                : 'border-line text-ink hover:bg-paper'
                            }`}
                          >
                            {m} msc
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Down Payment Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-ink">Wpłata wstępna</span>
                      <span className="text-xs font-bold text-forest">
                        {downPaymentPct}% (
                        {calculation ? calculation.initialPaymentAmount.toLocaleString('pl-PL') : 0} zł{' '}
                        {contractType === 'LEASING_B2B' ? 'netto' : 'brutto'})
                      </span>
                    </div>
                    {hasFinancingConfig && selectedOption ? (
                      <div className="flex flex-wrap gap-1.5">
                        {buildDownPaymentChipOptions(selectedOption.minDownPaymentPct, selectedOption.maxDownPaymentPct).map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setDownPaymentPct(pct)}
                            className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                              downPaymentPct === pct
                                ? 'border-forest bg-forest/5 text-forest ring-2 ring-forest/20'
                                : 'border-line text-ink hover:bg-paper'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1.5">
                        {[0, 10, 20, 30, 45].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setDownPaymentPct(pct)}
                            className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                              downPaymentPct === pct
                                ? 'border-forest bg-forest/5 text-forest ring-2 ring-forest/20'
                                : 'border-line text-ink hover:bg-paper'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Residual / Balloon Payment Selector */}
                  {(!hasFinancingConfig || (selectedOption && selectedOption.maxResidualPct > 0)) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-ink">Wykup końcowy</span>
                        <span className="text-xs font-bold text-forest">
                          {residualPct}% (
                          {calculation ? calculation.residualAmount.toLocaleString('pl-PL') : 0} zł{' '}
                          {contractType === 'LEASING_B2B' ? 'netto' : 'brutto'})
                        </span>
                      </div>
                      {hasFinancingConfig && selectedOption ? (
                        <div className="flex flex-wrap gap-2">
                          {buildResidualChipOptions(selectedOption.maxResidualPct).map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setResidualPct(pct)}
                              className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                                residualPct === pct
                                  ? 'border-forest bg-forest/5 text-forest ring-2 ring-forest/20'
                                  : 'border-line text-ink hover:bg-paper'
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {[1, 10, 20, 30].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setResidualPct(pct)}
                              className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                                residualPct === pct
                                  ? 'border-forest bg-forest/5 text-forest ring-2 ring-forest/20'
                                  : 'border-line text-ink hover:bg-paper'
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Result Rate Box */}
                  <div className="pt-4 border-t border-line bg-paper -mx-6 -mb-6 p-6 rounded-b-2xl">
                    <div className="flex items-baseline justify-between mb-2">
                      <div>
                        <span className="text-xs font-medium text-muted block">Szacowana rata miesięczna</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-ink tracking-tight font-heading">
                            {calculation ? calculation.installmentNet.toLocaleString('pl-PL') : 0} zł
                          </span>
                          <span className="text-xs font-semibold text-muted">netto / msc</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-muted block font-heading">
                          {calculation ? calculation.installmentGross.toLocaleString('pl-PL') : 0} zł
                        </span>
                        <span className="text-[11px] text-muted">brutto / msc</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-muted mb-4 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-muted flex-shrink-0" />
                      <span>Kalkulacja ma charakter orientacyjny. Rzeczywiste warunki zależą od oceny zdolności finansowej.</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsInquiryModalOpen(true)}
                      className="w-full py-3 px-4 bg-ink hover:bg-forest text-paper font-bold text-sm rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                    >
                      Zapytaj o tę ofertę i ratę
                    </button>
                  </div>
                </div>

                {/* Additional Guidance Box */}
                <div className="p-4 bg-white rounded-2xl border border-gray-200 text-xs text-gray-500 space-y-2">
                  <div className="font-semibold text-gray-700">Dlaczego warto przez program pracowniczy?</div>
                  <ul className="space-y-1 list-disc list-inside text-gray-600">
                    <li>Gwarancja wynegocjowanego rabatu flotowego</li>
                    <li>Brak ukrytych opłat i prowizji przygotowawczej</li>
                    <li>Szybka ścieżka weryfikacji wniosku</li>
                    <li>Opieka doradcy na każdym etapie odbioru auta</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Inquiry Modal */}
      {offer && (
        <InquiryModal
          isOpen={isInquiryModalOpen}
          onClose={() => setIsInquiryModalOpen(false)}
          offer={offer}
          initialNotes={inquiryInitialNotes}
          onViewMyInquiries={() => {
            setIsInquiryModalOpen(false);
            navigate('/zapytania');
          }}
        />
      )}
    </div>
  );
};
export default NewCarOfferDetailPage;
