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
import { PipelineOpportunitySummary, NEXT_ACTION_TYPES } from '../types';
import { usePipelineMutations } from '../api/usePipeline';
import { useToast } from '@/hooks/use-toast';
import { PhoneCall, Mail, MessageSquare, Users2, Loader2, Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';

export function LogContactModal({
  opportunity,
  isOpen,
  onClose,
  onSuccess,
}: {
  opportunity: PipelineOpportunitySummary | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { logContact } = usePipelineMutations();
  const { toast } = useToast();

  const [channel, setChannel] = useState<'CALL' | 'EMAIL' | 'SMS' | 'MEETING'>('CALL');
  const [note, setNote] = useState('');
  const [nextActionType, setNextActionType] = useState('CALL_FOLLOWUP');
  const [nextActionDueAt, setNextActionDueAt] = useState(
    format(addDays(new Date(), 2), "yyyy-MM-dd'T'10:00")
  );
  const [nextActionNote, setNextActionNote] = useState('Follow-up po rozmowie');

  if (!opportunity) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await logContact.mutateAsync({
        id: opportunity.id,
        data: {
          channel,
          note: note.trim() || undefined,
          nextActionType,
          nextActionDueAt: nextActionDueAt ? new Date(nextActionDueAt).toISOString() : null,
          nextActionNote: nextActionNote.trim() || undefined,
        },
      });

      toast({
        title: 'Kontakt zarejestrowany',
        description: `Zalogowano kontakt i zaktualizowano kolejną akcję dla sprawy ${opportunity.number}.`,
      });

      onClose();
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: 'Błąd zapisu',
        description: err.message || 'Nie udało się zarejestrować kontaktu.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-primary" />
            Zaloguj kontakt: {opportunity.customer?.fullName} ({opportunity.number})
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Kanał kontaktu</Label>
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant={channel === 'CALL' ? 'default' : 'outline'}
                size="sm"
                className="text-xs flex-col gap-1 h-14"
                onClick={() => setChannel('CALL')}
              >
                <PhoneCall className="w-4 h-4" />
                Telefon
              </Button>
              <Button
                type="button"
                variant={channel === 'EMAIL' ? 'default' : 'outline'}
                size="sm"
                className="text-xs flex-col gap-1 h-14"
                onClick={() => setChannel('EMAIL')}
              >
                <Mail className="w-4 h-4" />
                E-mail
              </Button>
              <Button
                type="button"
                variant={channel === 'SMS' ? 'default' : 'outline'}
                size="sm"
                className="text-xs flex-col gap-1 h-14"
                onClick={() => setChannel('SMS')}
              >
                <MessageSquare className="w-4 h-4" />
                SMS
              </Button>
              <Button
                type="button"
                variant={channel === 'MEETING' ? 'default' : 'outline'}
                size="sm"
                className="text-xs flex-col gap-1 h-14"
                onClick={() => setChannel('MEETING')}
              >
                <Users2 className="w-4 h-4" />
                Spotkanie
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notatka z rozmowy / ustaleń</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="np. Klient potwierdził chęć leasingu na 3 lata z wpłatą 15%..."
              rows={3}
              className="text-xs"
            />
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Zaplanuj kolejny krok
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
              <Label className="text-xs">Cel kolejnego kroku</Label>
              <Input
                value={nextActionNote}
                onChange={(e) => setNextActionNote(e.target.value)}
                placeholder="np. Przedstawić ofertę leasingu Santander"
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
              disabled={logContact.isPending}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={logContact.isPending}
              className="gap-1.5"
            >
              {logContact.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Zapisz kontakt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
