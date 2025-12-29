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
  }, [filters.query]);

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  // ... (keep existing activeChips logic)

  // ... (keep activeChips population code)

  const currentSort = sortOptions.find((s) => s.value === sortBy);

  return (
    <div className="space-y-4">
      {/* Top Bar - Mobile */}
      <div className="flex flex-col gap-4 lg:hidden">
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
          {/* ... (keep mobile sheet trigger and sort) ... */}
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
              {/* ... (keep sheet content) ... */}
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
      <div className="hidden lg:flex items-center gap-4 sticky top-20 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3 -mx-3 px-3 rounded-xl border shadow-sm transition-all">
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {t('common.found')}:{' '}
          <span className="font-semibold text-foreground">{resultCount}</span> {t('common.offers')}
        </div>

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('search.placeholder', 'Pozwól, że znajdę to za Ciebie...')} // "Let me find it for you..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 w-full bg-background border-primary/20 focus-visible:ring-primary/30 active:scale-[1.01] transition-all"
          />
        </div>

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

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
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
