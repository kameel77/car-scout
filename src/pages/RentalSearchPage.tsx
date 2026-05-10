import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { rentalPublicApi } from '@/services/rental-api';
import { useBrand } from '@/contexts/BrandContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Calendar, Gauge, Fuel, Settings2, ChevronLeft, ChevronRight, Car, Building2, User, ChevronDown, ArrowUpDown, Check } from 'lucide-react';
import { normalizeRentalImageUrl } from '@/lib/utils';
import { formatNumber } from '@/utils/formatters';
import { ImageSwiper } from '@/components/ImageSwiper';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function buildRentalImageList(v: any): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (raw: string | null | undefined) => {
        const url = normalizeRentalImageUrl(raw, v.id);
        if (url && !seen.has(url)) {
            seen.add(url);
            out.push(url);
        }
    };
    push(v.primaryImageUrl);
    for (const u of v.imageUrls || []) push(u);
    return out;
}

type ClientType = 'business' | 'consumer';

function getStoredClientType(): ClientType {
    try {
        const stored = localStorage.getItem('rentalClientType');
        if (stored === 'business' || stored === 'consumer') return stored;
    } catch { /* localStorage unavailable */ }
    return 'business';
}

/* ── Filter pill (same visual as TopFilterBar) ──────────────────── */

interface FilterPillProps {
    label: string;
    active?: boolean;
    children: React.ReactNode;
}

function FilterPill({ label, active, children }: FilterPillProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-sm whitespace-nowrap transition-colors',
                        active
                            ? 'border-accent bg-accent/15 text-foreground font-medium'
                            : 'border-border bg-background hover:bg-secondary/50'
                    )}
                >
                    <span>{label}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3">
                {children}
            </PopoverContent>
        </Popover>
    );
}

interface SingleSelectListProps {
    options: string[];
    selected: string;
    onChange: (value: string) => void;
    allLabel: string;
    searchable?: boolean;
}

