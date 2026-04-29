import { useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { faqApi } from '@/services/api';
import { CallbackForm } from '@/components/CallbackForm';
import type { FaqEntry } from '@/types/faq';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { ImageGallery } from '@/components/ImageGallery';
import { rentalPublicApi } from '@/services/rental-api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { PartnerSidebarAd } from '@/components/ads/PartnerSidebarAd';
import { usePartnerAds } from '@/hooks/usePartnerAds';
import { PurchaseProcessStepper } from '@/components/PurchaseProcessStepper';
import {
    ArrowLeft, Calendar, Gauge, Fuel, Settings2, MapPin,
    Shield, ChevronDown, Building2, Car, FileText, Music, ShieldCheck, Sofa, Package,
    User, Hash, Palette, DoorOpen, Paintbrush, Armchair, Cog, Phone
} from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { normalizeRentalImageUrl } from '@/lib/utils';
import { formatNumber } from '@/utils/formatters';
import { RentalFinancingContent } from '@/components/RentalFinancingContent';

type OfferType = 'business' | 'consumer';

export default function RentalDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const isLoggedIn = !!token;
    const { config } = useBrand();

    const { data, isLoading } = useQuery({
        queryKey: ['rental-vehicle-public', slug],
        queryFn: () => rentalPublicApi.getVehicle(slug!),
        enabled: !!slug
    });

    // FAQ for rental pages
    const { data: faqData } = useQuery({
        queryKey: ['faq', 'rental'],
        queryFn: () => faqApi.list({ page: 'rental', pageContext: 'rental' }),
        staleTime: 5 * 60 * 1000
    });
    const faqEntries = faqData?.entries || [];

    // Below-equipment ads
    const { data: belowEquipmentAdsData } = usePartnerAds('DETAIL_BELOW_EQUIPMENT', 'rental');
    const belowEquipmentAds = belowEquipmentAdsData?.ads || [];

    const vehicle = data?.vehicle;
    const options = data?.options;

    // Calculator state — init with first available option
    const [selectedMileage, setSelectedMileage] = useState<number | null>(null);
    const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
    const [selectedPayment, setSelectedPayment] = useState<number | null>(null);
    const [selectedOfferType, setSelectedOfferType] = useState<OfferType>(() => {
        try {
            const stored = localStorage.getItem('rentalClientType');
            if (stored === 'business' || stored === 'consumer') return stored;
        } catch { /* localStorage unavailable */ }
        return 'business';
    });
    const [showAllSpecs, setShowAllSpecs] = useState(false);

    // Initialize defaults when data loads
    if (options && selectedMileage === null && options.annualMileageOptions?.length > 0) {
        setSelectedMileage(options.annualMileageOptions[0]);
    }
    if (options && selectedMonths === null && options.contractMonthOptions?.length > 0) {
        setSelectedMonths(options.contractMonthOptions[0]);
    }
    if (options && selectedPayment === null && options.initialPaymentOptions?.length > 0) {
        setSelectedPayment(options.initialPaymentOptions[0]);
    }

    // Determine available offer types from the options data
    const availableOfferTypes = useMemo<Set<string>>(() => {
        const types = options?.offerTypeOptions;
        if (!types || types.length === 0) return new Set(['business', 'consumer']);
        const s = new Set<string>();
        for (const t of types) {
            if (t === 'all') { s.add('business'); s.add('consumer'); }
            else s.add(t);
        }
        return s;
    }, [options?.offerTypeOptions]);

    // If current selection is unavailable, switch
    if (!availableOfferTypes.has(selectedOfferType)) {
        const first = availableOfferTypes.values().next().value;
        if (first && first !== selectedOfferType) {
            setSelectedOfferType(first as OfferType);
        }
    }

    // Calculation query — keepPreviousData prevents offer card flashing on param change
    const calcQuery = useQuery({
        queryKey: ['rental-calc', slug, selectedMileage, selectedMonths, selectedPayment, selectedOfferType],
        queryFn: () => rentalPublicApi.calculate(slug!, {
            annualMileageKm: selectedMileage!,
            contractMonths: selectedMonths!,
            initialPaymentPct: selectedPayment!,
            offerType: selectedOfferType
        }),
        enabled: !!slug && selectedMileage !== null && selectedMonths !== null && selectedPayment !== null,
        placeholderData: (prev) => prev
    });

    const offers = calcQuery.data?.offers || [];

    // Images for gallery — normalize URLs to handle legacy data (bare filename without path)
    const vehicleId = vehicle?.id;
    const images = (vehicle?.imageUrls || []).map((u: string) => normalizeRentalImageUrl(u, vehicleId) ?? u);
    const galleryImages = images.length > 0 ? images : (
        vehicle?.primaryImageUrl ? [normalizeRentalImageUrl(vehicle.primaryImageUrl, vehicleId) ?? vehicle.primaryImageUrl] : []
    );

    // Build rental state for lead form
    const buildRentalState = useCallback((offer: any) => ({
        rental: {
            companyName: isLoggedIn ? offer.company?.name : undefined,
            companyId: offer.company?.id,
            monthlyRate: offer.monthlyRateGross,
            annualMileageKm: selectedMileage ?? undefined,
            contractMonths: selectedMonths ?? undefined,
            initialPaymentPct: selectedPayment ?? undefined,
            offerType: selectedOfferType,
        }
    }), [isLoggedIn, selectedMileage, selectedMonths, selectedPayment, selectedOfferType]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Header onClearFilters={() => {}} hasActiveFilters={false} />
                <div className="container py-10">
                    <div className="h-[400px] bg-gray-200 rounded-2xl animate-pulse" />
                </div>
            </div>
        );
    }

    if (!vehicle) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Header onClearFilters={() => {}} hasActiveFilters={false} />
                <div className="container py-20 text-center">
                    <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold">Pojazd nie został znaleziony</h2>
                    <Link to="/wynajem-dlugoterminowy" className="text-accent hover:underline mt-4 inline-block">
                        Wróć do listy
                    </Link>
                </div>
            </div>
        );
    }

    const specs = [
        { label: 'Rok produkcji', value: vehicle.productionYear, icon: Calendar },
        { label: 'Moc', value: vehicle.enginePowerHp ? `${vehicle.enginePowerHp} KM` : null, icon: Gauge },
        { label: 'Paliwo', value: vehicle.fuelType, icon: Fuel },
        { label: 'Skrzynia biegów', value: vehicle.transmission, icon: Settings2 },
        { label: 'Napęd', value: vehicle.drive, icon: Cog },
        { label: 'Pojemność', value: vehicle.engineCapacityCm3 ? `${vehicle.engineCapacityCm3} cm³` : null, icon: Hash },
        { label: 'Nadwozie', value: vehicle.bodyType, icon: Car },
        { label: 'Kolor', value: vehicle.color, icon: Palette },
        { label: 'Drzwi', value: vehicle.doors, icon: DoorOpen },
        { label: 'Miejsca', value: vehicle.seats, icon: Armchair },
        { label: 'Lakier', value: vehicle.paintType, icon: Paintbrush },
    ].filter(s => s.value);

    // Equipment categories
    const equipmentCategories = [
        { label: 'Audio i Multimedia', icon: Music, items: vehicle.equipmentAudioMultimedia },
        { label: 'Bezpieczeństwo', icon: ShieldCheck, items: vehicle.equipmentSafety },
        { label: 'Komfort i Dodatki', icon: Sofa, items: vehicle.equipmentComfortExtras },
        { label: 'Inne', icon: Package, items: vehicle.equipmentOther },
    ].filter(cat => cat.items?.length > 0);

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
            <Header onClearFilters={() => {}} hasActiveFilters={false} />

            <main className="container pb-10 pt-4">
                {/* Breadcrumb */}
                <Link to="/wynajem-dlugoterminowy" className="inline-flex items-center gap-1 text-sm text-accent hover:opacity-80 mb-4">
                    <ArrowLeft className="w-4 h-4" /> Wróć do listy
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Gallery + Specs + FAQ */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Gallery — shared component */}
                        <ImageGallery images={galleryImages} title={`${vehicle.make} ${vehicle.model}`} />

                        {/* Vehicle title + specs */}
                        <div className="bg-white rounded-2xl shadow-sm border p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
                                        {vehicle.make} {vehicle.model}
                                    </h1>
                                    {vehicle.version && (
                                        <p className="text-lg text-muted-foreground mt-1">{vehicle.version}</p>
                                    )}
                                    {vehicle.dealer && (
                                        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                                            <MapPin className="w-3 h-3" /> {vehicle.dealer.name}, {vehicle.dealer.city}
                                        </p>
                                    )}
                                </div>
                                {vehicle.catalogPrice && (
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-xl font-bold text-foreground">
                                            {formatNumber(vehicle.catalogPrice)} zł
                                        </div>
                                        <div className="text-xs text-muted-foreground">cena katalogowa</div>
                                    </div>
                                )}
                            </div>

                            {/* Key Parameters — using design-system spec classes */}
                            <h2 className="font-heading text-xl font-semibold mt-6 mb-4">Kluczowe parametry</h2>
                            <div className="spec-grid">
                                {specs.slice(0, showAllSpecs ? specs.length : 8).map(s => {
                                    const Icon = s.icon;
                                    return (
                                        <div key={s.label} className="spec-item">
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4 text-primary" />
                                                <span className="spec-label">{s.label}</span>
                                            </div>
                                            <span className="spec-value capitalize">{s.value}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {specs.length > 8 && (
                                <button
                                    onClick={() => setShowAllSpecs(!showAllSpecs)}
                                    className="text-sm text-accent hover:opacity-80 mt-3 flex items-center gap-1"
                                >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showAllSpecs ? 'rotate-180' : ''}`} />
                                    {showAllSpecs ? 'Zwiń specyfikację' : 'Pełna specyfikacja'}
                                </button>
                            )}

                            {/* Equipment — all 4 categories */}
                            {equipmentCategories.length > 0 && (
                                <div className="mt-8 pt-6 border-t space-y-4">
                                    <h3 className="font-heading text-xl font-semibold mb-2">Wyposażenie</h3>
                                    {equipmentCategories.map(cat => {
                                        const Icon = cat.icon;
                                        return (
                                            <details key={cat.label} className="group">
                                                <summary className="flex items-center gap-2 cursor-pointer text-base font-semibold text-foreground hover:text-accent transition-colors py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md">
                                                    <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" />
                                                    <Icon className="w-5 h-5 text-primary" />
                                                    {cat.label}
                                                    <span className="text-sm font-normal text-muted-foreground ml-1">({cat.items.length})</span>
                                                </summary>
                                                <div className="pl-9 pt-1 pb-3 space-y-2">
                                                    {cat.items.map((e: string, i: number) => (
                                                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground leading-snug">
                                                            <span className="text-accent font-bold text-sm flex-shrink-0 mt-0.5">✓</span>
                                                            {e}
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Below Equipment Ads */}
                            {belowEquipmentAds.filter(a => a.isActive).length > 0 && (
                                <div className="mt-6 pt-6 border-t">
                                    {belowEquipmentAds.filter(a => a.isActive).map(ad => (
                                        <PartnerSidebarAd
                                            key={ad.id}
                                            title={ad.title}
                                            description={ad.description || ''}
                                            ctaText={ad.ctaText}
                                            url={ad.url}
                                            brandName={ad.brandName}
                                            imageUrl={ad.imageUrl}
                                            features={ad.features}
                                            overlayOpacity={ad.overlayOpacity}
                                            hideUiElements={ad.hideUiElements}
                                            className="my-4"
                                        />
                                    ))}
                                </div>
                            )}
                            
                            {/* Purchase Process Steps */}
                            <div className="mt-8">
                                <PurchaseProcessStepper variant="compact" />
                            </div>

                            {/* SEO/Informational Content block for Long Term Rental */}
                            <div className="mt-8">
                                <RentalFinancingContent vehicle={vehicle} />
                            </div>
                     </div>



                     {/* FAQ in left column — stays visible while calculator is sticky on the right */}
                     {faqEntries.filter((e: FaqEntry) => e.isPublished).length > 0 && (
                         <div className="bg-white rounded-2xl shadow-sm border p-6">
                             <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Najczęściej zadawane pytania</h2>
                             <Accordion type="multiple" className="w-full space-y-3">
                                 {faqEntries.filter((e: FaqEntry) => e.isPublished).map((entry: FaqEntry) => (
                                     <AccordionItem
                                         key={entry.id}
                                         value={entry.id}
                                         className="rounded-lg border border-border bg-card shadow-sm px-4"
                                     >
                                         <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline text-left py-4">
                                             {entry.questionPl}
                                         </AccordionTrigger>
                                         <AccordionContent className="pb-4 text-muted-foreground text-sm leading-relaxed">
                                             {entry.answerPl}
                                         </AccordionContent>
                                     </AccordionItem>
                                 ))}
                             </Accordion>
                         </div>
                     )}
                    </div>{/* end lg:col-span-2 */}

                    {/* Right: sticky calculator */}
                    <div>
                        <div className="bg-white rounded-2xl shadow-sm border p-6 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
                            <h2 className="text-lg font-bold text-gray-900 mb-5">Kalkulator najmu</h2>

                            {/* Offer type toggle: Business / Private */}
                            <div className="space-y-2 mb-5">
                                <label className="text-sm font-medium text-gray-700">Typ oferty</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setSelectedOfferType('business'); try { localStorage.setItem('rentalClientType', 'business'); } catch { /* localStorage unavailable */ } }}
                                        disabled={!availableOfferTypes.has('business')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                            selectedOfferType === 'business'
                                                ? 'bg-accent text-accent-foreground shadow-md'
                                                : !availableOfferTypes.has('business')
                                                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        <Building2 className="w-4 h-4" /> Na firmę
                                    </button>
                                    <button
                                        onClick={() => { setSelectedOfferType('consumer'); try { localStorage.setItem('rentalClientType', 'consumer'); } catch { /* localStorage unavailable */ } }}
                                        disabled={!availableOfferTypes.has('consumer')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                            selectedOfferType === 'consumer'
                                                ? 'bg-accent text-accent-foreground shadow-md'
                                                : !availableOfferTypes.has('consumer')
                                                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        <User className="w-4 h-4" /> Prywatnie
                                    </button>
                                </div>
                            </div>

                            {/* Mileage */}
                            <div className="space-y-2 mb-5">
                                <label className="text-sm font-medium text-gray-700">Przebieg roczny</label>
                                <div className="flex flex-wrap gap-2">
                                    {options?.annualMileageOptions?.map((km: number) => (
                                        <button
                                            key={km}
                                            onClick={() => setSelectedMileage(km)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                selectedMileage === km
                                                    ? 'bg-accent text-accent-foreground shadow-md'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            {(km / 1000).toFixed(0)} tys. km
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Contract months */}
                            <div className="space-y-2 mb-5">
                                <label className="text-sm font-medium text-gray-700">Okres umowy</label>
                                <div className="flex flex-wrap gap-2">
                                    {options?.contractMonthOptions?.map((m: number) => (
                                        <button
                                            key={m}
                                            onClick={() => setSelectedMonths(m)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                selectedMonths === m
                                                    ? 'bg-accent text-accent-foreground shadow-md'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            {m} mies.
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Initial payment */}
                            <div className="space-y-2 mb-6">
                                <label className="text-sm font-medium text-gray-700">Opłata wstępna</label>
                                <div className="flex flex-wrap gap-2">
                                    {options?.initialPaymentOptions?.map((pct: number) => (
                                        <button
                                            key={pct}
                                            onClick={() => setSelectedPayment(pct)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                selectedPayment === pct
                                                    ? 'bg-accent text-accent-foreground shadow-md'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            {pct}%
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Results */}
                            {calcQuery.isLoading && (
                                <div className="p-4 bg-gray-50 rounded-xl animate-pulse">
                                    <div className="h-12 bg-gray-200 rounded mb-2" />
                                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                                </div>
                            )}

                            {offers.length > 0 && (
                                <div className="space-y-3">
                                    {offers.map((offer: any, i: number) => (
                                        <div
                                            key={i}
                                            className={`p-4 rounded-xl border-2 transition-all ${
                                                i === 0 ? 'border-accent bg-accent/5' : 'border-gray-200 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                {isLoggedIn ? (
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="w-4 h-4 text-gray-500" />
                                                        <span className="font-medium text-sm">{offer.company.name}</span>
                                                    </div>
                                                ) : (
                                                    <div></div>
                                                )}
                                                {i === 0 && (
                                                    <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-medium">Najlepsza</span>
                                                )}
                                            </div>
                                            <div className="text-3xl font-bold text-gray-900">
                                                {selectedOfferType === 'business'
                                                    ? `${formatNumber(Math.ceil(offer.monthlyRateNet))} zł`
                                                    : `${formatNumber(Math.ceil(offer.monthlyRateGross))} zł`
                                                }
                                                <span className="text-sm font-normal text-gray-500">
                                                    {selectedOfferType === 'business' ? ' netto / mies.' : ' brutto / mies.'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {selectedOfferType === 'business'
                                                    ? `${formatNumber(Math.ceil(offer.monthlyRateGross))} zł brutto`
                                                    : `${formatNumber(Math.ceil(offer.monthlyRateNet))} zł netto`
                                                }
                                            </div>

                                            {offer.servicesIncluded?.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-1">
                                                    {offer.servicesIncluded.map((s: string, j: number) => {
                                                        const labelMap: Record<string, string> = {
                                                            insurance: 'Ubezpieczenie',
                                                            tires: 'Opony',
                                                            service: 'Przeglądy techniczne',
                                                            other: 'Assistance 24h'
                                                        };
                                                        return (
                                                            <span key={j} className="inline-flex items-center gap-0.5 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                                                <Shield className="w-3 h-3" /> {labelMap[s] || s}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <Button
                                                className="w-full mt-4 bg-accent text-accent-foreground hover:opacity-90"
                                                onClick={() => navigate(`/wynajem-dlugoterminowy/${slug}/zapytanie`, { state: buildRentalState(offer) })}
                                            >
                                                <FileText className="w-4 h-4 mr-2" /> Zapytaj o ofertę
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!calcQuery.isLoading && offers.length === 0 && selectedMileage !== null && (
                                <div className="p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-500">
                                    Brak ofert dla wybranej konfiguracji
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>



            {/* Lightbox is handled by ImageGallery component */}

            <ScrollToTopButton />

            {/* Callback CTA */}
            <div className="container py-10">
                <CallbackForm
                    title="Masz dodatkowe pytania?"
                    titleHighlight="Zostaw numer, oddzwonimy"
                    description="Nasz doradca skontaktuje się z Tobą w ciągu 24h i pomoże dobrać najlepszą ofertę wynajmu."
                />
            </div>

            {/* Mobile Sticky CTA */}
            <div className="sticky-cta md:hidden">
                <div className="flex gap-3">
                    {config.contactInfo.phone && (
                        <button
                            className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl border border-border bg-background text-foreground font-semibold text-sm"
                            onClick={() => window.open(`tel:${config.contactInfo.phone}`)}
                        >
                            <Phone className="h-4 w-4" />
                            Zadzwoń
                        </button>
                    )}
                    <button
                        className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-foreground font-semibold text-sm"
                        onClick={() => {
                            if (offers.length > 0) {
                                navigate(`/wynajem-dlugoterminowy/${slug}/zapytanie`, { state: buildRentalState(offers[0]) });
                            } else {
                                navigate(`/wynajem-dlugoterminowy/${slug}/zapytanie`);
                            }
                        }}
                    >
                        <FileText className="h-4 w-4" />
                        Wyślij zapytanie
                    </button>
                </div>
            </div>

            <Footer />
        </div>
    );
}
