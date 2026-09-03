import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Car,
  CheckCircle2,
  Plus,
  Trash2,
  Star,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { VehicleCandidateSummary } from '../types';
import { usePipelineMutations } from '../api/usePipeline';
import { useToast } from '@/hooks/use-toast';

export function VehicleCandidatesSection({
  opportunityId,
  candidates,
  onRefresh,
}: {
  opportunityId: string;
  candidates: VehicleCandidateSummary[];
  onRefresh?: () => void;
}) {
  const { addVehicleCandidate, selectVehicleCandidate, removeVehicleCandidate } =
    usePipelineMutations();
  const { toast } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [customMake, setCustomMake] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [customVersion, setCustomVersion] = useState('');
  const [customYear, setCustomYear] = useState<string>('');
  const [pricePln, setPricePln] = useState<string>('');
  const [listingId, setListingId] = useState('');

  const handleAddCustom = async () => {
    if (!customMake || !customModel) {
      toast({
        title: 'Brak danych',
        description: 'Podaj co najmniej markę i model pojazdu',
        variant: 'destructive',
      });
      return;
    }

    const priceSnapshotGrosze = pricePln ? Math.round(parseFloat(pricePln) * 100) : null;
    const yearInt = customYear ? parseInt(customYear, 10) : null;

    try {
      await addVehicleCandidate.mutateAsync({
        opportunityId,
        data: {
          customMake,
          customModel,
          customVersion: customVersion || null,
          customYear: yearInt,
          priceSnapshotGrosze,
          listingId: listingId || null,
          selectionStatus: candidates.length === 0 ? 'SELECTED' : 'CANDIDATE',
        },
      });

      toast({
        title: 'Dodano pojazd',
        description: `${customMake} ${customModel} dodany do propozycji`,
      });

      setIsAddModalOpen(false);
      setCustomMake('');
      setCustomModel('');
      setCustomVersion('');
      setCustomYear('');
      setPricePln('');
      setListingId('');
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd dodawania pojazdu',
        description: e.message || 'Wystąpił błąd',
        variant: 'destructive',
      });
    }
  };

  const handleSelect = async (candidateId: string) => {
    try {
      await selectVehicleCandidate.mutateAsync({
        opportunityId,
        candidateId,
      });
      toast({
        title: 'Zmieniono auto główne',
        description: 'Pojazd został oznaczony jako wybrany',
      });
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd wyboru',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (candidateId: string) => {
    try {
      await removeVehicleCandidate.mutateAsync({
        opportunityId,
        candidateId,
      });
      toast({
        title: 'Usunięto pojazd',
        description: 'Propozycja pojazdu została usunięta',
      });
      onRefresh?.();
    } catch (err: unknown) {
      const e = err as Error;
      toast({
        title: 'Błąd usuwania',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Propozycje pojazdów ({candidates.length})</h3>
          <p className="text-xs text-muted-foreground">
            Wybierz 1 pojazd główny, na który przygotowywana jest oferta i wniosek.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Dodaj pojazd
        </Button>
      </div>

      {candidates.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground space-y-2">
          <Car className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm">Brak dodanych propozycji pojazdów dla tej sprawy.</p>
          <Button size="sm" variant="outline" onClick={() => setIsAddModalOpen(true)}>
            Dodaj pierwszy pojazd
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {candidates.map((cand) => {
            const isSelected = cand.selectionStatus === 'SELECTED';
            const make = cand.listing?.make || cand.customMake || 'Nieznana marka';
            const model = cand.listing?.model || cand.customModel || 'Nieznany model';
            const year = cand.listing?.productionYear || cand.customYear;
            const price = cand.priceSnapshotGrosze
              ? (cand.priceSnapshotGrosze / 100).toLocaleString('pl-PL') + ' zł'
              : cand.listing?.pricePln
              ? Number(cand.listing.pricePln).toLocaleString('pl-PL') + ' zł'
              : null;

            return (
              <div
                key={cand.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-md ${
                      isSelected ? 'bg-emerald-500/20 text-emerald-600' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Car className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {make} {model} {year ? `(${year})` : ''}
                      </span>
                      {isSelected && (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] px-1.5 py-0 h-4 gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Główne auto
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {cand.customVersion && <span>Wersja: {cand.customVersion}</span>}
                      {price && <span className="font-medium text-foreground">{price}</span>}
                      {cand.listingId && (
                        <span className="flex items-center gap-0.5 text-blue-600">
                          Stok <ExternalLink className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {!isSelected && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleSelect(cand.id)}
                      disabled={selectVehicleCandidate.isPending}
                    >
                      <Star className="h-3 w-3 mr-1 text-amber-500" />
                      Wybierz główne
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                    onClick={() => handleRemove(cand.id)}
                    disabled={removeVehicleCandidate.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add vehicle modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dodaj pojazd do sprawy</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="make" className="text-xs">
                  Marka *
                </Label>
                <Input
                  id="make"
                  placeholder="np. Toyota"
                  value={customMake}
                  onChange={(e) => setCustomMake(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model" className="text-xs">
                  Model *
                </Label>
                <Input
                  id="model"
                  placeholder="np. Corolla"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="version" className="text-xs">
                  Wersja / Silnik
                </Label>
                <Input
                  id="version"
                  placeholder="np. 1.8 Hybrid Comfort"
                  value={customVersion}
                  onChange={(e) => setCustomVersion(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year" className="text-xs">
                  Rocznik
                </Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="np. 2024"
                  value={customYear}
                  onChange={(e) => setCustomYear(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price" className="text-xs">
                Cena brutto (PLN)
              </Label>
              <Input
                id="price"
                type="number"
                placeholder="np. 125000"
                value={pricePln}
                onChange={(e) => setPricePln(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="listingId" className="text-xs">
                ID ogłoszenia ze stoku (opcjonalne)
              </Label>
              <Input
                id="listingId"
                placeholder="np. clx..."
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleAddCustom}
              disabled={addVehicleCandidate.isPending}
            >
              {addVehicleCandidate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Zapisz pojazd
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
