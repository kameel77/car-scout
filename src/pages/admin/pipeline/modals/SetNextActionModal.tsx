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
import { PipelineOpportunitySummary, NEXT_ACTION_TYPES } from '../types';
import { usePipelineMutations } from '../api/usePipeline';
import { useToast } from '@/hooks/use-toast';
import { Clock, Loader2 } from 'lucide-react';
import { format, addDays, addHours } from 'date-fns';

export function SetNextActionModal({
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
  const { setNextAction } = usePipelineMutations();
  const { toast } = useToast();

  const [nextActionType, setNextActionType] = useState<string>(
    opportunity?.nextActionType || 'CALL_FOLLOWUP'
  );
  const [nextActionDueAt, setNextActionDueAt] = useState<string>(
    opportunity?.nextActionDueAt
      ? format(new Date(opportunity.nextActionDueAt), "yyyy-MM-dd'T'HH:mm")
      : format(addDays(new Date(), 1), "yyyy-MM-dd'T'10:00")
  );
  const [nextActionNote, setNextActionNote] = useState<string>(
    opportunity?.nextActionNote || ''
  );

  if (!opportunity) return null;

  const handleQuickSnooze = (days: number) => {
    const target = addDays(new Date(), days);
    target.setHours(10, 0, 0, 0);
    setNextActionDueAt(format(target, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setNextAction.mutateAsync({
        id: opportunity.id,
        data: {
          nextActionType,
          nextActionDueAt: nextActionDueAt ? new Date(nextActionDueAt).toISOString() : null,
          nextActionNote: nextActionNote.trim() || null,
        },
      });

      toast({
        title: 'Termin zaktualizowany',
        description: `Zaktualizowano kolejną akcję dla sprawy ${opportunity.number}.`,
      });

      onClose();
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: 'Błąd zapisu',
        description: err.message || 'Nie udało się zaktualizować terminu.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Zaplanuj kolejną akcję: {opportunity.customer?.fullName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              onClick={() => handleQuickSnooze(1)}
            >
              +1 dzień (Jutro)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              onClick={() => handleQuickSnooze(3)}
            >
              +3 dni
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              onClick={() => handleQuickSnooze(7)}
            >
              +1 tydzień
            </Button>
          </div>

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
            <Label className="text-xs">Dokładna data i godzina</Label>
            <Input
              type="datetime-local"
              value={nextActionDueAt}
              onChange={(e) => setNextActionDueAt(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notatka / Zadanie</Label>
            <Input
              value={nextActionNote}
              onChange={(e) => setNextActionNote(e.target.value)}
              placeholder="np. Dopytać o preferowany okres finansowania"
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={setNextAction.isPending}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={setNextAction.isPending}
              className="gap-1.5"
            >
              {setNextAction.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Zapisz termin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
