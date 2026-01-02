import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, SlidersHorizontal, ArrowUpDown, Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { FilterPanel, FilterState } from '@/components/FilterPanel';
import { cn } from '@/lib/utils';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';

interface ActiveFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  resultCount: number;
  sortBy: string;
  onSortChange: (value: string) => void;
}

const sortOptions = [
  { value: 'cheapest', label: 'sort.cheapest' },
  { value: 'expensive', label: 'sort.mostExpensive' },
  { value: 'mileage', label: 'sort.lowestMileage' },
  { value: 'newest', label: 'sort.newest' },
];

export function ActiveFilters({
  filters,
  onFilterChange,
  onClearFilters,
  resultCount,
  sortBy,
  onSortChange,
}: ActiveFiltersProps) {
  const { t } = useTranslation();
  const { priceType, setPriceType } = usePriceSettings();
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState(filters.query || '');

  // Debounce search update
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchValue !== filters.query) {
        onFilterChange({ ...filters, query: searchValue });
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchValue, filters.query, onFilterChange, filters]);

  // Sync local state when filters are cleared externally
  React.useEffect(() => {
    if (filters.query !== searchValue) {
      setSearchValue(filters.query || '');
    }
  }, [filters.query, searchValue]);

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];

  // Build active chips
  filters.makes.forEach((make) => {
    activeChips.push({
      key: `make-${make}`,
      label: make,
      onRemove: () =>
        onFilterChange({ ...filters, makes: filters.makes.filter((m) => m !== make) }),
    });
  });

  filters.models.forEach((model) => {
    activeChips.push({
      key: `model-${model}`,
      label: model,
      onRemove: () =>
        onFilterChange({ ...filters, models: filters.models.filter((m) => m !== model) }),
    });
  });

  filters.fuelTypes.forEach((fuel) => {
    activeChips.push({
      key: `fuel-${fuel}`,
      label: t(`fuel.${fuel === 'benzyna' ? 'petrol' : fuel === 'diesel' ? 'diesel' : fuel === 'hybryda' ? 'hybrid' : fuel === 'elektryczny' ? 'electric' : 'lpg'}`),
      onRemove: () =>
        onFilterChange({ ...filters, fuelTypes: filters.fuelTypes.filter((f) => f !== fuel) }),
    });
  });

  filters.transmissions.forEach((trans) => {
    activeChips.push({
      key: `trans-${trans}`,
      label: t(`transmission.${trans === 'manualna' ? 'manual' : 'automatic'}`),
      onRemove: () =>
        onFilterChange({
          ...filters,
          transmissions: filters.transmissions.filter((t) => t !== trans),
        }),
    });
  });

  filters.drives.forEach((drive) => {
    activeChips.push({
      key: `drive-${drive}`,
      label: drive,
      onRemove: () =>
        onFilterChange({ ...filters, drives: filters.drives.filter((d) => d !== drive) }),
    });
  });

  filters.bodyTypes.forEach((body) => {
    activeChips.push({
      key: `body-${body}`,
      label: body,
      onRemove: () =>
        onFilterChange({ ...filters, bodyTypes: filters.bodyTypes.filter((b) => b !== body) }),
    });
  });

  if (filters.yearFrom || filters.yearTo) {
    activeChips.push({
      key: 'year',
      label: `${t('filters.productionYear')}: ${filters.yearFrom || '...'} - ${filters.yearTo || '...'}`,
      onRemove: () => onFilterChange({ ...filters, yearFrom: '', yearTo: '' }),
    });
  }

  if (filters.mileageFrom || filters.mileageTo) {
    activeChips.push({
      key: 'mileage',
      label: `${t('filters.mileage')}: ${filters.mileageFrom || '0'} - ${filters.mileageTo || '∞'} km`,
      onRemove: () => onFilterChange({ ...filters, mileageFrom: '', mileageTo: '' }),
    });
  }

  if (filters.powerFrom || filters.powerTo) {
    activeChips.push({
      key: 'power',
      label: `${t('filters.power')}: ${filters.powerFrom || '0'} - ${filters.powerTo || '∞'} KM`,
      onRemove: () => onFilterChange({ ...filters, powerFrom: '', powerTo: '' }),
    });
  }

  if (filters.priceFrom || filters.priceTo) {
    activeChips.push({
      key: 'price',
      label: `${t('filters.price')}: ${filters.priceFrom || '0'} - ${filters.priceTo || '∞'} PLN`,
      onRemove: () => onFilterChange({ ...filters, priceFrom: '', priceTo: '' }),
    });
  }

  const currentSort = sortOptions.find((s) => s.value === sortBy);

  return (
    <div className="flex flex-col">
      {/* Top Bar - Mobile */}
      <div className="flex lg:hidden flex-col gap-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('search.placeholder', 'Search...')}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 flex-1">
                <SlidersHorizontal className="h-4 w-4" />
                {t('filters.title')}
                {activeChips.length > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {activeChips.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
              <SheetHeader className="pb-4">
                <SheetTitle>{t('filters.title')}</SheetTitle>
              </SheetHeader>
              <div className="h-full overflow-auto pb-20">
                <FilterPanel
                  filters={filters}
                  onFilterChange={onFilterChange}
                  onClear={() => {
                    onClearFilters();
                    setMobileFiltersOpen(false);
                  }}
                  resultCount={resultCount}
                  className="shadow-none p-0"
                  availableMakes={[]}
                  availableModels={[]}
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t">
                <Button
                  variant="hero"
                  className="w-full"
                  onClick={() => setMobileFiltersOpen(false)}
                >
                  {t('common.found')}: {resultCount} {t('common.offers')}
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 flex-1">
                {priceType === 'gross' ? t('listing.gross') : t('listing.net')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPriceType('gross')} className={cn(priceType === 'gross' && 'bg-accent')}>
                {t('listing.gross')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriceType('net')} className={cn(priceType === 'net' && 'bg-accent')}>
                {t('listing.net')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 flex-1">
                <ArrowUpDown className="h-4 w-4" />
                <span className="truncate">{currentSort ? t(currentSort.label) : t('sort.title')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                  className={cn('gap-2', sortBy === option.value && 'bg-accent')}
                >
                  {sortBy === option.value && <Check className="h-4 w-4" />}
                  {t(option.label)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Results Count & Sort & Search - Desktop Sticky Widget */}
      <div className="hidden lg:flex flex-col gap-3 sticky top-16 z-20 bg-card p-4 transition-all mt-4">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {t('common.found')}:{' '}
            <span className="font-semibold text-foreground">{resultCount}</span> {t('common.offers')}
          </div>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder', 'Pozwól, że znajdę to za Ciebie...')}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9 w-full bg-background border-primary/20 focus-visible:ring-primary/30 active:scale-[1.01] transition-all"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 whitespace-nowrap">
                {priceType === 'gross' ? t('listing.gross') : t('listing.net')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPriceType('gross')} className={cn(priceType === 'gross' && 'bg-accent')}>
                {t('listing.gross')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriceType('net')} className={cn(priceType === 'net' && 'bg-accent')}>
                {t('listing.net')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 whitespace-nowrap">
                <ArrowUpDown className="h-4 w-4" />
                {currentSort ? t(currentSort.label) : t('sort.title')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                  className={cn('gap-2', sortBy === option.value && 'bg-accent')}
                >
                  {sortBy === option.value && <Check className="h-4 w-4" />}
                  {t(option.label)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Active Filter Chips - Now inside sticky widget for desktop */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.onRemove}
                className="chip chip-active chip-removable group text-xs py-1"
              >
                <span>{chip.label}</span>
                <X className="h-3 w-3 opacity-70 group-hover:opacity-100" />
              </button>
            ))}
            {activeChips.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="text-destructive hover:text-destructive h-7 text-xs px-2"
              >
                {t('common.clearFilters')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Active Filter Chips - Only for Mobile (stays below) */}
      {activeChips.length > 0 && (
        <div className="flex lg:hidden flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.onRemove}
              className="chip chip-active chip-removable group"
            >
              <span>{chip.label}</span>
              <X className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
            </button>
          ))}
          {activeChips.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-destructive hover:text-destructive"
            >
              {t('common.clearFilters')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
