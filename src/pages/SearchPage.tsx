import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useParams, useNavigate, Link } from 'react-router-dom';
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
import { useSeoContent } from '@/hooks/useSeoContent';
import { rentalPublicApi } from '@/services/rental-api';
import { mergeFacets, mergeMakes, mergeModels, popularBrandsFromFacets } from '@/utils/listingMerge';
import { ListingPagination } from '@/components/ListingPagination';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { Footer } from '@/components/Footer';
import { MetaHead } from '@/components/seo/MetaHead';
import { useSeoConfig } from '@/components/seo/SeoManager';
import { useAppSettings } from '@/hooks/useAppSettings';
import { PartnerBannerAd } from '@/components/ads/PartnerBannerAd';
import { PartnerAdCard } from '@/components/ads/PartnerAdCard';
import { usePartnerAds } from '@/hooks/usePartnerAds';
import { useBrand } from '@/contexts/BrandContext';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';
import { canonicalTransmission, canonicalFuel } from '@/utils/i18n-utils';
import { FinancingContentSection, FinancingContentType } from '@/components/FinancingContentSection';
import { slugifyBrandName } from '@/utils/brand-slug';
import { WaitlistForm } from '@/components/WaitlistForm';
import NotFound from '@/pages/NotFound';

// Fallback do wyświetlenia marki/modelu, gdy slug nie rozwiązuje się przez katalog aktywnych
// ofert (0 aktywnych ofert) — "słowo-na-słowo" kapitalizacja slugu, np. "aston-martin" →
// "Aston Martin". Nie odtwarza prawdziwej pisowni marki (np. "BMW"), ale to jedyne bezpieczne
// źródło nazwy, gdy nie ma jej ani w katalogu ofert, ani w ustrukturyzowanej treści CMS.
function capitalizeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

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
  cities: [],
};

// Helper to parse arrays from URL
const parseArray = (param: string | null) => param ? param.split(',') : [];

