import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  InboxLeadSummary,
  ClientType,
  FinancingType,
  NEXT_ACTION_TYPES,
  UserSummary,
} from '../types';
import { usePipelineMutations } from '../api/usePipeline';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { UserCheck, Sparkles, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export function QualifyLeadModal({
  lead,
  users,
  isOpen,
  onClose,
  onSuccess,
}: {
  lead: InboxLeadSummary | null;
  users: UserSummary[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const { qualifyLead } = usePipelineMutations();
  const { toast } = useToast();

  const [ownerUserId, setOwnerUserId] = useState<string>(user?.id ?? '');
  const [clientType, setClientType] = useState<ClientType>('B2C');
  const [financingType, setFinancingType] = useState<FinancingType | ''>('LEASING');
  const [nextActionType, setNextActionType] = useState<string>('CALL_FIRST');
  const [nextActionDueAt, setNextActionDueAt] = useState<string>(
    format(new Date(Date.now() + 30 * 60 * 1000), "yyyy-MM-dd'T'HH:mm")
  );
  const [nextActionNote, setNextActionNote] = useState<string>('Pierwszy kontakt z klientem');

  if (!lead) return null;

  const vehicleName =
    lead.listing
      ? `${lead.listing.make} ${lead.listing.model} (${lead.listing.productionYear ?? ''})`
      : lead.rentalVehicle
      ? `${lead.rentalVehicle.make} ${lead.rentalVehicle.model}`
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await qualifyLead.mutateAsync({
        leadId: lead.id,
        data: {
          ownerUserId: ownerUserId || null,
          clientType,
          financingType: (financingType as FinancingType) || null,
          nextActionType,
          nextActionDueAt: nextActionDueAt ? new Date(nextActionDueAt).toISOString() : null,
          nextActionNote: nextActionNote.trim() || null,
        },
      });

      toast({
        title: 'Lead zakwalifikowany',
        description: `Sprawa została utworzona i przypisana do doradcy.`,
      });

      onClose();
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: 'Błąd kwalifikacji',
        description: err.message || 'Nie udało się zakwalifikować leada.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Kwalifikacja leada do Pipeline
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1 border">
            <div className="flex justify-between font-medium">
              <span className="text-foreground">{lead.name}</span>
              <span className="text-muted-foreground">{lead.phone || lead.email}</span>
            </div>
            {vehicleName && (
              <div className="text-primary font-medium">Auto: {vehicleName}</div>
            )}
            {lead.message && (
              <div className="text-muted-foreground italic line-clamp-2">
                "{lead.message}"
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Przypisany doradca</Label>
              <Select value={ownerUserId} onValueChange={setOwnerUserId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Wybierz doradcę" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak przypisania</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Typ klienta</Label>
              <Select
                value={clientType}
                onValueChange={(val) => setClientType(val as ClientType)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B2C" className="text-xs">
                    Konsument (B2C)
                  </SelectItem>
                  <SelectItem value="B2B" className="text-xs">
                    Firma (B2B)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Forma finansowania</Label>
            <Select
              value={financingType}
              onValueChange={(val) => setFinancingType(val as FinancingType)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Wybierz finansowanie" />
              </SelectTrigger>
              <SelectContent>
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

          <div className="border-t pt-3 space-y-3">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Kolejna akcja (SLA i termin)
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Typ akcji</Label>
                <Select value={nextActionType} onValueChange={setNextActionType}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NEXT_ACTION_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Termin realizacji</Label>
                <Input
                  type="datetime-local"
                  value={nextActionDueAt}
                  onChange={(e) => setNextActionDueAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notatka do akcji</Label>
              <Input
                value={nextActionNote}
                onChange={(e) => setNextActionNote(e.target.value)}
                placeholder="np. Zadzwonić w sprawie dostępności"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={qualifyLead.isPending}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={qualifyLead.isPending}
              className="gap-1.5"
            >
              {qualifyLead.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Utwórz sprawę i dodaj do kolejki
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
