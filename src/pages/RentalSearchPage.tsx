import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { rentalPublicApi } from '@/services/rental-api';
import { useBrand } from '@/contexts/BrandContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { MetaHead } from '@/components/seo/MetaHead';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Calendar, Gauge, Fuel, Settings2, ChevronLeft, ChevronRight,
  Car, Building2, User, ChevronDown, ArrowUpDown, Check, SlidersHorizontal
} from 'lucide-react';
import { normalizeRentalImageUrl, cn } from '@/lib/utils';
import { formatNumber } from '@/utils/formatters';
import { ImageSwiper } from '@/components/ImageSwiper';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ── Helpers ── */

function buildRentalImageList(v: any): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const url = normalizeRentalImageUrl(raw, v.id);
    if (url && !seen.has(url)) { seen.add(url); out.push(url); }
  };
  push(v.primaryImageUrl);
  for (const u of v.imageUrls || []) push(u);
  return out;
}

type ClientType = 'business' | 'consumer';
function getStoredClientType(): ClientType {
  try {
    const s = localStorage.getItem('rentalClientType');
    if (s === 'business' || s === 'consumer') return s;
  } catch { /* ignore */ }
  return 'business';
}

const PLN = new Intl.NumberFormat('pl-PL');

/* ── Filter pill ── */

interface FilterPillProps { label: string; activeCount?: number; children: React.ReactNode; }
function FilterPill({ label, activeCount, children }: FilterPillProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(
          'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-sm whitespace-nowrap transition-colors',
          activeCount && activeCount > 0
            ? 'border-accent bg-accent/15 text-foreground font-medium'
            : 'border-border bg-background hover:bg-secondary/50'
        )}>
          <span>{label}</span>
          {activeCount && activeCount > 0
            ? <span className="text-xs font-semibold">({activeCount})</span>
            : <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">{children}</PopoverContent>
    </Popover>
  );
}

/* ── Multi-check list ── */

