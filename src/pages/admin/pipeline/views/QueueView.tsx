import React, { useState, useMemo } from 'react';
import {
  QueueResponse,
  PipelineOpportunitySummary,
  InboxLeadSummary,
  WaitingOpportunitySummary,
} from '../types';
import { QueueRow } from '../components/QueueRow';
import { InboxRow } from '../components/InboxRow';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calendar, HelpCircle, Hourglass, Inbox, Loader2 } from 'lucide-react';

const WAITING_REASON_LABEL: Record<WaitingOpportunitySummary['waitingReason'], string> = {
  APPLICATION_PENDING: 'czeka na decyzję finansującego',
  DOCUMENT_PENDING: 'czeka na dokument od klienta',
};

function waitingNoteFor(opp: WaitingOpportunitySummary): string {
  const days = Math.floor((Date.now() - new Date(opp.waitingSince).getTime()) / (1000 * 60 * 60 * 24));
  return `${WAITING_REASON_LABEL[opp.waitingReason]} (${days} dni)`;
}

export function QueueView({
  queue,
  isLoading,
  onOpenDetails,
  onOpenLogContact,
  onOpenSetNextAction,
  onOpenTransition,
  onOpenClose,
  onQuickSnooze,
  onQualifyLead,
  onDismissLead,
}: {
  queue?: QueueResponse;
  isLoading: boolean;
  onOpenDetails: (opp: PipelineOpportunitySummary) => void;
  onOpenLogContact: (opp: PipelineOpportunitySummary) => void;
  onOpenSetNextAction: (opp: PipelineOpportunitySummary) => void;
  onOpenTransition: (opp: PipelineOpportunitySummary) => void;
  onOpenClose: (opp: PipelineOpportunitySummary) => void;
  onQuickSnooze: (opp: PipelineOpportunitySummary, days: number) => void;
  onQualifyLead: (lead: InboxLeadSummary) => void;
  onDismissLead: (lead: InboxLeadSummary) => void;
}) {
  const [inboxFilter, setInboxFilter] = useState<'all' | 'employer_b2b'>('all');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm">Ładowanie kolejki doradcy...</span>
      </div>
    );
  }

  if (!queue) return null;

  const { overdue, today, waiting, noAction, inbox, counts } = queue;

  const filteredInbox = useMemo(() => {
    if (inboxFilter === 'all') return inbox;
    return inbox.filter((l) => l.leadType === 'employer_b2b');
  }, [inbox, inboxFilter]);

  return (
    <div className="space-y-8">
      {/* 1. OVERDUE SECTION (🔴 Zaległe) */}
      {overdue.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-red-700 dark:text-red-400">
              Zaległe akcje ({counts.overdue})
            </h3>
            <span className="text-xs text-muted-foreground">
              Wymagają natychmiastowego kontaktu lub zmiany terminu
            </span>
          </div>

          <div className="space-y-2">
            {overdue.map((opp) => (
              <QueueRow
                key={opp.id}
                opportunity={opp}
                onOpenDetails={onOpenDetails}
                onOpenLogContact={onOpenLogContact}
                onOpenSetNextAction={onOpenSetNextAction}
                onOpenTransition={onOpenTransition}
                onOpenClose={onOpenClose}
                onQuickSnooze={onQuickSnooze}
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. TODAY SECTION (🟡 Dzisiejsze) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
            <Calendar className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-base text-foreground">
            Zaplanowane na dziś ({counts.today})
          </h3>
          <span className="text-xs text-muted-foreground">
            Zadania i kontakty do wykonania w trakcie dnia
          </span>
        </div>

        {today.length > 0 ? (
          <div className="space-y-2">
            {today.map((opp) => (
              <QueueRow
                key={opp.id}
                opportunity={opp}
                onOpenDetails={onOpenDetails}
                onOpenLogContact={onOpenLogContact}
                onOpenSetNextAction={onOpenSetNextAction}
                onOpenTransition={onOpenTransition}
                onOpenClose={onOpenClose}
                onQuickSnooze={onQuickSnooze}
              />
            ))}
          </div>
        ) : (
          <div className="p-6 text-center rounded-xl border border-dashed text-xs text-muted-foreground bg-muted/20">
            Brak spraw zaplanowanych na dzisiaj. Świetna robota!
          </div>
        )}
      </section>

      {/* 2b. WAITING SECTION (🟠 Czeka na odpowiedź) */}
      {waiting.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400">
              <Hourglass className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-orange-700 dark:text-orange-400">
              Czeka na odpowiedź ({counts.waiting})
            </h3>
            <span className="text-xs text-muted-foreground">
              Brak decyzji finansującego lub dokumentu od klienta od co najmniej 3 dni
            </span>
          </div>

          <div className="space-y-2">
            {waiting.map((opp) => (
              <QueueRow
                key={opp.id}
                opportunity={opp}
                onOpenDetails={onOpenDetails}
                onOpenLogContact={onOpenLogContact}
                onOpenSetNextAction={onOpenSetNextAction}
                onOpenTransition={onOpenTransition}
                onOpenClose={onOpenClose}
                onQuickSnooze={onQuickSnooze}
                waitingNote={waitingNoteFor(opp)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. INBOX SECTION (🔵 Nowe zapytania) */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
              <Inbox className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-blue-700 dark:text-blue-400">
              Nowe zapytania z Inboxu ({counts.inbox})
            </h3>
            <span className="text-xs text-muted-foreground">
              Leady czekające na 30-sekundową kwalifikację i przypisanie
            </span>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <Button
              type="button"
              variant={inboxFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setInboxFilter('all')}
            >
              Wszystkie ({inbox.length})
            </Button>
            <Button
              type="button"
              variant={inboxFilter === 'employer_b2b' ? 'default' : 'outline'}
              size="sm"
              className={`h-7 text-xs px-2.5 ${inboxFilter === 'employer_b2b' ? 'bg-[#0f2d1e] hover:bg-[#1a4a32] text-[#F7F8F2]' : ''}`}
              onClick={() => setInboxFilter('employer_b2b')}
            >
              Benefivo B2B ({inbox.filter((l) => l.leadType === 'employer_b2b').length})
            </Button>
          </div>
        </div>

        {filteredInbox.length > 0 ? (
          <div className="space-y-2">
            {filteredInbox.map((lead) => (
              <InboxRow
                key={lead.id}
                lead={lead}
                onQualify={onQualifyLead}
                onDismiss={onDismissLead}
              />
            ))}
          </div>
        ) : (
          <div className="p-6 text-center rounded-xl border border-dashed text-xs text-muted-foreground bg-muted/20">
            {inboxFilter === 'employer_b2b'
              ? 'Brak oczekujących leadów Benefivo B2B w Inboxie.'
              : 'Inbox jest pusty - brak oczekujących leadów.'}
          </div>
        )}
      </section>

      {/* 4. NO NEXT ACTION SECTION (⚪ Bez kolejnej akcji) */}
      {noAction.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <HelpCircle className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-foreground">
              Bez wyznaczonej akcji ({counts.noAction})
            </h3>
            <span className="text-xs text-muted-foreground">
              Otwarte sprawy, które nie mają zaplanowanego kolejnego kroku
            </span>
          </div>

          <div className="space-y-2">
            {noAction.map((opp) => (
              <QueueRow
                key={opp.id}
                opportunity={opp}
                onOpenDetails={onOpenDetails}
                onOpenLogContact={onOpenLogContact}
                onOpenSetNextAction={onOpenSetNextAction}
                onOpenTransition={onOpenTransition}
                onOpenClose={onOpenClose}
                onQuickSnooze={onQuickSnooze}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
