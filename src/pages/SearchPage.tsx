import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { FilterPanel, FilterState } from '@/components/FilterPanel';
import { ActiveFilters } from '@/components/ActiveFilters';
import { StatusTabs } from '@/components/StatusTabs';
import { TopFilterBar } from '@/components/TopFilterBar';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { RentalListingCard } from '@/components/RentalListingCard';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useListings } from '@/hooks/useListings';
import { useListingOptions } from '@/hooks/useListingOptions';
import { rentalPublicApi } from '@/services/rental-api';
import { mergeFacets, mergeMakes, mergeModels } from '@/utils/listingMerge';
import { ListingPagination } from '@/components/ListingPagination';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { Footer } from '@/components/Footer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MetaHead } from '@/components/seo/MetaHead';
import { useSeoConfig } from '@/components/seo/SeoManager';
import { useAppSettings } from '@/hooks/useAppSettings';
import { PartnerBannerAd } from '@/components/ads/PartnerBannerAd';
import { PartnerAdCard } from '@/components/ads/PartnerAdCard';
import { usePartnerAds } from '@/hooks/usePartnerAds';
import { useBrand } from '@/contexts/BrandContext';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';
import { canonicalTransmission, canonicalFuel } from '@/utils/i18n-utils';

const emptyFilters: FilterState = {
  makes: [],
  models: [],
  fuelTypes: [],
  yearFrom: '',
  yearTo: '',
  mileageFrom: '',
  mileageTo: '',
  drives: [],
  transmissions: [],
  powerFrom: '',
  powerTo: '',
  capacityFrom: '',
  capacityTo: '',
  bodyTypes: [],
  statuses: [],
  priceFrom: '',
  priceTo: '',
  rateFrom: '',
  rateTo: '',
  rateType: 'credit',
  rateBasis: 'gross',
  query: '',
};

// Helper to parse arrays from URL
const parseArray = (param: string | null) => param ? param.split(',') : [];

const DEFAULT_PER_PAGE = 30;
const PAGE_SIZE_OPTIONS = [30, 60];

