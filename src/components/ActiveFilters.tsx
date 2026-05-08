import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, SlidersHorizontal, Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { FilterPanel, FilterState } from '@/components/FilterPanel';
import { cn } from '@/lib/utils';

interface ActiveFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  resultCount: number;
  // sortBy / onSortChange are no longer used here — moved to StatusTabs
  sortBy?: string;
  onSortChange?: (value: string) => void;
  availableMakes: string[];
  availableModels: { make: string; model: string }[];
}

export function ActiveFilters({
  filters,
  onFilterChange,
  onClearFilters,
  resultCount,
  availableMakes,
  availableModels,
}: ActiveFiltersProps) {
  const { t } = useTranslation();
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState(filters.query || '');
  const [isUserTyping, setIsUserTyping] = React.useState(false);

  // Debounce search update
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setIsUserTyping(false);
      if (searchValue !== filters.query) {
        onFilterChange({ ...filters, query: searchValue });
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchValue, filters.query, onFilterChange, filters]);

  // Sync local state when filters are cleared externally (but not while user is typing)
  React.useEffect(() => {
    if (!isUserTyping && filters.query !== searchValue) {
      setSearchValue(filters.query || '');
    }
  }, [filters.query, searchValue, isUserTyping]);

  type Chip = { key: string; label: string; onRemove: () => void };
  type ChipGroup = { key: string; groupLabel: string; chips: Chip[] };
  const chipGroups: ChipGroup[] = [];
  const pushGroup = (key: string, groupLabel: string, chips: Chip[]) => {
    if (chips.length > 0) chipGroups.push({ key, groupLabel, chips });
  };

  pushGroup(
    'status',
    t('filters.status'),
    filters.statuses.map((s) => ({
      key: `status-${s}`,
      label: t(`status.${s.toLowerCase()}`),
      onRemove: () =>
        onFilterChange({ ...filters, statuses: filters.statuses.filter((x) => x !== s) }),
    }))
  );

  pushGroup(
    'make',
    t('filters.make'),
    filters.makes.map((make) => ({
      key: `make-${make}`,
      label: make,
      onRemove: () =>
        onFilterChange({ ...filters, makes: filters.makes.filter((m) => m !== make) }),
    }))
  );

  pushGroup(
    'model',
    t('filters.model'),
    filters.models.map((model) => ({
      key: `model-${model}`,
      label: model,
      onRemove: () =>
        onFilterChange({ ...filters, models: filters.models.filter((m) => m !== model) }),
    }))
  );

  pushGroup(
    'fuel',
    t('filters.fuelType'),
    filters.fuelTypes.map((fuel) => ({
      key: `fuel-${fuel}`,
      label: t(`fuel.${fuel === 'benzyna' ? 'petrol' : fuel === 'diesel' ? 'diesel' : fuel === 'hybryda' ? 'hybrid' : fuel === 'elektryczny' ? 'electric' : 'lpg'}`),
      onRemove: () =>
        onFilterChange({ ...filters, fuelTypes: filters.fuelTypes.filter((f) => f !== fuel) }),
    }))
  );

  pushGroup(
    'transmission',
    t('filters.transmission'),
    filters.transmissions.map((trans) => ({
      key: `trans-${trans}`,
      label: t(`transmission.${trans === 'manualna' ? 'manual' : 'automatic'}`),
      onRemove: () =>
        onFilterChange({
          ...filters,
          transmissions: filters.transmissions.filter((t) => t !== trans),
        }),
    }))
  );

  pushGroup(
    'drive',
    t('filters.drive'),
    filters.drives.map((drive) => ({
      key: `drive-${drive}`,
      label: drive,
      onRemove: () =>
        onFilterChange({ ...filters, drives: filters.drives.filter((d) => d !== drive) }),
    }))
  );

  pushGroup(
    'body',
    t('filters.bodyType'),
    filters.bodyTypes.map((body) => ({
      key: `body-${body}`,
      label: body,
      onRemove: () =>
        onFilterChange({ ...filters, bodyTypes: filters.bodyTypes.filter((b) => b !== body) }),
    }))
  );

  if (filters.yearFrom || filters.yearTo) {
    pushGroup('year', t('filters.productionYear'), [
      {
        key: 'year-range',
        label: `${filters.yearFrom || '...'} - ${filters.yearTo || '...'}`,
        onRemove: () => onFilterChange({ ...filters, yearFrom: '', yearTo: '' }),
      },
    ]);
  }

  if (filters.mileageFrom || filters.mileageTo) {
    pushGroup('mileage', t('filters.mileage'), [
      {
        key: 'mileage-range',
        label: `${filters.mileageFrom || '0'} - ${filters.mileageTo || '∞'} km`,
        onRemove: () => onFilterChange({ ...filters, mileageFrom: '', mileageTo: '' }),
      },
    ]);
  }

  if (filters.powerFrom || filters.powerTo) {
    pushGroup('power', t('filters.power'), [
      {
        key: 'power-range',
        label: `${filters.powerFrom || '0'} - ${filters.powerTo || '∞'} KM`,
        onRemove: () => onFilterChange({ ...filters, powerFrom: '', powerTo: '' }),
      },
    ]);
  }

  if (filters.priceFrom || filters.priceTo) {
    pushGroup('price', t('filters.price'), [
      {
        key: 'price-range',
        label: `${filters.priceFrom || '0'} - ${filters.priceTo || '∞'} PLN`,
        onRemove: () => onFilterChange({ ...filters, priceFrom: '', priceTo: '' }),
      },
    ]);
  }

  const totalChipCount = chipGroups.reduce((acc, g) => acc + g.chips.length, 0);

  return (
    <div className="flex flex-col">
      {/* ── Mobile top bar ── */}
      <div className="flex lg:hidden flex-col gap-3 mb-3 mt-3">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t('search.placeholder', 'Szukaj marki, modelu, typu nadwozia...')}
            value={searchValue}
            onChange={(e) => {
              setIsUserTyping(true);
              setSearchValue(e.target.value);
            }}
            className="pl-9"
          />
        </div>
        {/* Filters button row */}
        <div className="flex items-center gap-2">
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 flex-1">
                <SlidersHorizontal className="h-4 w-4" />
                {t('filters.title')}
                {totalChipCount > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {totalChipCount}
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
                  availableMakes={availableMakes}
                  availableModels={availableModels}
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
        </div>
      </div>

      {/* ── Desktop: search integrated into TopFilterBar row (this row is now just chips) ── */}
      {/* Search pill — desktop, shown inline with filter pills in TopFilterBar */}
      {/* (TopFilterBar renders the search input — nothing extra here on desktop) */}

      {/* ── Active Filter Chips — desktop (below TopFilterBar) ── */}
      {totalChipCount > 0 && (
        <div className="hidden lg:flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
          {chipGroups.map((group) => (
            <div key={group.key} className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {group.groupLabel}:
              </span>
              {group.chips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={chip.onRemove}
                  className="chip chip-active chip-removable group text-xs py-1"
                >
                  <span>{chip.label}</span>
                  <X className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ))}
          {totalChipCount > 1 && (
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

      {/* ── Active Filter Chips — mobile ── */}
      {totalChipCount > 0 && (
        <div className="flex lg:hidden flex-wrap items-center gap-x-3 gap-y-2">
          {chipGroups.map((group) => (
            <div key={group.key} className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {group.groupLabel}:
              </span>
              {group.chips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={chip.onRemove}
                  className="chip chip-active chip-removable group"
                >
                  <span>{chip.label}</span>
                  <X className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ))}
          {totalChipCount > 1 && (
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
