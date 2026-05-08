import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface StatusTabsProps {
  activeStatuses: string[]; // current filters.statuses
  byCondition?: { NEW: number; USED: number };
  onChange: (statuses: string[]) => void;
  className?: string;
}

const PLN = new Intl.NumberFormat('pl-PL');

/**
 * Quick-switch tabs over the listings grid: All / New / Used.
 * Mirrors the condition filter — clicking a tab updates filters.statuses.
 * Counts come from backend response.byCondition (computed without the
 * condition filter so each tab shows its true total).
 */
export function StatusTabs({ activeStatuses, byCondition, onChange, className }: StatusTabsProps) {
  const { t } = useTranslation();

  const isAll = activeStatuses.length === 0;
  const isNew = activeStatuses.length === 1 && activeStatuses[0] === 'NEW';
  const isUsed = activeStatuses.length === 1 && activeStatuses[0] === 'USED';

  const totalCount = byCondition ? byCondition.NEW + byCondition.USED : null;

  const tabClass = (active: boolean) =>
    cn(
      'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
      active
        ? 'border-accent text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    );

  return (
    <div className={cn('flex gap-1 border-b border-border overflow-x-auto', className)}>
      <button type="button" onClick={() => onChange([])} className={tabClass(isAll)}>
        {t('filters.title')}
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
    </div>
  );
}
