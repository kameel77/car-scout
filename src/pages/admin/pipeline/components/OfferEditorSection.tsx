import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calculator,
  CheckCircle2,
  Send,
  CopyPlus,
  Save,
  Loader2,
  FileCheck2,
  Clock,
} from 'lucide-react';
import { PipelineOfferSummary, FinancingType } from '../types';
import { usePipelineMutations } from '../api/usePipeline';
import { useToast } from '@/hooks/use-toast';

export function OfferEditorSection({
  opportunityId,
  offers,
  defaultFinancingType,
  selectedVehiclePriceGrosze,
  onRefresh,
}: {
  opportunityId: string;
  offers: PipelineOfferSummary[];
  defaultFinancingType?: FinancingType | null;
  selectedVehiclePriceGrosze?: number | null;
  onRefresh?: () => void;
}) {
  const {
    createOrUpdateOffer,
    supersedeOffer,
    presentOffer,
    acceptOffer,
  } = usePipelineMutations();
  const { toast } = useToast();

  const activeOffer = offers.find((o) => o.status !== 'SUPERSEDED') || offers[0];

  const [financingType, setFinancingType] = useState<FinancingType>(
    activeOffer?.financingType || defaultFinancingType || 'LEASING'
  );
  const [pricePln, setPricePln] = useState<string>(
    activeOffer
      ? String(activeOffer.priceGrosze / 100)
      : selectedVehiclePriceGrosze
      ? String(selectedVehiclePriceGrosze / 100)
      : '100000'
  );
  const [downPaymentPln, setDownPaymentPln] = useState<string>(
    activeOffer ? String(activeOffer.downPaymentGrosze / 100) : '10000'
  );
  const [periodMonths, setPeriodMonths] = useState<string>(
    activeOffer ? String(activeOffer.periodMonths) : '60'
  );
  const [finalPaymentPln, setFinalPaymentPln] = useState<string>(
    activeOffer?.finalPaymentGrosze ? String(activeOffer.finalPaymentGrosze / 100) : '25000'
  );
  const [monthlyRatePln, setMonthlyRatePln] = useState<string>(
    activeOffer ? String(activeOffer.monthlyRateGrosze / 100) : ''
  );

  // Sync state when activeOffer changes
  useEffect(() => {
    if (activeOffer) {
      setFinancingType(activeOffer.financingType);
      setPricePln(String(activeOffer.priceGrosze / 100));
      setDownPaymentPln(String(activeOffer.downPaymentGrosze / 100));
      setPeriodMonths(String(activeOffer.periodMonths));
      setFinalPaymentPln(
        activeOffer.finalPaymentGrosze ? String(activeOffer.finalPaymentGrosze / 100) : '0'
      );
      setMonthlyRatePln(String(activeOffer.monthlyRateGrosze / 100));
    }
  }, [activeOffer?.id]);

  // Client-side quick recalculation helper
  const handleRecalculate = () => {
    const price = parseFloat(pricePln) || 0;
    const down = parseFloat(downPaymentPln) || 0;
    const finalVal = parseFloat(finalPaymentPln) || 0;
    const months = parseInt(periodMonths, 10) || 60;

    const amountToFinance = price - down;
    const annualRate = 5.85 + 2.5; // WIBOR + marża
    const monthlyRate = annualRate / 100 / 12;

    let pmt: number;
    if (monthlyRate === 0) {
      pmt = (amountToFinance - finalVal) / months;
    } else {
      const pow = Math.pow(1 + monthlyRate, months);
      pmt = (amountToFinance * monthlyRate - (finalVal * monthlyRate) / pow) / (1 - 1 / pow);
    }

    const calculated = Math.max(0, Math.round(pmt));
    setMonthlyRatePln(String(calculated));
    return calculated;
  };

  const handleSave = async () => {
    const priceGrosze = Math.round((parseFloat(pricePln) || 0) * 100);
    const downPaymentGrosze = Math.round((parseFloat(downPaymentPln) || 0) * 100);
    const finalPaymentGrosze = Math.round((parseFloat(finalPaymentPln) || 0) * 100);
    const months = parseInt(periodMonths, 10) || 60;
    let rateGrosze = Math.round((parseFloat(monthlyRatePln) || 0) * 100);

    if (rateGrosze <= 0) {
      rateGrosze = handleRecalculate() * 100;
    }

    if (priceGrosze <= 0) {
      toast({
        title: 'Nieprawidłowa cena',
        description: 'Cena pojazdu musi być większa od zera',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createOrUpdateOffer.mutateAsync({
        opportunityId,
        data: {
          financingType,
          priceGrosze,
          downPaymentGrosze,
          periodMonths: months,
          finalPaymentGrosze,
          monthlyRateGrosze: rateGrosze,
        },
      });

      toast({
        title: 'Zapisano ofertę',
        description: 'Parametry oferty zostały zaktualizowane',
      });
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd zapisu',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const handleSupersede = async () => {
    const priceGrosze = Math.round((parseFloat(pricePln) || 0) * 100);
    const downPaymentGrosze = Math.round((parseFloat(downPaymentPln) || 0) * 100);
    const finalPaymentGrosze = Math.round((parseFloat(finalPaymentPln) || 0) * 100);
    const months = parseInt(periodMonths, 10) || 60;
    let rateGrosze = Math.round((parseFloat(monthlyRatePln) || 0) * 100);

    if (rateGrosze <= 0) {
      rateGrosze = handleRecalculate() * 100;
    }

    try {
      await supersedeOffer.mutateAsync({
        opportunityId,
        data: {
          financingType,
          priceGrosze,
          downPaymentGrosze,
          periodMonths: months,
          finalPaymentGrosze,
          monthlyRateGrosze: rateGrosze,
        },
      });

      toast({
        title: 'Utworzono nowy wariant oferty',
        description: `Nowa wersja v${(activeOffer?.versionNumber || 1) + 1} została przygotowana`,
      });
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd tworzenia wersji',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const handlePresent = async () => {
    if (!activeOffer) return;
    try {
      await presentOffer.mutateAsync({
        opportunityId,
        offerId: activeOffer.id,
        data: { channel: 'EMAIL' },
      });
      toast({
        title: 'Oferta przedstawiona',
        description: 'Zarejestrowano wysłanie oferty do klienta',
      });
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const handleAccept = async () => {
    if (!activeOffer) return;
    try {
      await acceptOffer.mutateAsync({
        opportunityId,
        offerId: activeOffer.id,
      });
      toast({
        title: 'Oferta zaakceptowana!',
        description: 'Klient zaakceptował warunki oferty',
      });
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Oferta i kalkulacja</h3>
            {activeOffer && (
              <Badge variant="outline" className="text-xs">
                Wersja v{activeOffer.versionNumber}
              </Badge>
            )}
            {activeOffer?.status === 'ACCEPTED' && (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Zaakceptowana
              </Badge>
            )}
            {activeOffer?.presentedAt && activeOffer.status !== 'ACCEPTED' && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" /> Przedstawiona
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Edycja parametrów w miejscu z natychmiastowym przeliczaniem raty.
          </p>
        </div>

        {activeOffer && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSupersede}
            disabled={supersedeOffer.isPending}
            className="h-8 gap-1.5 text-xs"
          >
            <CopyPlus className="h-3.5 w-3.5" />
            Nowy wariant (Supersede)
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Produkt finansowy *</Label>
            <Select
              value={financingType}
              onValueChange={(val) => setFinancingType(val as FinancingType)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LEASING">Leasing operacyjny</SelectItem>
                <SelectItem value="CREDIT">Kredyt samochodowy</SelectItem>
                <SelectItem value="RENTAL">Wynajem długoterminowy</SelectItem>
                <SelectItem value="CASH">Zakup za gotówkę</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cena pojazdu (PLN brutto) *</Label>
            <Input
              type="number"
              className="h-9 font-medium"
              value={pricePln}
              onChange={(e) => setPricePln(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Wpłata własna (PLN)</Label>
            <Input
              type="number"
              className="h-9"
              value={downPaymentPln}
              onChange={(e) => setDownPaymentPln(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Okres finansowania (mc) *</Label>
            <Select value={periodMonths} onValueChange={setPeriodMonths}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 miesiące</SelectItem>
                <SelectItem value="36">36 miesięcy</SelectItem>
                <SelectItem value="48">48 miesięcy</SelectItem>
                <SelectItem value="60">60 miesięcy</SelectItem>
                <SelectItem value="72">72 miesiące</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Wykup / Rata końcowa (PLN)</Label>
            <Input
              type="number"
              className="h-9"
              value={finalPaymentPln}
              onChange={(e) => setFinalPaymentPln(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Rata miesięczna (PLN) *
              </Label>
              <button
                type="button"
                onClick={handleRecalculate}
                className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
              >
                <Calculator className="h-2.5 w-2.5" /> Przelicz
              </button>
            </div>
            <Input
              type="number"
              className="h-9 font-bold text-emerald-600 dark:text-emerald-400"
              value={monthlyRatePln}
              onChange={(e) => setMonthlyRatePln(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between pt-2 border-t gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={createOrUpdateOffer.isPending}
              className="gap-1.5"
            >
              {createOrUpdateOffer.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Zapisz ofertę
            </Button>
          </div>

          {activeOffer && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePresent}
                disabled={presentOffer.isPending}
                className="text-xs gap-1.5"
              >
                <Send className="h-3 w-3 text-blue-600" />
                Przedstawiono klientowi
              </Button>
              {activeOffer.status !== 'ACCEPTED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAccept}
                  disabled={acceptOffer.isPending}
                  className="text-xs gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  <FileCheck2 className="h-3 w-3 text-emerald-600" />
                  Klient zaakceptował
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
