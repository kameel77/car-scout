import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Check, Building2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface StatusTabsProps {
  activeStatuses: string[]; // current filters.statuses
  byCondition?: { NEW: number; USED: number };
  onChange: (statuses: string[]) => void;
  className?: string;
  /** Total result count shown in "Znaleziono: N" */
  resultCount?: number;
  /** Current sort value */
  sortBy?: string;
  /** Callback when sort changes */
  onSortChange?: (value: string) => void;
}

const sortOptions = [
  { value: 'recommended', label: 'sort.recommended' },
  { value: 'price_asc', label: 'sort.cheapest' },
  { value: 'price_desc', label: 'sort.mostExpensive' },
  { value: 'mileage_asc', label: 'sort.lowestMileage' },
  { value: 'year_desc', label: 'sort.newest' },
  { value: 'newest', label: 'sort.recentlyAdded' },
];

const PLN = new Intl.NumberFormat('pl-PL');

/**
 * Quick-switch tabs over the listings grid: All / New / Used.
 * Also hosts "Na firmę/Prywatnie", sort selector and "Znaleziono" count on the right.
 */
export function StatusTabs({
  activeStatuses,
  byCondition,
  onChange,
  className,
  resultCount,
  sortBy,
  onSortChange,
}: StatusTabsProps) {
  const { t } = useTranslation();
  const { priceType, setPriceType } = usePriceSettings();

  const isAll = activeStatuses.length === 0;
  const isNew = activeStatuses.length === 1 && activeStatuses[0] === 'NEW';
  const isUsed = activeStatuses.length === 1 && activeStatuses[0] === 'USED';

  const totalCount = byCondition ? byCondition.NEW + byCondition.USED : null;

  const tabClass = (active: boolean) =>
    cn(
      'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
      active
        ? 'border-accent text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    );

  const currentSort = sortOptions.find((s) => s.value === sortBy);

  return (
    <div className={cn('flex items-center gap-1 border-b border-border overflow-x-auto', className)}>
      {/* Tabs: Wszystkie / Nowy / Używany */}
      <button type="button" onClick={() => onChange([])} className={tabClass(isAll)}>
        {t('status.all', 'Wszystkie')}
        {totalCount !== null && (
          <span className="ml-1.5 text-xs text-muted-foreground">({PLN.format(totalCount)})</span>
        )}
      </button>
      <button type="button" onClick={() => onChange(['NEW'])} className={tabClass(isNew)}>
        {t('status.new')}
        {byCondition && (
          <span className="ml-1.5 text-xs text-muted-foreground">({PLN.format(byCondition.NEW)})</span>
        )}
      </button>
      <button type="button" onClick={() => onChange(['USED'])} className={tabClass(isUsed)}>
        {t('status.used')}
        {byCondition && (
          <span className="ml-1.5 text-xs text-muted-foreground">({PLN.format(byCondition.USED)})</span>
        )}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Na firmę / Prywatnie pill toggle */}
      <div className="flex bg-secondary rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => setPriceType('net')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
            priceType === 'net'
              ? 'bg-accent shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Building2 className="w-3.5 h-3.5" />
          {t('listing.net')}
        </button>
        <button
          type="button"
          onClick={() => setPriceType('gross')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
            priceType === 'gross'
              ? 'bg-accent shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <User className="w-3.5 h-3.5" />
          {t('listing.gross')}
        </button>
      </div>

      {/* Sort */}
      {onSortChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-8 text-xs whitespace-nowrap border border-border rounded-full px-3 hover:bg-secondary"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
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
                {sortBy === option.value && <Check className="h-3.5 w-3.5" />}
                {t(option.label)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Right padding */}
      <div className="w-1" />
    </div>
  );
}
