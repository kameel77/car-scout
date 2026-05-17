import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronDown, ChevronUp, Search as SearchIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
// Removed mock imports
import { cn } from '@/lib/utils';
import { useAppSettings } from '@/hooks/useAppSettings';

export interface FilterState {
  makes: string[];
  models: string[];
  fuelTypes: string[];
  yearFrom: string;
  yearTo: string;
  mileageFrom: string;
  mileageTo: string;
  drives: string[];
  transmissions: string[];
  powerFrom: string;
  powerTo: string;
  capacityFrom: string;
  capacityTo: string;
  bodyTypes: string[];
  statuses: string[]; // 'NEW' | 'USED'
  priceFrom: string;
  priceTo: string;
  // Monthly rate filter (translates server-side to a price filter using fixed factors).
  rateFrom: string;
  rateTo: string;
  rateType: 'credit' | 'lease';
  rateBasis: 'gross' | 'net';
  query: string;
}

export interface ListingFacets {
  make: Record<string, number>;
  model: Record<string, number>;
  fuelType: Record<string, number>;
  transmission: Record<string, number>;
  bodyType: Record<string, number>;
  drive: Record<string, number>;
}

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClear: () => void;
  resultCount: number;
  className?: string;
  availableMakes: string[];
  availableModels: { make: string; model: string }[];
  facets?: ListingFacets;
}

const fuelTypeOptions = [
  { value: 'benzyna', label: 'fuel.petrol' },
  { value: 'diesel', label: 'fuel.diesel' },
  { value: 'hybryda', label: 'fuel.hybrid' },
  { value: 'elektryczny', label: 'fuel.electric' },
  { value: 'lpg', label: 'fuel.lpg' },
];

const transmissionOptions = [
  { value: 'manualna', label: 'transmission.manual' },
  { value: 'automatyczna', label: 'transmission.automatic' },
];

const driveOptions = [
  { value: 'FWD', label: 'drive.fwd' },
  { value: 'RWD', label: 'drive.rwd' },
  { value: 'AWD', label: 'drive.awd' },
];

const bodyTypeOptions = [
  { value: 'sedan', label: 'body.sedan' },
  { value: 'hatchback', label: 'body.hatchback' },
  { value: 'SUV', label: 'body.suv' },
  { value: 'kombi', label: 'body.kombi' },
  { value: 'coupe', label: 'body.coupe' },
];

const statusOptions = [
  { value: 'NEW', label: 'status.new' },
  { value: 'USED', label: 'status.used' },
];

interface FilterSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function FilterSection({ title, defaultOpen = false, children }: FilterSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-primary transition-colors">
          {title}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-3">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface MultiSelectProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** When true, renders options as wrapped row instead of stacked column. */
  inline?: boolean;
  /** Per-option counts. Keys must be lowercased. */
  counts?: Record<string, number>;
}

function MultiSelect({
  options,
  selected,
  onChange,
  searchable,
  searchPlaceholder,
  inline,
  counts,
}: MultiSelectProps) {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState('');

  const getCount = React.useCallback((value: string) => {
    if (!counts) return undefined;
    return counts[value.toLowerCase()];
  }, [counts]);

  const filteredOptions = searchable
    ? options.filter((opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      t(opt.label).toLowerCase().includes(search.toLowerCase())
    )
    : options;

  // Sort options: counted desc → zero count → no count info (alphabetical within each group)
  const sortedOptions = React.useMemo(() => {
    if (!counts) return filteredOptions;
    const arr = [...filteredOptions];
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
  }, [filteredOptions, counts, getCount]);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="space-y-2">
      {searchable && (
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      )}
      <ScrollArea className={searchable ? 'h-64' : 'max-h-64'}>
        <div className={inline ? 'flex flex-wrap gap-x-4 gap-y-1' : 'space-y-1'}>
          {sortedOptions.map((option) => {
            const id = `filter-${option.value.replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 9)}`;
            const count = getCount(option.value);
            const isZero = counts !== undefined && (count === undefined || count === 0);
            const isSelected = selected.includes(option.value);
            return (
              <div
                key={option.value}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-md transition-colors',
                  isZero && !isSelected ? 'opacity-50' : 'hover:bg-secondary/50'
                )}
              >
                <Checkbox
                  id={id}
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(option.value)}
                />
                <label
                  htmlFor={id}
                  className="text-sm cursor-pointer select-none whitespace-nowrap flex-1 flex items-center justify-between gap-2"
                >
                  <span>{t(option.label, option.label)}</span>
                  {count !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">({count})</span>
                  )}
                </label>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

interface RangeInputProps {
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromPlaceholder: string;
  toPlaceholder: string;
  type?: 'number' | 'text';
}

function RangeInput({
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  fromPlaceholder,
  toPlaceholder,
  type = 'number',
}: RangeInputProps) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type={type}
        placeholder={fromPlaceholder}
        value={fromValue}
        onChange={(e) => onFromChange(e.target.value)}
        className="h-9"
      />
      <span className="text-muted-foreground">-</span>
      <Input
        type={type}
        placeholder={toPlaceholder}
        value={toValue}
        onChange={(e) => onToChange(e.target.value)}
        className="h-9"
      />
    </div>
  );
}