const parseNumberParam = (value: string | null, fallback: number) => {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export default function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: seoConfig } = useSeoConfig();
  const { config } = useBrand();
  const { setPriceType } = usePriceSettings();

  // Sync URL ?clientType=private|business → global priceType (one-shot on mount)
  React.useEffect(() => {
    const ct = searchParams.get('clientType');
    if (ct === 'business') setPriceType('net');
    else if (ct === 'private') setPriceType('gross');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize from URL
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
      statuses: parseArray(searchParams.get('status')).map((c) => c.toUpperCase()),

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

  const { data: settings } = useAppSettings();
  const defaultSortCars = settings?.defaultSortCars || 'year_desc';
  const [sortBy, setSortBy] = React.useState(searchParams.get('sortBy') || defaultSortCars);
  
  // Re-sync default if settings loads after initial mount and no explicit sort is set
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

  // "Wszystkie filtry" sheet (full FilterPanel) trigger
  const [allFiltersOpen, setAllFiltersOpen] = React.useState(() => {
    return searchParams.get('openFilters') === 'true';
  });

  // Clean up openFilters param after reading it
  React.useEffect(() => {
    if (searchParams.get('openFilters')) {
      const next = new URLSearchParams(searchParams);
      next.delete('openFilters');
      setSearchParams(next, { replace: true });
    }
  }, []);

  // Desktop search state (debounced, synced to filters.query)
  const [desktopSearch, setDesktopSearch] = React.useState(filters.query || '');
  const [isDesktopTyping, setIsDesktopTyping] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setIsDesktopTyping(false);
      if (desktopSearch !== filters.query) {
        handleFilterChange({ ...filters, query: desktopSearch });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [desktopSearch]);

  // Sync desktop search when filters cleared externally
  React.useEffect(() => {
    if (!isDesktopTyping && filters.query !== desktopSearch) {
      setDesktopSearch(filters.query || '');
    }
  }, [filters.query]);

  // Sync URL when state changes - use a ref to prevent loops
  const urlSyncTimeoutRef = React.useRef<NodeJS.Timeout>();
  React.useEffect(() => {
    // Clear any pending timeout
    if (urlSyncTimeoutRef.current) {
      clearTimeout(urlSyncTimeoutRef.current);
    }

    // Debounce URL updates to prevent excessive calls
    urlSyncTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams();

      if (filters.makes.length) params.set('make', filters.makes.join(','));
      if (filters.models.length) params.set('model', filters.models.join(','));
      if (filters.fuelTypes.length) params.set('fuelType', filters.fuelTypes.join(','));
      if (filters.transmissions.length) params.set('transmission', filters.transmissions.join(','));
      if (filters.bodyTypes.length) params.set('bodyType', filters.bodyTypes.join(','));
      if (filters.drives.length) params.set('drive', filters.drives.join(','));
      if (filters.statuses.length) params.set('status', filters.statuses.map((c) => c.toLowerCase()).join(','));

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

    return () => {
      if (urlSyncTimeoutRef.current) {
        clearTimeout(urlSyncTimeoutRef.current);
      }
    };
  }, [filters, sortBy, page, perPage, setSearchParams]);

  React.useEffect(() => {
    const nextPage = parseNumberParam(searchParams.get('page'), 1);
    const nextPerPageRaw = parseNumberParam(searchParams.get('perPage'), DEFAULT_PER_PAGE);
    const nextPerPage = PAGE_SIZE_OPTIONS.includes(nextPerPageRaw) ? nextPerPageRaw : DEFAULT_PER_PAGE;

    if (nextPage !== page) {
      setPage(nextPage);
    }

    if (nextPerPage !== perPage) {
      setPerPage(nextPerPage);
    }
  }, [searchParams]);

  const { data, isLoading } = useListings(filters, sortBy, page, perPage);
  const { data: options } = useListingOptions();
  const { data: adsData } = usePartnerAds();
  const partnersAds = adsData?.ads || [];
  const listings = data?.listings || [];
  const saleTotalCount = data?.count ?? listings.length;

  const rentalCondition = filters.statuses.length === 1
    ? (filters.statuses[0] as 'NEW' | 'USED')
    : undefined;
  // Hide rentals when a price range is set: rental "price" is the monthly rate,
  // which would mix two incompatible scales (full price vs. rate).
  const hideRentals = Boolean(filters.priceFrom || filters.priceTo);
  const { data: rentalData, isLoading: rentalLoading } = useQuery({
    queryKey: ['rental-search', rentalCondition, filters.makes, filters.fuelTypes, filters.bodyTypes, filters.yearFrom, filters.yearTo, filters.query],
    queryFn: () => rentalPublicApi.listVehicles({
      page: '1',
      limit: '50',
      search: filters.query || undefined,
      make: filters.makes.length === 1 ? filters.makes[0] : undefined,
      fuelType: filters.fuelTypes.length === 1 ? filters.fuelTypes[0] : undefined,
      bodyType: filters.bodyTypes.length === 1 ? filters.bodyTypes[0] : undefined,
      yearFrom: filters.yearFrom || undefined,
      yearTo: filters.yearTo || undefined,
      condition: rentalCondition,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    enabled: !hideRentals,
  });
  const rentalVehicles = hideRentals ? [] : (rentalData?.vehicles || []);

  const rentalByCondition = hideRentals
    ? undefined
    : (rentalData?.filters?.byCondition as { NEW: number; USED: number } | undefined);
  const mergedByCondition = data?.byCondition
    ? {
        NEW: data.byCondition.NEW + (rentalByCondition?.NEW ?? 0),
        USED: data.byCondition.USED + (rentalByCondition?.USED ?? 0),
      }
    : undefined;
  const mergedMakes = React.useMemo(
    () => mergeMakes(options?.makes || [], rentalData?.filters?.makes || []),
    [options?.makes, rentalData?.filters?.makes],
  );
  const mergedModels = React.useMemo(
    () => mergeModels(options?.models || [], rentalData?.filters?.models || []),
    [options?.models, rentalData?.filters?.models],
  );
  const mergedFacets = React.useMemo(
    () => mergeFacets(data?.facets, rentalData?.facets),
    [data?.facets, rentalData?.facets],
  );

  const totalCount = saleTotalCount + rentalVehicles.length;
  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil((saleTotalCount || 1) / perPage));

  const handleFilterChange = React.useCallback((updatedFilters: FilterState) => {
    setFilters(updatedFilters);
    setPage(1);
  }, []);

  const handleClearFilters = React.useCallback(() => {
    setFilters(emptyFilters);
    setPage(1);
  }, []);

  const hasActiveFilters = React.useMemo(() =>
    Object.values(filters).some((v) =>
      Array.isArray(v) ? v.length > 0 : v !== ''
    ),
    [filters]
  );

  const handlePageChange = React.useCallback((newPage: number) => {
    const safePage = Math.min(Math.max(newPage, 1), totalPages);
    setPage(safePage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [totalPages]);

  const handlePerPageChange = React.useCallback((value: string) => {
    const parsed = parseInt(value, 10);
    const validated = PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PER_PAGE;
    setPerPage(validated);
    setPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const { i18n } = useTranslation();
  const lang = i18n.language;
  const suffix = lang === 'pl' ? '' : lang === 'en' ? 'En' : 'De';

  const pageTitleBase = 'Samochody nowe i używane z finansowaniem';
  const pageDescription = 'Tysiące sprawdzonych ofert nowych i używanych samochodów w jednym miejscu. Dobieramy kredyt, leasing lub wynajem długoterminowy — i prowadzimy Cię przez cały proces zakupu.';


  const siteName = React.useMemo(() => {
    if (!settings) return '';
    const langCode = i18n.language.slice(0, 2).toLowerCase();
    const candidates = [
      langCode === 'en' ? settings?.siteNameEn : null,
      langCode === 'de' ? settings?.siteNameDe : null,
      langCode === 'pl' ? settings?.siteNamePl : null,
      settings?.siteNameEn,
      settings?.siteNameDe,
      settings?.siteNamePl
    ];
    const pick = candidates.find((s) => typeof s === 'string' && s.trim().length > 0);
    return pick?.trim() || config.name;
  }, [i18n.language, settings?.siteNameEn, settings?.siteNameDe, settings?.siteNamePl, settings, config.name]);

  return (
    <div className="min-h-screen bg-background">
      <MetaHead
        title={`${pageTitleBase} | ${siteName}`}
        description={pageDescription}
        image={seoConfig?.homeOgImage}
        canonical="/samochody"
        schema={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "name": siteName,
              "url": window.location.origin,
              "logo": seoConfig?.homeOgImage,
            },
            {
              "@type": "CollectionPage",
              "name": pageTitleBase,
              "description": pageDescription,
              "url": `${window.location.origin}/samochody`,
              "isPartOf": { "@type": "WebSite", "name": siteName, "url": window.location.origin },
            },
            {
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Strona główna", "item": window.location.origin },
                { "@type": "ListItem", "position": 2, "name": pageTitleBase, "item": `${window.location.origin}/samochody` },
              ],
            },
          ],
        }}
      />

      <Header onClearFilters={handleClearFilters} hasActiveFilters={hasActiveFilters} />

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
              resultCount={totalCount}
              availableMakes={mergedMakes}
              availableModels={mergedModels}
              facets={mergedFacets}
            />
          </div>
        </SheetContent>
      </Sheet>

      <main className="container pt-4 pb-6">
        <div className="min-w-0">
          {/* Page heading */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-foreground">Samochody nowe i używane z elastycznym finansowaniem</h1>
            <p className="text-sm text-muted-foreground mt-1">Tysiące sprawdzonych aut w jednym miejscu. Dobieramy kredyt, leasing lub wynajem długoterminowy i prowadzimy Cię przez cały proces — od wyboru pojazdu po odbiór kluczyków.</p>
          </div>

          {/* Top filter bar on desktop */}
          <TopFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            availableMakes={mergedMakes}
            availableModels={mergedModels}
            onOpenAllFilters={() => setAllFiltersOpen(true)}
            query={desktopSearch}
            onQueryChange={(v) => {
              setIsDesktopTyping(true);
              setDesktopSearch(v);
            }}
            facets={mergedFacets}
          />

          {/* Results */}
          <div className="flex-1 min-w-0">
            <StatusTabs
              activeStatuses={filters.statuses}
              byCondition={mergedByCondition}
              onChange={(statuses) => {
                handleFilterChange({ ...filters, statuses });
                setPage(1);
              }}
              className="mb-3"
              resultCount={totalCount}
              sortBy={sortBy}
              onSortChange={(value) => {
                setSortBy(value);
                setPage(1);
              }}
            />

            <ActiveFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
              resultCount={totalCount}
              sortBy={sortBy}
              onSortChange={(value) => {
                setSortBy(value);
                setPage(page === 1 ? 1 : 1); // Reset to page 1 on sort change
                setPage(1);
              }}
              availableMakes={mergedMakes}
              availableModels={mergedModels}
            />

            {/* Top Banner Ad */}
            {!isLoading && listings.length > 0 && partnersAds.find(a => a.placement === 'SEARCH_TOP' && a.isActive) && (
              <div className="mt-4">
                {partnersAds.filter(a => a.placement === 'SEARCH_TOP' && a.isActive).slice(0, 1).map(ad => (
                  <PartnerBannerAd
                    key={ad.id}
                    title={(ad as any)[`title${suffix}`] || ad.title}
                    subtitle={(ad as any)[`subtitle${suffix}`] || ad.subtitle}
                    ctaText={(ad as any)[`ctaText${suffix}`] || ad.ctaText}
                    url={ad.url}
                    imageUrl={ad.imageUrl || ''}
                    mobileImageUrl={ad.mobileImageUrl || undefined}
                    hideUiElements={ad.hideUiElements}
                    overlayOpacity={ad.overlayOpacity}
                  />
                ))}
              </div>
            )}

            <div className={`mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${Number(settings?.searchGridColumns) === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'} gap-4`}>
              {rentalVehicles.map((v: any) => (
                <RentalListingCard key={`r-${v.id}`} v={v} />
              ))}
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))
              ) : (
                listings.map((listing, index) => {
                  const elements = [];

                  // Add the listing card
                  elements.push(
                    <ListingCard key={listing.listing_id} listing={listing} index={index} />
                  );

                  // Inject an ad after every 6th item (at index 5, 11, etc.)
                  if ((index + 1) % 6 === 0) {
                    const gridAds = partnersAds.filter(a => a.placement === 'SEARCH_GRID' && a.isActive);
                    const adIndex = Math.floor((index + 1) / 6) - 1;
                    const ad = gridAds[adIndex % gridAds.length];

                    if (ad) {
                      elements.push(
                        <PartnerAdCard
                          key={`ad-${index}`}
                          index={index + 1}
                          title={(ad as any)[`title${suffix}`] || ad.title}
                          description={(ad as any)[`description${suffix}`] || ad.description || ''}
                          ctaText={(ad as any)[`ctaText${suffix}`] || ad.ctaText}
                          url={ad.url}
                          brandName={ad.brandName}
                          imageUrl={ad.imageUrl || ''}
                          overlayOpacity={ad.overlayOpacity}
                          hideUiElements={ad.hideUiElements}
                        />
                      );
                    }
                  }

                  return elements;
                })
              )}
              {!isLoading && !rentalLoading && listings.length === 0 && rentalVehicles.length === 0 && (
                <div className="col-span-full py-16 text-center">
                  <p className="text-lg font-medium text-foreground">{t('empty.noResults')}</p>
                  <p className="text-muted-foreground mt-1">{t('empty.noResultsHint')}</p>
                </div>
              )}
            </div>

            {!isLoading && (
              <div className="mt-8 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {t('common.found')}: <span className="font-semibold text-foreground">{totalCount}</span> {t('common.offers')}
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
                  totalPages={totalPages}
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
