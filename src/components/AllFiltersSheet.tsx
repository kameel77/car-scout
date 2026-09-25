import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FilterPanel, FilterState, ListingFacets } from '@/components/FilterPanel';

export interface AllFiltersSheetHandle {
  open: () => void;
}

interface AllFiltersSheetProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClear: () => void;
  resultCount: number;
  availableMakes: string[];
  availableModels: { make: string; model: string }[];
  facets?: ListingFacets;
  // Skips the sheet's entry animation when it opens via the `?openFilters=true` deep link
  // (masks the brief unmount/mount flicker after a Stan-switch redirect). Off by default so
  // pages that never had this behaviour keep behaving exactly as before.
  skipAnimationOnDeepLink?: boolean;
  // Notified whenever the open state changes, so a parent that needs the current value
  // (e.g. to preserve it across a redirect) doesn't have to hold it in state itself.
  onOpenChange?: (open: boolean) => void;
}

// Owns its own `open` state so opening/closing this sheet never re-renders the parent
// page (and, with it, the results grid). The parent triggers it via the imperative
// `open()` handle instead of lifted state.
export const AllFiltersSheet = React.forwardRef<AllFiltersSheetHandle, AllFiltersSheetProps>(
  (
    {
      filters,
      onFilterChange,
      onClear,
      resultCount,
      availableMakes,
      availableModels,
      facets,
      skipAnimationOnDeepLink = false,
      onOpenChange,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();

    const [open, setOpen] = React.useState(() => searchParams.get('openFilters') === 'true');
    // When the sheet opens because we just landed here from a Stan-switch redirect,
    // skip the entry animation to mask the brief unmount/mount flicker.
    const [skipSheetAnimation, setSkipSheetAnimation] = React.useState(
      () => skipAnimationOnDeepLink && searchParams.get('openFilters') === 'true',
    );

    const onOpenChangeRef = React.useRef(onOpenChange);
    onOpenChangeRef.current = onOpenChange;
    React.useEffect(() => {
      onOpenChangeRef.current?.(open);
    }, [open]);

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

    React.useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
    }), []);

    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0" instant={skipSheetAnimation}>
          <SheetHeader className="sr-only">
            <SheetTitle>{t('filters.title')}</SheetTitle>
          </SheetHeader>
          <div className="px-6 pt-6 pb-6 h-[calc(100vh-5rem)] overflow-hidden">
            <FilterPanel
              filters={filters}
              onFilterChange={onFilterChange}
              onClear={onClear}
              resultCount={resultCount}
              availableMakes={availableMakes}
              availableModels={availableModels}
              facets={facets}
              onApply={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  },
);

AllFiltersSheet.displayName = 'AllFiltersSheet';
