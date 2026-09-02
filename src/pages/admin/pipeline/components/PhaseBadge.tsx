import React from 'react';
import { PipelinePhase } from '../types';
import { cn } from '@/lib/utils';

const PHASE_CONFIG: Record<
  PipelinePhase,
  { label: string; bg: string; text: string; border: string }
> = {
  INBOX: {
    label: 'Inbox',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
  },
  QUALIFICATION: {
    label: 'Kwalifikacja',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  SELECTION: {
    label: 'Dobór pojazdu',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  COMPLETING: {
    label: 'Kompletowanie',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
  FINANCIAL_DECISION: {
    label: 'Weryfikacja fin.',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  CONTRACT: {
    label: 'Umowa',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
  },
  DELIVERY: {
    label: 'Odbiór',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
};

export function PhaseBadge({
  phase,
  className,
}: {
  phase: PipelinePhase;
  className?: string;
}) {
  const cfg = PHASE_CONFIG[phase] || PHASE_CONFIG.QUALIFICATION;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        cfg.bg,
        cfg.text,
        cfg.border,
        className
      )}
    >
      {cfg.label}
    </span>
  );
}
