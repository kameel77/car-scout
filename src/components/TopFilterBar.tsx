import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { FilterState } from '@/components/FilterPanel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const fuelTypeOptions = [
  { value: 'benzyna', label: 'fuel.petrol' },
  { value: 'diesel', label: 'fuel.diesel' },
  { value: 'hybryda', label: 'fuel.hybrid' },
  { value: 'elektryczny', label: 'fuel.electric' },
  { value: 'lpg', label: 'fuel.lpg' },
];

const bodyTypeOptions = [
  { value: 'sedan', label: 'body.sedan' },
  { value: 'hatchback', label: 'body.hatchback' },
  { value: 'SUV', label: 'body.suv' },
  { value: 'kombi', label: 'body.kombi' },
  { value: 'coupe', label: 'body.coupe' },
];

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
}

function MultiCheck({ options, selected, onChange, searchable, searchPlaceholder }: MultiCheckProps) {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState('');

  const filtered = searchable
    ? options.filter((o) => {
        const label = t(o.label, o.label).toLowerCase();
        return label.includes(search.toLowerCase()) || o.value.toLowerCase().includes(search.toLowerCase());
      })
    : options;

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
      <ScrollArea className="max-h-64">
        <div className="space-y-1">
          {filtered.map((option) => {
            const id = `topfilter-${option.value.replace(/\s+/g, '-')}`;
            return (
              <label
                key={option.value}
                htmlFor={id}
                className="flex items-center gap-2 p-1.5 rounded-md hover:bg-secondary/50 cursor-pointer"
              >
                <Checkbox
                  id={id}
                  checked={selected.includes(option.value)}
                  onCheckedChange={() => toggle(option.value)}
                />
                <span className="text-sm">{t(option.label, option.label)}</span>
              </label>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">{t('common.noResults', 'Brak wyników')}</p>
          )}
        </div>
      </ScrollArea>
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

  return (
    <div className="hidden lg:flex flex-wrap items-center gap-2 mb-3 sticky top-20 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
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
          />
        ) : (
          <p className="text-sm text-muted-foreground p-2">{t('filters.selectMake')}</p>
        )}
      </FilterPill>

      <FilterPill label={t('filters.bodyType')} activeCount={filters.bodyTypes.length}>
        <MultiCheck
          options={bodyTypeOptions}
          selected={filters.bodyTypes}
          onChange={(v) => update('bodyTypes', v)}
        />
      </FilterPill>

      <FilterPill label={t('filters.fuelType')} activeCount={filters.fuelTypes.length}>
        <MultiCheck
          options={fuelTypeOptions}
          selected={filters.fuelTypes}
          onChange={(v) => update('fuelTypes', v)}
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

      <Button
        variant="outline"
        size="sm"
        onClick={onOpenAllFilters}
        className="h-9 rounded-full ml-auto gap-1.5"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {t('filters.title')}
      </Button>
    </div>
  );
}
