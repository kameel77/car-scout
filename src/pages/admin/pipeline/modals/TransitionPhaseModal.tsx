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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PipelineOpportunitySummary,
  PipelinePhase,
  PIPELINE_PHASES,
} from '../types';
import { usePipelineMutations } from '../api/usePipeline';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Loader2, GitCommit } from 'lucide-react';

export function TransitionPhaseModal({
  opportunity,
  targetPhaseInitial,
  isOpen,
  onClose,
  onSuccess,
}: {
  opportunity: PipelineOpportunitySummary | null;
  targetPhaseInitial?: PipelinePhase;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { transitionPhase } = usePipelineMutations();
  const { toast } = useToast();

  const currentIdx = opportunity
    ? PIPELINE_PHASES.findIndex((p) => p.id === opportunity.phase)
    : -1;
  const nextPhaseDefault =
    targetPhaseInitial ||
    (currentIdx >= 0 && currentIdx < PIPELINE_PHASES.length - 1
      ? PIPELINE_PHASES[currentIdx + 1].id
      : 'SELECTION');

  const [targetPhase, setTargetPhase] = useState<PipelinePhase>(nextPhaseDefault);

  if (!opportunity) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await transitionPhase.mutateAsync({
        id: opportunity.id,
        data: {
          targetPhase,
        },
      });

      toast({
        title: 'Faza zmieniona',
        description: `Sprawa ${opportunity.number} przeszła do etapu: ${
          PIPELINE_PHASES.find((p) => p.id === targetPhase)?.label
        }.`,
      });

      onClose();
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: 'Błąd zmiany etapu',
        description: err.message || 'Nie udało się zmienić etapu.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-primary" />
            Zmień etap sprawy: {opportunity.number}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted/40 rounded-lg text-xs flex items-center justify-between border">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                Obecny etap
              </span>
              <span className="font-semibold text-foreground">
                {PIPELINE_PHASES.find((p) => p.id === opportunity.phase)?.label}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                Nowy etap
              </span>
              <span className="font-semibold text-primary">
                {PIPELINE_PHASES.find((p) => p.id === targetPhase)?.label}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Wybierz docelowy etap</Label>
            <Select
              value={targetPhase}
              onValueChange={(val) => setTargetPhase(val as PipelinePhase)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_PHASES.filter((p) => p.id !== 'INBOX').map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.label} - {p.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={transitionPhase.isPending}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={transitionPhase.isPending}
              className="gap-1.5"
            >
              {transitionPhase.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Zmień etap
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
