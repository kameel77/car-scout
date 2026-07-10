import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, SlidersHorizontal, Search } from 'lucide-react';
import { FilterState, ListingFacets } from '@/components/FilterPanel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Build options dynamically from facet keys returned by the API (DB values, e.g.
// 'benzynowy', 'benzynowy + gaz', 'hybryda plug-in'). The previous hardcoded
// 'benzyna'/'hybryda' never matched real values for most listings.
function optionsFromFacet(
  facet?: Record<string, number>,
  labelMap?: Record<string, string>,
): { value: string; label: string }[] {
  const keys = new Set<string>();
  if (labelMap) {
    Object.keys(labelMap).forEach((k) => keys.add(k.toLowerCase()));
  }
  if (facet) {
    Object.keys(facet).forEach((k) => keys.add(k.toLowerCase()));
  }
  return Array.from(keys).map((k) => ({ value: k, label: labelMap?.[k] ?? k }));
}

const FUEL_LABEL_MAP: Record<string, string> = {
  petrol: 'fuel.petrol',
  diesel: 'fuel.diesel',
  hybrid: 'fuel.hybrid',
  hybrid_plugin: 'fuel.hybridPlugin',
  petrol_lpg: 'fuel.petrolLpg',
  electric: 'fuel.electric',
  lpg: 'fuel.lpg',
  cng: 'fuel.cng',
};

const DRIVE_LABEL_MAP: Record<string, string> = {
  fwd: 'drive.fwd',
  rwd: 'drive.rwd',
  awd: 'drive.awd',
  '4x4': 'drive.4x4',
};

const BODY_TYPE_LABEL_MAP: Record<string, string> = {
  sedan: 'body.sedan',
  hatchback: 'body.hatchback',
  suv: 'body.suv',
  kombi: 'body.kombi',
  coupe: 'body.coupe',
  cabrio: 'body.cabrio',
  minivan: 'body.minivan',
};

interface FilterPillProps {
  label: string;
  activeCount?: number;
  children: React.ReactNode;
}

function FilterPill({ label, activeCount, children }: FilterPillProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-sm whitespace-nowrap transition-colors',
            activeCount && activeCount > 0
              ? 'border-accent bg-accent/15 text-foreground font-medium'
              : 'border-border bg-background hover:bg-secondary/50'
          )}
        >
          <span>{label}</span>
          {activeCount && activeCount > 0 ? (
            <span className="text-xs font-semibold">({activeCount})</span>
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        {children}
      </PopoverContent>
    </Popover>
  );
}

interface MultiCheckProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  counts?: Record<string, number>;
}

function MultiCheck({ options, selected, onChange, searchable, searchPlaceholder, counts }: MultiCheckProps) {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState('');

  const getCount = (value: string) => {
    if (!counts) return undefined;
    if (value in counts) return counts[value];
    const lower = value.toLowerCase();
    for (const k of Object.keys(counts)) {
      if (k.toLowerCase() === lower) return counts[k];
    }
    return undefined;
  };

  const filtered = searchable
    ? options.filter((o) => {
        const label = t(o.label, o.label).toLowerCase();
        return label.includes(search.toLowerCase()) || o.value.toLowerCase().includes(search.toLowerCase());
      })
    : options;

  const sorted = React.useMemo(() => {
    if (!counts) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const ca = getCount(a.value);
      const cb = getCount(b.value);
      const aHas = ca !== undefined && ca > 0;
      const bHas = cb !== undefined && cb > 0;
      if (aHas && bHas) return (cb! - ca!) || a.label.localeCompare(b.label);
      if (aHas) return -1;
      if (bHas) return 1;
      return a.label.localeCompare(b.label);
    });
    return arr;
  }, [filtered, counts]);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  return (
    <div className="space-y-2">
      {searchable && (
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
      )}
      <div className="max-h-72 overflow-y-auto pr-1">
        <div className="space-y-1">
          {sorted.map((option) => {
            const id = `topfilter-${option.value.replace(/\s+/g, '-')}`;
            const count = getCount(option.value);
            const isSelected = selected.includes(option.value);
            const isZero = counts !== undefined && (count === undefined || count === 0);
            return (
              <label
                key={option.value}
                htmlFor={id}
                className={cn(
                  'flex items-center gap-2 p-1.5 rounded-md cursor-pointer',
                  isZero && !isSelected ? 'opacity-50' : 'hover:bg-secondary/50'
                )}
              >
                <Checkbox
                  id={id}
                  checked={isSelected}
                  onCheckedChange={() => toggle(option.value)}
                />
                <span className="text-sm flex-1 flex items-center justify-between gap-2">
                  <span>{t(option.label, option.label)}</span>
                  {count !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">({count})</span>
                  )}
                </span>
              </label>
            );
          })}
          {sorted.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">{t('common.noResults', 'Brak wyników')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface RangePopoverProps {
  fromValue: string;
  toValue: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  fromPlaceholder: string;
  toPlaceholder: string;
}

function RangePopover({ fromValue, toValue, onFromChange, onToChange, fromPlaceholder, toPlaceholder }: RangePopoverProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input
        type="number"
        value={fromValue}
        onChange={(e) => onFromChange(e.target.value)}
        placeholder={fromPlaceholder}
        className="h-9"
      />
      <Input
        type="number"
        value={toValue}
        onChange={(e) => onToChange(e.target.value)}
        placeholder={toPlaceholder}
        className="h-9"
      />
    </div>
  );
}