function MultiCheck({ options, selected, onChange, searchable, searchPlaceholder }: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = useState('');
  const filtered = searchable
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;
  const toggle = (v: string) =>
    selected.includes(v) ? onChange(selected.filter(x => x !== v)) : onChange([...selected, v]);
  return (
    <div className="space-y-2">
      {searchable && <Input placeholder={searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} className="h-9" />}
      <ScrollArea className="max-h-64">
        <div className="space-y-1">
          {filtered.map(o => (
            <label key={o.value} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-secondary/50 cursor-pointer">
              <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
              <span className="text-sm">{o.label}</span>
            </label>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground p-2">Brak wyników</p>}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Range popover ── */

function RangePopover({ fromValue, toValue, onFromChange, onToChange, fromPh, toPh }: {
  fromValue: string; toValue: string;
  onFromChange: (v: string) => void; onToChange: (v: string) => void;
  fromPh: string; toPh: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input type="number" value={fromValue} onChange={e => onFromChange(e.target.value)} placeholder={fromPh} className="h-9" />
      <Input type="number" value={toValue} onChange={e => onToChange(e.target.value)} placeholder={toPh} className="h-9" />
    </div>
  );
}

/* ── Sort options ── */

const rentalSortOptions = [
  { sortBy: 'minMonthlyRateNet', sortOrder: 'asc', label: 'Najtańsze' },
  { sortBy: 'minMonthlyRateNet', sortOrder: 'desc', label: 'Najdroższe' },
  { sortBy: 'createdAt', sortOrder: 'desc', label: 'Najnowsze' },
  { sortBy: 'productionYear', sortOrder: 'desc', label: 'Najmłodszy rocznik' },
  { sortBy: 'make', sortOrder: 'asc', label: 'Marka A-Z' },
];

/* ══════════════════════════════════════════════════════════════════
   Main component
   ══════════════════════════════════════════════════════════════════ */

export default function RentalSearchPage() {
  const { t } = useTranslation();
  const { config } = useBrand();
  const { data: settings } = useAppSettings();
  const accent = 'hsl(var(--accent))';
  const accentText = 'hsl(var(--accent-foreground))';

  const defaultSortRental = settings?.defaultSortRental || 'createdAt_desc';
  const [initSortBy, initSortOrder] = defaultSortRental.split('_');

  // ── Filter state ──
  const [search, setSearch] = useState('');
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [fuelTypes, setFuelTypes] = useState<string[]>([]);
  const [bodyTypes, setBodyTypes] = useState<string[]>([]);
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [condition, setCondition] = useState<string[]>([]); // [] = all, ['NEW'], ['USED']
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(initSortBy || 'createdAt');
  const [sortOrder, setSortOrder] = useState(initSortOrder || 'desc');
  const [clientType, setClientType] = useState<ClientType>(getStoredClientType);
  const [allFiltersOpen, setAllFiltersOpen] = useState(false);

  useEffect(() => {
    if (settings?.defaultSortRental) {
      const [dsb, dso] = settings.defaultSortRental.split('_');
      if (dsb && dso && sortBy === 'createdAt' && sortOrder === 'desc') {
        setSortBy(dsb); setSortOrder(dso);
      }
    }
  }, [settings?.defaultSortRental]);

  const handleClientTypeChange = (type: ClientType) => {
    setClientType(type);
    try { localStorage.setItem('rentalClientType', type); } catch { /* ignore */ }
  };

  // ── API query ──
  const { data, isLoading } = useQuery({
    queryKey: ['rental-public', page, search, makes, models, fuelTypes, bodyTypes, yearFrom, yearTo, priceFrom, priceTo, condition, sortBy, sortOrder, clientType],
    queryFn: () => rentalPublicApi.listVehicles({
      page: String(page), limit: '12',
      search: search || undefined,
      make: makes.length > 0 ? makes.join(',') : undefined,
      model: models.length > 0 ? models.join(',') : undefined,
      fuelType: fuelTypes.length > 0 ? fuelTypes.join(',') : undefined,
      bodyType: bodyTypes.length > 0 ? bodyTypes.join(',') : undefined,
      yearFrom: yearFrom || undefined,
      yearTo: yearTo || undefined,
      priceFrom: priceFrom || undefined,
      priceTo: priceTo || undefined,
      condition: condition.length > 0 ? condition.join(',') : undefined,
      sortBy, sortOrder,
      offerType: clientType === 'consumer' ? 'b2c' : 'b2b'
    })
  });

  const vehicles = data?.vehicles || [];
  const pagination = data?.pagination;
  const filters = data?.filters;
  const isBusiness = clientType === 'business';
  const currentSortOption = rentalSortOptions.find(o => o.sortBy === sortBy && o.sortOrder === sortOrder);
  const totalCount = pagination?.total ?? vehicles.length;
  const byCondition = filters?.byCondition;

  const hasActiveFilters = makes.length > 0 || models.length > 0 || fuelTypes.length > 0 || bodyTypes.length > 0 || yearFrom !== '' || yearTo !== '' || priceFrom !== '' || priceTo !== '' || search !== '';
  const clearAllFilters = () => {
    setMakes([]); setModels([]); setFuelTypes([]); setBodyTypes([]);
    setYearFrom(''); setYearTo(''); setPriceFrom(''); setPriceTo('');
    setSearch(''); setCondition([]); setPage(1);
  };

  // ── Derived options ──
  const makeOptions = (filters?.makes || []).map((m: string) => ({ value: m, label: m }));
  const modelOptions = (filters?.models || [])
    .filter((m: any) => makes.length === 0 || makes.includes(m.make))
    .map((m: any) => ({ value: m.model, label: m.model }));
  const fuelTypeOptions = (filters?.fuelTypes || []).map((f: string) => ({ value: f, label: f }));
  const bodyTypeOptions = (filters?.bodyTypes || []).map((b: string) => ({ value: b, label: b }));

  const isAll = condition.length === 0;
  const isNew = condition.length === 1 && condition[0] === 'NEW';
  const isUsed = condition.length === 1 && condition[0] === 'USED';
  const totalConditionCount = byCondition ? byCondition.NEW + byCondition.USED : null;

  const tabClass = (active: boolean) => cn(
    'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
    active ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
  );

  const yearActive = yearFrom !== '' || yearTo !== '';
  const priceActive = priceFrom !== '' || priceTo !== '';

  return (
    <div className="min-h-screen bg-background">
      <Header onClearFilters={clearAllFilters} hasActiveFilters={hasActiveFilters} />

      <MetaHead
        title={`Wynajem długoterminowy | ${config.name}`}
        description="Oferty wynajmu długoterminowego samochodów - elastyczne warunki, atrakcyjne raty miesięczne."
        canonical="/wynajem-dlugoterminowy"
        schema={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'CollectionPage',
              name: 'Wynajem długoterminowy',
              description: 'Oferty wynajmu długoterminowego samochodów - elastyczne warunki, atrakcyjne raty miesięczne.',
              url: `${window.location.origin}/wynajem-dlugoterminowy`,
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: totalCount,
                itemListElement: vehicles.slice(0, 10).map((v: any, i: number) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  item: {
                    '@type': 'Car',
                    name: `${v.make} ${v.model}`,
                    url: `${window.location.origin}/wynajem-dlugoterminowy/${v.slug || v.id}`,
                    vehicleModelDate: v.productionYear?.toString(),
                    fuelType: v.fuelType,
                  },
                })),
              },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Strona główna', item: window.location.origin },
                { '@type': 'ListItem', position: 2, name: 'Wynajem długoterminowy', item: `${window.location.origin}/wynajem-dlugoterminowy` },
              ],
            },
          ],
        }}
      />

      {/* ── Side Sheet: All Filters ── */}
      <Sheet open={allFiltersOpen} onOpenChange={setAllFiltersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="px-6 pt-6 pb-2">
            <SheetTitle>{t('filters.title')}</SheetTitle>
          </SheetHeader>
          <div className="px-6 pb-6 overflow-y-auto h-[calc(100vh-5rem)] space-y-5">
            {/* Marka */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">{t('filters.make')}</label>
              <MultiCheck options={makeOptions} selected={makes} onChange={v => { setMakes(v); if (v.length === 0) setModels([]); setPage(1); }} searchable searchPlaceholder={t('filters.selectMake')} />
            </div>
            {/* Model */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">{t('filters.model')}</label>
              {makes.length > 0
                ? <MultiCheck options={modelOptions} selected={models} onChange={v => { setModels(v); setPage(1); }} searchable searchPlaceholder={t('filters.selectModel')} />
                : <p className="text-sm text-muted-foreground">{t('filters.selectMake')}</p>}
            </div>
            {/* Typ nadwozia */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">{t('filters.bodyType')}</label>
              <MultiCheck options={bodyTypeOptions} selected={bodyTypes} onChange={v => { setBodyTypes(v); setPage(1); }} />
            </div>
            {/* Paliwo */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">{t('filters.fuelType')}</label>
              <MultiCheck options={fuelTypeOptions} selected={fuelTypes} onChange={v => { setFuelTypes(v); setPage(1); }} />
            </div>
            {/* Rata (od-do) */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Rata miesięczna</label>
              <RangePopover fromValue={priceFrom} toValue={priceTo} onFromChange={v => { setPriceFrom(v); setPage(1); }} onToChange={v => { setPriceTo(v); setPage(1); }} fromPh="Rata od (zł)" toPh="Rata do (zł)" />
            </div>
            {/* Rok produkcji (od-do) */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">{t('filters.productionYear')}</label>
              <RangePopover fromValue={yearFrom} toValue={yearTo} onFromChange={v => { setYearFrom(v); setPage(1); }} onToChange={v => { setYearTo(v); setPage(1); }} fromPh={t('filters.yearFrom')} toPh={t('filters.yearTo')} />
            </div>
            {/* Stan (Nowy / Używany) */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Stan pojazdu</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setCondition([]); setPage(1); }} className={cn('px-4 py-2 rounded-lg text-sm font-medium border transition-colors', isAll ? 'bg-accent text-foreground border-accent' : 'bg-background border-border hover:bg-secondary/50')}>Wszystkie</button>
                <button type="button" onClick={() => { setCondition(['NEW']); setPage(1); }} className={cn('px-4 py-2 rounded-lg text-sm font-medium border transition-colors', isNew ? 'bg-accent text-foreground border-accent' : 'bg-background border-border hover:bg-secondary/50')}>Nowy</button>
                <button type="button" onClick={() => { setCondition(['USED']); setPage(1); }} className={cn('px-4 py-2 rounded-lg text-sm font-medium border transition-colors', isUsed ? 'bg-accent text-foreground border-accent' : 'bg-background border-border hover:bg-secondary/50')}>Używany</button>
              </div>
            </div>
            {/* Clear all */}
            {hasActiveFilters && (
              <Button variant="outline" className="w-full" onClick={() => { clearAllFilters(); setAllFiltersOpen(false); }}>
                Wyczyść wszystkie filtry
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <main className="container pt-4 pb-10">
        {/* Page heading */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Wynajem długoterminowy</h1>
          <p className="text-sm text-muted-foreground mt-1">Oferty wynajmu długoterminowego samochodów - elastyczne warunki, atrakcyjne raty miesięczne.</p>
        </div>

        {/* ── Desktop TopFilterBar ── */}
        <div className="hidden lg:flex flex-wrap items-center gap-2 mb-3 sticky top-20 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <FilterPill label={t('filters.make')} activeCount={makes.length}>
            <MultiCheck options={makeOptions} selected={makes} onChange={v => { setMakes(v); if (v.length === 0) setModels([]); setPage(1); }} searchable searchPlaceholder={t('filters.selectMake')} />
          </FilterPill>

          <FilterPill label={t('filters.model')} activeCount={models.length}>
            {makes.length > 0
              ? <MultiCheck options={modelOptions} selected={models} onChange={v => { setModels(v); setPage(1); }} searchable searchPlaceholder={t('filters.selectModel')} />
              : <p className="text-sm text-muted-foreground p-2">{t('filters.selectMake')}</p>}
          </FilterPill>

          <FilterPill label={t('filters.bodyType')} activeCount={bodyTypes.length}>
            <MultiCheck options={bodyTypeOptions} selected={bodyTypes} onChange={v => { setBodyTypes(v); setPage(1); }} />
          </FilterPill>

          <FilterPill label={t('filters.fuelType')} activeCount={fuelTypes.length}>
            <MultiCheck options={fuelTypeOptions} selected={fuelTypes} onChange={v => { setFuelTypes(v); setPage(1); }} />
          </FilterPill>

          <FilterPill label="Rata" activeCount={priceActive ? 1 : 0}>
            <RangePopover fromValue={priceFrom} toValue={priceTo} onFromChange={v => { setPriceFrom(v); setPage(1); }} onToChange={v => { setPriceTo(v); setPage(1); }} fromPh="Rata od (zł)" toPh="Rata do (zł)" />
          </FilterPill>

          <FilterPill label={t('filters.productionYear')} activeCount={yearActive ? 1 : 0}>
            <RangePopover fromValue={yearFrom} toValue={yearTo} onFromChange={v => { setYearFrom(v); setPage(1); }} onToChange={v => { setYearTo(v); setPage(1); }} fromPh={t('filters.yearFrom')} toPh={t('filters.yearTo')} />
          </FilterPill>

          <div className="flex-1" />
          <div className="relative w-[340px] flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input placeholder={t('search.placeholder', 'Szukaj marki, modelu, typu nadwozia...')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9 text-sm rounded-full border-border bg-background" />
          </div>
          <div className="flex-1" />

          <Button variant="outline" size="sm" onClick={() => setAllFiltersOpen(true)} className="h-9 rounded-full gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('filters.title')}
          </Button>
        </div>

        {/* ── Mobile filters ── */}
        <div className="lg:hidden mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Szukaj: marka, model..." className="pl-10" />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterPill label={t('filters.make')} activeCount={makes.length}>
              <MultiCheck options={makeOptions} selected={makes} onChange={v => { setMakes(v); if (v.length === 0) setModels([]); setPage(1); }} searchable searchPlaceholder={t('filters.selectMake')} />
            </FilterPill>
            <FilterPill label={t('filters.fuelType')} activeCount={fuelTypes.length}>
              <MultiCheck options={fuelTypeOptions} selected={fuelTypes} onChange={v => { setFuelTypes(v); setPage(1); }} />
            </FilterPill>
            <FilterPill label={t('filters.bodyType')} activeCount={bodyTypes.length}>
              <MultiCheck options={bodyTypeOptions} selected={bodyTypes} onChange={v => { setBodyTypes(v); setPage(1); }} />
            </FilterPill>
          </div>
        </div>

        {/* ── StatusTabs: Wszystkie / Nowy / Używany + Na firmę/Prywatnie + Sort ── */}
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto mb-6">
          <button type="button" onClick={() => { setCondition([]); setPage(1); }} className={tabClass(isAll)}>
            {t('status.all', 'Wszystkie')}
            {totalConditionCount !== null && <span className="ml-1.5 text-xs text-muted-foreground">({PLN.format(totalConditionCount)})</span>}
          </button>
          <button type="button" onClick={() => { setCondition(['NEW']); setPage(1); }} className={tabClass(isNew)}>
            {t('status.new')}
            {byCondition && <span className="ml-1.5 text-xs text-muted-foreground">({PLN.format(byCondition.NEW)})</span>}
          </button>
          <button type="button" onClick={() => { setCondition(['USED']); setPage(1); }} className={tabClass(isUsed)}>
            {t('status.used')}
            {byCondition && <span className="ml-1.5 text-xs text-muted-foreground">({PLN.format(byCondition.USED)})</span>}
          </button>

          <div className="flex-1" />

          <span className="hidden sm:block text-sm text-muted-foreground whitespace-nowrap px-2">
            {t('common.found')}: <span className="font-semibold text-foreground">{PLN.format(totalCount)}</span>
          </span>

          {/* Na firmę / Prywatnie */}
          <div className="flex bg-secondary rounded-lg p-0.5">
            <button type="button" onClick={() => handleClientTypeChange('business')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap', isBusiness ? 'bg-accent shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <Building2 className="w-3.5 h-3.5" /> Na firmę
            </button>
            <button type="button" onClick={() => handleClientTypeChange('consumer')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap', !isBusiness ? 'bg-accent shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <User className="w-3.5 h-3.5" /> Prywatnie
            </button>
          </div>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs whitespace-nowrap border border-border rounded-full px-3 hover:bg-secondary">
                <ArrowUpDown className="h-3.5 w-3.5" />
                {currentSortOption?.label || 'Sortuj'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {rentalSortOptions.map(o => {
                const active = sortBy === o.sortBy && sortOrder === o.sortOrder;
                return (
                  <DropdownMenuItem key={`${o.sortBy}_${o.sortOrder}`} onClick={() => { setSortBy(o.sortBy); setSortOrder(o.sortOrder); setPage(1); }} className={cn('gap-2', active && 'bg-accent')}>
                    {active && <Check className="h-3.5 w-3.5" />} {o.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-1" />
        </div>

        {/* ── Results ── */}
        <div className="mt-4">
        {isLoading ? (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${Number(settings?.searchGridColumns) === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'} gap-4`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="listing-card h-[380px] animate-pulse">
                <div className="h-48 bg-secondary rounded-t-xl" />
                <div className="p-4 space-y-3"><div className="h-5 bg-secondary rounded w-3/4" /><div className="h-4 bg-secondary rounded w-1/2" /><div className="h-8 bg-secondary rounded w-2/3" /></div>
              </div>
            ))}
          </div>
        ) : vehicles.length > 0 ? (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${Number(settings?.searchGridColumns) === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'} gap-4`}>
            {vehicles.map((v: any) => (
              <Link key={v.id} to={`/wynajem-dlugoterminowy/${v.slug || v.id}`} className="listing-card group flex flex-col overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="relative">
                  <ImageSwiper images={buildRentalImageList(v)} alt={`${v.make} ${v.model}`} aspectClassName="aspect-[16/10]" imgClassName="group-hover:scale-105" fallback={<div className="w-full h-full flex items-center justify-center"><Car className="w-16 h-16 text-gray-300" /></div>} />
                  {v.rentalCompanyCount > 1 && <div className="absolute top-3 right-3 bg-card/95 backdrop-blur-sm text-xs font-medium px-2 py-1 rounded-full z-10">{v.rentalCompanyCount} oferty</div>}
                </div>
                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  <div>
                    <span className={`text-[10px] font-bold tracking-wider ${v.condition === 'NEW' ? 'text-accent' : 'text-muted-foreground'}`}>
                      {v.condition === 'NEW' ? t('listing.statusNew', 'NOWY') : t('listing.statusUsed', 'UŻYWANY')}
                    </span>
                    <h3 className="font-heading text-xl font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{v.make} {v.model}</h3>
                    <p className="text-sm font-medium text-muted-foreground line-clamp-1 min-h-[1.25rem]">{v.version || '\u00A0'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {v.productionYear && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium"><Calendar className="h-3.5 w-3.5 shrink-0" /> {v.productionYear}</span>}
                    {v.enginePowerHp && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium"><Gauge className="h-3.5 w-3.5 shrink-0" /> {v.enginePowerHp} KM</span>}
                    {v.fuelType && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium"><Fuel className="h-3.5 w-3.5 shrink-0" /> {v.fuelType}</span>}
                    {v.transmission && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium"><Settings2 className="h-3.5 w-3.5 shrink-0" /> {v.transmission}</span>}
                  </div>
                  <div className="flex-1" />
                  <div className="pt-3">
                    {v.minMonthlyRateGross ? (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Rata od</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="inline-flex items-baseline gap-0.5 px-2.5 py-1.5 rounded-lg font-bold text-2xl" style={{ background: accent, color: accentText }}>
                            {isBusiness ? formatNumber(Math.ceil(v.minMonthlyRateNet || v.minMonthlyRateGross / 1.23)) : formatNumber(Math.ceil(v.minMonthlyRateGross))}
                            <span className="text-base font-semibold ml-0.5">zł</span>
                          </span>
                          <span className="text-xs text-muted-foreground">{isBusiness ? 'netto / mies.' : 'brutto / mies.'}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {isBusiness ? `${formatNumber(Math.ceil(v.minMonthlyRateGross))} zł brutto` : `${formatNumber(Math.ceil(v.minMonthlyRateNet || v.minMonthlyRateGross / 1.23))} zł netto`}
                        </div>
                        {v.minRateConfig && <span className="text-xs text-muted-foreground">{v.minRateConfig.contractMonths} mies. | {(v.minRateConfig.annualMileageKm / 1000).toFixed(0)}tys. km/rok</span>}
                      </div>
                    ) : <span className="text-sm text-muted-foreground">Zapytaj o cenę</span>}
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
        </div>

        {/* ── Pagination ── */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-10">
            <Button variant="outline" onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Poprzednia
            </Button>
            <span className="text-sm text-gray-600">Strona {pagination.page} z {pagination.totalPages}</span>
            <Button variant="outline" onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={page >= pagination.totalPages}>
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
