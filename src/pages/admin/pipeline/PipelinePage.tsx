import React, { useState } from 'react';
import {
  useAdvisorQueue,
  useOpportunities,
  usePipelineDictionaries,
  usePipelineMutations,
  useInboxLeads,
} from './api/usePipeline';
import { QueueView } from './views/QueueView';
import { BoardView } from './views/BoardView';
import {
  PipelineOpportunitySummary,
  InboxLeadSummary,
  PipelinePhase,
  ClientType,
  FinancingType,
  LeadSourceChannel,
  LEAD_SOURCES,
  StageGateViolationErrorData,
} from './types';
import { StageGateAlertModal } from './components/StageGateAlertModal';
import { QualifyLeadModal } from './modals/QualifyLeadModal';
import { LogContactModal } from './modals/LogContactModal';
import { SetNextActionModal } from './modals/SetNextActionModal';
import { TransitionPhaseModal } from './modals/TransitionPhaseModal';
import { CloseOpportunityModal } from './modals/CloseOpportunityModal';
import { NewOpportunityModal } from './modals/NewOpportunityModal';
import { OpportunityDetailModal } from './modals/OpportunityDetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  ListFilter,
  KanbanSquare,
  ListTodo,
  Plus,
  Search,
  RefreshCw,
  Clock,
  Sparkles,
  Users,
} from 'lucide-react';
import { addDays } from 'date-fns';

