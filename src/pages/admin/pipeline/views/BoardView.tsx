import React, { useMemo } from 'react';
import {
  PipelineOpportunitySummary,
  PipelinePhase,
  PIPELINE_PHASES,
  InboxLeadSummary,
} from '../types';
import { OpportunityCard } from '../components/OpportunityCard';
import {
  DndContext,
  DragOverlay,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Inbox, UserCheck, Loader2 } from 'lucide-react';

function KanbanColumn({
  phase,
  label,
  opportunities,
  inboxLeads,
  onCardClick,
  onQualifyLead,
}: {
  phase: PipelinePhase;
  label: string;
  opportunities: PipelineOpportunitySummary[];
  inboxLeads?: InboxLeadSummary[];
  onCardClick: (opp: PipelineOpportunitySummary) => void;
  onQualifyLead?: (lead: InboxLeadSummary) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: phase,
  });

  const count = phase === 'INBOX' ? inboxLeads?.length ?? 0 : opportunities.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col flex-1 min-w-[280px] max-w-[320px] bg-muted/40 rounded-xl border p-2.5 transition-colors',
        isOver && 'bg-primary/5 ring-2 ring-primary/40 border-primary/50'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-2 py-1.5 mb-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wider text-foreground">
            {label}
          </span>
          <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-background text-muted-foreground border">
            {count}
          </span>
        </div>
      </div>

      {/* Column Body */}
      <div className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5">
        {phase === 'INBOX' ? (
          inboxLeads && inboxLeads.length > 0 ? (
            inboxLeads.map((lead) => (
              <div
                key={lead.id}
                className={`p-3 ${lead.leadType === 'employer_b2b' ? 'bg-stone-50/70 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800' : 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'} rounded-xl border text-xs space-y-2`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-foreground truncate">{lead.name}</span>
                    {lead.leadType === 'employer_b2b' && (
                      <span className="shrink-0 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#0f2d1e] text-[#F7F8F2]">
                        Benefivo B2B
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {lead.leadType === 'employer_b2b' ? 'benefivo.pl' : (lead.trafficSource || 'Formularz')}
                  </span>
                </div>
                {lead.leadType === 'employer_b2b' && lead.metadata?.companyName && (
                  <div className="text-[11px] font-semibold text-stone-800 dark:text-stone-200 truncate">
                    {lead.metadata.companyName} {lead.metadata.companyNip ? `(NIP: ${lead.metadata.companyNip})` : ''}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground">{lead.phone || lead.email}</div>
                {lead.message && (
                  <p className="text-[11px] text-foreground/80 italic line-clamp-2">
                    "{lead.message}"
                  </p>
                )}
                {onQualifyLead && (
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
                    onClick={() => onQualifyLead(lead)}
                  >
                    <UserCheck className="w-3 h-3" />
                    Kwalifikuj
                  </Button>
                )}
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              Brak leadów w Inboxie
            </div>
          )
        ) : opportunities.length > 0 ? (
          opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onClick={onCardClick}
            />
          ))
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
            Brak spraw w tej fazie
          </div>
        )}
      </div>
    </div>
  );
}

export function BoardView({
  opportunities = [],
  inboxLeads = [],
  isLoading,
  onCardClick,
  onTransitionPhase,
  onQualifyLead,
}: {
  opportunities?: PipelineOpportunitySummary[];
  inboxLeads?: InboxLeadSummary[];
  isLoading: boolean;
  onCardClick: (opp: PipelineOpportunitySummary) => void;
  onTransitionPhase: (oppId: string, targetPhase: PipelinePhase) => void;
  onQualifyLead: (lead: InboxLeadSummary) => void;
}) {
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const activeOpp = useMemo(
    () => opportunities.find((o) => o.id === activeDragId),
    [opportunities, activeDragId]
  );

  const phaseColumns = useMemo(() => {
    return PIPELINE_PHASES.map((p) => {
      const colOpps = opportunities.filter((o) => o.phase === p.id && o.status === 'OPEN');
      return {
        ...p,
        opportunities: colOpps,
      };
    });
  }, [opportunities]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;
    const targetPhase = over.id as PipelinePhase;
    const oppId = String(active.id);

    const opp = opportunities.find((o) => o.id === oppId);
    if (opp && opp.phase !== targetPhase && targetPhase !== 'INBOX') {
      onTransitionPhase(oppId, targetPhase);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm">Ładowanie tablicy Kanban...</span>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1">
        {phaseColumns.map((col) => (
          <KanbanColumn
            key={col.id}
            phase={col.id}
            label={col.label}
            opportunities={col.opportunities}
            inboxLeads={col.id === 'INBOX' ? inboxLeads : undefined}
            onCardClick={onCardClick}
            onQualifyLead={onQualifyLead}
          />
        ))}
      </div>

      <DragOverlay>
        {activeOpp ? (
          <div className="w-[300px]">
            <OpportunityCard opportunity={activeOpp} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
