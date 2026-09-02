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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ClientType,
  FinancingType,
  LeadSourceChannel,
  LEAD_SOURCES,
  NEXT_ACTION_TYPES,
  UserSummary,
} from '../types';
import { usePipelineMutations } from '../api/usePipeline';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { PlusCircle, Loader2 } from 'lucide-react';
import { format, addHours } from 'date-fns';

export function NewOpportunityModal({
  users,
  isOpen,
  onClose,
  onSuccess,
}: {
  users: UserSummary[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const { createOpportunity } = usePipelineMutations();
  const { toast } = useToast();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyNip, setCompanyNip] = useState('');
  const [clientType, setClientType] = useState<ClientType>('B2C');
  const [financingType, setFinancingType] = useState<FinancingType | ''>('LEASING');
  const [leadSource, setLeadSource] = useState<LeadSourceChannel>('ORGANIC');
  const [leadSourceDetail, setLeadSourceDetail] = useState('');
  const [ownerUserId, setOwnerUserId] = useState<string>(user?.id ?? '');
  const [nextActionType, setNextActionType] = useState('CALL_FIRST');
  const [nextActionDueAt, setNextActionDueAt] = useState(
    format(addHours(new Date(), 2), "yyyy-MM-dd'T'HH:mm")
  );
  const [nextActionNote, setNextActionNote] = useState('Wstępna rozmowa z klientem');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast({ title: 'Wymagane dane', description: 'Podaj imię i nazwisko klienta.', variant: 'destructive' });
      return;
    }

    try {
      const created = await createOpportunity.mutateAsync({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        customerEmail: customerEmail.trim() || null,
        companyName: clientType === 'B2B' ? companyName.trim() || null : null,
        companyNip: clientType === 'B2B' ? companyNip.trim() || null : null,
        clientType,
        financingType: (financingType as FinancingType) || null,
        leadSource,
        leadSourceDetail: leadSourceDetail.trim() || null,
        ownerUserId: ownerUserId || null,
        nextActionType,
        nextActionDueAt: nextActionDueAt ? new Date(nextActionDueAt).toISOString() : null,
        nextActionNote: nextActionNote.trim() || null,
      });

      toast({
        title: 'Sprawa utworzona',
        description: `Sprawa ${created.number} została pomyślnie dodana do kolejki.`,
      });

      onClose();
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: 'Błąd tworzenia sprawy',
        description: err.message || 'Nie udało się utworzyć sprawy.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-primary" />
            Nowa sprawa (ręczne wprowadzenie)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Imię i nazwisko *</Label>
              <Input
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Jan Kowalski"
                className="h-9 text-xs"
              />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Telefon</Label>
              <Input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+48 600 000 000"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="jan@firma.pl"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {clientType === 'B2B' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border">
              <div className="space-y-1.5">
                <Label className="text-xs">Nazwa firmy</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Kowalski Sp. z o.o."
                  className="h-9 text-xs bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">NIP</Label>
                <Input
                  value={companyNip}
                  onChange={(e) => setCompanyNip(e.target.value)}
                  placeholder="5250000000"
                  className="h-9 text-xs bg-background"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-primary">
                Źródło leada (atrybucja) *
              </Label>
              <Select
                value={leadSource}
                onValueChange={(val) => setLeadSource(val as LeadSourceChannel)}
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

            <div className="space-y-1.5">
              <Label className="text-xs">Szczegóły źródła</Label>
              <Input
                value={leadSourceDetail}
                onChange={(e) => setLeadSourceDetail(e.target.value)}
                placeholder="np. Telefon od dealera BMW"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Finansowanie</Label>
              <Select
                value={financingType}
                onValueChange={(val) => setFinancingType(val as FinancingType)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Wybierz finansowanie" />
                </SelectTrigger>
                <SelectContent>
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
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="text-xs font-semibold text-foreground">Kolejna akcja</div>
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
                <Label className="text-xs">Termin</Label>
                <Input
                  type="datetime-local"
                  value={nextActionDueAt}
                  onChange={(e) => setNextActionDueAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notatka</Label>
              <Input
                value={nextActionNote}
                onChange={(e) => setNextActionNote(e.target.value)}
                placeholder="np. Przygotować propozycję finansowania"
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
              disabled={createOpportunity.isPending}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createOpportunity.isPending}
              className="gap-1.5"
            >
              {createOpportunity.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Utwórz sprawę
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
