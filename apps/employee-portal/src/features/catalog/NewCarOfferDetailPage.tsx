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
  Info,
  ChevronDown,
  Home
} from 'lucide-react';
import {
  fetchEmployeeOfferDetails,
  calculateFinancingApi,
  EmployeeOffer,
  EmployeeFinancingOption
} from './catalog-api';
import { InquiryModal } from '../inquiries/InquiryModal';
import { PortalHeader } from '../common/PortalHeader';
import { PortalFooter } from '../common/PortalFooter';
import { ImageGallery } from '../common/ImageGallery';
import {
  calculateInstallment,
  nearestPeriodTo36,
  formatPln,
  DEFAULT_FINANCING_OPTIONS,
  KNOWN_FINANCING_PRODUCTS
} from './financing';
import { formatCountPl } from '../common/plural';

interface EquipmentAccordionProps {
  title: string;
  items: string[];
}

const EquipmentAccordion: React.FC<EquipmentAccordionProps> = ({ title, items }) => {
  if (!items || items.length === 0) return null;

  return (
    <details className="group py-3 first:pt-0 last:pb-0">
      <summary className="flex items-center justify-between cursor-pointer list-none select-none text-sm font-semibold text-ink hover:text-forest transition-colors">
        <span className="flex items-center gap-2">
          <span>{title}</span>
          <span className="text-xs font-normal text-muted">
            ({formatCountPl(items.length, ['pozycja', 'pozycje', 'pozycji'])})
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-2 text-sm text-ink">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-forest shrink-0 mt-0.5" />
            <span>{item}</span>
          </div>
        ))}
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

