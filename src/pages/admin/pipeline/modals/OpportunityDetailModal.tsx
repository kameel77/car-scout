import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOpportunityDetails, usePipelineMutations } from '../api/usePipeline';
import { useToast } from '@/hooks/use-toast';
import { PhaseBadge } from '../components/PhaseBadge';
import { NextActionBadge } from '../components/NextActionBadge';
import { LeadSourceBadge } from '../components/LeadSourceBadge';
import {
  PIPELINE_PHASES,
  UserSummary,
  PipelineDictionaries,
  ClientType,
  FinancingType,
  LeadSourceChannel,
  LEAD_SOURCES,
} from '../types';
import { VehicleCandidatesSection } from '../components/VehicleCandidatesSection';
import { OfferEditorSection } from '../components/OfferEditorSection';
import { ApplicationsRerouteSection } from '../components/ApplicationsRerouteSection';
import { DocumentChecklistSection } from '../components/DocumentChecklistSection';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Phone,
  Mail,
  Building2,
  History,
  Car,
  FileText,
  User,
  PhoneCall,
  Clock,
  ArrowRight,
  Loader2,
  Calculator,
  Shuffle,
  Edit,
  Save,
  X,
} from 'lucide-react';

export function OpportunityDetailModal({
  opportunityId,
  users,
  dictionaries,
  isOpen,
  onClose,
  onOpenLogContact,
  onOpenSetNextAction,
  onOpenTransition,
  onOpenClose,
}: {
  opportunityId: string | null;
  users: UserSummary[];
  dictionaries?: PipelineDictionaries;
  isOpen: boolean;
  onClose: () => void;
  onOpenLogContact?: () => void;
  onOpenSetNextAction?: () => void;
  onOpenTransition?: () => void;
  onOpenClose?: () => void;
}) {
  const { data: opp, isLoading, refetch } = useOpportunityDetails(opportunityId);
  const { patchOpportunity } = usePipelineMutations();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<
    'timeline' | 'vehicles' | 'offer' | 'applications' | 'documents' | 'customer'
  >('offer');

  // Customer Edit State
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custCompanyName, setCustCompanyName] = useState('');
  const [custCompanyNip, setCustCompanyNip] = useState('');
  const [custClientType, setCustClientType] = useState<ClientType>('UNKNOWN');
  const [custFinancingType, setCustFinancingType] = useState<FinancingType | ''>('');
  const [custLeadSource, setCustLeadSource] = useState<LeadSourceChannel>('ORGANIC');
  const [custLeadSourceDetail, setCustLeadSourceDetail] = useState('');

  useEffect(() => {
    if (opp) {
      setCustName(opp.customer?.fullName || '');
      setCustPhone(opp.customer?.phone || '');
      setCustEmail(opp.customer?.email || '');
      setCustCompanyName(opp.customer?.companyName || '');
      setCustCompanyNip(opp.customer?.companyNip || '');
      setCustClientType(opp.customer?.clientType || opp.clientType || 'UNKNOWN');
      setCustFinancingType(opp.financingType || '');
      setCustLeadSource(opp.leadSource || 'ORGANIC');
      setCustLeadSourceDetail(opp.leadSourceDetail || '');
      setIsEditingCustomer(false);
    }
  }, [opp]);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opp) return;

    if (!custName.trim()) {
      toast({
        title: 'Błąd walidacji',
        description: 'Imię i nazwisko klienta jest wymagane.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await patchOpportunity.mutateAsync({
        id: opp.id,
        data: {
          customerName: custName.trim(),
          customerPhone: custPhone.trim() || null,
          customerEmail: custEmail.trim() || null,
          companyName: custCompanyName.trim() || null,
          companyNip: custCompanyNip.trim() || null,
          clientType: custClientType,
          financingType: custFinancingType ? (custFinancingType as FinancingType) : null,
          leadSource: custLeadSource,
          leadSourceDetail: custLeadSourceDetail.trim() || null,
        },
      });

      toast({
        title: 'Zaktualizowano dane klienta',
        description: 'Dane klienta i sprawy zostały pomyślnie zapisane.',
      });

      setIsEditingCustomer(false);
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Błąd zapisu',
        description: message || 'Nie udało się zaktualizować danych klienta.',
        variant: 'destructive',
      });
    }
  };

  if (!isOpen) return null;

  const selectedVehicle = opp?.vehicleCandidates?.find(
    (v) => v.selectionStatus === 'SELECTED'
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {isLoading || !opp ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b bg-muted/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-muted-foreground">
                      {opp.number}
                    </span>
                    <PhaseBadge phase={opp.phase} />
                    {opp.status === 'WON' && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        WYGRANA
                      </span>
                    )}
                    {opp.status === 'LOST' && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                        UTRACONA ({opp.lostReasonCode})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">
                      {opp.customer?.fullName}
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      title="Edytuj dane klienta"
                      onClick={() => {
                        setActiveTab('customer');
                        setIsEditingCustomer(true);
                      }}
                    >
                      <Edit className="w-3.5 h-3.5 text-primary" />
                    </Button>
                  </div>
                  {opp.customer?.companyName && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{opp.customer.companyName}</span>
                      {opp.customer.companyNip && <span>(NIP: {opp.customer.companyNip})</span>}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <LeadSourceBadge source={opp.leadSource} detail={opp.leadSourceDetail} />
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                      {opp.clientType}
                    </span>
                    {opp.financingType && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                        {opp.financingType}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Doradca: <span className="font-medium text-foreground">{opp.owner?.name || opp.owner?.email || 'Brak'}</span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t">
                <div>
                  <NextActionBadge
                    actionType={opp.nextActionType}
                    dueAt={opp.nextActionDueAt}
                    note={opp.nextActionNote}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={onOpenLogContact}
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-primary" />
                    Zaloguj kontakt
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={onOpenSetNextAction}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Zmień termin
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 text-xs gap-1.5"
                    onClick={onOpenTransition}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Przesuń etap
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={onOpenClose}
                  >
                    Zamknij...
                  </Button>
                </div>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="flex-1 overflow-y-auto p-6">
              <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
                <TabsList className="grid grid-cols-6 mb-4">
                  <TabsTrigger value="offer" className="text-xs gap-1">
                    <Calculator className="w-3.5 h-3.5" />
                    Oferta
                  </TabsTrigger>
                  <TabsTrigger value="vehicles" className="text-xs gap-1">
                    <Car className="w-3.5 h-3.5" />
                    Pojazdy ({opp.vehicleCandidates?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="applications" className="text-xs gap-1">
                    <Shuffle className="w-3.5 h-3.5" />
                    Wnioski ({opp.applications?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    Dokumenty ({opp.documents?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs gap-1">
                    <History className="w-3.5 h-3.5" />
                    Oś ({opp.events?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="customer" className="text-xs gap-1">
                    <User className="w-3.5 h-3.5" />
                    Klient
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Offer */}
                <TabsContent value="offer">
                  <OfferEditorSection
                    opportunityId={opp.id}
                    offers={opp.offers || []}
                    defaultFinancingType={opp.financingType}
                    selectedVehiclePriceGrosze={
                      selectedVehicle?.priceSnapshotGrosze ??
                      (selectedVehicle?.listing?.pricePln
                        ? Math.round(Number(selectedVehicle.listing.pricePln) * 100)
                        : null)
                    }
                    onRefresh={refetch}
                  />
                </TabsContent>

                {/* Tab: Vehicles */}
                <TabsContent value="vehicles">
                  <VehicleCandidatesSection
                    opportunityId={opp.id}
                    candidates={opp.vehicleCandidates || []}
                    onRefresh={refetch}
                  />
                </TabsContent>

                {/* Tab: Applications & Reroute */}
                <TabsContent value="applications">
                  <ApplicationsRerouteSection
                    opportunityId={opp.id}
                    applications={opp.applications || []}
                    dictionaries={dictionaries}
                    onRefresh={refetch}
                  />
                </TabsContent>

                {/* Tab: Documents */}
                <TabsContent value="documents">
                  <DocumentChecklistSection
                    opportunityId={opp.id}
                    documents={opp.documents || []}
                    onRefresh={refetch}
                  />
                </TabsContent>

                {/* Tab: Timeline */}
                <TabsContent value="timeline" className="space-y-3">
                  {opp.events && opp.events.length > 0 ? (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                      {opp.events.map((ev) => {
                        const dateStr = format(new Date(ev.occurredAt), 'd MMM yyyy, HH:mm:ss', {
                          locale: pl,
                        });
                        return (
                          <div key={ev.id} className="relative group text-xs">
                            <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                            <div className="p-3 bg-muted/30 hover:bg-muted/60 transition-colors rounded-lg border">
                              <div className="flex items-center justify-between font-semibold text-foreground mb-1">
                                <span className="font-mono text-primary text-[11px]">
                                  {ev.type}
                                </span>
                                <span className="text-[11px] text-muted-foreground font-normal">
                                  {dateStr}
                                </span>
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {ev.type === 'NOTE_ADDED' && (
                                  <p className="font-normal italic text-foreground">
                                    {ev.payload.content}
                                  </p>
                                )}
                                {ev.type === 'OPPORTUNITY_PHASE_CHANGED' && (
                                  <p>
                                    Przejście z fazy <span className="font-medium text-foreground">{ev.payload.before}</span> na{' '}
                                    <span className="font-medium text-foreground">{ev.payload.after}</span> (czas w poprzedniej fazie:{' '}
                                    {Math.round(ev.payload.durationSeconds / 60)} min).
                                  </p>
                                )}
                                {ev.type === 'OFFER_CREATED' && (
                                  <p>
                                    Utworzono ofertę v{ev.payload.versionNumber}:{' '}
                                    {(ev.payload.priceGrosze / 100).toLocaleString('pl-PL')} zł, rata{' '}
                                    {(ev.payload.monthlyRateGrosze / 100).toLocaleString('pl-PL')} zł/mc ({ev.payload.periodMonths} mc).
                                  </p>
                                )}
                                {ev.type === 'OFFER_UPDATED' && (
                                  <p>
                                    Zaktualizowano ofertę w miejscu (zmieniono: {Object.keys(ev.payload.after || {}).join(', ')}).
                                  </p>
                                )}
                                {ev.type === 'OFFER_SUPERSEDED' && (
                                  <p>
                                    Unieważniono ofertę v{ev.payload.versionNumber} na rzecz nowej wersji.
                                  </p>
                                )}
                                {ev.type === 'APPLICATION_CREATED' && (
                                  <p>
                                    Utworzono wniosek do {ev.payload.financierCode} (próba #{ev.payload.attemptSequence}).
                                  </p>
                                )}
                                {ev.type === 'APPLICATION_SUBMITTED' && (
                                  <p>
                                    Złożono {ev.payload.stage === 'PRECHECK' ? 'Pre-check' : 'Pełny wniosek'} do {ev.payload.financierCode}
                                    {ev.payload.externalReference && ` (ref: ${ev.payload.externalReference})`}.
                                  </p>
                                )}
                                {ev.type === 'APPLICATION_DECIDED' && (
                                  <p>
                                    Decyzja {ev.payload.financierCode}: <span className="font-semibold">{ev.payload.decision}</span>
                                    {ev.payload.reasonCode && ` (powód: ${ev.payload.reasonCode})`}.
                                  </p>
                                )}
                                {ev.type === 'APPLICATION_REROUTED' && (
                                  <p className="text-amber-600 dark:text-amber-400 font-medium">
                                    Przepięto wniosek: {ev.payload.fromFinancierCode} → {ev.payload.toFinancierCode} (powód poprzedniej odmowy: {ev.payload.rejectionReasonCode}).
                                  </p>
                                )}
                                {ev.type === 'DOCUMENT_REQUESTED' && (
                                  <p>
                                    Poproszono klienta o dokument: {ev.payload.label || ev.payload.code}.
                                  </p>
                                )}
                                {ev.type === 'DOCUMENT_RECEIVED' && (
                                  <p className="text-emerald-600 dark:text-emerald-400">
                                    Otrzymano dokument: {ev.payload.code} (po {ev.payload.hoursSinceRequest}h).
                                  </p>
                                )}
                                {ev.type === 'DOCUMENT_VERIFIED' && (
                                  <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    Zweryfikowano dokument: {ev.payload.code}.
                                  </p>
                                )}
                                {ev.type === 'VEHICLE_CANDIDATE_ADDED' && (
                                  <p>
                                    Dodano propozycję pojazdu: {ev.payload.label}.
                                  </p>
                                )}
                                {ev.type === 'VEHICLE_SELECTED' && (
                                  <p className="font-medium text-emerald-600">
                                    Oznaczono pojazd jako główne auto sprawy.
                                  </p>
                                )}
                                {ev.type === 'OPPORTUNITY_FIRST_CONTACT' && (
                                  <p>
                                    Pierwszy kontakt via <span className="font-medium text-foreground">{ev.payload.channel}</span> po{' '}
                                    {Math.round(ev.payload.secondsFromFirstTouch / 60)} min od wejścia leada.
                                  </p>
                                )}
                                {ev.type === 'OPPORTUNITY_LOST' && (
                                  <p className="text-red-600 dark:text-red-400">
                                    Powód utraty: {ev.payload.reasonCode} {ev.payload.comment && `— "${ev.payload.comment}"`}
                                  </p>
                                )}
                                {ev.type === 'OPPORTUNITY_WON' && (
                                  <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    Sukces! Sprawa sfinalizowana wygraną.
                                  </p>
                                )}
                                {ev.type === 'OPPORTUNITY_NEXT_ACTION_SET' && (
                                  <p>
                                    Ustawiono termin:{' '}
                                    <span className="font-medium text-foreground">{ev.payload.after?.type}</span> na{' '}
                                    {ev.payload.after?.dueAt ? format(new Date(ev.payload.after.dueAt), 'd MMM HH:mm') : 'brak'}
                                    {ev.payload.after?.note && ` (${ev.payload.after.note})`}
                                  </p>
                                )}
                              </div>
                              {ev.actorLabel && (
                                <div className="text-[10px] text-muted-foreground/70 mt-1">
                                  Aktor: {ev.actorLabel}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center p-8 text-xs text-muted-foreground">
                      Brak zarejestrowanych zdarzeń.
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Customer */}
                <TabsContent value="customer" className="space-y-4">
                  <div className="p-4 rounded-lg border bg-card space-y-4 text-sm">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">Dane klienta i profil sprawy</h3>
                        <p className="text-xs text-muted-foreground">
                          Zarządzaj danymi kontaktowymi, firmowymi i parametrami sprawy.
                        </p>
                      </div>
                      {!isEditingCustomer ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => setIsEditingCustomer(true)}
                        >
                          <Edit className="w-3.5 h-3.5 text-primary" />
                          Edytuj dane
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-muted-foreground"
                          onClick={() => {
                            if (opp) {
                              setCustName(opp.customer?.fullName || '');
                              setCustPhone(opp.customer?.phone || '');
                              setCustEmail(opp.customer?.email || '');
                              setCustCompanyName(opp.customer?.companyName || '');
                              setCustCompanyNip(opp.customer?.companyNip || '');
                              setCustClientType(opp.customer?.clientType || opp.clientType || 'UNKNOWN');
                              setCustFinancingType(opp.financingType || '');
                              setCustLeadSource(opp.leadSource || 'ORGANIC');
                              setCustLeadSourceDetail(opp.leadSourceDetail || '');
                            }
                            setIsEditingCustomer(false);
                          }}
                        >
                          <X className="w-3.5 h-3.5" />
                          Anuluj
                        </Button>
                      )}
                    </div>

                    {!isEditingCustomer ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs text-muted-foreground block">Imię i nazwisko klienta</span>
                            <span className="font-semibold text-foreground text-base">
                              {opp.customer?.fullName}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Typ klienta</span>
                            <span className="font-semibold text-foreground">
                              {opp.customer?.clientType || opp.clientType}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Telefon</span>
                            {opp.customer?.phone ? (
                              <a
                                href={`tel:${opp.customer.phone}`}
                                className="font-medium text-primary hover:underline flex items-center gap-1.5"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                {opp.customer.phone}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">Brak</span>
                            )}
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">E-mail</span>
                            {opp.customer?.email ? (
                              <a
                                href={`mailto:${opp.customer.email}`}
                                className="font-medium text-primary hover:underline flex items-center gap-1.5"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                {opp.customer.email}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">Brak</span>
                            )}
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Forma finansowania</span>
                            <span className="font-semibold text-foreground">
                              {opp.financingType || 'Nie ustalono'}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Źródło leada</span>
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <LeadSourceBadge source={opp.leadSource} detail={opp.leadSourceDetail} />
                            </span>
                          </div>
                        </div>

                        {(opp.customer?.companyName || opp.customer?.companyNip) && (
                          <div className="pt-3 border-t grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs text-muted-foreground block">Nazwa firmy</span>
                              <span className="font-semibold text-foreground block">
                                {opp.customer.companyName || 'Brak'}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground block">NIP</span>
                              <span className="font-semibold text-foreground block font-mono">
                                {opp.customer.companyNip || 'Brak'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={handleSaveCustomer} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Imię i nazwisko klienta *</Label>
                            <Input
                              value={custName}
                              onChange={(e) => setCustName(e.target.value)}
                              placeholder="np. Jan Kowalski"
                              className="h-9 text-xs"
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Typ klienta</Label>
                            <Select
                              value={custClientType}
                              onValueChange={(val) => setCustClientType(val as ClientType)}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UNKNOWN" className="text-xs">
                                  Nie określono (UNKNOWN)
                                </SelectItem>
                                <SelectItem value="B2C" className="text-xs">
                                  Konsument (B2C)
                                </SelectItem>
                                <SelectItem value="B2B" className="text-xs">
                                  Firma (B2B)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Telefon</Label>
                            <Input
                              value={custPhone}
                              onChange={(e) => setCustPhone(e.target.value)}
                              placeholder="+48..."
                              className="h-9 text-xs"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">E-mail</Label>
                            <Input
                              type="email"
                              value={custEmail}
                              onChange={(e) => setCustEmail(e.target.value)}
                              placeholder="klient@email.pl"
                              className="h-9 text-xs"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Forma finansowania</Label>
                            <Select
                              value={custFinancingType || 'none'}
                              onValueChange={(val) => setCustFinancingType(val === 'none' ? '' : (val as FinancingType))}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Nie ustalono" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs text-muted-foreground">
                                  Nie ustalono
                                </SelectItem>
                                <SelectItem value="LEASING" className="text-xs">
                                  Leasing operacyjny / finansowy
                                </SelectItem>
                                <SelectItem value="CREDIT" className="text-xs">
                                  Kredyt samochodowy
                                </SelectItem>
                                <SelectItem value="RENTAL" className="text-xs">
                                  Wynajem długoterminowy
                                </SelectItem>
                                <SelectItem value="CASH" className="text-xs">
                                  Gotówka / Zakup bezpośredni
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Kanał źródła</Label>
                            <Select
                              value={custLeadSource}
                              onValueChange={(val) => setCustLeadSource(val as LeadSourceChannel)}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LEAD_SOURCES.map((s) => (
                                  <SelectItem key={s.id} value={s.id} className="text-xs">
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {custClientType === 'B2B' && (
                          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 border rounded-lg">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Nazwa firmy</Label>
                              <Input
                                value={custCompanyName}
                                onChange={(e) => setCustCompanyName(e.target.value)}
                                placeholder="np. Moja Firma Sp. z o.o."
                                className="h-9 text-xs"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">NIP firmy</Label>
                              <Input
                                value={custCompanyNip}
                                onChange={(e) => setCustCompanyNip(e.target.value)}
                                placeholder="np. 5250000000"
                                className="h-9 text-xs"
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label className="text-xs">Szczegóły źródła / Kampania / UTM</Label>
                          <Input
                            value={custLeadSourceDetail}
                            onChange={(e) => setCustLeadSourceDetail(e.target.value)}
                            placeholder="np. Kampania FB Q3 Leasing Promocja"
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            disabled={patchOpportunity.isPending}
                            onClick={() => setIsEditingCustomer(false)}
                          >
                            Anuluj
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            className="gap-1.5 text-xs"
                            disabled={patchOpportunity.isPending}
                          >
                            {patchOpportunity.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            Zapisz dane klienta
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