function SingleSelectList({ options, selected, onChange, allLabel, searchable }: SingleSelectListProps) {
    const [search, setSearch] = useState('');
    const filtered = searchable
        ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
        : options;

    return (
        <div className="space-y-2">
            {searchable && (
                <Input
                    placeholder="Szukaj..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9"
                />
            )}
            <ScrollArea className="max-h-64">
                <div className="space-y-0.5">
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className={cn(
                            'w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors',
                            selected === '' ? 'bg-accent/15 font-medium' : 'hover:bg-secondary/50'
                        )}
                    >
                        {allLabel}
                    </button>
                    {filtered.map(option => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => onChange(option)}
                            className={cn(
                                'w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors',
                                selected === option ? 'bg-accent/15 font-medium' : 'hover:bg-secondary/50'
                            )}
                        >
                            {option}
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <p className="text-xs text-muted-foreground p-2">Brak wyników</p>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

/* ── Sort options for rental ──────────────────────────────────── */

const rentalSortOptions = [
    { sortBy: 'minMonthlyRateNet', sortOrder: 'asc', label: 'Najtańsze' },
    { sortBy: 'minMonthlyRateNet', sortOrder: 'desc', label: 'Najdroższe' },
    { sortBy: 'createdAt', sortOrder: 'desc', label: 'Najnowsze' },
    { sortBy: 'make', sortOrder: 'asc', label: 'Marka A-Z' },
];

/* ── Main component ───────────────────────────────────────────── */

export default function RentalSearchPage() {
    const { config } = useBrand();
    const { data: settings } = useAppSettings();
    const accent = 'hsl(var(--accent))';
    const accentText = 'hsl(var(--accent-foreground))';

    const defaultSortRental = settings?.defaultSortRental || 'createdAt_desc';
    const [initialSortBy, initialSortOrder] = defaultSortRental.split('_');

    const [search, setSearch] = useState('');
    const [make, setMake] = useState('');
    const [fuelType, setFuelType] = useState('');
    const [bodyType, setBodyType] = useState('');
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState(initialSortBy || 'createdAt');
    const [sortOrder, setSortOrder] = useState(initialSortOrder || 'desc');
    const [clientType, setClientType] = useState<ClientType>(getStoredClientType);

    useEffect(() => {
        if (settings?.defaultSortRental) {
            const [defSortBy, defSortOrder] = settings.defaultSortRental.split('_');
            if (defSortBy && defSortOrder && sortBy === 'createdAt' && sortOrder === 'desc') {
                setSortBy(defSortBy);
                setSortOrder(defSortOrder);
            }
        }
    }, [settings?.defaultSortRental]);

    const handleClientTypeChange = (type: ClientType) => {
        setClientType(type);
        try { localStorage.setItem('rentalClientType', type); } catch { /* localStorage unavailable */ }
    };

    const { data, isLoading } = useQuery({
        queryKey: ['rental-public', page, search, make, fuelType, bodyType, sortBy, sortOrder, clientType],
        queryFn: () => rentalPublicApi.listVehicles({
            page: String(page),
            limit: '12',
            search: search || undefined,
            make: make || undefined,
            fuelType: fuelType || undefined,
            bodyType: bodyType || undefined,
            sortBy,
            sortOrder,
            offerType: clientType === 'consumer' ? 'b2c' : 'b2b'
        })
    });

    const vehicles = data?.vehicles || [];
    const pagination = data?.pagination;
    const filters = data?.filters;

    const isBusiness = clientType === 'business';

    const currentSortOption = rentalSortOptions.find(
        o => o.sortBy === sortBy && o.sortOrder === sortOrder
    );

    const totalCount = pagination?.total ?? vehicles.length;

    const hasActiveFilters = make !== '' || fuelType !== '' || bodyType !== '' || search !== '';

    return (
        <div className="min-h-screen bg-background">
            <Header onClearFilters={() => { setMake(''); setFuelType(''); setBodyType(''); setSearch(''); setPage(1); }} hasActiveFilters={hasActiveFilters} />

            <main className="container pt-4 pb-10">
                {/* ── Top Filter Bar (pill-based, same as /samochody/) ── */}
                <div className="hidden lg:flex flex-wrap items-center gap-2 mb-3 sticky top-20 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <FilterPill label="Marka" active={make !== ''}>
                        <SingleSelectList
                            options={filters?.makes || []}
                            selected={make}
                            onChange={(v) => { setMake(v); setPage(1); }}
                            allLabel="Wszystkie marki"
                            searchable
                        />
                    </FilterPill>

                    <FilterPill label="Rodzaj paliwa" active={fuelType !== ''}>
                        <SingleSelectList
                            options={filters?.fuelTypes || []}
                            selected={fuelType}
                            onChange={(v) => { setFuelType(v); setPage(1); }}
                            allLabel="Wszystkie"
                        />
                    </FilterPill>

                    <FilterPill label="Typ nadwozia" active={bodyType !== ''}>
                        <SingleSelectList
                            options={filters?.bodyTypes || []}
                            selected={bodyType}
                            onChange={(v) => { setBodyType(v); setPage(1); }}
                            allLabel="Wszystkie"
                        />
                    </FilterPill>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Search */}
                    <div className="relative w-[340px] flex-shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Szukaj marki, modelu, typu nadwozia..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="pl-9 h-9 text-sm rounded-full border-border bg-background"
                        />
                    </div>

                    <div className="flex-1" />
                </div>

                {/* ── Mobile filters (visible on small screens) ── */}
                <div className="lg:hidden mb-4 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Szukaj: marka, model..."
                            className="pl-10"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <select
                            value={make}
                            onChange={e => { setMake(e.target.value); setPage(1); }}
                            className="h-10 px-3 rounded-md border text-sm bg-background"
                        >
                            <option value="">Marka</option>
                            {filters?.makes?.map((m: string) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                            value={fuelType}
                            onChange={e => { setFuelType(e.target.value); setPage(1); }}
                            className="h-10 px-3 rounded-md border text-sm bg-background"
                        >
                            <option value="">Paliwo</option>
                            {filters?.fuelTypes?.map((f: string) => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <select
                            value={bodyType}
                            onChange={e => { setBodyType(e.target.value); setPage(1); }}
                            className="h-10 px-3 rounded-md border text-sm bg-background"
                        >
                            <option value="">Nadwozie</option>
                            {filters?.bodyTypes?.map((b: string) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                </div>

                {/* ── Status bar (Na firmę/Prywatnie + count + sort) — same as StatusTabs ── */}
                <div className="flex items-center gap-1 border-b border-border overflow-x-auto mb-6">
                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Znaleziono */}
                    <span className="hidden sm:block text-sm text-muted-foreground whitespace-nowrap px-2">
                        Znaleziono:{' '}
                        <span className="font-semibold text-foreground">{totalCount}</span>
                    </span>

                    {/* Na firmę / Prywatnie pill toggle */}
                    <div className="flex bg-secondary rounded-lg p-0.5">
                        <button
                            type="button"
                            onClick={() => handleClientTypeChange('business')}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                                isBusiness
                                    ? 'bg-accent shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            Na firmę
                        </button>
                        <button
                            type="button"
                            onClick={() => handleClientTypeChange('consumer')}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                                !isBusiness
                                    ? 'bg-accent shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <User className="w-3.5 h-3.5" />
                            Prywatnie
                        </button>
                    </div>

                    {/* Sort */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 h-8 text-xs whitespace-nowrap border border-border rounded-full px-3 hover:bg-secondary"
                            >
                                <ArrowUpDown className="h-3.5 w-3.5" />
                                {currentSortOption?.label || 'Sortuj'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {rentalSortOptions.map((option) => {
                                const isActive = sortBy === option.sortBy && sortOrder === option.sortOrder;
                                return (
                                    <DropdownMenuItem
                                        key={`${option.sortBy}_${option.sortOrder}`}
                                        onClick={() => { setSortBy(option.sortBy); setSortOrder(option.sortOrder); setPage(1); }}
                                        className={cn('gap-2', isActive && 'bg-accent')}
                                    >
                                        {isActive && <Check className="h-3.5 w-3.5" />}
                                        {option.label}
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Right padding */}
                    <div className="w-1" />
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
                                <div className="relative">
                                    <ImageSwiper
                                        images={buildRentalImageList(v)}
                                        alt={`${v.make} ${v.model}`}
                                        aspectClassName="aspect-[16/10]"
                                        imgClassName="group-hover:scale-105"
                                        fallback={
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Car className="w-16 h-16 text-gray-300" />
                                            </div>
                                        }
                                    />
                                    {v.rentalCompanyCount > 1 && (
                                        <div className="absolute top-3 right-3 bg-accent text-accent-foreground text-xs font-medium px-2 py-1 rounded-full z-10">
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
                                                            ? formatNumber(Math.ceil(v.minMonthlyRateNet || v.minMonthlyRateGross / 1.23))
                                                            : formatNumber(Math.ceil(v.minMonthlyRateGross))
                                                        }
                                                        <span className="text-base font-semibold">zł</span>
                                                    </span>
                                                    <span className="text-sm text-gray-500 font-normal">
                                                        {isBusiness ? 'netto / mies.' : 'brutto / mies.'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {isBusiness
                                                        ? `${formatNumber(Math.ceil(v.minMonthlyRateGross))} zł brutto`
                                                        : `${formatNumber(Math.ceil(v.minMonthlyRateNet || v.minMonthlyRateGross / 1.23))} zł netto`
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