export function FilterPanel({
  filters,
  onFilterChange,
  onClear,
  resultCount,
  className,
  availableMakes,
  availableModels: allModels,
  facets,
}: FilterPanelProps) {
  const { t } = useTranslation();
  const { data: settings } = useAppSettings();
  const currency = settings?.displayCurrency || 'PLN';

  const makeOptions = availableMakes
    .map((m) => ({ value: m, label: m }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const filteredModels = filters.makes.length
    ? allModels.filter((m) => filters.makes.includes(m.make))
    : [];

  const modelOptions = filteredModels
    .map((m) => ({ value: m.model, label: m.model }))
    .filter((v, i, a) => a.findIndex(t => t.value === v.value) === i) // unique
    .sort((a, b) => a.label.localeCompare(b.label));

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== ''
  );

  return (
    <div className={cn('filter-panel flex flex-col h-full', className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold">{t('filters.title')}</h2>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-destructive">
            <X className="h-4 w-4 mr-1" />
            {t('common.clear')}
          </Button>
        )}
      </div>


      <Separator className="mb-4" />

      <div className="space-y-1 overflow-y-auto flex-1 pr-3 min-h-0 -mr-1">
        {/* Status (new / used) */}
        <FilterSection title={t('filters.status')} defaultOpen>
          <MultiSelect
            options={statusOptions}
            selected={filters.statuses}
            onChange={(v) => updateFilter('statuses', v)}
            inline
          />
        </FilterSection>

        <Separator />

        {/* Make */}
        <FilterSection title={t('filters.make')}>
          <MultiSelect
            options={makeOptions}
            selected={filters.makes}
            onChange={(v) => {
              // Standard update
              const newFilters = { ...filters, makes: v };

              // If no makes selected, clear models too (avoids stale state + orphaned models)
              if (v.length === 0) {
                newFilters.models = [];
              }

              onFilterChange(newFilters);
            }}
            searchable
            searchPlaceholder={t('filters.selectMake')}
            counts={facets?.make}
          />
        </FilterSection>

        <Separator />

        {/* Model (cascading) */}
        <FilterSection title={t('filters.model')} defaultOpen={filters.makes.length > 0}>
          {filters.makes.length > 0 ? (
            <MultiSelect
              options={modelOptions}
              selected={filters.models}
              onChange={(v) => updateFilter('models', v)}
              searchable
              searchPlaceholder={t('filters.selectModel')}
              counts={facets?.model}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              {t('filters.selectMake')}
            </p>
          )}
        </FilterSection>

        <Separator />

        {/* Fuel Type */}
        <FilterSection title={t('filters.fuelType')}>
          <MultiSelect
            options={fuelTypeOptions}
            selected={filters.fuelTypes}
            onChange={(v) => updateFilter('fuelTypes', v)}
            counts={facets?.fuelType}
          />
        </FilterSection>

        <Separator />

        {/* Year Range */}
        <FilterSection title={t('filters.productionYear')}>
          <RangeInput
            fromValue={filters.yearFrom}
            toValue={filters.yearTo}
            onFromChange={(v) => updateFilter('yearFrom', v)}
            onToChange={(v) => updateFilter('yearTo', v)}
            fromPlaceholder={t('common.from')}
            toPlaceholder={t('common.to')}
          />
        </FilterSection>

        <Separator />

        {/* Mileage Range */}
        <FilterSection title={t('filters.mileage')}>
          <RangeInput
            fromValue={filters.mileageFrom}
            toValue={filters.mileageTo}
            onFromChange={(v) => updateFilter('mileageFrom', v)}
            onToChange={(v) => updateFilter('mileageTo', v)}
            fromPlaceholder="0 km"
            toPlaceholder="300 000 km"
          />
        </FilterSection>

        <Separator />

        {/* Price Range */}
        <FilterSection title={t('filters.price')}>
          <RangeInput
            fromValue={filters.priceFrom}
            toValue={filters.priceTo}
            onFromChange={(v) => updateFilter('priceFrom', v)}
            onToChange={(v) => updateFilter('priceTo', v)}
            fromPlaceholder={`0 ${currency}`}
            toPlaceholder={`500 000 ${currency}`}
          />
        </FilterSection>

        <Separator />

        {/* Monthly Rate */}
        <FilterSection title={t('filters.monthlyRate', 'Wysokość raty')}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => updateFilter('rateType', 'credit')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-full border transition-colors',
                  filters.rateType === 'credit' ? 'border-accent bg-accent/15 text-foreground font-medium' : 'border-border bg-background hover:bg-secondary/50'
                )}
              >
                {t('filters.credit', 'Kredyt')}
              </button>
              <button
                type="button"
                onClick={() => updateFilter('rateType', 'lease')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-full border transition-colors',
                  filters.rateType === 'lease' ? 'border-accent bg-accent/15 text-foreground font-medium' : 'border-border bg-background hover:bg-secondary/50'
                )}
              >
                {t('filters.lease', 'Leasing')}
              </button>
              <span className="mx-1 w-px bg-border" />
              <button
                type="button"
                onClick={() => updateFilter('rateBasis', 'gross')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-full border transition-colors',
                  filters.rateBasis === 'gross' ? 'border-accent bg-accent/15 text-foreground font-medium' : 'border-border bg-background hover:bg-secondary/50'
                )}
              >
                {t('common.gross', 'Brutto')}
              </button>
              <button
                type="button"
                onClick={() => updateFilter('rateBasis', 'net')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-full border transition-colors',
                  filters.rateBasis === 'net' ? 'border-accent bg-accent/15 text-foreground font-medium' : 'border-border bg-background hover:bg-secondary/50'
                )}
              >
                {t('common.net', 'Netto')}
              </button>
            </div>
            <RangeInput
              fromValue={filters.rateFrom}
              toValue={filters.rateTo}
              onFromChange={(v) => updateFilter('rateFrom', v)}
              onToChange={(v) => updateFilter('rateTo', v)}
              fromPlaceholder="500 zł"
              toPlaceholder="5 000 zł"
            />
          </div>
        </FilterSection>

        <Separator />

        {/* Transmission */}
        <FilterSection title={t('filters.transmission')}>
          <MultiSelect
            options={transmissionOptions}
            selected={filters.transmissions}
            onChange={(v) => updateFilter('transmissions', v)}
            counts={facets?.transmission}
          />
        </FilterSection>

        <Separator />

        {/* Drive */}
        <FilterSection title={t('filters.drive')}>
          <MultiSelect
            options={driveOptions}
            selected={filters.drives}
            onChange={(v) => updateFilter('drives', v)}
            counts={facets?.drive}
          />
        </FilterSection>

        <Separator />

        {/* Power Range */}
        <FilterSection title={t('filters.power')}>
          <RangeInput
            fromValue={filters.powerFrom}
            toValue={filters.powerTo}
            onFromChange={(v) => updateFilter('powerFrom', v)}
            onToChange={(v) => updateFilter('powerTo', v)}
            fromPlaceholder="50 KM"
            toPlaceholder="500 KM"
          />
        </FilterSection>

        <Separator />

        {/* Engine Capacity */}
        <FilterSection title={t('filters.engineCapacity')}>
          <RangeInput
            fromValue={filters.capacityFrom}
            toValue={filters.capacityTo}
            onFromChange={(v) => updateFilter('capacityFrom', v)}
            onToChange={(v) => updateFilter('capacityTo', v)}
            fromPlaceholder="800 cm³"
            toPlaceholder="6000 cm³"
          />
        </FilterSection>

        <Separator />

        {/* Body Type */}
        <FilterSection title={t('filters.bodyType')}>
          <MultiSelect
            options={bodyTypeOptions}
            selected={filters.bodyTypes}
            onChange={(v) => updateFilter('bodyTypes', v)}
            counts={facets?.bodyType}
          />
        </FilterSection>
      </div>

      {hasFilters && (
        <div className="border-t pt-3 mt-2 bg-background">
          <Button
            variant="outline"
            onClick={onClear}
            className="w-full text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4 mr-2" />
            {t('common.clearAllFilters')}
          </Button>
        </div>
      )}
    </div>
  );
}