// Etykieta przycisku wyboru formy finansowania (Prywatnie vs Rozliczam B2B)
function getFinancingButtonLabel(category: string): string {
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

const RESIDUAL_PRESETS = [1, 10, 20, 30, 40];
function buildResidualChipOptions(max: number): number[] {
  const filtered = RESIDUAL_PRESETS.filter((p) => p <= max);
  if (filtered.length > 0) return filtered;
  return [max];
}

export const NewCarOfferDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { config } = useBrandConfig();
  const { logout, sessionError } = useAuth();
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
  const [residualPct, setResidualPct] = useState<number>(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);

  // Live API calculation state
  const [apiCalculation, setApiCalculation] = useState<{ installmentNet: number; installmentGross: number } | null>(null);

  // Inquiry Modal State
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState<boolean>(false);

  // Sticky Top Bar on scroll
  const [showStickyTopBar, setShowStickyTopBar] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyTopBar(window.scrollY > 220);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

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

  // Konfiguracja finansowania z programu pracowniczego (nadpisania produktów).
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
    const isCredit = selectedOption.category === 'CREDIT';
    setContractType(isCredit ? 'CONSUMER' : 'LEASING_B2B');
    setMonths((prev) => (selectedOption.periods.includes(prev) ? prev : nearestPeriodTo36(selectedOption.periods)));
    setDownPaymentPct((prev) => Math.min(Math.max(prev, selectedOption.minDownPaymentPct), selectedOption.maxDownPaymentPct));
    if (isCredit) {
      setResidualPct(0); // W kredycie konsumenckim brak wykupu balonowego
    } else {
      setResidualPct((prev) => (prev > 0 ? Math.min(prev, selectedOption.maxResidualPct || 40) : 20));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOptionIndex, offer?.id]);

  // Bazowa kalkulacja matematyczna (fallback offline PMT)
  const calculation = useMemo(() => {
    if (!offer || !hasFinancingConfig || !selectedOption || typeof selectedOption.annualRatePct !== 'number') return null;

    return calculateInstallment({
      employeePriceGrossPln: offer.pricing.employeePricePln,
      contractType,
      months,
      downPaymentPct,
      residualPct: contractType === 'CONSUMER' ? 0 : residualPct,
      annualRatePct: selectedOption.annualRatePct
    });
  }, [offer, contractType, months, downPaymentPct, residualPct, hasFinancingConfig, selectedOption]);

  // Odpytywanie produkcyjnego API /api/financing/calculate (VEHIS dla leasingu, INBANK dla kredytu)
  useEffect(() => {
    if (!offer || !selectedOption) return;

    let isCancelled = false;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const isLeasing = contractType === 'LEASING_B2B';
        const grossPrice = offer.pricing.employeePricePln;
        const netPrice = Math.round(grossPrice / 1.23);
        const price = isLeasing ? netPrice : grossPrice;
        const downPaymentAmount = Math.round((price * downPaymentPct) / 100);
        const finalPaymentPercent = isLeasing ? residualPct : 0;

        // Określenie ID produktu w bazie (użyj ID z opcji lub znanych produktów Vehis/Inbank)
        let productId = selectedOption.productId;
        if (productId === 'default-credit') {
          productId = KNOWN_FINANCING_PRODUCTS.INBANK_CREDIT;
        } else if (productId === 'default-leasing') {
          productId = KNOWN_FINANCING_PRODUCTS.VEHIS_LEASING;
        }

        const res = await calculateFinancingApi(config.apiUrl || '/api', {
          productId,
          price,
          downPaymentAmount,
          period: months,
          initialFeePercent: downPaymentPct,
          finalPaymentPercent,
          manufacturingYear: offer.vehicle.productionYear || 2026,
          mileageKm: 0
        }, controller.signal);

        if (!isCancelled && res && typeof res.monthlyInstallment === 'number') {
          if (isLeasing) {
            const installmentNet = Math.round(res.monthlyInstallment);
            const installmentGross = Math.round(installmentNet * 1.23);
            setApiCalculation({ installmentNet, installmentGross });
          } else {
            const installmentGross = Math.round(res.monthlyInstallment);
            const installmentNet = Math.round(installmentGross / 1.23);
            setApiCalculation({ installmentNet, installmentGross });
          }
        }
      } catch {
        if (!isCancelled) {
          setApiCalculation(null);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    offer?.id,
    offer?.pricing?.employeePricePln,
    offer?.vehicle?.productionYear,
    selectedOption?.productId,
    contractType,
    months,
    downPaymentPct,
    residualPct,
    config.apiUrl
  ]);

  // Efektywna rata (z API zewnętrznego lub wzorcowego silnika fallback)
  const effectiveInstallment = useMemo(() => {
    if (apiCalculation) {
      return {
        installmentNet: apiCalculation.installmentNet,
        installmentGross: apiCalculation.installmentGross,
        initialPaymentAmount: calculation?.initialPaymentAmount ?? 0,
        residualAmount: calculation?.residualAmount ?? 0
      };
    }
    return calculation;
  }, [apiCalculation, calculation]);

  // Płynne przewinięcie do kalkulatora z mobilnej belki
  const scrollToCalculator = () => {
    const el = document.getElementById('kalkulator-finansowania');
    if (el) {
      const headerOffset = 76;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Tekst podsumowujący konfigurację do przekazania w zapytaniu
  const inquiryInitialNotes = useMemo(() => {
    if (!offer) return '';
    if (!hasFinancingConfig || !effectiveInstallment) {
      return `[Zapytanie o ofertę]:
- Pojazd: ${offer.vehicle.make} ${offer.vehicle.model} ${offer.vehicle.version || ''}
- Cena dla Ciebie: ${formatPln(offer.pricing.employeePricePln)} zł brutto
- Finansowanie: Rata na zapytanie (prośba o indywidualną kalkulację doradcy)`;
    }
    const typeLabel = contractType === 'CONSUMER' ? 'Kredyt samochodowy (Prywatnie)' : 'Leasing operacyjny (B2B)';
    const productLabelLine = selectedOption
      ? `\n- Wybrany produkt finansowania: ${selectedOption.label}`
      : '';
    const rateLine = contractType === 'CONSUMER'
      ? `- Szacowana rata: ${formatPln(effectiveInstallment.installmentGross)} zł brutto (${formatPln(effectiveInstallment.installmentNet)} zł netto) / mies.`
      : `- Szacowana rata: ${formatPln(effectiveInstallment.installmentNet)} zł netto (${formatPln(effectiveInstallment.installmentGross)} zł brutto) / mies.`;

    const residualLine = contractType === 'CONSUMER'
      ? '- Wykup końcowy: brak (spłata 100% kapitału w ratach)'
      : `- Wykup końcowy: ${residualPct}% (${formatPln(effectiveInstallment.residualAmount)} zł netto)`;

    return `[Konfiguracja kalkulatora finansowania]:
- Typ finansowania: ${typeLabel}${productLabelLine}
- Okres umowy: ${months} miesięcy
- Wpłata własna: ${downPaymentPct}% (${formatPln(effectiveInstallment.initialPaymentAmount)} zł ${contractType === 'CONSUMER' ? 'brutto' : 'netto'})
${residualLine}
${rateLine}`;
  }, [offer, contractType, months, downPaymentPct, residualPct, hasFinancingConfig, effectiveInstallment, selectedOption]);

  // Komponenty cząstkowe UI
  const renderGallery = () => {
    if (!offer) return null;
    return (
      <div className="w-full bg-white p-4 rounded-2xl border border-line shadow-xs overflow-hidden">
        <ImageGallery
          images={Array.from(
            new Set([offer.vehicle.primaryImageUrl, ...(offer.vehicle.imageUrls || [])].filter(Boolean))
          ) as string[]}
          title={`${offer.vehicle.make} ${offer.vehicle.model}`}
          aspectClassName="aspect-[16/10]"
        />
      </div>
    );
  };

  const renderTitleAndPricing = () => {
    if (!offer) return null;
    return (
      <div className="w-full bg-white p-6 rounded-2xl border border-line shadow-xs space-y-4">
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
            <span className="text-xs text-muted">
              Cena katalogowa: <span className="line-through">{formatPln(offer.pricing.listPricePln)} zł brutto</span>
            </span>
            <span className="inline-flex items-center bg-lime text-ink font-semibold text-[11px] px-2.5 py-0.5 rounded-full">
              Oszczędzasz {formatPln(offer.pricing.savingsPln)} zł
            </span>
          </div>
        )}

        {/* Linia 4: BOHATER - Szacowana rata miesięczna */}
        <div className="pt-3 border-t border-line space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-muted block">
              Twoja rata
            </span>
            <span className="text-xs font-semibold text-forest">
              {contractType === 'CONSUMER' ? 'Kredyt samochodowy' : 'Leasing operacyjny'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-ink tracking-tight font-heading">
              {effectiveInstallment
                ? formatPln(contractType === 'CONSUMER' ? effectiveInstallment.installmentGross : effectiveInstallment.installmentNet)
                : 'od -'} zł
            </span>
            <span className="text-xs font-semibold text-muted">
              {contractType === 'CONSUMER' ? 'brutto / mies.' : 'netto / mies.'}
            </span>
          </div>
          {effectiveInstallment && (
            <p className="text-2xs text-muted">
              ({formatPln(contractType === 'CONSUMER' ? effectiveInstallment.installmentNet : effectiveInstallment.installmentGross)} zł {contractType === 'CONSUMER' ? 'netto' : 'brutto'})
            </p>
          )}
        </div>

        {/* Linia 5: DRUGORZĘDNA - Cena pojazdu dla Ciebie */}
        <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
          <span className="text-muted font-medium">Cena dla Ciebie</span>
          <span className="font-bold text-ink">
            {formatPln(offer.pricing.employeePricePln)} zł brutto
          </span>
        </div>
      </div>
    );
  };

  const renderBenefits = () => {
    if (!offer) return null;
    return (
      <div className="w-full space-y-4">
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
      </div>
    );
  };

  const renderSpecs = () => {
    if (!offer) return null;
    return (
      <div className="w-full bg-white p-6 rounded-2xl border border-line shadow-xs">
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
    );
  };

  const renderEquipment = () => {
    if (!offer) return null;
    const hasEquipment = Boolean(
      offer.vehicle.equipmentSafety?.length ||
      offer.vehicle.equipmentComfortExtras?.length ||
      offer.vehicle.equipmentAudioMultimedia?.length ||
      offer.vehicle.equipmentOther?.length
    );
    if (!hasEquipment) return null;

    return (
      <div className="w-full bg-white p-6 rounded-2xl border border-line shadow-xs space-y-4">
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
    );
  };

  const renderAdditionalInfo = () => {
    if (!offer?.vehicle.additionalInfoContent) return null;
    return (
      <div className="w-full bg-white p-6 rounded-2xl border border-line shadow-xs">
        <h3 className="text-base font-bold text-ink mb-3 font-heading">
          {offer.vehicle.additionalInfoHeader || 'Dodatkowe informacje o pojeździe'}
        </h3>
        <p className="text-sm text-muted whitespace-pre-line leading-relaxed">
          {offer.vehicle.additionalInfoContent}
        </p>
      </div>
    );
  };

  const renderCalculator = () => {
    if (!offer) return null;
    if (!hasFinancingConfig || !selectedOption) {
      return (
        <div id="kalkulator-finansowania" className="bg-white p-6 rounded-2xl border border-line shadow-sm space-y-5 lg:sticky lg:top-20">
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
            className="w-full py-3.5 px-6 bg-ink hover:bg-forest text-paper font-semibold text-sm rounded-full transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Zapytaj doradcę o ratę</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      );
    }

    return (
      <div id="kalkulator-finansowania" className="w-full bg-white rounded-2xl border border-line shadow-sm overflow-hidden lg:sticky lg:top-20 scroll-mt-20">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-forest" />
              <h3 className="font-bold text-ink text-base font-heading">Kalkulator finansowania</h3>
            </div>
          </div>

          {/* Forma finansowania z dynamiczną etykietą po prawej */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-ink">Forma finansowania</span>
              <span className="text-xs font-bold text-forest">
                {contractType === 'CONSUMER' ? 'Kredyt samochodowy' : 'Leasing operacyjny'}
              </span>
            </div>
            <div className={`grid gap-2 bg-paper p-1 rounded-xl border border-line ${financingOptions.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {financingOptions.map((option, idx) => (
                <button
                  key={option.productId}
                  type="button"
                  onClick={() => setSelectedOptionIndex(idx)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    selectedOptionIndex === idx
                      ? 'bg-white text-ink shadow-xs'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {getFinancingButtonLabel(option.category)}
                </button>
              ))}
            </div>
          </div>

          {/* Okres finansowania */}
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
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
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

          {/* Wpłata początkowa */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-ink">Wpłata początkowa</span>
              <div className="text-right">
                <span className="text-xs font-bold text-forest">{downPaymentPct}%</span>
                {effectiveInstallment && (
                  <span className="text-2xs text-muted block">
                    {formatPln(effectiveInstallment.initialPaymentAmount)} zł {contractType === 'CONSUMER' ? 'brutto' : 'netto'}
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
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
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

          {/* Wykup końcowy - WIDOCZNY TYLKO W LEASINGU B2B, CHOWANY W KREDYCIE */}
          {contractType === 'LEASING_B2B' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-ink">Wykup końcowy</span>
                <div className="text-right">
                  <span className="text-xs font-bold text-forest">{residualPct}%</span>
                  {effectiveInstallment && (
                    <span className="text-2xs text-muted block">
                      {formatPln(effectiveInstallment.residualAmount)} zł netto
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {buildResidualChipOptions(selectedOption.maxResidualPct || 40).map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setResidualPct(pct)}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
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
        </div>

        {/* Podsumowanie raty */}
        <div className="p-6 bg-paper border-t border-line space-y-4">
          <div className="flex items-baseline justify-between mb-2">
            {contractType === 'CONSUMER' ? (
              <>
                <div>
                  <span className="text-xs font-medium text-muted block">Szacowana rata miesięczna</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-ink tracking-tight font-heading">
                      {effectiveInstallment ? formatPln(effectiveInstallment.installmentGross) : '0'} zł
                    </span>
                    <span className="text-xs font-semibold text-muted">brutto / mies.</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-muted block font-heading">
                    {effectiveInstallment ? formatPln(effectiveInstallment.installmentNet) : '0'} zł
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
                      {effectiveInstallment ? formatPln(effectiveInstallment.installmentNet) : '0'} zł
                    </span>
                    <span className="text-xs font-semibold text-muted">netto / mies.</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-muted block font-heading">
                    {effectiveInstallment ? formatPln(effectiveInstallment.installmentGross) : '0'} zł
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
            className="w-full py-3.5 px-4 bg-ink hover:bg-forest text-paper font-bold text-sm rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            Zapytaj o tę ofertę i ratę
          </button>
        </div>
      </div>
    );
  };

  const renderMobileStickyTopBar = () => {
    if (!offer) return null;
    const rateNumber = effectiveInstallment
      ? (contractType === 'CONSUMER' ? effectiveInstallment.installmentGross : effectiveInstallment.installmentNet)
      : null;
    const rateSuffix = contractType === 'CONSUMER' ? 'brutto / msc' : 'netto / msc';

    return (
      <div
        className={`lg:hidden fixed top-0 left-0 right-0 h-16 z-40 bg-white/95 backdrop-blur-md border-b border-line shadow-xs px-4 flex items-center transition-all duration-300 transform ${
          showStickyTopBar ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between gap-3 w-full max-w-7xl mx-auto">
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-ink truncate font-heading leading-tight">
              {offer.vehicle.make} {offer.vehicle.model}
            </div>
            <div className="text-xs text-muted truncate mt-0.5">
              {offer.vehicle.productionYear ? `Rocznik ${offer.vehicle.productionYear}` : ''}
              {offer.vehicle.productionYear && offer.vehicle.version ? ' · ' : ''}
              {offer.vehicle.version || ''}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg sm:text-xl font-black text-ink font-heading leading-tight">
              {rateNumber !== null ? `${formatPln(rateNumber)} zł` : 'od - zł'}
            </div>
            <div className="text-[11px] font-semibold text-muted">
              {rateSuffix}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMobileStickyBottomBar = () => {
    if (!offer) return null;

    return (
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-line shadow-lg px-4 py-2.5 pb-[calc(0.6rem+env(safe-area-inset-bottom))] flex items-center gap-2.5">
        <Link
          to="/katalog"
          aria-label="Strona główna katalogu"
          title="Strona główna katalogu"
          className="p-2.5 bg-paper hover:bg-paper/80 border border-line rounded-xl text-ink transition-colors flex items-center justify-center shrink-0 cursor-pointer"
        >
          <Home className="h-5 w-5 text-forest" />
        </Link>
        <button
          type="button"
          onClick={scrollToCalculator}
          aria-label="Przejdź do kalkulatora"
          title="Przejdź do kalkulatora"
          className="p-2.5 bg-paper hover:bg-paper/80 border border-line rounded-xl text-ink transition-colors flex items-center justify-center shrink-0 cursor-pointer"
        >
          <Calculator className="h-5 w-5 text-forest" />
        </button>
        <button
          type="button"
          onClick={() => setIsInquiryModalOpen(true)}
          className="flex-1 py-2.5 px-4 bg-forest hover:bg-forest/90 text-lime font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <span>Zapytaj o ofertę</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-sans">
      <PortalHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Breadcrumb row */}
        <div className="flex items-center justify-between">
          <Link
            to="/katalog"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Wróć do listy samochodów</span>
          </Link>
        </div>

        {/* Global errors */}
        {(logoutError || sessionError) && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-xs text-red-900">
            <div>{logoutError || sessionError}</div>
            <button
              type="button"
              onClick={() => {
                setLogoutError(null);
                navigate('/logowanie');
              }}
              className="font-semibold underline hover:text-red-700 cursor-pointer"
            >
              Zaloguj ponownie
            </button>
          </div>
        )}

        {/* Skeleton Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-pulse">
            <div className="lg:col-span-7 space-y-6">
              <div className="h-80 bg-white border border-line rounded-2xl" />
              <div className="h-64 bg-white border border-line rounded-2xl" />
            </div>
            <div className="lg:col-span-5 space-y-6">
              <div className="h-96 bg-white border border-line rounded-2xl" />
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-8 bg-white border border-line rounded-2xl text-center space-y-4 max-w-xl mx-auto my-12">
            <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-2">
              <Info className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-ink">Nie udało się załadować oferty</h2>
            <p className="text-xs text-muted leading-relaxed">{error}</p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/katalog')}
                className="px-5 py-2.5 bg-ink text-paper text-xs font-semibold rounded-full hover:bg-forest transition-colors cursor-pointer"
              >
                Wróć do katalogu
              </button>
            </div>
          </div>
        )}

        {/* Offer Detail Content */}
        {!isLoading && offer && (
          <div className="flex flex-col w-full lg:grid lg:grid-cols-12 gap-6 lg:gap-8 lg:items-start pb-24 lg:pb-0">
            {/* Left Column on Desktop / Mobile items via contents */}
            <div className="contents lg:block lg:col-span-7 space-y-6">
              <div className="w-full order-1 lg:order-none">
                {renderGallery()}
              </div>
              <div className="w-full order-4 lg:order-none">
                {renderSpecs()}
              </div>
              <div className="w-full order-5 lg:order-none">
                {renderEquipment()}
              </div>
              <div className="w-full order-6 lg:order-none">
                {renderAdditionalInfo()}
              </div>
            </div>

            {/* Right Column on Desktop / Mobile items via contents */}
            <div className="contents lg:block lg:col-span-5 space-y-6">
              <div className="w-full order-2 lg:order-none">
                {renderTitleAndPricing()}
              </div>
              <div className="w-full order-3 lg:order-none">
                {renderBenefits()}
              </div>
              <div className="w-full order-7 lg:order-none">
                {renderCalculator()}
              </div>
            </div>

            {/* Mobile Sticky Bars */}
            {renderMobileStickyTopBar()}
            {renderMobileStickyBottomBar()}
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
