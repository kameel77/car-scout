import React from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/Header';
import { FilterPanel, FilterState } from '@/components/FilterPanel';
import { ActiveFilters } from '@/components/ActiveFilters';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { filterListings, mockListings } from '@/data/mockData';

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
};

export default function SearchPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = React.useState<FilterState>(emptyFilters);
  const [sortBy, setSortBy] = React.useState('newest');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredListings = React.useMemo(() => {
    return filterListings({
      makes: filters.makes,
      models: filters.models,
      fuelTypes: filters.fuelTypes,
      yearFrom: filters.yearFrom ? parseInt(filters.yearFrom) : undefined,
      yearTo: filters.yearTo ? parseInt(filters.yearTo) : undefined,
      mileageFrom: filters.mileageFrom ? parseInt(filters.mileageFrom) : undefined,
      mileageTo: filters.mileageTo ? parseInt(filters.mileageTo) : undefined,
      drives: filters.drives,
      transmissions: filters.transmissions,
      powerFrom: filters.powerFrom ? parseInt(filters.powerFrom) : undefined,
      powerTo: filters.powerTo ? parseInt(filters.powerTo) : undefined,
      capacityFrom: filters.capacityFrom ? parseInt(filters.capacityFrom) : undefined,
      capacityTo: filters.capacityTo ? parseInt(filters.capacityTo) : undefined,
      bodyTypes: filters.bodyTypes,
      priceFrom: filters.priceFrom ? parseInt(filters.priceFrom) : undefined,
      priceTo: filters.priceTo ? parseInt(filters.priceTo) : undefined,
      sortBy,
    });
  }, [filters, sortBy]);

  const handleClearFilters = () => {
    setFilters(emptyFilters);
  };

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== ''
  );

  return (
    <div className="min-h-screen bg-background">
      <Header onClearFilters={handleClearFilters} hasActiveFilters={hasActiveFilters} />

      <main className="container py-6">
        <div className="flex gap-6">
          {/* Desktop Filters */}
          <aside className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-20">
              <FilterPanel
                filters={filters}
                onFilterChange={setFilters}
                onClear={handleClearFilters}
                resultCount={filteredListings.length}
              />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <ActiveFilters
              filters={filters}
              onFilterChange={setFilters}
              onClearFilters={handleClearFilters}
              resultCount={filteredListings.length}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))
              ) : filteredListings.length > 0 ? (
                filteredListings.map((listing, index) => (
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
