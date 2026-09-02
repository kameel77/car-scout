import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { StageGateViolationErrorData, PIPELINE_PHASES } from '../types';

export function StageGateAlertModal({
  errorData,
  isOpen,
  onClose,
}: {
  errorData: StageGateViolationErrorData | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!errorData) return null;

  const targetPhaseLabel =
    PIPELINE_PHASES.find((p) => p.id === errorData.targetPhase)?.label ||
    errorData.targetPhase;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-6 w-6" />
            <DialogTitle className="text-lg font-bold">
              Wymagane dane do przejścia
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="py-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Aby przesunąć sprawę do etapu{' '}
            <span className="font-semibold text-foreground">
              {targetPhaseLabel}
            </span>
            , musisz najpierw uzupełnić następujące wymagane informacje (twarda bramka):
          </p>

          <div className="rounded-lg border bg-amber-500/10 border-amber-500/20 p-3 space-y-2">
            {errorData.missing.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground block">
                    ({item.fieldPath})
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Wskazówka: Uzupełnij brakujące dane w odpowiedniej zakładce szczegółów sprawy (Oferta / Pojazd / Wniosek / Klient).
          </p>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full sm:w-auto">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Rozumiem, uzupełnię dane
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
