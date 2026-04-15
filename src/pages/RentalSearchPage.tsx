import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { rentalPublicApi } from '@/services/rental-api';
import { useBrand } from '@/contexts/BrandContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Calendar, Gauge, Fuel, Settings2, ChevronLeft, ChevronRight, Car, Building2, User } from 'lucide-react';

type ClientType = 'business' | 'consumer';

function getStoredClientType(): ClientType {
    try {
        const stored = localStorage.getItem('rentalClientType');
        if (stored === 'business' || stored === 'consumer') return stored;
    } catch {}
    return 'business';
}

export default function RentalSearchPage() {
    const { config } = useBrand();
    const isMotolia = config.id === 'motolia';
    const accent = 'hsl(var(--accent))';
    const accentText = 'hsl(var(--accent-foreground))';

    const [search, setSearch] = useState('');
    const [make, setMake] = useState('');
    const [fuelType, setFuelType] = useState('');
    const [bodyType, setBodyType] = useState('');
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');
    const [clientType, setClientType] = useState<ClientType>(getStoredClientType);

    const handleClientTypeChange = (type: ClientType) => {
        setClientType(type);
        try { localStorage.setItem('rentalClientType', type); } catch {}
    };

    const { data, isLoading } = useQuery({
        queryKey: ['rental-public', page, search, make, fuelType, bodyType, sortBy, sortOrder],
        queryFn: () => rentalPublicApi.listVehicles({
            page: String(page),
            limit: '12',
            search: search || undefined,
            make: make || undefined,
            fuelType: fuelType || undefined,
            bodyType: bodyType || undefined,
            sortBy,
            sortOrder
        })
    });

    const vehicles = data?.vehicles || [];
    const pagination = data?.pagination;
    const filters = data?.filters;

    const isBusiness = clientType === 'business';

    return (
        <div className="min-h-screen bg-gray-50">
            <Header onClearFilters={() => {}} hasActiveFilters={false} />

            <main className="container pb-10">
                {/* Hero section */}
                <div className="py-10 text-center">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                        Najem długoterminowy
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Wybierz pojazd i sprawdź ratę miesięczną. Oferta od wiodących firm najmowych.
                    </p>
                </div>

                {/* Filters bar */}
                <div className="bg-white rounded-2xl shadow-sm border p-4 mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                        <div className="relative md:col-span-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                placeholder="Szukaj: marka, model..."
                                className="pl-10"
                            />
                        </div>
                        <select
                            value={make}
                            onChange={e => { setMake(e.target.value); setPage(1); }}
                            className="h-10 px-3 rounded-md border text-sm"
                        >
                            <option value="">Wszystkie marki</option>
                            {filters?.makes?.map((m: string) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                            value={fuelType}
                            onChange={e => { setFuelType(e.target.value); setPage(1); }}
                            className="h-10 px-3 rounded-md border text-sm"
                        >
                            <option value="">Rodzaj paliwa</option>
                            {filters?.fuelTypes?.map((f: string) => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <select
                            value={bodyType}
                            onChange={e => { setBodyType(e.target.value); setPage(1); }}
                            className="h-10 px-3 rounded-md border text-sm"
                        >
                            <option value="">Typ nadwozia</option>
                            {filters?.bodyTypes?.map((b: string) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    {/* Client type toggle — second row */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t">
                        <span className="text-sm font-medium text-gray-600">Oferta dla:</span>
                        <div className="flex bg-gray-100 rounded-lg p-0.5">
                            <button
                                onClick={() => handleClientTypeChange('business')}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    isBusiness ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                                style={isBusiness ? { color: accent } : {}}
                            >
                                <Building2 className="w-3.5 h-3.5" /> Na firmę
                            </button>
                            <button
                                onClick={() => handleClientTypeChange('consumer')}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    !isBusiness ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                                style={!isBusiness ? { color: accent } : {}}
                            >
                                <User className="w-3.5 h-3.5" /> Prywatnie
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results */}
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl shadow-sm border h-[380px] animate-pulse">
                                <div className="h-48 bg-gray-200 rounded-t-2xl" />
                                <div className="p-5 space-y-3">
                                    <div className="h-5 bg-gray-200 rounded w-3/4" />
                                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                                    <div className="h-8 bg-gray-200 rounded w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : vehicles.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {vehicles.map((v: any) => (
                            <Link
                                key={v.id}
                                to={`/wynajem-dlugoterminowy/${v.slug || v.id}`}
                                className="group bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 hover:border-gray-300"
                            >
                                {/* Image */}
                                <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                                    {v.primaryImageUrl ? (
                                        <img
                                            src={v.primaryImageUrl}
                                            alt={`${v.make} ${v.model}`}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Car className="w-16 h-16 text-gray-300" />
                                        </div>
                                    )}
                                    {v.rentalCompanyCount > 1 && (
                                        <div className="absolute top-3 right-3 bg-accent text-accent-foreground text-xs font-medium px-2 py-1 rounded-full">
                                            {v.rentalCompanyCount} oferty
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-5">
                                    <h3 className="font-semibold text-lg text-gray-900 transition-colors" style={{ '--hover-color': accent } as React.CSSProperties}>
                                        {v.make} {v.model}
                                    </h3>
                                    {v.version && (
                                        <p className="text-sm text-gray-500 mt-0.5">{v.version}</p>
                                    )}

                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {v.productionYear && (
                                            <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                <Calendar className="w-3 h-3" /> {v.productionYear}
                                            </span>
                                        )}
                                        {v.enginePowerHp && (
                                            <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                <Gauge className="w-3 h-3" /> {v.enginePowerHp} KM
                                            </span>
                                        )}
                                        {v.fuelType && (
                                            <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                <Fuel className="w-3 h-3" /> {v.fuelType}
                                            </span>
                                        )}
                                        {v.transmission && (
                                            <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                <Settings2 className="w-3 h-3" /> {v.transmission}
                                            </span>
                                        )}
                                    </div>

                                    {/* Price — primary depends on client type */}
                                    <div className="mt-4 pt-4 border-t">
                                        {v.minMonthlyRateGross ? (
                                            <div>
                                                <span className="text-xs text-gray-500">Rata od</span>
                                                <div className="flex items-baseline gap-2 mt-1">
                                                    <span
                                                        className="inline-flex items-baseline gap-1 px-3 py-1 rounded-lg font-bold text-2xl"
                                                        style={{ background: accent, color: accentText }}
                                                    >
                                                        {isBusiness
                                                            ? Math.ceil(v.minMonthlyRateNet || v.minMonthlyRateGross / 1.23).toLocaleString('pl-PL')
                                                            : Math.ceil(v.minMonthlyRateGross).toLocaleString('pl-PL')
                                                        }
                                                        <span className="text-base font-semibold">zł</span>
                                                    </span>
                                                    <span className="text-sm text-gray-500 font-normal">
                                                        {isBusiness ? 'netto / mies.' : 'brutto / mies.'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {isBusiness
                                                        ? `${Math.ceil(v.minMonthlyRateGross).toLocaleString('pl-PL')} zł brutto`
                                                        : `${Math.ceil(v.minMonthlyRateNet || v.minMonthlyRateGross / 1.23).toLocaleString('pl-PL')} zł netto`
                                                    }
                                                </div>
                                                {v.minRateConfig && (
                                                    <span className="text-xs text-gray-400">
                                                        {v.minRateConfig.contractMonths} mies. | {(v.minRateConfig.annualMileageKm / 1000).toFixed(0)}tys. km/rok
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400">Zapytaj o cenę</span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">Brak pojazdów</h3>
                        <p className="text-gray-500 mt-1">Zmień filtry lub sprawdź później</p>
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-10">
                        <Button
                            variant="outline"
                            onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" /> Poprzednia
                        </Button>
                        <span className="text-sm text-gray-600">
                            Strona {pagination.page} z {pagination.totalPages}
                        </span>
                        <Button
                            variant="outline"
                            onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            disabled={page >= pagination.totalPages}
                        >
                            Następna <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                )}
            </main>

            <ScrollToTopButton />
            <Footer />
        </div>
    );
}
