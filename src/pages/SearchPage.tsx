import React from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/Header';
import { FilterPanel, FilterState } from '@/components/FilterPanel';
import { ActiveFilters } from '@/components/ActiveFilters';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { useListings } from '@/hooks/useListings';
import { useListingOptions } from '@/hooks/useListingOptions';

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

import { useSearchParams } from 'react-router-dom';

// ... (keep constant emptyFilters)

// Helper to parse arrays from URL
const parseArray = (param: string | null) => param ? param.split(',') : [];

export default function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Sync URL when state changes
  React.useEffect(() => {
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

    setSearchParams(params, { replace: true });
  }, [filters, sortBy, setSearchParams]);


  const { data, isLoading } = useListings(filters, sortBy);
  const { data: options } = useListingOptions();
  const listings = data?.listings || [];

  const handleClearFilters = () => {
    setFilters(emptyFilters);
  };

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== ''
  );

  return (
    <div className="min-h-screen bg-background">
      <Header onClearFilters={handleClearFilters} hasActiveFilters={hasActiveFilters} />

      <main className="container pt-0 pb-6">
        <div className="flex gap-6">
          {/* Desktop Filters */}
          <aside className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-16 h-[calc(100vh-4rem)] pt-4">
              <FilterPanel
                filters={filters}
                onFilterChange={setFilters}
                onClear={handleClearFilters}
                resultCount={listings.length}
                availableMakes={options?.makes || []}
                availableModels={options?.models || []}
              />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <ActiveFilters
              filters={filters}
              onFilterChange={setFilters}
              onClearFilters={handleClearFilters}
              resultCount={listings.length}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))
              ) : listings.length > 0 ? (
                listings.map((listing, index) => (
                  <ListingCard key={listing.listing_id} listing={listing} index={index} />
                ))
              ) : (
                <div className="col-span-full py-16 text-center">
                  <p className="text-lg font-medium text-foreground">{t('empty.noResults')}</p>
                  <p className="text-muted-foreground mt-1">{t('empty.noResultsHint')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
