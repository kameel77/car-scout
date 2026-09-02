import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  Shuffle,
  Plus,
  Send,
  Loader2,
  Ban,
} from 'lucide-react';
import {
  PipelineApplicationSummary,
  PipelineDictionaries,
} from '../types';
import { usePipelineMutations } from '../api/usePipeline';
import { useToast } from '@/hooks/use-toast';

export function ApplicationsRerouteSection({
  opportunityId,
  applications,
  dictionaries,
  onRefresh,
}: {
  opportunityId: string;
  applications: PipelineApplicationSummary[];
  dictionaries?: PipelineDictionaries;
  onRefresh?: () => void;
  onSelectApplication?: (app: PipelineApplicationSummary) => void;
}) {
  const {
    createApplication,
    submitApplication,
    decideApplication,
    rerouteApplication,
  } = usePipelineMutations();
  const { toast } = useToast();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isDecideModalOpen, setIsDecideModalOpen] = useState(false);
  const [isRerouteModalOpen, setIsRerouteModalOpen] = useState(false);

  const [selectedApp, setSelectedApp] = useState<PipelineApplicationSummary | null>(null);
  const [selectedFinancierId, setSelectedFinancierId] = useState('');
  const [roundMode, setRoundMode] = useState<'JOIN_CURRENT' | 'NEW_ROUND'>('JOIN_CURRENT');
  const [targetFinancierId, setTargetFinancierId] = useState('');
  const [submitStage, setSubmitStage] = useState<'PRECHECK' | 'FULL'>('PRECHECK');
  const [externalReference, setExternalReference] = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'CONDITIONALLY_APPROVED' | 'REJECTED'>('APPROVED');
  const [rejectionReasonCode, setRejectionReasonCode] = useState('');
  const [rejectionComment, setRejectionComment] = useState('');

  const financiers = dictionaries?.financiers || [];
  const financierLossReasons =
    dictionaries?.lossReasons.filter((r) => r.category === 'FINANCIER') || [];

  const handleCreateApplication = async () => {
    if (!selectedFinancierId) {
      toast({
        title: 'Wybierz finansującego',
        description: 'Wybierz instytucję finansową z listy',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createApplication.mutateAsync({
        opportunityId,
        data: {
          financierId: selectedFinancierId,
          roundMode,
        },
      });

      toast({
        title: 'Utworzono wniosek',
        description: 'Wniosek został pomyślnie zarejestrowany',
      });
      setIsCreateModalOpen(false);
      setSelectedFinancierId('');
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd tworzenia wniosku',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedApp) return;

    try {
      await submitApplication.mutateAsync({
        applicationId: selectedApp.id,
        data: {
          stage: submitStage,
          externalReference: externalReference.trim() || undefined,
        },
      });

      toast({
        title: submitStage === 'PRECHECK' ? 'Złożono pre-check' : 'Złożono pełny wniosek',
        description: 'Status wniosku został zaktualizowany',
      });
      setIsSubmitModalOpen(false);
      setExternalReference('');
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd składania wniosku',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const handleDecide = async () => {
    if (!selectedApp) return;

    if (decision === 'REJECTED' && !rejectionReasonCode) {
      toast({
        title: 'Wymagany powód',
        description: 'Wybierz powód odrzucenia wniosku z listy',
        variant: 'destructive',
      });
      return;
    }

    const reasonObj = financierLossReasons.find((r) => r.code === rejectionReasonCode);
    if (decision === 'REJECTED' && reasonObj?.requiresComment && !rejectionComment.trim()) {
      toast({
        title: 'Wymagany komentarz',
        description: 'Ten powód odrzucenia wymaga wpisania komentarza',
        variant: 'destructive',
      });
      return;
    }

    try {
      await decideApplication.mutateAsync({
        applicationId: selectedApp.id,
        data: {
          decision,
          rejectionReasonCode: decision === 'REJECTED' ? rejectionReasonCode : undefined,
          rejectionComment: decision === 'REJECTED' ? rejectionComment.trim() : undefined,
        },
      });

      toast({
        title: 'Zarejestrowano decyzję',
        description:
          decision === 'APPROVED'
            ? 'Zgoda finansowania przyznana'
            : decision === 'CONDITIONALLY_APPROVED'
            ? 'Zgoda warunkowa'
            : 'Odrzucenie wniosku (Negat)',
      });
      setIsDecideModalOpen(false);
      setRejectionReasonCode('');
      setRejectionComment('');
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd rejestracji decyzji',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const handleReroute = async () => {
    if (!selectedApp || !targetFinancierId) {
      toast({
        title: 'Wybierz docelowego finansującego',
        description: 'Wskaż nową instytucję finansową do reroutingu',
        variant: 'destructive',
      });
      return;
    }

    try {
      await rerouteApplication.mutateAsync({
        applicationId: selectedApp.id,
        data: {
          targetFinancierId,
        },
      });

      toast({
        title: 'Przepięto wniosek (Reroute)',
        description: 'Otwarto kolejną rundę w procesie decyzyjnym',
      });
      setIsRerouteModalOpen(false);
      setTargetFinancierId('');
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd reroutingu',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (
    state: string,
    reasonCode?: string | null,
    withdrawalReasonCode?: string | null
  ) => {
    switch (state) {
      case 'DRAFT':
        return (
          <Badge variant="outline" className="text-xs">
            Szkic (Nie wysłano)
          </Badge>
        );
      case 'PRECHECK_SUBMITTED':
        return (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">
            <Clock className="h-3 w-3 mr-1" /> Pre-check złożony
          </Badge>
        );
      case 'FULL_SUBMITTED':
        return (
          <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30 text-xs">
            <Send className="h-3 w-3 mr-1" /> Pełny wniosek złożony
          </Badge>
        );
      case 'APPROVED':
        return (
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Zgoda finansowa
          </Badge>
        );
      case 'CONDITIONALLY_APPROVED':
        return (
          <Badge className="bg-amber-600 text-white hover:bg-amber-700 text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" /> Zgoda warunkowa
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge className="bg-rose-600 text-white hover:bg-rose-700 text-xs">
            <XCircle className="h-3 w-3 mr-1" /> Odrzucenie (Negat)
          </Badge>
        );
      case 'WITHDRAWN':
        return (
          <Badge variant="secondary" className="text-xs text-muted-foreground">
            <Ban className="h-3 w-3 mr-1" />
            {withdrawalReasonCode === 'CONTRACTED_ELSEWHERE' ? 'Wycofany (inna umowa)' : 'Wycofany'}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{state}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Wnioski leasingowe i partnerzy finansowi</h3>
          <p className="text-xs text-muted-foreground">
            Obsługa wniosków równoległych w rundzie oraz łańcuch reroutingu po odrzuceniu.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          className="h-8 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          {applications.length === 0 ? 'Wybierz finansującego' : 'Dodaj wniosek (Równolegle)'}
        </Button>
      </div>

      {applications.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground space-y-2">
          <Building2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm">Brak zarejestrowanych wniosków u finansujących dla tej sprawy.</p>
          <Button size="sm" variant="outline" onClick={() => setIsCreateModalOpen(true)}>
            Wskaż partnera finansowego
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const financierName = app.financier?.name || 'Finansujący';
            const reasonLabel = financierLossReasons.find(
              (r) => r.code === app.rejectionReasonCode
            )?.label;

            return (
              <div
                key={app.id}
                className={`p-4 rounded-lg border bg-card space-y-3 ${
                  app.state === 'WITHDRAWN' ? 'opacity-60 bg-muted/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-md bg-blue-500/10 text-blue-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {financierName}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4">
                          Runda #{app.roundNumber ?? app.attemptSequence ?? 1}
                        </Badge>
                        {getStatusBadge(app.state, app.rejectionReasonCode, app.withdrawalReasonCode)}
                      </div>
                      {app.externalReference && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Nr ref: <span className="font-mono text-foreground">{app.externalReference}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {app.state === 'DRAFT' && (
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => {
                          setSelectedApp(app);
                          setIsSubmitModalOpen(true);
                        }}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Złóż wniosek
                      </Button>
                    )}

                    {(app.state === 'PRECHECK_SUBMITTED' || app.state === 'FULL_SUBMITTED') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => {
                          setSelectedApp(app);
                          setIsDecideModalOpen(true);
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Zarejestruj decyzję
                      </Button>
                    )}

                    {app.state === 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        onClick={() => {
                          setSelectedApp(app);
                          setIsRerouteModalOpen(true);
                        }}
                      >
                        <Shuffle className="h-3.5 w-3.5" />
                        Reroute (Przepnij)
                      </Button>
                    )}
                  </div>
                </div>

                {app.rerouteFrom && (
                  <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded flex items-center gap-1.5">
                    <Shuffle className="h-3 w-3 text-muted-foreground" />
                    <span>Przepięto z:</span>
                    <span className="font-medium text-foreground">
                      {app.rerouteFrom.financier?.name || 'Poprzedni finansujący'}
                    </span>
                  </div>
                )}

                {app.state === 'REJECTED' && (
                  <div className="text-xs bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-2.5 rounded-md text-rose-800 dark:text-rose-300 space-y-1">
                    <div className="flex items-center gap-1 font-semibold">
                      <XCircle className="h-3.5 w-3.5 text-rose-600" />
                      <span>Powód odrzucenia: {reasonLabel || app.rejectionReasonCode}</span>
                    </div>
                    {app.rejectionComment && (
                      <p className="text-rose-700/80 dark:text-rose-400 pl-4.5 italic">
                        „{app.rejectionComment}”
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Application */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wskaż instytucję finansową</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Wybierz finansującego *</Label>
              <Select value={selectedFinancierId} onValueChange={setSelectedFinancierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz bank / leasingodawcę" />
                </SelectTrigger>
                <SelectContent>
                  {financiers.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {applications.length > 0 && (
              <div className="space-y-2">
                <Label>Tryb rundy</Label>
                <Select
                  value={roundMode}
                  onValueChange={(val: any) => setRoundMode(val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JOIN_CURRENT">
                      Dołącz do bieżącej rundy (Wniosek równoległy)
                    </SelectItem>
                    <SelectItem value="NEW_ROUND">
                      Otwórz nową rundę
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Wnioski równoległe w tej samej rundzie pozwalają na jednoczesne procesowanie ofert u wielu partnerów.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleCreateApplication} disabled={createApplication.isPending}>
              {createApplication.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Utwórz wniosek
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Submit Application */}
      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Złożenie wniosku u finansującego</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Etap złożenia</Label>
              <Select
                value={submitStage}
                onValueChange={(v: 'PRECHECK' | 'FULL') => setSubmitStage(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRECHECK">Pre-check (Uproszczona weryfikacja)</SelectItem>
                  <SelectItem value="FULL">Pełny wniosek leasingowy / kredytowy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Zewnętrzny numer referencyjny (opcjonalnie)</Label>
              <Input
                placeholder="np. WN/2026/09/VEH-9812"
                value={externalReference}
                onChange={(e) => setExternalReference(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubmitModalOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={submitApplication.isPending}>
              {submitApplication.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Potwierdź złożenie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Decide Application */}
      <Dialog open={isDecideModalOpen} onOpenChange={setIsDecideModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejestracja decyzji finansującego</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Decyzja *</Label>
              <Select
                value={decision}
                onValueChange={(v: 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'REJECTED') =>
                  setDecision(v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVED">Pozytywna (Zgoda)</SelectItem>
                  <SelectItem value="CONDITIONALLY_APPROVED">Warunkowa (Wymogi)</SelectItem>
                  <SelectItem value="REJECTED">Negatywna (Odrzucenie)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {decision === 'REJECTED' && (
              <>
                <div className="space-y-2">
                  <Label>Powód odrzucenia (Słownik FINANCIER) *</Label>
                  <Select
                    value={rejectionReasonCode}
                    onValueChange={setRejectionReasonCode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz oficjalny powód odrzucenia" />
                    </SelectTrigger>
                    <SelectContent>
                      {financierLossReasons.map((r) => (
                        <SelectItem key={r.code} value={r.code}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Komentarz / Uzasadnienie{' '}
                    {financierLossReasons.find((r) => r.code === rejectionReasonCode)
                      ?.requiresComment && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    placeholder="Szczegóły decyzji analityka..."
                    value={rejectionComment}
                    onChange={(e) => setRejectionComment(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDecideModalOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleDecide} disabled={decideApplication.isPending}>
              {decideApplication.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Zapisz decyzję
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Reroute Application */}
      <Dialog open={isRerouteModalOpen} onOpenChange={setIsRerouteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Przepięcie wniosku (Reroute)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Reroute tworzy nową rundę u kolejnego partnera finansowego z zachowaniem historii odrzucenia i wraca do etapu decyzji finansowej bez blokowania sprawy.
            </p>

            <div className="space-y-2">
              <Label>Nowy finansujący *</Label>
              <Select value={targetFinancierId} onValueChange={setTargetFinancierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz nowego partnera" />
                </SelectTrigger>
                <SelectContent>
                  {financiers
                    .filter((f) => f.id !== selectedApp?.financierId)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name} ({f.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRerouteModalOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleReroute} disabled={rerouteApplication.isPending}>
              {rerouteApplication.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Przepnij wniosek
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
