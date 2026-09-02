import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOpportunityDetails, usePipelineMutations } from '../api/usePipeline';
import { PhaseBadge } from '../components/PhaseBadge';
import { NextActionBadge } from '../components/NextActionBadge';
import { LeadSourceBadge } from '../components/LeadSourceBadge';
import { PIPELINE_PHASES, UserSummary, PipelineDictionaries } from '../types';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Phone,
  Mail,
  Building2,
  Calendar,
  History,
  Car,
  FileText,
  User,
  PhoneCall,
  Clock,
  ArrowRight,
  Trophy,
  XCircle,
  Loader2,
  CheckCircle2,
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
  const { data: opp, isLoading } = useOpportunityDetails(opportunityId);
  const [activeTab, setActiveTab] = useState<'timeline' | 'vehicles' | 'customer'>('timeline');

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
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
                  <h2 className="text-xl font-bold text-foreground">
                    {opp.customer?.fullName}
                  </h2>
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
                <TabsList className="grid grid-cols-3 mb-4">
                  <TabsTrigger value="timeline" className="text-xs gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Oś zdarzeń ({opp.events?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="vehicles" className="text-xs gap-1.5">
                    <Car className="w-3.5 h-3.5" />
                    Pojazdy ({opp.vehicleCandidates?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="customer" className="text-xs gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Klient i kontakt
                  </TabsTrigger>
                </TabsList>

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
                                {ev.type === 'OPPORTUNITY_FIRST_CONTACT' && (
                                  <p>
                                    Pierwszy kontakt via <span className="font-medium text-foreground">{ev.payload.channel}</span> po{' '}
                                    {Math.round(ev.payload.secondsFromFirstTouch / 60)} min od wejścia leada.
                                  </p>
                                )}
                                {ev.type === 'OPPORTUNITY_LOST' && (
                                  <p className="text-red-600 dark:text-red-400">
                                    Powód: {ev.payload.reasonCode} {ev.payload.comment && `— "${ev.payload.comment}"`}
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

                <TabsContent value="vehicles" className="space-y-3">
                  {opp.vehicleCandidates && opp.vehicleCandidates.length > 0 ? (
                    opp.vehicleCandidates.map((vc) => {
                      const title =
                        vc.listing
                          ? `${vc.listing.make} ${vc.listing.model} ${vc.listing.version || ''}`
                          : vc.rentalVehicle
                          ? `${vc.rentalVehicle.make} ${vc.rentalVehicle.model}`
                          : `${vc.customMake || ''} ${vc.customModel || ''}`.trim() || 'Pojazd';
                      const year =
                        vc.listing?.productionYear ||
                        vc.rentalVehicle?.productionYear ||
                        vc.customYear;
                      const price =
                        vc.priceSnapshotGrosze
                          ? (vc.priceSnapshotGrosze / 100).toLocaleString('pl-PL') + ' zł'
                          : vc.listing?.pricePln
                          ? Number(vc.listing.pricePln).toLocaleString('pl-PL') + ' zł'
                          : null;

                      return (
                        <div
                          key={vc.id}
                          className="p-4 bg-muted/30 rounded-lg border flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm">{title}</span>
                              {year && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {year}
                                </span>
                              )}
                              <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                                Wybrany do oferty
                              </span>
                            </div>
                            {price && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Cena snapshot: <span className="font-semibold text-foreground">{price}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center p-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                      Brak przypisanych kandydatów pojazdu w tej sprawie.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="customer" className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/30 rounded-lg border space-y-2">
                      <span className="font-bold text-foreground text-sm block mb-1">
                        Dane kontaktowe
                      </span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 text-primary" />
                        <span className="text-foreground font-medium">{opp.customer?.phone || 'Brak telefonu'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4 text-primary" />
                        <span className="text-foreground font-medium">{opp.customer?.email || 'Brak e-mail'}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg border space-y-2">
                      <span className="font-bold text-foreground text-sm block mb-1">
                        Atrybucja i pochodzenie
                      </span>
                      <div>
                        Źródło: <span className="font-semibold text-foreground">{opp.leadSource}</span>
                        {opp.leadSourceDetail && ` (${opp.leadSourceDetail})`}
                      </div>
                      <div>
                        Data wejścia:{' '}
                        <span className="font-medium text-foreground">
                          {format(new Date(opp.firstTouchAt), 'd MMMM yyyy, HH:mm', { locale: pl })}
                        </span>
                      </div>
                      <div>
                        Czas do 1. kontaktu:{' '}
                        <span className="font-medium text-foreground">
                          {opp.firstContactAt
                            ? format(new Date(opp.firstContactAt), 'd MMM yyyy, HH:mm', { locale: pl })
                            : 'Brak kontaktu'}
                        </span>
                      </div>
                    </div>
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
