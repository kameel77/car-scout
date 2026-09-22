import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  Layers,
  Calculator,
  Info
} from 'lucide-react';
import {
  fetchEmployeeOfferDetails,
  EmployeeOffer,
  EmployeeFinancingOption
} from './catalog-api';
import { InquiryModal } from '../inquiries/InquiryModal';
import { PortalHeader } from '../common/PortalHeader';
import { PortalFooter } from '../common/PortalFooter';
import { ImageGallery } from '../common/ImageGallery';
import { calculateInstallment, nearestPeriodTo36, formatPln, DEFAULT_FINANCING_OPTIONS } from './financing';
import { formatCountPl } from '../common/plural';

interface EquipmentAccordionProps {
  title: string;
  items: string[];
}

const EquipmentAccordion: React.FC<EquipmentAccordionProps> = ({ title, items }) => {
  if (!items || items.length === 0) return null;

  return (
    <details className="group py-1">
      <summary className="flex items-center justify-between gap-4 py-3 min-h-[44px] cursor-pointer list-none [&::-webkit-details-marker]:hidden text-sm font-semibold text-ink hover:text-forest transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 rounded-xl">
        <span className="flex items-center gap-2">
          <span>{title}</span>
          <span className="text-xs font-normal text-muted">
            ({formatCountPl(items.length, ['pozycja', 'pozycje', 'pozycji'])})
          </span>
        </span>
        <span
          aria-hidden="true"
          className="text-lg font-light text-muted group-open:rotate-45 transition-transform duration-200 motion-reduce:transition-none leading-none select-none px-1"
        >
          +
        </span>
      </summary>
      <div className="pb-4 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ink">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-forest flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
};

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
  if (category === 'CREDIT') return 'Prywatnie';
  if (category === 'LEASING') return 'Rozliczam B2B';
  return category;
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
  const [contractType, setContractType] = useState<'LEASING_B2B' | 'CONSUMER'>('CONSUMER');
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
  // konfiguracji lub pusta lista options - domyślne formy finansowania (Kredyt i Leasing po 7,5%).
  const financingOptions = useMemo(() => {
    const raw = (offer?.financing?.options && offer.financing.options.length > 0)
      ? offer.financing.options
      : DEFAULT_FINANCING_OPTIONS;
    return [...raw].sort((a, b) => {
      if (a.category === 'CREDIT' && b.category !== 'CREDIT') return -1;
      if (a.category !== 'CREDIT' && b.category === 'CREDIT') return 1;
      return 0;
    });
  }, [offer?.financing?.options]);
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
    if (!offer || !hasFinancingConfig || !selectedOption || typeof selectedOption.annualRatePct !== 'number') return null;

    return calculateInstallment({
      employeePriceGrossPln: offer.pricing.employeePricePln,
      contractType,
      months,
      downPaymentPct,
      residualPct,
      annualRatePct: selectedOption.annualRatePct
    });
  }, [offer, contractType, months, downPaymentPct, residualPct, hasFinancingConfig, selectedOption]);

  // Tekst podsumowujący konfigurację do przekazania w zapytaniu
  const inquiryInitialNotes = useMemo(() => {
    if (!offer) return '';
    if (!hasFinancingConfig || !calculation) {
      return `[Zapytanie o ofertę]:
- Pojazd: ${offer.vehicle.make} ${offer.vehicle.model} ${offer.vehicle.version || ''}
- Cena pracownicza: ${formatPln(offer.pricing.employeePricePln)} zł brutto
- Finansowanie: Rata na zapytanie (prośba o indywidualną kalkulację doradcy)`;
    }
    const typeLabel = contractType === 'CONSUMER' ? 'Kredyt / Finansowanie konsumenckie' : 'Leasing operacyjny (B2B)';
    const productLabelLine = selectedOption
      ? `\n- Wybrany produkt finansowania: ${selectedOption.label}`
      : '';
    const rateLine = contractType === 'CONSUMER'
      ? `- Szacowana rata: ${formatPln(calculation.installmentGross)} zł brutto (${formatPln(calculation.installmentNet)} zł netto) / mies.`
      : `- Szacowana rata: ${formatPln(calculation.installmentNet)} zł netto (${formatPln(calculation.installmentGross)} zł brutto) / mies.`;
    return `[Konfiguracja kalkulatora finansowania]:
- Typ finansowania: ${typeLabel}
- Okres umowy: ${months} miesięcy
- Wpłata własna: ${downPaymentPct}% (${formatPln(calculation.initialPaymentAmount)} zł ${contractType === 'CONSUMER' ? 'brutto' : 'netto'})
- Wykup końcowy: ${residualPct}% (${formatPln(calculation.residualAmount)} zł ${contractType === 'CONSUMER' ? 'brutto' : 'netto'})
${rateLine}${productLabelLine}`;
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
            <h2 className="text-lg font-bold text-ink mb-2">Nie udało się załadować oferty</h2>
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
                className="px-5 py-2.5 border border-line hover:bg-paper text-ink text-sm font-semibold rounded-xl transition-colors"
              >
                Wróć do katalogu
              </button>
            </div>
          </div>
        )}

        {/* Offer Detail Content */}
        {!isLoading && offer && (
          <div className="space-y-8">
            {/* Grid: Photos + Calculator & Benefits */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* 1. Left Column: Gallery + Specs + Equipment (Col 1-7 on desktop, 2nd on mobile) */}
              <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
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
                        <span className="font-semibold text-ink">{formatPln(offer.vehicle.engineCapacityCm3)} cm³</span>
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
                  <div className="bg-white p-6 rounded-2xl border border-line shadow-xs space-y-4">
                    <h3 className="text-base font-bold text-ink flex items-center gap-2 font-heading pb-2 border-b border-line">
                      <ShieldCheck className="h-5 w-5 text-forest" />
                      Wyposażenie pojazdu
                    </h3>

                    <div className="divide-y divide-line">
                      <EquipmentAccordion
                        title="Bezpieczeństwo i asystenci"
                        items={offer.vehicle.equipmentSafety || []}
                      />
                      <EquipmentAccordion
                        title="Komfort i funkcjonalność"
                        items={offer.vehicle.equipmentComfortExtras || []}
                      />
                      <EquipmentAccordion
                        title="Audio i multimedia"
                        items={offer.vehicle.equipmentAudioMultimedia || []}
                      />
                      <EquipmentAccordion
                        title="Pozostałe elementy"
                        items={offer.vehicle.equipmentOther || []}
                      />
                    </div>
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

              {/* 2. Right Column: Pricing Hero + Benefits + Calculator (Col 8-12 on desktop, 1st on mobile) */}
              <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
                {/* Title & Pricing Hero Card */}
                <div className="bg-white p-6 rounded-2xl border border-line shadow-xs space-y-4">
                  {/* Linia 1: Plakietki */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-lime text-ink font-semibold text-xs px-3 py-1 rounded-full">
                      Oferta pracownicza
                    </span>
                    {offer.vehicle.productionYear && (
                      <span className="bg-paper text-ink font-semibold text-xs px-3 py-1 rounded-full border border-line">
                        Rocznik {offer.vehicle.productionYear}
                      </span>
                    )}
                  </div>

                  {/* Linia 2: make + model jako h1, pod spodem version */}
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-heading">
                      {offer.vehicle.make} {offer.vehicle.model}
                    </h1>
                    {offer.vehicle.version && (
                      <p className="text-sm text-muted mt-1">
                        {offer.vehicle.version}
                      </p>
                    )}
                  </div>

                  {/* Linia 3: Przekreślona cena katalogowa + oszczędności */}
                  {offer.pricing.listPricePln > offer.pricing.employeePricePln && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs text-muted line-through">
                        Cena katalogowa: {formatPln(offer.pricing.listPricePln)} zł brutto
                      </span>
                      <span className="inline-flex items-center bg-lime text-ink font-semibold text-[11px] px-2.5 py-0.5 rounded-full">
                        Oszczędzasz {formatPln(offer.pricing.savingsPln)} zł
                      </span>
                    </div>
                  )}

                  {/* Linia 4: BOHATER - Szacowana rata miesięczna (sprzedaż raty) */}
                  <div className="pt-3 border-t border-line space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-bold uppercase tracking-wider text-muted block">
                        Szacowana rata miesięczna
                      </span>
                      <span className="text-xs font-semibold text-forest">
                        {contractType === 'CONSUMER' ? 'Kredyt konsumencki' : 'Leasing operacyjny'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black text-ink tracking-tight font-heading">
                        {calculation
                          ? formatPln(contractType === 'CONSUMER' ? calculation.installmentGross : calculation.installmentNet)
                          : 'od -'} zł
                      </span>
                      <span className="text-xs font-semibold text-muted">
                        {contractType === 'CONSUMER' ? 'brutto / mies.' : 'netto / mies.'}
                      </span>
                    </div>
                  </div>

                  {/* Linia 5: DRUGORZĘDNA - Cena pojazdu w programie */}
                  <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
                    <span className="text-muted font-medium">Cena w programie</span>
                    <span className="font-bold text-ink">
                      {formatPln(offer.pricing.employeePricePln)} zł brutto
                    </span>
                  </div>
                </div>

                {/* Dlaczego warto - Compact Benefits Bar */}
                <div className="p-3.5 bg-paper border border-line rounded-2xl shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-ink">
                    <div className="flex items-start gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-forest flex-shrink-0 mt-0.5" />
                      <span className="font-medium leading-tight">Gwarancja wynegocjowanego rabatu flotowego</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-forest flex-shrink-0 mt-0.5" />
                      <span className="font-medium leading-tight">Brak ukrytych opłat i prowizji przygotowawczej</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-forest flex-shrink-0 mt-0.5" />
                      <span className="font-medium leading-tight">Opieka doradcy na każdym etapie odbioru auta</span>
                    </div>
                  </div>
                </div>

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
                          <span>Karta paliwowa Moya na kwotę <strong>{formatPln(offer.benefit.moyaCardAmount)} zł</strong></span>
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
                          <span>Dedykowany doradca flotowy</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Financing Calculator Box or Rata na zapytanie */}
                {hasFinancingConfig && selectedOption ? (
                  <div className="bg-white p-6 rounded-2xl border border-line shadow-sm space-y-6 lg:sticky lg:top-20 lg:z-10">
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
                      <span className="text-xs font-medium text-muted block mb-2">Forma finansowania</span>
                      <div className={`grid gap-2 bg-paper p-1 rounded-xl border border-line ${financingOptions.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {financingOptions.map((option, idx) => (
                          <button
                            key={option.productId}
                            type="button"
                            onClick={() => setSelectedOptionIndex(idx)}
                            className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                              selectedOptionIndex === idx
                                ? 'bg-white text-ink shadow-xs'
                                : 'text-muted hover:text-ink'
                            }`}
                          >
                            {getFinancingCategoryLabel(option.category)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Months Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-ink">Okres finansowania</span>
                        <span className="text-xs font-bold text-forest">{months} miesięcy</span>
                      </div>
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
                    </div>

                    {/* Down Payment Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-ink">Wpłata początkowa</span>
                        <div className="text-right">
                          <span className="text-xs font-bold text-forest">{downPaymentPct}%</span>
                          {calculation && (
                            <span className="text-2xs text-muted block">
                              {formatPln(calculation.initialPaymentAmount)} zł {contractType === 'CONSUMER' ? 'brutto' : 'netto'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
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
                    </div>

                    {/* Residual Value Selector (if available) */}
                    {selectedOption.maxResidualPct > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-ink">Wykup końcowy</span>
                          <div className="text-right">
                            <span className="text-xs font-bold text-forest">{residualPct}%</span>
                            {calculation && (
                              <span className="text-2xs text-muted block">
                                {formatPln(calculation.residualAmount)} zł {contractType === 'CONSUMER' ? 'brutto' : 'netto'}
                              </span>
                            )}
                          </div>
                        </div>
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
                      </div>
                    )}

                    {/* Result Rate Box */}
                    <div className="pt-4 border-t border-line bg-paper -mx-6 -mb-6 p-6 rounded-b-2xl">
                      <div className="flex items-baseline justify-between mb-2">
                        {contractType === 'CONSUMER' ? (
                          <>
                            <div>
                              <span className="text-xs font-medium text-muted block">Szacowana rata miesięczna</span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-ink tracking-tight font-heading">
                                  {calculation ? formatPln(calculation.installmentGross) : '0'} zł
                                </span>
                                <span className="text-xs font-semibold text-muted">brutto / mies.</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-muted block font-heading">
                                {calculation ? formatPln(calculation.installmentNet) : '0'} zł
                              </span>
                              <span className="text-[11px] text-muted">netto / mies.</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="text-xs font-medium text-muted block">Szacowana rata miesięczna</span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-ink tracking-tight font-heading">
                                  {calculation ? formatPln(calculation.installmentNet) : '0'} zł
                                </span>
                                <span className="text-xs font-semibold text-muted">netto / mies.</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-muted block font-heading">
                                {calculation ? formatPln(calculation.installmentGross) : '0'} zł
                              </span>
                              <span className="text-[11px] text-muted">brutto / mies.</span>
                            </div>
                          </>
                        )}
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
                ) : (
                  <div className="bg-white p-6 rounded-2xl border border-line shadow-sm space-y-5 lg:sticky lg:top-20 lg:z-10">
                    <div className="flex items-center justify-between border-b border-line pb-4">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-forest" />
                        <h3 className="font-bold text-ink text-base font-heading">Kalkulator finansowania</h3>
                      </div>
                      <span className="text-xs font-semibold text-ink bg-paper border border-line px-2.5 py-1 rounded-full">
                        Rata na zapytanie
                      </span>
                    </div>

                    <div className="p-4 bg-paper rounded-xl border border-line">
                      <p className="text-xs text-muted leading-relaxed">
                        Dla tej oferty program nie posiada ustandaryzowanej matrycy rat. Dedykowany doradca przygotuje dla Ciebie indywidualną kalkulację finansowania (leasing konsumencki, pożyczka lub leasing B2B) dopasowaną do Twoich preferencji.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsInquiryModalOpen(true)}
                      className="w-full py-3.5 px-6 bg-ink hover:bg-forest text-paper font-semibold text-sm rounded-full transition-colors shadow-xs flex items-center justify-center gap-2"
                    >
                      <span>Zapytaj doradcę o ratę</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <PortalFooter />

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
