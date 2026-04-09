import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { rentalPublicApi } from '@/services/rental-api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft, Calendar, Gauge, Fuel, Settings2, MapPin,
    Shield, ChevronDown, Building2, Car, FileText, Music, ShieldCheck, Sofa, Package
} from 'lucide-react';

type OfferType = 'business' | 'consumer';

export default function RentalDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const { token } = useAuth();
    const isLoggedIn = !!token;

    const { data, isLoading } = useQuery({
        queryKey: ['rental-vehicle-public', slug],
        queryFn: () => rentalPublicApi.getVehicle(slug!),
        enabled: !!slug
    });

    const vehicle = data?.vehicle;
    const options = data?.options;

    // Calculator state — init with first available option
    const [selectedMileage, setSelectedMileage] = useState<number | null>(null);
    const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
    const [selectedPayment, setSelectedPayment] = useState<number | null>(null);
    const [selectedOfferType, setSelectedOfferType] = useState<OfferType>('business');
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

    // Calculation query
    const calcQuery = useQuery({
        queryKey: ['rental-calc', slug, selectedMileage, selectedMonths, selectedPayment, selectedOfferType],
        queryFn: () => rentalPublicApi.calculate(slug!, {
            annualMileageKm: selectedMileage!,
            contractMonths: selectedMonths!,
            initialPaymentPct: selectedPayment!,
            offerType: selectedOfferType
        }),
        enabled: !!slug && selectedMileage !== null && selectedMonths !== null && selectedPayment !== null
    });

    const offers = calcQuery.data?.offers || [];

    // Main image state
    const [mainImage, setMainImage] = useState(0);
    const images = vehicle?.imageUrls || [];
    const currentImage = images[mainImage] || vehicle?.primaryImageUrl;

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
                    <Link to="/najem" className="text-blue-600 hover:underline mt-4 inline-block">
                        Wróć do listy
                    </Link>
                </div>
            </div>
        );
    }

    const specs = [
        { label: 'Rok', value: vehicle.productionYear, icon: Calendar },
        { label: 'Moc', value: vehicle.enginePowerHp ? `${vehicle.enginePowerHp} KM` : null, icon: Gauge },
        { label: 'Paliwo', value: vehicle.fuelType, icon: Fuel },
        { label: 'Skrzynia', value: vehicle.transmission, icon: Settings2 },
        { label: 'Napęd', value: vehicle.drive },
        { label: 'Pojemność', value: vehicle.engineCapacityCm3 ? `${vehicle.engineCapacityCm3} cm³` : null },
        { label: 'Nadwozie', value: vehicle.bodyType },
        { label: 'Kolor', value: vehicle.color },
        { label: 'Drzwi', value: vehicle.doors },
        { label: 'Miejsca', value: vehicle.seats },
        { label: 'Lakier', value: vehicle.paintType },
    ].filter(s => s.value);

    // Equipment categories
    const equipmentCategories = [
        { label: 'Audio i Multimedia', icon: Music, items: vehicle.equipmentAudioMultimedia },
        { label: 'Bezpieczeństwo', icon: ShieldCheck, items: vehicle.equipmentSafety },
        { label: 'Komfort i Dodatki', icon: Sofa, items: vehicle.equipmentComfortExtras },
        { label: 'Inne', icon: Package, items: vehicle.equipmentOther },
    ].filter(cat => cat.items?.length > 0);

    return (
        <div className="min-h-screen bg-gray-50">
            <Header onClearFilters={() => {}} hasActiveFilters={false} />

            <main className="container pb-10 pt-4">
                {/* Breadcrumb */}
                <Link to="/najem" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mb-4">
                    <ArrowLeft className="w-4 h-4" /> Wróć do listy
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Left: Gallery + Specs */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Gallery */}
                        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                            <div className="relative h-[300px] md:h-[400px] bg-gray-100">
                                {currentImage ? (
                                    <img
                                        src={currentImage}
                                        alt={`${vehicle.make} ${vehicle.model}`}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Car className="w-24 h-24 text-gray-300" />
                                    </div>
                                )}
                            </div>
                            {images.length > 1 && (
                                <div className="flex gap-2 p-3 overflow-x-auto">
                                    {images.map((url: string, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => setMainImage(i)}
                                            className={`w-16 h-12 rounded overflow-hidden border-2 flex-shrink-0 transition-all ${
                                                i === mainImage ? 'border-blue-500 scale-105' : 'border-gray-200 opacity-70 hover:opacity-100'
                                            }`}
                                        >
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Vehicle title + specs */}
                        <div className="bg-white rounded-2xl shadow-sm border p-6">
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                                {vehicle.make} {vehicle.model}
                            </h1>
                            {vehicle.version && (
                                <p className="text-lg text-gray-500 mt-1">{vehicle.version}</p>
                            )}
                            {vehicle.dealer && (
                                <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {vehicle.dealer.name}, {vehicle.dealer.city}
                                </p>
                            )}

                            {/* Quick specs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                                {specs.slice(0, showAllSpecs ? specs.length : 4).map(s => (
                                    <div key={s.label} className="p-3 bg-gray-50 rounded-xl text-center">
                                        <div className="text-xs text-gray-500">{s.label}</div>
                                        <div className="font-semibold text-gray-900 mt-1">{s.value}</div>
                                    </div>
                                ))}
                            </div>

                            {specs.length > 4 && (
                                <button
                                    onClick={() => setShowAllSpecs(!showAllSpecs)}
                                    className="text-sm text-blue-600 hover:text-blue-700 mt-3 flex items-center gap-1"
                                >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showAllSpecs ? 'rotate-180' : ''}`} />
                                    {showAllSpecs ? 'Zwiń specyfikację' : 'Pełna specyfikacja'}
                                </button>
                            )}

                            {/* Price info */}
                            <div className="mt-6 pt-6 border-t flex items-center gap-6">
                                <div>
                                    <span className="text-xs text-gray-500">Cena katalogowa</span>
                                    <div className="font-semibold text-gray-500 line-through">{vehicle.catalogPrice?.toLocaleString('pl-PL')} zł</div>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500">Cena sprzedaży</span>
                                    <div className="font-bold text-xl text-gray-900">{vehicle.sellingPrice?.toLocaleString('pl-PL')} zł</div>
                                </div>
                            </div>

                            {/* Equipment — all 4 categories */}
                            {equipmentCategories.length > 0 && (
                                <div className="mt-6 pt-6 border-t space-y-5">
                                    <h3 className="font-semibold text-gray-900">Wyposażenie</h3>
                                    {equipmentCategories.map(cat => {
                                        const Icon = cat.icon;
                                        return (
                                            <div key={cat.label}>
                                                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                                                    <Icon className="w-4 h-4 text-blue-500" /> {cat.label}
                                                </h4>
                                                <div className="grid grid-cols-2 gap-1 text-sm text-gray-600">
                                                    {cat.items.map((e: string, i: number) => (
                                                        <div key={i} className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                                            {e}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Calculator */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border p-6 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
                            <h2 className="text-lg font-bold text-gray-900 mb-5">Kalkulator najmu</h2>

                            {/* Offer type toggle: Business / Private */}
                            <div className="space-y-2 mb-5">
                                <label className="text-sm font-medium text-gray-700">Typ oferty</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSelectedOfferType('business')}
                                        disabled={!availableOfferTypes.has('business')}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                            selectedOfferType === 'business'
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : !availableOfferTypes.has('business')
                                                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        🏢 Na firmę
                                    </button>
                                    <button
                                        onClick={() => setSelectedOfferType('consumer')}
                                        disabled={!availableOfferTypes.has('consumer')}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                            selectedOfferType === 'consumer'
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : !availableOfferTypes.has('consumer')
                                                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        👤 Prywatnie
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
                                                    ? 'bg-blue-600 text-white shadow-md'
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
                                                    ? 'bg-blue-600 text-white shadow-md'
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
                                                    ? 'bg-blue-600 text-white shadow-md'
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
                                                i === 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-gray-500" />
                                                    {isLoggedIn ? (
                                                        <span className="font-medium text-sm">{offer.company.name}</span>
                                                    ) : (
                                                        <span className="font-medium text-sm text-gray-400">Firma #{i + 1}</span>
                                                    )}
                                                </div>
                                                {i === 0 && (
                                                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Najlepsza</span>
                                                )}
                                            </div>
                                            <div className="text-3xl font-bold text-gray-900">
                                                {offer.monthlyRateGross.toLocaleString('pl-PL')} zł
                                                <span className="text-sm font-normal text-gray-500"> / mies. brutto</span>
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {offer.monthlyRateNet.toLocaleString('pl-PL')} zł netto
                                            </div>

                                            {offer.servicesIncluded?.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-1">
                                                    {offer.servicesIncluded.map((s: string, j: number) => (
                                                        <span key={j} className="inline-flex items-center gap-0.5 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                                            <Shield className="w-3 h-3" /> {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <Button
                                                className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                                                asChild
                                            >
                                                <Link to={`/kontakt?rental=${vehicle.id}&company=${offer.company.id}&rate=${offer.monthlyRateGross}`}>
                                                    <FileText className="w-4 h-4 mr-2" /> Zapytaj o ofertę
                                                </Link>
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

            <ScrollToTopButton />
            <Footer />
        </div>
    );
}