const parseNumberParam = (value: string | null, fallback: number) => {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export default function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const params = useParams<{ marka?: string; model?: string }>();
  const { data: seoConfig } = useSeoConfig();
  const { config } = useBrand();
  const { priceType, setPriceType } = usePriceSettings();
  const { data: options } = useListingOptions();

  // Strony marek/modeli (/samochody/:marka[/:model]) rozwiązują slug z URL-a na realną
  // markę/model z API (dopiero gdy options się załaduje) — to samo źródło danych co filtry.
  const resolvedBrand = React.useMemo(() => {
    if (!params.marka || !options) return undefined;
    const target = params.marka.toLowerCase();
    return options.makes.find((m) => slugifyBrandName(m) === target);
  }, [params.marka, options]);
  const resolvedModel = React.useMemo(() => {
    if (!params.model || !resolvedBrand || !options) return undefined;
    const target = params.model.toLowerCase();
    return options.models.find((m) => m.make === resolvedBrand && slugifyBrandName(m.model) === target)?.model;
  }, [params.model, resolvedBrand, options]);
  const isOnBrandRoute = Boolean(params.marka);

  // Treść CMS (F2) dla stron marki/modelu — klucz budowany z surowych slugów URL-a (nie z
  // resolvedBrand/resolvedModel), żeby zapytanie nie czekało na załadowanie /api/listings/options.
  const seoContentPath = params.marka
    ? `/samochody/${params.marka}${params.model ? `/${params.model}` : ''}`
    : undefined;
  const { data: seoContent, isFetched: seoContentFetched } = useSeoContent(seoContentPath);

  // Slug marki/modelu, który nie rozwiązuje się przez katalog aktywnych ofert (0 aktywnych ofert
  // — options nie zna marek/modeli bez choćby jednej aktywnej oferty). Zamiast od razu 404,
  // czekamy aż osiądzie zapytanie o treść CMS (ten sam mechanizm trwałości co SSR, F2 §1 pkt 4e):
  // jest CMS → strona zostaje (200, pusty listing + waitlist, F3); brak CMS → NotFound (F1).
  const catalogUnresolved =
    Boolean(params.marka) && Boolean(options) &&
    (!resolvedBrand || (Boolean(params.model) && !resolvedModel));
  const stillResolvingCms = catalogUnresolved && !seoContentFetched;
  const cmsFallbackActive = catalogUnresolved && seoContentFetched && Boolean(seoContent);
  const notFoundFinal = catalogUnresolved && seoContentFetched && !seoContent;

  // Nazwa marki/modelu do wyświetlenia: z katalogu ofert, a w trybie CMS-fallback — slug
  // z kapitalizacją (CMS nie ma ustrukturyzowanego pola nazwy marki/modelu, patrz komentarz
  // przy capitalizeSlug).
  const displayBrand = resolvedBrand || (cmsFallbackActive && params.marka ? capitalizeSlug(params.marka) : undefined);
  const displayModel = resolvedModel || (cmsFallbackActive && params.model ? capitalizeSlug(params.model) : undefined);

  // Sync URL ?clientType=private|business → global priceType (one-shot on mount)
  React.useEffect(() => {
    const ct = searchParams.get('clientType');
    if (ct === 'business') setPriceType('net');
    else if (ct === 'private') setPriceType('gross');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sekcja treści filarowej pod listingiem — tylko na kategoriach finansowania
  const financingContentType: FinancingContentType | null =
    window.location.pathname === '/leasing' ? 'leasing'
      : window.location.pathname === '/kredyt' ? 'kredyt'
        : null;

  // Initialize from URL
  const [filters, setFilters] = React.useState<FilterState>(() => {
    const isLeasingPath = window.location.pathname.startsWith('/leasing');
    const isKredytPath = window.location.pathname.startsWith('/kredyt');

    const rt = searchParams.get('rateType');
    const rb = searchParams.get('rateBasis');
    const searchText = searchParams.get('SearchText') || searchParams.get('q') || '';

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
      rateType: rt ? (rt === 'lease' ? 'lease' : 'credit') : (isLeasingPath ? 'lease' : 'credit'),
      rateBasis: rb ? (rb === 'net' ? 'net' : 'gross') : (isLeasingPath ? 'net' : 'gross'),

      query: searchText,
      cities: parseArray(searchParams.get('city')),
    };
  });

  // Strona marki/modelu (URL bez ?make=): dopiero gdy displayBrand/displayModel jest znany
  // (po załadowaniu options — z katalogu ofert, albo w trybie CMS-fallback ze slugu), wstrzykujemy
  // go do filtrów — SSR/boty widzą poprawną treść od razu z serwera, użytkownik po hydratacji
  // dostaje krótki błysk nieprzefiltrowanej listy. W trybie CMS-fallback filtrujemy po nazwie
  // wyprowadzonej ze slugu, żeby listing faktycznie pokazał 0 wyników (a nie cały katalog).
  React.useEffect(() => {
    if (!displayBrand) return;
    setFilters((prev) => {
      const alreadyApplied =
        prev.makes.length === 1 && prev.makes[0] === displayBrand &&
        (!displayModel || (prev.models.length === 1 && prev.models[0] === displayModel));
      if (alreadyApplied) return prev;
      return { ...prev, makes: [displayBrand], models: displayModel ? [displayModel] : prev.models };
    });
  }, [displayBrand, displayModel]);

  const { data: settings } = useAppSettings();
  const defaultSortCars = settings?.defaultSortCars || 'price_asc';
  const [sortBy, setSortBy] = React.useState(searchParams.get('sortBy') || defaultSortCars);
  
  // Re-sync default if settings loads after initial mount and no explicit sort is set
  React.useEffect(() => {
     if (settings?.defaultSortCars && !searchParams.get('sortBy') && sortBy !== settings.defaultSortCars) {
       setSortBy(settings.defaultSortCars);
     }
  }, [settings?.defaultSortCars, searchParams]);

  const initialPage = parseNumberParam(searchParams.get('page'), 1);
  const [page, setPage] = React.useState(initialPage);
  const perPage = Number(settings?.searchGridColumns) === 3 ? 30 : 32;

  // "Wszystkie filtry" sheet (full FilterPanel) trigger
  const [allFiltersOpen, setAllFiltersOpen] = React.useState(() => {
    return searchParams.get('openFilters') === 'true';
  });
  // When the sheet opens because we just landed here from a Stan-switch redirect,
  // skip the entry animation to mask the brief unmount/mount flicker.
  const [skipSheetAnimation, setSkipSheetAnimation] = React.useState(
    () => searchParams.get('openFilters') === 'true',
  );

  // Clean up openFilters param after reading it; re-enable animations on next tick.
  React.useEffect(() => {
    if (searchParams.get('openFilters')) {
      const next = new URLSearchParams(searchParams);
      next.delete('openFilters');
      setSearchParams(next, { replace: true });
    }
    if (skipSheetAnimation) {
      const timer = setTimeout(() => setSkipSheetAnimation(false), 100);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      // Na stronie marki/modelu marka/model są już zakodowane w ścieżce (/samochody/:marka[/:model]) —
      // nie dublujemy ich w query. Każda zmiana marki/modelu i tak przechodzi przez
      // handleFilterChange, który w takim wypadku przekierowuje na klasyczny URL z ?make=.
      if (!isOnBrandRoute) {
        if (filters.makes.length) params.set('make', filters.makes.join(','));
        if (filters.models.length) params.set('model', filters.models.join(','));
      }
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
      if (filters.cities.length) params.set('city', filters.cities.join(','));
      if (sortBy !== defaultSortCars) params.set('sortBy', sortBy);
      if (page > 1) params.set('page', page.toString());

      setSearchParams(params, { replace: true });
    }, 100);

    return () => {
      if (urlSyncTimeoutRef.current) {
        clearTimeout(urlSyncTimeoutRef.current);
      }
    };
  }, [filters, sortBy, page, setSearchParams, isOnBrandRoute]);

  React.useEffect(() => {
    const nextPage = parseNumberParam(searchParams.get('page'), 1);

    if (nextPage !== page) {
      setPage(nextPage);
    }
  }, [searchParams]);

  const { data, isLoading } = useListings(filters, sortBy, page, perPage);
  const { data: adsData } = usePartnerAds();
  const partnersAds = adsData?.ads || [];
  const listings = data?.listings || [];
  const saleTotalCount = data?.count ?? listings.length;

  const rentalCondition = filters.statuses.length === 1
    ? (filters.statuses[0] as 'NEW' | 'USED')
    : undefined;
  // Hide rentals when a sale-price range is set: rental "price" is the monthly rate,
  // not a comparable scale to sale price. Rate filter (rateFrom/rateTo) is mapped
  // through priceMin/priceMax + priceBasis below so it still applies to rentals.
  const hideRentals = Boolean(filters.priceFrom || filters.priceTo);
  const rentalOfferType = priceType === 'net' ? 'b2b' : 'b2c';
  const rentalRateMin = filters.rateFrom || undefined;
  const rentalRateMax = filters.rateTo || undefined;
  const rentalRateBasis = (filters.rateFrom || filters.rateTo) ? filters.rateBasis : undefined;
  // Map the sale sortBy onto rental-backend sort fields so rentals reorder with the user's choice.
  // For price-based sorts, use the matching rate basis (gross for Prywatnie, net for Firma).
  const rentalRateField = priceType === 'net' ? 'minMonthlyRateNet' : 'minMonthlyRateGross';
  const rentalSort: { sortBy: string; sortOrder: 'asc' | 'desc' } = (() => {
    switch (sortBy) {
      case 'year_desc': return { sortBy: 'productionYear', sortOrder: 'desc' };
      case 'year_asc': return { sortBy: 'productionYear', sortOrder: 'asc' };
      case 'price_asc': return { sortBy: rentalRateField, sortOrder: 'asc' };
      case 'price_desc': return { sortBy: rentalRateField, sortOrder: 'desc' };
      default: return { sortBy: 'createdAt', sortOrder: 'desc' };
    }
  })();
  const { data: rentalData, isLoading: rentalLoading } = useQuery({
    queryKey: ['rental-search', rentalCondition, filters.makes, filters.models, filters.fuelTypes, filters.bodyTypes, filters.yearFrom, filters.yearTo, filters.query, rentalOfferType, rentalRateMin, rentalRateMax, rentalRateBasis, rentalSort.sortBy, rentalSort.sortOrder],
    queryFn: () => rentalPublicApi.listVehicles({
      page: '1',
      limit: '50',
      search: filters.query || undefined,
      make: filters.makes.length ? filters.makes.join(',') : undefined,
      model: filters.models.length ? filters.models.join(',') : undefined,
      fuelType: filters.fuelTypes.length ? filters.fuelTypes.join(',') : undefined,
      bodyType: filters.bodyTypes.length ? filters.bodyTypes.join(',') : undefined,
      yearFrom: filters.yearFrom || undefined,
      yearTo: filters.yearTo || undefined,
      condition: rentalCondition,
      offerType: rentalOfferType,
      priceFrom: rentalRateMin,
      priceTo: rentalRateMax,
      priceBasis: rentalRateBasis,
      sortBy: rentalSort.sortBy,
      sortOrder: rentalSort.sortOrder,
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
  // "Popularne marki" — linkowanie wewnętrzne do stron marek, tylko na czystym /samochody
  // (ten sam próg top ~20 wg liczby ofert co blok SSR w buildStaticMeta).
  const popularBrands = React.useMemo(
    () => popularBrandsFromFacets(mergedFacets, 20),
    [mergedFacets],
  );

  const totalCount = saleTotalCount + rentalVehicles.length;
  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil((saleTotalCount || 1) / perPage));

  const handleFilterChange = React.useCallback((updatedFilters: FilterState) => {
    // Na stronie marki/modelu: jeśli użytkownik zmienia filtr tak, że przestaje on
    // odpowiadać marce/modelowi z ładnego URL-a, zostawiamy tę stronę i przechodzimy na
    // klasyczny /samochody?... z pełnym zestawem filtrów w query (nie zostajemy na ładnym
    // URL-u z nieaktualnym filtrem).
    if (isOnBrandRoute) {
      const stillMatchesRoute =
        updatedFilters.makes.length === 1 && updatedFilters.makes[0] === displayBrand &&
        (params.model
          ? updatedFilters.models.length === 1 && updatedFilters.models[0] === displayModel
          : updatedFilters.models.length === 0);
      if (!stillMatchesRoute) {
        const qp = new URLSearchParams();
        if (updatedFilters.makes.length) qp.set('make', updatedFilters.makes.join(','));
        if (updatedFilters.models.length) qp.set('model', updatedFilters.models.join(','));
        if (updatedFilters.fuelTypes.length) qp.set('fuelType', updatedFilters.fuelTypes.join(','));
        if (updatedFilters.transmissions.length) qp.set('transmission', updatedFilters.transmissions.join(','));
        if (updatedFilters.bodyTypes.length) qp.set('bodyType', updatedFilters.bodyTypes.join(','));
        if (updatedFilters.drives.length) qp.set('drive', updatedFilters.drives.join(','));
        if (updatedFilters.statuses.length) qp.set('status', updatedFilters.statuses.map((c) => c.toLowerCase()).join(','));
        if (updatedFilters.yearFrom) qp.set('yearMin', updatedFilters.yearFrom);
        if (updatedFilters.yearTo) qp.set('yearMax', updatedFilters.yearTo);
        if (updatedFilters.mileageFrom) qp.set('mileageMin', updatedFilters.mileageFrom);
        if (updatedFilters.mileageTo) qp.set('mileageMax', updatedFilters.mileageTo);
        if (updatedFilters.priceFrom) qp.set('priceMin', updatedFilters.priceFrom);
        if (updatedFilters.priceTo) qp.set('priceMax', updatedFilters.priceTo);
        if (updatedFilters.powerFrom) qp.set('powerMin', updatedFilters.powerFrom);
        if (updatedFilters.powerTo) qp.set('powerMax', updatedFilters.powerTo);
        if (updatedFilters.capacityFrom) qp.set('capacityMin', updatedFilters.capacityFrom);
        if (updatedFilters.capacityTo) qp.set('capacityMax', updatedFilters.capacityTo);
        if (updatedFilters.rateFrom) qp.set('rateMin', updatedFilters.rateFrom);
        if (updatedFilters.rateTo) qp.set('rateMax', updatedFilters.rateTo);
        if ((updatedFilters.rateFrom || updatedFilters.rateTo) && updatedFilters.rateType !== 'credit') qp.set('rateType', updatedFilters.rateType);
        if ((updatedFilters.rateFrom || updatedFilters.rateTo) && updatedFilters.rateBasis !== 'gross') qp.set('rateBasis', updatedFilters.rateBasis);
        if (updatedFilters.query) qp.set('q', updatedFilters.query);
        if (updatedFilters.cities.length) qp.set('city', updatedFilters.cities.join(','));
        const qs = qp.toString();
        navigate(`/samochody${qs ? `?${qs}` : ''}`);
        return;
      }
    }

    setFilters(updatedFilters);
    setPage(1);
  }, [isOnBrandRoute, displayBrand, displayModel, params.model, navigate]);

  const handleClearFilters = React.useCallback(() => {
    handleFilterChange(emptyFilters);
  }, [handleFilterChange]);

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

  // Crawlowalne URL-e paginacji (Googlebot nie podąża za href="#")
  const buildPageHref = React.useCallback((targetPage: number) => {
    const params = new URLSearchParams(searchParams);
    if (targetPage > 1) params.set('page', targetPage.toString());
    else params.delete('page');
    const qs = params.toString();
    return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  }, [searchParams]);

  const { i18n } = useTranslation();
  const lang = i18n.language;
  const suffix = lang === 'pl' ? '' : lang === 'en' ? 'En' : 'De';

  const pageTitleBase = 'Samochody nowe i używane z finansowaniem';
  const pageDescription = 'Tysiące sprawdzonych ofert nowych i używanych samochodów w jednym miejscu. Dobieramy kredyt, leasing lub wynajem długoterminowy — i prowadzimy Cię przez cały proces zakupu.';

  // Odmiana liczebnika przy "oferta" (1 oferta / 2-4 oferty / 5+ ofert) — ten sam wzorzec co w
  // backendowym seo-meta.ts (buildBrandMeta/buildModelMeta), żeby title/description się zgadzały.
  const pluralOfert = (n: number): string => {
    if (n === 1) return 'oferta';
    const lastDigit = n % 10;
    const lastTwo = n % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 'oferty';
    return 'ofert';
  };

  // Strona marki/modelu (/samochody/:marka[/:model]) — H1/title/description wg wzorca z
  // backendowego buildBrandMeta/buildModelMeta, tylko gdy slug jest już rozwiązany (katalog
  // ofert lub CMS-fallback).
  const brandPageH1 = displayModel
    ? `${displayBrand} ${displayModel} — dostępne od ręki`
    : displayBrand
    ? `Samochody ${displayBrand} dostępne od ręki — nowe i używane`
    : null;
  const brandPageSeoTitle = displayModel
    ? `${displayBrand} ${displayModel} (${totalCount} ${pluralOfert(totalCount)}) — dostępne od ręki`
    : displayBrand
    ? `${displayBrand} (${totalCount} ${pluralOfert(totalCount)}) — nowe i używane`
    : null;
  const brandPageDescription = displayBrand
    ? `${displayModel ? `${displayBrand} ${displayModel}` : `Samochody ${displayBrand}`} dostępne od ręki — ${totalCount} ${pluralOfert(totalCount)}. Sprawdź aktualne ceny i dopasuj finansowanie: leasing, kredyt lub wynajem długoterminowy.`
    : null;

  // Canonicale filtrów (spec): pojedyncza marka → /samochody/<marka>, marka+model →
  // /samochody/<marka>/<model>. Tylko na rodzinie tras /samochody — /search, /leasing, /kredyt
  // (renderowane tym samym komponentem) zachowują swój dotychczasowy canonical.
  const isSamochodyFamily = window.location.pathname === '/samochody' || window.location.pathname.startsWith('/samochody/');
  const canonicalPath = React.useMemo(() => {
    if (!isSamochodyFamily) return '/samochody';
    // CMS-fallback (0 aktywnych ofert, patrz catalogUnresolved): canonical wprost z surowych
    // slugów URL-a — slugifyBrandName(displayBrand) mógłby się rozjechać z oryginalnym slugiem
    // przy nietypowych znakach, a tu mamy pewne źródło.
    if (cmsFallbackActive && params.marka) {
      return params.model ? `/samochody/${params.marka}/${params.model}` : `/samochody/${params.marka}`;
    }
    if (filters.makes.length === 1 && filters.models.length === 1) {
      return `/samochody/${slugifyBrandName(filters.makes[0])}/${slugifyBrandName(filters.models[0])}`;
    }
    if (filters.makes.length === 1) {
      return `/samochody/${slugifyBrandName(filters.makes[0])}`;
    }
    return '/samochody';
  }, [isSamochodyFamily, filters.makes, filters.models, cmsFallbackActive, params.marka, params.model]);

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

  // Nieznany slug marki/modelu bez treści CMS — spójne z SSR resolverem (404). Sprawdzane po
  // wszystkich hookach (Rules of Hooks), zanim wyrenderujemy właściwą stronę. Gdy katalog ofert
  // nie rozpoznaje slugu, ale zapytanie o treść CMS jeszcze trwa, czekamy (stillResolvingCms)
  // zamiast pokazywać przedwczesny NotFound.
  if (notFoundFinal) {
    return <NotFound />;
  }
  if (stillResolvingCms) {
    return (
      <div className="min-h-screen bg-background">
        <Header onClearFilters={handleClearFilters} hasActiveFilters={hasActiveFilters} />
        <div className="container py-24 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <Footer />
      </div>
    );
  }

  const breadcrumbItems: Array<{ "@type": string; position: number; name: string; item: string }> = [
    { "@type": "ListItem", position: 1, name: "Strona główna", item: window.location.origin },
    { "@type": "ListItem", position: 2, name: "Samochody", item: `${window.location.origin}/samochody` },
  ];
  if (displayBrand) {
    breadcrumbItems.push({
      "@type": "ListItem", position: 3, name: displayBrand,
      item: `${window.location.origin}/samochody/${params.marka}`,
    });
  }
  if (displayBrand && displayModel) {
    breadcrumbItems.push({
      "@type": "ListItem", position: 4, name: `${displayBrand} ${displayModel}`,
      item: `${window.location.origin}/samochody/${params.marka}/${params.model}`,
    });
  }

  // Treść CMS nadpisuje meta title/description całkowicie (spójne z backendowym buildBrandMeta/
  // buildModelMeta — cms.metaTitle zastępuje wygenerowany tytuł razem z sufiksem siteName).
  const metaTitle = seoContent?.metaTitle || `${brandPageSeoTitle || pageTitleBase} | ${siteName}`;
  const metaDescription = seoContent?.metaDescription || brandPageDescription || pageDescription;

  return (
    <div className="min-h-screen bg-background">
      <MetaHead
        title={metaTitle}
        description={metaDescription}
        image={seoConfig?.homeOgImage}
        canonical={canonicalPath}
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
              "name": metaTitle,
              "description": metaDescription,
              "url": `${window.location.origin}${canonicalPath}`,
              "isPartOf": { "@type": "WebSite", "name": siteName, "url": window.location.origin },
            },
            {
              "@type": "BreadcrumbList",
              "itemListElement": breadcrumbItems,
            },
          ],
        }}
      />

      <Header onClearFilters={handleClearFilters} hasActiveFilters={hasActiveFilters} />

      <Sheet open={allFiltersOpen} onOpenChange={setAllFiltersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0" instant={skipSheetAnimation}>
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
              onApply={() => setAllFiltersOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <main className="container pt-4 pb-6">
        <div className="min-w-0">
          {/* Page heading */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-foreground">{brandPageH1 || 'Samochody nowe i używane z elastycznym finansowaniem'}</h1>
            <p className="text-sm text-muted-foreground mt-1">{brandPageDescription || 'Tysiące sprawdzonych aut w jednym miejscu. Dobieramy kredyt, leasing lub wynajem długoterminowy i prowadzimy Cię przez cały proces — od wyboru pojazdu po odbiór kluczyków.'}</p>
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

            {(() => {
              // Kolejność kart najmu vs sprzedaży sterowana ustawieniem backoffice (domyślnie najem pierwszy)
              const rentalCardsFirst = settings?.rentalCardsFirst !== false;
              const rentalCards = rentalVehicles.map((v: any, i: number) => (
                <RentalListingCard key={`r-${v.id}`} v={v} priority={rentalCardsFirst && i < 3} />
              ));
              const saleCards = isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))
              ) : (
                listings.flatMap((listing, index) => {
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
                          key={`ad-${listing.listing_id}-${index}`}
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
              );

              return (
                <div className={`mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${Number(settings?.searchGridColumns) === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'} gap-4`}>
                  {rentalCardsFirst && rentalCards}
                  {saleCards}
                  {!rentalCardsFirst && rentalCards}
                  {!isLoading && !rentalLoading && listings.length === 0 && rentalVehicles.length === 0 && (
                    <div className="col-span-full py-16 text-center">
                      {displayBrand ? (
                        <>
                          <p className="text-lg font-medium text-foreground">
                            {t('waitlist.emptyTitle', 'Aktualnie brak ofert')} {displayModel ? `${displayBrand} ${displayModel}` : displayBrand} — {t('waitlist.emptyHint', 'zostaw kontakt, powiadomimy o nowej ofercie.')}
                          </p>
                          <div className="mt-6">
                            <WaitlistForm make={displayBrand} model={displayModel} />
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-medium text-foreground">{t('empty.noResults')}</p>
                          <p className="text-muted-foreground mt-1">{t('empty.noResultsHint')}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {!isLoading && (
              <div className="mt-8">
                <ListingPagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  buildPageHref={buildPageHref}
                />
              </div>
            )}

            {window.location.pathname === '/samochody' && popularBrands.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-foreground mb-3">Popularne marki</h2>
                <div className="flex flex-wrap gap-2">
                  {popularBrands.map(([make, count]) => (
                    <Link
                      key={make}
                      to={`/samochody/${slugifyBrandName(make)}`}
                      className="px-3 py-1.5 rounded-full border border-border text-sm text-foreground hover:bg-secondary transition-colors"
                    >
                      {make} <span className="text-muted-foreground">({count})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Treść CMS (F2) pod listingiem stron marki/modelu — HTML już zsanityzowany na backendzie */}
        {seoContent?.html && (
          <div className="container mt-12 mb-8 max-w-3xl">
            <div
              className="text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground [&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_td]:border [&_td]:border-border [&_td]:p-2"
              dangerouslySetInnerHTML={{ __html: seoContent.html }}
            />
          </div>
        )}

        {financingContentType && <FinancingContentSection type={financingContentType} />}
      </main>

      <ScrollToTopButton />
      <Footer />
    </div>
  );
}
