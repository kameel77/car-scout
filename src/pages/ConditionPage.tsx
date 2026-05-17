/**
 * ConditionPage – combined listing page that shows BOTH sale vehicles
 * and rental vehicles filtered by condition (NEW or USED).
 *
 * Routes: /nowe → condition="NEW"   /uzywane → condition="USED"
 */
import React from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Car, Calendar, Gauge, Fuel, Settings2, Building2, User, ArrowUpDown, Check } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { FilterPanel, FilterState } from '@/components/FilterPanel';
import { ActiveFilters } from '@/components/ActiveFilters';
import { TopFilterBar } from '@/components/TopFilterBar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { ListingPagination } from '@/components/ListingPagination';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useListings } from '@/hooks/useListings';
import { useListingOptions } from '@/hooks/useListingOptions';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useBrand } from '@/contexts/BrandContext';
import { MetaHead } from '@/components/seo/MetaHead';
import { useSeoConfig } from '@/components/seo/SeoManager';
import { rentalPublicApi } from '@/services/rental-api';
import { normalizeRentalImageUrl, cn } from '@/lib/utils';
import { getTransmissionShortLabel, canonicalTransmission, canonicalFuel, translateTechnicalValue } from '@/utils/i18n-utils';
import { formatNumber } from '@/utils/formatters';
import { ImageSwiper } from '@/components/ImageSwiper';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';
const PLN_FMT = new Intl.NumberFormat('pl-PL');

/* ── helpers ── */
const emptyFilters: FilterState = {
  makes: [], models: [], fuelTypes: [], yearFrom: '', yearTo: '',
  mileageFrom: '', mileageTo: '', drives: [], transmissions: [],
  powerFrom: '', powerTo: '', capacityFrom: '', capacityTo: '',
  bodyTypes: [], statuses: [], priceFrom: '', priceTo: '',
  rateFrom: '', rateTo: '', rateType: 'credit', rateBasis: 'gross',
  query: '',
};

const parseArray = (param: string | null) => param ? param.split(',') : [];
const DEFAULT_PER_PAGE = 30;
const PAGE_SIZE_OPTIONS = [30, 60];
const parseNumberParam = (v: string | null, fallback: number) => {
  const p = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(p) && p > 0 ? p : fallback;
};

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
/* ── ConditionNavTabs ── */

const sortOpts = [
  { value: 'year_desc', label: 'Najmłodszy rocznik' },
  { value: 'year_asc', label: 'Najstarszy rocznik' },
  { value: 'price_asc', label: 'Cena rosnąco' },
  { value: 'price_desc', label: 'Cena malejąco' },
  { value: 'mileage_asc', label: 'Przebieg rosnąco' },
];