interface TopFilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  availableMakes: string[];
  availableModels: { make: string; model: string }[];
  onOpenAllFilters: () => void;
  /** Text search query — shown inline with filter pills on desktop */
  query?: string;
  onQueryChange?: (value: string) => void;
  facets?: ListingFacets;
}

/**
 * Horizontal pill-style filter bar shown above the listings grid
 * on desktop. Mirrors the most-used sections from FilterPanel as
 * Popover dropdowns, plus a fallback "Wszystkie filtry" button
 * that opens the full panel in a side sheet.
 */
export function TopFilterBar({
  filters,
  onFilterChange,
  availableMakes,
  availableModels,
  onOpenAllFilters,
  query = '',
  onQueryChange,
  facets,
}: TopFilterBarProps) {
  const { t } = useTranslation();

  const makeOptions = availableMakes.map((m) => ({ value: m, label: m }));
  const modelOptions = availableModels
    .filter((m) => filters.makes.length === 0 || filters.makes.includes(m.make))
    .map((m) => ({ value: m.model, label: m.model }));

  const update = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onFilterChange({ ...filters, [key]: value });

  const yearActive = filters.yearFrom !== '' || filters.yearTo !== '';
  const priceActive = filters.priceFrom !== '' || filters.priceTo !== '';
  const rateActive = filters.rateFrom !== '' || filters.rateTo !== '';

  return (
    <div className="hidden lg:flex flex-wrap items-center gap-2 mb-3 sticky top-20 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <FilterPill label={t('filters.make')} activeCount={filters.makes.length}>
        <MultiCheck
          options={makeOptions}
          selected={filters.makes}
          onChange={(v) => {
            const next = { ...filters, makes: v };
            // Clear models when removing all makes
            if (v.length === 0) next.models = [];
            onFilterChange(next);
          }}
          searchable
          searchPlaceholder={t('filters.selectMake')}
          counts={facets?.make}
        />
      </FilterPill>

      <FilterPill label={t('filters.model')} activeCount={filters.models.length}>
        {filters.makes.length > 0 ? (
          <MultiCheck
            options={modelOptions}
            selected={filters.models}
            onChange={(v) => update('models', v)}
            searchable
            searchPlaceholder={t('filters.selectModel')}
            counts={facets?.model}
          />
        ) : (
          <p className="text-sm text-muted-foreground p-2">{t('filters.selectMake')}</p>
        )}
      </FilterPill>

      <FilterPill label={t('filters.bodyType')} activeCount={filters.bodyTypes.length}>
        <MultiCheck
          options={optionsFromFacet(facets?.bodyType, BODY_TYPE_LABEL_MAP)}
          selected={filters.bodyTypes}
          onChange={(v) => update('bodyTypes', v)}
          counts={facets?.bodyType}
        />
      </FilterPill>

      <FilterPill label={t('filters.fuelType')} activeCount={filters.fuelTypes.length}>
        <MultiCheck
          options={optionsFromFacet(facets?.fuelType, FUEL_LABEL_MAP)}
          selected={filters.fuelTypes}
          onChange={(v) => update('fuelTypes', v)}
          counts={facets?.fuelType}
        />
      </FilterPill>

      <FilterPill label={t('filters.price')} activeCount={priceActive ? 1 : 0}>
        <RangePopover
          fromValue={filters.priceFrom}
          toValue={filters.priceTo}
          onFromChange={(v) => update('priceFrom', v)}
          onToChange={(v) => update('priceTo', v)}
          fromPlaceholder={t('filters.priceFrom')}
          toPlaceholder={t('filters.priceTo')}
        />
      </FilterPill>

      <FilterPill label={t('filters.rate', 'Rata')} activeCount={rateActive ? 1 : 0}>
        <RangePopover
          fromValue={filters.rateFrom}
          toValue={filters.rateTo}
          onFromChange={(v) => update('rateFrom', v)}
          onToChange={(v) => update('rateTo', v)}
          fromPlaceholder={t('common.from', 'Od')}
          toPlaceholder={t('common.to', 'Do')}
        />
      </FilterPill>

      <FilterPill label={t('filters.productionYear')} activeCount={yearActive ? 1 : 0}>
        <RangePopover
          fromValue={filters.yearFrom}
          toValue={filters.yearTo}
          onFromChange={(v) => update('yearFrom', v)}
          onToChange={(v) => update('yearTo', v)}
          fromPlaceholder={t('filters.yearFrom')}
          toPlaceholder={t('filters.yearTo')}
        />
      </FilterPill>

      {/* Left spacer — pushes search to center */}
      <div className="flex-1" />

      {/* Search input — centered between Rok produkcji and Filtry */}
      {onQueryChange && (
        <div className="relative w-[340px] flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            aria-label={t('search.placeholder', 'Szukaj marki, modelu, typu nadwozia...')}
            placeholder={t('search.placeholder', 'Szukaj marki, modelu, typu nadwozia...')}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="pl-9 h-9 text-sm rounded-full border-border bg-background"
          />
        </div>
      )}

      {/* Right spacer — equal to left, keeps Filtry at far right */}
      <div className="flex-1" />

      <Button
        variant="outline"
        size="sm"
        onClick={onOpenAllFilters}
        className="h-9 rounded-full gap-1.5"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {t('filters.title')}
      </Button>
    </div>
  );
}
