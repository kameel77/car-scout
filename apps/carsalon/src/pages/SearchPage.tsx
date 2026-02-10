import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { FilterPanel, FilterState } from '@/components/FilterPanel';
import { ActiveFilters } from '@/components/ActiveFilters';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { useListings } from '@/hooks/useListings';
import { useListingOptions } from '@/hooks/useListingOptions';
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
  priceFrom: '',
  priceTo: '',
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

  // Initialize from URL
  const [filters, setFilters] = React.useState<FilterState>(() => {
    return {
      makes: parseArray(searchParams.get('make')),
      models: parseArray(searchParams.get('model')),
      fuelTypes: parseArray(searchParams.get('fuelType')),
      transmissions: parseArray(searchParams.get('transmission')),
      bodyTypes: parseArray(searchParams.get('bodyType')),
      drives: parseArray(searchParams.get('drive')),

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

      query: searchParams.get('q') || '',
    };
  });

  const [sortBy, setSortBy] = React.useState(searchParams.get('sortBy') || 'newest');
  const initialPage = parseNumberParam(searchParams.get('page'), 1);
  const initialPerPage = parseNumberParam(searchParams.get('perPage'), DEFAULT_PER_PAGE);
  const [page, setPage] = React.useState(initialPage);
  const [perPage, setPerPage] = React.useState(
    PAGE_SIZE_OPTIONS.includes(initialPerPage) ? initialPerPage : DEFAULT_PER_PAGE
  );

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

      if (filters.query) params.set('q', filters.query);
      if (sortBy !== 'newest') params.set('sortBy', sortBy);
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
  const totalCount = data?.count ?? listings.length;
  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil((totalCount || 1) / perPage));

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

  const homeTitle = (seoConfig ? (seoConfig as any)[`homeTitle${suffix}`] : undefined) || seoConfig?.homeTitle;
  const homeDescription = (seoConfig ? (seoConfig as any)[`homeDescription${suffix}`] : undefined) || seoConfig?.homeDescription;

  const { data: settings } = useAppSettings();
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
    return pick?.trim() || 'Car Scout';
  }, [i18n.language, settings?.siteNameEn, settings?.siteNameDe, settings?.siteNamePl, settings]);

  return (
    <div className="min-h-screen bg-background">
      <MetaHead
        title={homeTitle}
        description={homeDescription}
        image={seoConfig?.homeOgImage}
        schema={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": siteName,
          "url": window.location.origin,
          "logo": seoConfig?.homeOgImage
        }}
      />

      <Header onClearFilters={handleClearFilters} hasActiveFilters={hasActiveFilters} />

      <main className="container pt-0 pb-6">
        <div className="flex gap-6">
          {/* Desktop Filters */}
          <aside className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-16 h-[calc(100vh-4rem)] pt-4">
              <FilterPanel
                filters={filters}
                onFilterChange={handleFilterChange}
                onClear={handleClearFilters}
                resultCount={totalCount}
                availableMakes={options?.makes || []}
                availableModels={options?.models || []}
              />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
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
              availableMakes={options?.makes || []}
              availableModels={options?.models || []}
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

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))
              ) : listings.length > 0 ? (
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
                        />
                      );
                    }
                  }

                  return elements;
                })
              ) : (
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