function ConditionNavTabs({ condition, resultCount, byCondition, sortBy, onSortChange }: {
  condition: 'NEW' | 'USED'; resultCount?: number;
  byCondition?: { NEW: number; USED: number };
  sortBy: string;
  onSortChange: (v: string) => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { priceType, setPriceType } = usePriceSettings();
  const isNew = condition === 'NEW';
  const tabCls = (active: boolean) => cn(
    'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer',
    active ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
  );
  const currentSort = sortOpts.find(s => s.value === sortBy);
  const totalCount = byCondition ? byCondition.NEW + byCondition.USED : null;
  return (
    <div className="flex items-center gap-1 border-b border-border overflow-x-auto mb-3">
      <button type="button" onClick={() => navigate('/samochody')} className={tabCls(false)}>
        {t('status.all', 'Wszystkie')}
        {totalCount !== null && (
          <span className="ml-1.5 text-xs text-muted-foreground">({PLN_FMT.format(totalCount)})</span>
        )}
      </button>
      <button type="button" onClick={() => navigate('/nowe')} className={tabCls(isNew)}>
        {t('status.new', 'Nowy')}
        {byCondition && (
          <span className="ml-1.5 text-xs text-muted-foreground">({PLN_FMT.format(byCondition.NEW)})</span>
        )}
      </button>
      <button type="button" onClick={() => navigate('/uzywane')} className={tabCls(!isNew)}>
        {t('status.used', 'Używany')}
        {byCondition && (
          <span className="ml-1.5 text-xs text-muted-foreground">({PLN_FMT.format(byCondition.USED)})</span>
        )}
      </button>
      <div className="flex-1" />
      {resultCount !== undefined && (
        <span className="hidden sm:block text-sm text-muted-foreground whitespace-nowrap px-2">
          {t('common.found')}: <span className="font-semibold text-foreground">{PLN_FMT.format(resultCount)}</span>
        </span>
      )}
      <div className="flex bg-secondary rounded-lg p-0.5">
        <button type="button" onClick={() => setPriceType('net')}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
            priceType === 'net' ? 'bg-accent shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
          <Building2 className="w-3.5 h-3.5" /> {t('pricing.business', 'Na firmę')}
        </button>
        <button type="button" onClick={() => setPriceType('gross')}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
            priceType === 'gross' ? 'bg-accent shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
          <User className="w-3.5 h-3.5" /> {t('pricing.private', 'Prywatnie')}
        </button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 h-8 text-xs whitespace-nowrap border border-border rounded-full px-3 hover:bg-secondary">
            <ArrowUpDown className="h-3.5 w-3.5" /> {currentSort?.label || 'Sortuj'}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {sortOpts.map(o => (
            <DropdownMenuItem key={o.value} onClick={() => onSortChange(o.value)}>
              {sortBy === o.value && <Check className="h-4 w-4 mr-2" />}
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ── component ── */
interface ConditionPageProps {
  condition: 'NEW' | 'USED';
}

export default function ConditionPage({ condition }: ConditionPageProps) {
  const { t, i18n } = useTranslation();
  const { config } = useBrand();
  const { data: settings } = useAppSettings();
  const { data: seoConfig } = useSeoConfig();
  const { priceType } = usePriceSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  const isNew = condition === 'NEW';
  // Visible h1 — keyword-rich, emphasises the value prop (flexible financing + guidance).
  const pageTitle = isNew
    ? 'Nowe samochody z elastycznym finansowaniem'
    : 'Używane samochody z elastycznym finansowaniem';
  // Visible sub-heading under the h1.
  const pageDescription = isNew
    ? 'Aktualne oferty nowych aut od sprawdzonych dealerów. Dobieramy kredyt, leasing lub wynajem długoterminowy i prowadzimy Cię przez cały proces zakupu — od konfiguracji po odbiór kluczyków.'
    : 'Sprawdzone używane samochody w atrakcyjnych cenach. Dobieramy kredyt, leasing lub wynajem długoterminowy i wspieramy Cię na każdym etapie zakupu — od wyboru auta po finalizację umowy.';
  // Shorter copy for <title> tag (keeps room for siteName).
  const seoTitle = isNew
    ? 'Nowe samochody z finansowaniem'
    : 'Używane samochody z finansowaniem';
  // Shorter copy for <meta description> (155–175 znaków).
  const seoDescription = isNew
    ? 'Aktualne oferty nowych samochodów od sprawdzonych dealerów. Dobieramy najkorzystniejszy kredyt, leasing lub wynajem długoterminowy — wspieramy Cię na każdym etapie zakupu.'
    : 'Sprawdzone używane samochody w atrakcyjnych cenach. Dobieramy kredyt, leasing lub wynajem długoterminowy — prowadzimy Cię przez cały proces zakupu.';

  /* ── Sale vehicle filters (condition is locked) ── */
  const [filters, setFilters] = React.useState<FilterState>(() => {
    const rt = searchParams.get('rateType');
    const rb = searchParams.get('rateBasis');
    return {
      makes: parseArray(searchParams.get('make')),
      models: parseArray(searchParams.get('model')),
      fuelTypes: parseArray(searchParams.get('fuelType')).map(canonicalFuel),
      transmissions: parseArray(searchParams.get('transmission')).map(canonicalTransmission),
      bodyTypes: parseArray(searchParams.get('bodyType')),
      drives: parseArray(searchParams.get('drive')),
      statuses: [condition], // LOCKED
      yearFrom: searchParams.get('yearMin') || '',
      yearTo: searchParams.get('yearMax') || '',
      mileageFrom: searchParams.get('mileageMin') || '',
      mileageTo: searchParams.get('mileageMax') || '',
      priceFrom: searchParams.get('priceMin') || '',
      priceTo: searchParams.get('priceMax') || '',
      powerFrom: searchParams.get('powerMin') || '',
      powerTo: searchParams.get('powerMax') || '',
      capacityFrom: searchParams.get('capacityMin') || '',
      capacityTo: searchParams.get('capacityMax') || '',
      rateFrom: searchParams.get('rateMin') || '',
      rateTo: searchParams.get('rateMax') || '',
      rateType: rt === 'lease' ? 'lease' : 'credit',
      rateBasis: rb === 'net' ? 'net' : 'gross',
      query: searchParams.get('q') || '',
    };
  });

  // Keep condition locked when user changes other filters
  React.useEffect(() => {
    if (filters.statuses.length !== 1 || filters.statuses[0] !== condition) {
      setFilters(prev => ({ ...prev, statuses: [condition] }));
    }
  }, [condition, filters.statuses]);

  const defaultSortCars = settings?.defaultSortCars || 'year_desc';
  const [sortBy, setSortBy] = React.useState(searchParams.get('sortBy') || defaultSortCars);

  React.useEffect(() => {
    if (settings?.defaultSortCars && !searchParams.get('sortBy') && sortBy !== settings.defaultSortCars) {
      setSortBy(settings.defaultSortCars);
    }
  }, [settings?.defaultSortCars, searchParams]);

  const initialPage = parseNumberParam(searchParams.get('page'), 1);
  const initialPerPage = parseNumberParam(searchParams.get('perPage'), DEFAULT_PER_PAGE);
  const [page, setPage] = React.useState(initialPage);
  const [perPage, setPerPage] = React.useState(
    PAGE_SIZE_OPTIONS.includes(initialPerPage) ? initialPerPage : DEFAULT_PER_PAGE
  );

  const [allFiltersOpen, setAllFiltersOpen] = React.useState(() => searchParams.get('openFilters') === 'true');

  React.useEffect(() => {
    if (searchParams.get('openFilters')) {
      const next = new URLSearchParams(searchParams);
      next.delete('openFilters');
      setSearchParams(next, { replace: true });
    }
  }, []);

  // Desktop search (debounced)
  const [desktopSearch, setDesktopSearch] = React.useState(filters.query || '');
  const [isDesktopTyping, setIsDesktopTyping] = React.useState(false);

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setIsDesktopTyping(false);
      if (desktopSearch !== filters.query) {
        handleFilterChange({ ...filters, query: desktopSearch });
      }
    }, 400);
    return () => clearTimeout(tm);
  }, [desktopSearch]);

  React.useEffect(() => {
    if (!isDesktopTyping && filters.query !== desktopSearch) {
      setDesktopSearch(filters.query || '');
    }
  }, [filters.query]);

  // Sync URL
  const urlSyncTimeoutRef = React.useRef<NodeJS.Timeout>();
  React.useEffect(() => {
    if (urlSyncTimeoutRef.current) clearTimeout(urlSyncTimeoutRef.current);
    urlSyncTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (filters.makes.length) params.set('make', filters.makes.join(','));
      if (filters.models.length) params.set('model', filters.models.join(','));
      if (filters.fuelTypes.length) params.set('fuelType', filters.fuelTypes.join(','));
      if (filters.transmissions.length) params.set('transmission', filters.transmissions.join(','));
      if (filters.bodyTypes.length) params.set('bodyType', filters.bodyTypes.join(','));
      if (filters.drives.length) params.set('drive', filters.drives.join(','));
      if (filters.yearFrom) params.set('yearMin', filters.yearFrom);
      if (filters.yearTo) params.set('yearMax', filters.yearTo);
      if (filters.mileageFrom) params.set('mileageMin', filters.mileageFrom);
      if (filters.mileageTo) params.set('mileageMax', filters.mileageTo);
      if (filters.priceFrom) params.set('priceMin', filters.priceFrom);
      if (filters.priceTo) params.set('priceMax', filters.priceTo);
      if (filters.powerFrom) params.set('powerMin', filters.powerFrom);
      if (filters.powerTo) params.set('powerMax', filters.powerTo);
      if (filters.capacityFrom) params.set('capacityMin', filters.capacityFrom);
      if (filters.capacityTo) params.set('capacityMax', filters.capacityTo);
      if (filters.rateFrom) params.set('rateMin', filters.rateFrom);
      if (filters.rateTo) params.set('rateMax', filters.rateTo);
      if ((filters.rateFrom || filters.rateTo) && filters.rateType !== 'credit') params.set('rateType', filters.rateType);
      if ((filters.rateFrom || filters.rateTo) && filters.rateBasis !== 'gross') params.set('rateBasis', filters.rateBasis);
      if (filters.query) params.set('q', filters.query);
      if (sortBy !== defaultSortCars) params.set('sortBy', sortBy);
      if (page > 1) params.set('page', page.toString());
      if (perPage !== DEFAULT_PER_PAGE) params.set('perPage', perPage.toString());
      setSearchParams(params, { replace: true });
    }, 100);
    return () => { if (urlSyncTimeoutRef.current) clearTimeout(urlSyncTimeoutRef.current); };
  }, [filters, sortBy, page, perPage, setSearchParams]);

  React.useEffect(() => {
    const nextPage = parseNumberParam(searchParams.get('page'), 1);
    const nextPerPageRaw = parseNumberParam(searchParams.get('perPage'), DEFAULT_PER_PAGE);
    const nextPerPage = PAGE_SIZE_OPTIONS.includes(nextPerPageRaw) ? nextPerPageRaw : DEFAULT_PER_PAGE;
    if (nextPage !== page) setPage(nextPage);
    if (nextPerPage !== perPage) setPerPage(nextPerPage);
  }, [searchParams]);

  /* ── Data: sale listings ── */
  const { data: saleData, isLoading: saleLoading } = useListings(filters, sortBy, page, perPage);
  const { data: options } = useListingOptions();
  const saleListings = saleData?.listings || [];
  const saleTotalCount = saleData?.count ?? saleListings.length;
  const saleTotalPages = saleData?.totalPages ?? Math.max(1, Math.ceil((saleTotalCount || 1) / perPage));

  /* ── Data: rental vehicles (same condition) ── */
  const { data: rentalData, isLoading: rentalLoading } = useQuery({
    queryKey: ['rental-condition', condition, filters.makes, filters.fuelTypes, filters.bodyTypes, filters.yearFrom, filters.yearTo, filters.priceFrom, filters.priceTo, filters.query],
    queryFn: () => rentalPublicApi.listVehicles({
      page: '1',
      limit: '50',
      search: filters.query || undefined,
      make: filters.makes.length === 1 ? filters.makes[0] : undefined,
      fuelType: filters.fuelTypes.length === 1 ? filters.fuelTypes[0] : undefined,
      bodyType: filters.bodyTypes.length === 1 ? filters.bodyTypes[0] : undefined,
      yearFrom: filters.yearFrom || undefined,
      yearTo: filters.yearTo || undefined,
      priceFrom: filters.priceFrom || undefined,
      priceTo: filters.priceTo || undefined,
      condition,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
  });

  const rentalVehicles = rentalData?.vehicles || [];
  const isBusiness = priceType === 'net';
  const accent = 'hsl(var(--accent))';
  const accentText = 'hsl(var(--accent-foreground))';

  /* ── Handlers ── */
  const handleFilterChange = React.useCallback((updatedFilters: FilterState) => {
    // Ensure condition stays locked
    setFilters({ ...updatedFilters, statuses: [condition] });
    setPage(1);
  }, [condition]);

  const handleClearFilters = React.useCallback(() => {
    setFilters({ ...emptyFilters, statuses: [condition] });
    setPage(1);
  }, [condition]);

  const hasActiveFilters = React.useMemo(() =>
    Object.entries(filters).some(([key, v]) => {
      if (key === 'statuses') return false; // statuses is always locked
      return Array.isArray(v) ? v.length > 0 : v !== '';
    }),
    [filters]
  );

  const handlePageChange = React.useCallback((newPage: number) => {
    const safePage = Math.min(Math.max(newPage, 1), saleTotalPages);
    setPage(safePage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [saleTotalPages]);

  const handlePerPageChange = React.useCallback((value: string) => {
    const parsed = parseInt(value, 10);
    const validated = PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PER_PAGE;
    setPerPage(validated);
    setPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const totalCombined = saleTotalCount + rentalVehicles.length;

  /* ── SEO ── */
  const lang = i18n.language;
  const suffix = lang === 'pl' ? '' : lang === 'en' ? 'En' : 'De';
  const siteName = React.useMemo(() => {
    if (!settings) return '';
    const langCode = i18n.language.slice(0, 2).toLowerCase();
    const candidates = [
      langCode === 'en' ? settings?.siteNameEn : null,
      langCode === 'de' ? settings?.siteNameDe : null,
      langCode === 'pl' ? settings?.siteNamePl : null,
      settings?.siteNameEn, settings?.siteNameDe, settings?.siteNamePl,
    ];
    return candidates.find((s) => typeof s === 'string' && s.trim().length > 0)?.trim() || config.name;
  }, [i18n.language, settings, config.name]);

  return (
    <div className="min-h-screen bg-background">
      <MetaHead
        title={`${seoTitle} | ${siteName}`}
        description={seoDescription}
        image={seoConfig?.homeOgImage}
        canonical={isNew ? '/nowe' : '/uzywane'}
        schema={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'CollectionPage',
              name: pageTitle,
              description: seoDescription,
              url: `${window.location.origin}${isNew ? '/nowe' : '/uzywane'}`,
              isPartOf: { '@type': 'WebSite', name: siteName, url: window.location.origin },
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: totalCombined,
                itemListElement: saleListings.slice(0, 10).map((l: any, i: number) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  item: {
                    '@type': 'Car',
                    name: `${l.make} ${l.model}`,
                    url: `${window.location.origin}/samochody/${l.slug || l.listing_id}`,
                    vehicleModelDate: l.year?.toString(),
                    fuelType: l.fuel_type,
                    vehicleTransmission: l.transmission,
                  },
                })),
              },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Strona główna', item: window.location.origin },
                { '@type': 'ListItem', position: 2, name: 'Samochody', item: `${window.location.origin}/samochody` },
                { '@type': 'ListItem', position: 3, name: isNew ? 'Nowe' : 'Używane', item: `${window.location.origin}${isNew ? '/nowe' : '/uzywane'}` },
              ],
            },
          ],
        }}
      />

      <Header onClearFilters={handleClearFilters} hasActiveFilters={hasActiveFilters} />

      {/* Full-page filter sheet */}
      <Sheet open={allFiltersOpen} onOpenChange={setAllFiltersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('filters.title')}</SheetTitle>
          </SheetHeader>
          <div className="px-6 pt-6 pb-6 h-[calc(100vh-5rem)] overflow-hidden">
            <FilterPanel
              filters={filters}
              onFilterChange={handleFilterChange}
              onClear={handleClearFilters}
              resultCount={totalCombined}
              availableMakes={options?.makes || []}
              availableModels={options?.models || []}
              facets={saleData?.facets}
            />
          </div>
        </SheetContent>
      </Sheet>

      <main className="container pt-4 pb-6">
        <div className="min-w-0">
          {/* Page heading */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground mt-1">{pageDescription}</p>
          </div>

          {/* Top filter bar */}
          <TopFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            availableMakes={options?.makes || []}
            availableModels={options?.models || []}
            onOpenAllFilters={() => setAllFiltersOpen(true)}
            query={desktopSearch}
            onQueryChange={(v) => {
              setIsDesktopTyping(true);
              setDesktopSearch(v);
            }}
            facets={saleData?.facets}
          />

          {/* Tabs: Nowy / Używany – navigate between /nowe and /uzywane */}
          <div className="flex-1 min-w-0">
            <ConditionNavTabs
              condition={condition}
              resultCount={totalCombined}
              byCondition={saleData?.byCondition}
              sortBy={sortBy}
              onSortChange={(value) => {
                setSortBy(value);
                setPage(1);
              }}
            />

            <ActiveFilters
              filters={{ ...filters, statuses: [] }} // Hide statuses from active filter chips
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
              resultCount={totalCombined}
              sortBy={sortBy}
              onSortChange={(value) => {
                setSortBy(value);
                setPage(1);
              }}
              availableMakes={options?.makes || []}
              availableModels={options?.models || []}
            />

            {/* ── UNIFIED GRID ── */}
            <div className={`mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${Number(settings?.searchGridColumns) === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'} gap-4`}>
              {rentalVehicles.map((v: any) => (
                <Link key={`r-${v.id}`} to={`/wynajem-dlugoterminowy/${v.slug || v.id}`} className="listing-card group flex flex-col overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="relative">
                    <ImageSwiper images={buildRentalImageList(v)} alt={`${v.make} ${v.model}`} aspectClassName="aspect-[16/10]" imgClassName="group-hover:scale-105" fallback={<div className="w-full h-full flex items-center justify-center"><Car className="w-16 h-16 text-gray-300" /></div>} />
                    <div className="absolute top-3 left-3 bg-accent text-accent-foreground text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full z-10">WYNAJEM</div>
                  </div>
                  <div className="p-4 space-y-3 flex-1 flex flex-col">
                    <div>
                      <span className={`text-[10px] font-bold tracking-wider ${isNew ? 'text-accent' : 'text-muted-foreground'}`}>{isNew ? t('listing.statusNew') : t('listing.statusUsed')}</span>
                      <h3 className="font-heading text-xl font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{v.make} {v.model}</h3>
                      <p className="text-sm font-medium text-muted-foreground line-clamp-1 min-h-[1.25rem]">{v.version || '\u00A0'}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {v.productionYear && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium"><Calendar className="h-3.5 w-3.5 shrink-0" /> {v.productionYear}</span>}
                      {v.enginePowerHp && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium"><Gauge className="h-3.5 w-3.5 shrink-0" /> {v.enginePowerHp} KM</span>}
                      {v.fuelType && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium"><Fuel className="h-3.5 w-3.5 shrink-0" /> {translateTechnicalValue('fuel', v.fuelType, t)}</span>}
                      {v.transmission && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium"><Settings2 className="h-3.5 w-3.5 shrink-0" /> {getTransmissionShortLabel(v.transmission, t)}</span>}
                    </div>
                    <div className="flex-1" />
                    <div className="pt-3">
                      {v.minMonthlyRateGross ? (<div>
                        <span className="text-xs text-muted-foreground block mb-1">Rata od</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="inline-flex items-baseline gap-0.5 px-2.5 py-1.5 rounded-lg font-bold text-2xl" style={{ background: accent, color: accentText }}>
                            {isBusiness ? formatNumber(Math.ceil(v.minMonthlyRateNet || v.minMonthlyRateGross / 1.23)) : formatNumber(Math.ceil(v.minMonthlyRateGross))}
                            <span className="text-base font-semibold ml-0.5">zł</span>
                          </span>
                          <span className="text-xs text-muted-foreground">{isBusiness ? 'netto / mies.' : 'brutto / mies.'}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{isBusiness ? `${formatNumber(Math.ceil(v.minMonthlyRateGross))} zł brutto` : `${formatNumber(Math.ceil(v.minMonthlyRateNet || v.minMonthlyRateGross / 1.23))} zł netto`}</div>
                        {v.minRateConfig && <span className="text-xs text-muted-foreground">{v.minRateConfig.contractMonths} mies. | {(v.minRateConfig.annualMileageKm / 1000).toFixed(0)}tys. km/rok</span>}
                      </div>) : <span className="text-sm text-muted-foreground">Zapytaj o cenę</span>}
                    </div>
                  </div>
                </Link>
              ))}
              {saleLoading ? Array.from({ length: 6 }).map((_, i) => <ListingCardSkeleton key={i} />) : saleListings.map((listing, index) => <ListingCard key={listing.listing_id} listing={listing} index={index} />)}
            </div>
            {/* Empty state */}
            {!saleLoading && !rentalLoading && saleListings.length === 0 && rentalVehicles.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <Car className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground">{t('empty.noResults')}</p>
                <p className="text-muted-foreground mt-1">{t('empty.noResultsHint')}</p>
              </div>
            )}

            {/* Pagination (for sale listings) */}
            {!saleLoading && saleListings.length > 0 && (
              <div className="mt-8 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {t('common.found')}: <span className="font-semibold text-foreground">{totalCombined}</span> {t('common.offers')}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{t('common.perPage')}</span>
                    <Select value={perPage.toString()} onValueChange={handlePerPageChange}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={size.toString()}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <ListingPagination
                  page={page}
                  totalPages={saleTotalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <ScrollToTopButton />
      <Footer />
    </div>
  );
}
