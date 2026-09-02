import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
  PipelineOpportunitySummary,
  PipelineDictionaries,
} from '../types';
import { usePipelineMutations } from '../api/usePipeline';
import { useToast } from '@/hooks/use-toast';
import { Trophy, XCircle, Loader2 } from 'lucide-react';

export function CloseOpportunityModal({
  opportunity,
  initialStatus = 'LOST',
  dictionaries,
  isOpen,
  onClose,
  onSuccess,
}: {
  opportunity: PipelineOpportunitySummary | null;
  initialStatus?: 'WON' | 'LOST';
  dictionaries?: PipelineDictionaries;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { closeOpportunity } = usePipelineMutations();
  const { toast } = useToast();

  const [status, setStatus] = useState<'WON' | 'LOST'>(initialStatus);
  const [reasonCode, setReasonCode] = useState<string>('CUST_TERMS_REJECTED');
  const [comment, setComment] = useState<string>('');

  if (!opportunity) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await closeOpportunity.mutateAsync({
        id: opportunity.id,
        data: {
          status,
          reasonCode: status === 'LOST' ? reasonCode : undefined,
          comment: comment.trim() || undefined,
        },
      });

      toast({
        title: status === 'WON' ? '🎉 Sprawa wygrana!' : 'Sprawa zamknięta jako utracona',
        description: `Zaktualizowano status sprawy ${opportunity.number}.`,
      });

      onClose();
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: 'Błąd zamykania sprawy',
        description: err.message || 'Nie udało się zamknąć sprawy.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'WON' ? (
              <Trophy className="w-5 h-5 text-emerald-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            Zamknij sprawę: {opportunity.customer?.fullName} ({opportunity.number})
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={status === 'WON' ? 'default' : 'outline'}
              className={`h-12 flex-col gap-1 text-xs ${
                status === 'WON' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
              }`}
              onClick={() => setStatus('WON')}
            >
              <Trophy className="w-4 h-4" />
              Wygrana (WON)
            </Button>
            <Button
              type="button"
              variant={status === 'LOST' ? 'destructive' : 'outline'}
              className="h-12 flex-col gap-1 text-xs"
              onClick={() => setStatus('LOST')}
            >
              <XCircle className="w-4 h-4" />
              Utracona (LOST)
            </Button>
          </div>

          {status === 'LOST' && (
            <div className="space-y-3 border-t pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Powód utraty (słownik)</Label>
                <Select value={reasonCode} onValueChange={setReasonCode}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dictionaries?.lossReasons.map((lr) => (
                      <SelectItem key={lr.code} value={lr.code} className="text-xs">
                        {lr.label}
                      </SelectItem>
                    )) || (
                      <>
                        <SelectItem value="CUST_TERMS_REJECTED" className="text-xs">
                          Warunki nie do zaakceptowania
                        </SelectItem>
                        <SelectItem value="CUST_BOUGHT_ELSEWHERE" className="text-xs">
                          Kupił w innym miejscu
                        </SelectItem>
                        <SelectItem value="CUST_NO_CONTACT" className="text-xs">
                          Brak kontaktu
                        </SelectItem>
                        <SelectItem value="QUAL_SPAM" className="text-xs">
                          Spam / pomyłka
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Komentarz / Wyjaśnienie</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="np. Klient zrezygnował z powodu dłuższego czasu oczekiwania..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          {status === 'WON' && (
            <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-lg text-xs border border-emerald-200 dark:border-emerald-800">
              Gratulacje! Sprawa zostanie oznaczona jako wygrana z zachowaniem bieżącej fazy.
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={closeOpportunity.isPending}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={status === 'WON' ? 'default' : 'destructive'}
              disabled={closeOpportunity.isPending}
              className="gap-1.5"
            >
              {closeOpportunity.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === 'WON' ? 'Potwierdź wygraną' : 'Potwierdź zamknięcie jako utracona'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
