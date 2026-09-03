import React from 'react';
import { cn } from '@/lib/utils';
import { NEXT_ACTION_TYPES } from '../types';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format, isBefore, isToday, isTomorrow, startOfDay } from 'date-fns';
import { pl } from 'date-fns/locale';

export function NextActionBadge({
  actionType,
  dueAt,
  note,
  className,
}: {
  actionType: string | null;
  dueAt: string | null;
  note?: string | null;
  className?: string;
}) {
  if (!actionType && !dueAt) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-normal bg-muted text-muted-foreground',
          className
        )}
      >
        Brak zaplanowanej akcji
      </span>
    );
  }

  const typeObj = NEXT_ACTION_TYPES.find((t) => t.id === actionType);
  const typeLabel = typeObj ? typeObj.label : actionType || 'Akcja';

  let dateLabel = '';
  let isOverdue = false;
  let isDueToday = false;

  if (dueAt) {
    const d = new Date(dueAt);
    const today = startOfDay(new Date());

    if (isBefore(d, today)) {
      isOverdue = true;
      dateLabel = `Zaległe (${format(d, 'd MMM', { locale: pl })})`;
    } else if (isToday(d)) {
      isDueToday = true;
      dateLabel = `Dziś, ${format(d, 'HH:mm')}`;
    } else if (isTomorrow(d)) {
      dateLabel = `Jutro, ${format(d, 'HH:mm')}`;
    } else {
      dateLabel = format(d, 'd MMM, HH:mm', { locale: pl });
    }
  }

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border',
            isOverdue
              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800'
              : isDueToday
              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
              : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
          )}
        >
          {isOverdue ? (
            <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" />
          ) : (
            <Clock className="w-3 h-3 text-muted-foreground" />
          )}
          <span>{typeLabel}</span>
          {dateLabel && <span className="font-semibold ml-0.5">• {dateLabel}</span>}
        </span>
      </div>
      {note && (
        <span className="text-[11px] text-muted-foreground line-clamp-1 italic">
          "{note}"
        </span>
      )}
    </div>
  );
}