export default function PipelinePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setNextAction, transitionPhase, dismissLead } = usePipelineMutations();

  // View state: 'queue' (default) | 'board'
  const [activeView, setActiveView] = useState<'queue' | 'board'>('queue');

  // Filters
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('all');
  const [financingFilter, setFinancingFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filterParams = {
    ownerUserId: ownerFilter !== 'all' ? ownerFilter : undefined,
    clientType: clientTypeFilter !== 'all' ? (clientTypeFilter as ClientType) : undefined,
    financingType: financingFilter !== 'all' ? (financingFilter as FinancingType) : undefined,
    leadSource: sourceFilter !== 'all' ? (sourceFilter as LeadSourceChannel) : undefined,
    search: searchQuery.trim() || undefined,
  };

  // Queries
  const queueQuery = useAdvisorQueue(filterParams);
  const oppsQuery = useOpportunities({
    ...filterParams,
    status: 'OPEN',
    limit: 100,
  });
  const dictQuery = usePipelineDictionaries();
  const inboxQuery = useInboxLeads();

  // Modal states
  const [selectedLeadForQualify, setSelectedLeadForQualify] = useState<InboxLeadSummary | null>(null);
  const [selectedOppForDetails, setSelectedOppForDetails] = useState<PipelineOpportunitySummary | null>(null);
  const [selectedOppForContact, setSelectedOppForContact] = useState<PipelineOpportunitySummary | null>(null);
  const [selectedOppForNextAction, setSelectedOppForNextAction] = useState<PipelineOpportunitySummary | null>(null);
  const [selectedOppForTransition, setSelectedOppForTransition] = useState<PipelineOpportunitySummary | null>(null);
  const [selectedOppForClose, setSelectedOppForClose] = useState<PipelineOpportunitySummary | null>(null);
  const [isNewOppOpen, setIsNewOppOpen] = useState(false);
  const [stageGateError, setStageGateError] = useState<StageGateViolationErrorData | null>(null);

  const users = dictQuery.data?.users || [];

  // Quick actions
  const handleQuickSnooze = async (opp: PipelineOpportunitySummary, days: number) => {
    try {
      const nextDue = addDays(new Date(), days);
      nextDue.setHours(10, 0, 0, 0);

      await setNextAction.mutateAsync({
        id: opp.id,
        data: {
          nextActionType: opp.nextActionType || 'CALL_FOLLOWUP',
          nextActionDueAt: nextDue.toISOString(),
          nextActionNote: opp.nextActionNote || `Odłożono o ${days} dni`,
        },
      });

      toast({
        title: 'Odłożono sprawę',
        description: `Nowy termin sprawy ${opp.number} to ${nextDue.toLocaleDateString('pl-PL')}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Błąd',
        description: err.message || 'Nie udało się odłożyć sprawy.',
        variant: 'destructive',
      });
    }
  };

  const handleKanbanTransition = async (oppId: string, targetPhase: PipelinePhase) => {
    try {
      await transitionPhase.mutateAsync({
        id: oppId,
        data: { targetPhase },
      });
      toast({
        title: 'Przesunięto sprawę',
        description: `Sprawa przeszła do etapu: ${
          PIPELINE_PHASES.find((p) => p.id === targetPhase)?.label || targetPhase
        }.`,
      });
    } catch (err: any) {
      if (err?.statusCode === 422 || err?.data?.error === 'STAGE_GATE_VIOLATION') {
        setStageGateError(err.data as StageGateViolationErrorData);
      } else {
        toast({
          title: 'Błąd przejścia fazy',
          description: err.message || 'Nie udało się zmienić etapu sprawy.',
          variant: 'destructive',
        });
      }
    }
  };

  const counts = queueQuery.data?.counts;

  return (
    <div className="flex flex-col min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Main Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Pipeline CRM
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
              M1 Core
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Zarządzanie sprawami, inboxem i kolejką 30-sekundowego kontaktu
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Switcher: Queue vs Board */}
          <Tabs
            value={activeView}
            onValueChange={(v: any) => setActiveView(v)}
            className="w-auto"
          >
            <TabsList className="h-9 p-0.5 bg-muted">
              <TabsTrigger value="queue" className="text-xs gap-1.5 px-3 h-8">
                <ListTodo className="w-3.5 h-3.5" />
                <span>Kolejka</span>
                {counts && counts.totalActive > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                    {counts.totalActive}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="board" className="text-xs gap-1.5 px-3 h-8">
                <KanbanSquare className="w-3.5 h-3.5" />
                <span>Tablica</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs gap-1.5"
            onClick={() => {
              queueQuery.refetch();
              oppsQuery.refetch();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Odśwież</span>
          </Button>

          <Button
            size="sm"
            variant="default"
            className="h-9 text-xs gap-1.5 bg-primary shadow-sm"
            onClick={() => setIsNewOppOpen(true)}
          >
            <Plus className="w-4 h-4" />
            <span>Nowa sprawa</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 bg-card rounded-xl border shadow-sm flex flex-col md:flex-row items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] w-full md:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj po nazwisku, firmie, telefonie, NIP lub numerze..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Filter: Doradca */}
        <div className="w-full sm:w-auto min-w-[140px]">
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Wszyscy doradcy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Wszyscy doradcy
              </SelectItem>
              {user && (
                <SelectItem value={user.id} className="text-xs font-semibold text-primary">
                  ★ Moje sprawy
                </SelectItem>
              )}
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">
                  {u.name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter: Typ klienta */}
        <div className="w-full sm:w-auto min-w-[120px]">
          <Select value={clientTypeFilter} onValueChange={setClientTypeFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Typ klienta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Wszyscy klienci
              </SelectItem>
              <SelectItem value="B2C" className="text-xs">
                B2C (Konsument)
              </SelectItem>
              <SelectItem value="B2B" className="text-xs">
                B2B (Firma)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter: Finansowanie */}
        <div className="w-full sm:w-auto min-w-[130px]">
          <Select value={financingFilter} onValueChange={setFinancingFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Finansowanie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Wszystkie formy
              </SelectItem>
              <SelectItem value="LEASING" className="text-xs">
                Leasing
              </SelectItem>
              <SelectItem value="CREDIT" className="text-xs">
                Kredyt
              </SelectItem>
              <SelectItem value="RENTAL" className="text-xs">
                Wynajem
              </SelectItem>
              <SelectItem value="CASH" className="text-xs">
                Gotówka
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter: Źródło */}
        <div className="w-full sm:w-auto min-w-[130px]">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Źródło leada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Wszystkie źródła
              </SelectItem>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main View Body */}
      {activeView === 'queue' ? (
        <QueueView
          queue={queueQuery.data}
          isLoading={queueQuery.isLoading}
          onOpenDetails={(opp) => setSelectedOppForDetails(opp)}
          onOpenLogContact={(opp) => setSelectedOppForContact(opp)}
          onOpenSetNextAction={(opp) => setSelectedOppForNextAction(opp)}
          onOpenTransition={(opp) => setSelectedOppForTransition(opp)}
          onOpenClose={(opp) => setSelectedOppForClose(opp)}
          onQuickSnooze={handleQuickSnooze}
          onQualifyLead={(lead) => setSelectedLeadForQualify(lead)}
          onDismissLead={async (lead) => {
            if (confirm(`Czy na pewno odrzucić lead od "${lead.name}" jako spam?`)) {
              await dismissLead.mutateAsync({
                leadId: lead.id,
                data: { comment: 'Odrzucony z kolejki doradcy' },
              });
              toast({ title: 'Lead odrzucony', description: 'Lead oznaczony jako spam.' });
            }
          }}
        />
      ) : (
        <BoardView
          opportunities={oppsQuery.data?.items}
          inboxLeads={inboxQuery.data?.leads}
          isLoading={oppsQuery.isLoading}
          onCardClick={(opp) => setSelectedOppForDetails(opp)}
          onTransitionPhase={handleKanbanTransition}
          onQualifyLead={(lead) => setSelectedLeadForQualify(lead)}
        />
      )}

      {/* Modals */}
      <QualifyLeadModal
        lead={selectedLeadForQualify}
        users={users}
        isOpen={Boolean(selectedLeadForQualify)}
        onClose={() => setSelectedLeadForQualify(null)}
      />

      <LogContactModal
        opportunity={selectedOppForContact}
        isOpen={Boolean(selectedOppForContact)}
        onClose={() => setSelectedOppForContact(null)}
      />

      <SetNextActionModal
        opportunity={selectedOppForNextAction}
        isOpen={Boolean(selectedOppForNextAction)}
        onClose={() => setSelectedOppForNextAction(null)}
      />

      <TransitionPhaseModal
        opportunity={selectedOppForTransition}
        isOpen={Boolean(selectedOppForTransition)}
        onClose={() => setSelectedOppForTransition(null)}
      />

      <CloseOpportunityModal
        opportunity={selectedOppForClose}
        dictionaries={dictQuery.data}
        isOpen={Boolean(selectedOppForClose)}
        onClose={() => setSelectedOppForClose(null)}
      />

      <NewOpportunityModal
        users={users}
        isOpen={isNewOppOpen}
        onClose={() => setIsNewOppOpen(false)}
      />

      <OpportunityDetailModal
        opportunityId={selectedOppForDetails?.id ?? null}
        users={users}
        dictionaries={dictQuery.data}
        isOpen={Boolean(selectedOppForDetails)}
        onClose={() => setSelectedOppForDetails(null)}
        onOpenLogContact={() => {
          setSelectedOppForContact(selectedOppForDetails);
        }}
        onOpenSetNextAction={() => {
          setSelectedOppForNextAction(selectedOppForDetails);
        }}
        onOpenTransition={() => {
          setSelectedOppForTransition(selectedOppForDetails);
        }}
        onOpenClose={() => {
          setSelectedOppForClose(selectedOppForDetails);
        }}
      />

      {/* Stage Gate Error Alert Modal */}
      <StageGateAlertModal
        isOpen={Boolean(stageGateError)}
        errorData={stageGateError}
        onClose={() => setStageGateError(null)}
      />
    </div>
  );
}
