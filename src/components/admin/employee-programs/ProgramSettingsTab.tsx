import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Settings, Fuel, Plus, Trash2, Check, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import {
  employeeAdminApi,
  EmployeeBenefitPolicy,
  EmployeeProgramSummary
} from '@/services/employee-admin.service';

interface Props {
  program: EmployeeProgramSummary;
  token: string;
}

export const ProgramSettingsTab: React.FC<Props> = ({ program, token }) => {
  const queryClient = useQueryClient();

  // Settings form state
  const [programName, setProgramName] = useState(program.name);
  const [discountPct, setDiscountPct] = useState(program.defaultDiscountPct || '5.0');
  const [scopeIncludeNew, setScopeIncludeNew] = useState(program.scopeIncludeNew ?? false);
  const [scopeIncludeRental, setScopeIncludeRental] = useState(program.scopeIncludeRental ?? false);
  const [scopeDiscountPct, setScopeDiscountPct] = useState(program.scopeDiscountPct || '');
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  // Policy dialog state
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyName, setPolicyName] = useState('');
  const [moyaAmount, setMoyaAmount] = useState('500');
  const [fuelDiscount, setFuelDiscount] = useState('10 gr/l standard, 15 gr/l premium');
  const [consultantCare, setConsultantCare] = useState(true);
  const [termsText, setTermsText] = useState('');
  const [policyError, setPolicyError] = useState<string | null>(null);

  // Fetch benefit policies
  const { data: policiesData, isLoading: isPoliciesLoading } = useQuery({
    queryKey: ['employee-policies', program.id],
    queryFn: () => employeeAdminApi.listBenefitPolicies(program.id, token)
  });

  const updateProgramMutation = useMutation({
    mutationFn: (data: {
      name: string;
      defaultDiscountPct: number | null;
      scopeIncludeNew: boolean;
      scopeIncludeRental: boolean;
      scopeDiscountPct: number | null;
    }) =>
      employeeAdminApi.updateProgram(program.id, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-employee-companies'] });
      queryClient.invalidateQueries({ queryKey: ['employee-companies'] });
      setIsSavedSuccess(true);
      setTimeout(() => setIsSavedSuccess(false), 3000);
    }
  });

  const createPolicyMutation = useMutation({
    mutationFn: (data: { name: string; moyaCardAmount?: number | null; fuelDiscount?: string | null; consultantCare: boolean; termsText?: string | null }) =>
      employeeAdminApi.createBenefitPolicy(program.id, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-policies', program.id] });
      setIsPolicyModalOpen(false);
      setPolicyName('');
      setMoyaAmount('500');
      setFuelDiscount('10 gr/l standard, 15 gr/l premium');
      setTermsText('');
    },
    onError: (err: unknown) => {
      setPolicyError(err instanceof Error ? err.message : 'Błąd podczas tworzenia pakietu benefitów');
    }
  });

  const deletePolicyMutation = useMutation({
    mutationFn: (policyId: string) => employeeAdminApi.deleteBenefitPolicy(policyId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-policies', program.id] });
    },
    onError: (err: unknown) => {
      alert(err instanceof Error ? err.message : 'Błąd podczas usuwania pakietu benefitów');
    }
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const discNum = discountPct ? parseFloat(discountPct) : null;
    const scopeDiscNum = scopeDiscountPct ? parseFloat(scopeDiscountPct) : null;
    updateProgramMutation.mutate({
      name: programName.trim(),
      defaultDiscountPct: discNum && !isNaN(discNum) ? discNum : null,
      scopeIncludeNew,
      scopeIncludeRental,
      scopeDiscountPct: scopeDiscNum && !isNaN(scopeDiscNum) ? scopeDiscNum : null
    });
  };

  const handleCreatePolicySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPolicyError(null);
    if (!policyName.trim()) {
      setPolicyError('Nazwa pakietu jest wymagana');
      return;
    }

    const amountNum = moyaAmount ? parseInt(moyaAmount, 10) : null;
    createPolicyMutation.mutate({
      name: policyName.trim(),
      moyaCardAmount: amountNum && !isNaN(amountNum) ? amountNum : null,
      fuelDiscount: fuelDiscount.trim() || null,
      consultantCare,
      termsText: termsText.trim() || null
    });
  };

  const policies = policiesData?.policies || [];

  return (
    <div className="space-y-8">
      {/* Sekcja 1: Ogólne parametry programu */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <Settings className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-semibold text-gray-900">Ustawienia ogólne i cennik programu</h3>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-5 max-w-xl">
          <div className="space-y-1.5">
            <Label htmlFor="prog-name">Nazwa programu</Label>
            <Input
              id="prog-name"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prog-discount">Domyślny rabat globalny floty (%)</Label>
            <Input
              id="prog-discount"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Podstawowy rabat floty, stosowany jako domyślna zniżka programu pracowniczego.
            </p>
          </div>

          {/* Reguła zasięgu katalogu (Scope Rules) */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Reguła zasięgu katalogu (Scope Rules)
            </h4>

            <div className="space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scopeIncludeNew}
                  onChange={(e) => setScopeIncludeNew(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <span className="font-medium text-gray-900">
                    Automatycznie uwzględniaj nowe pojazdy z katalogu Motolii (condition = NEW)
                  </span>
                  <p className="text-gray-500">
                    Katalog pracowniczy aktualizuje się dynamicznie wraz ze stokiem nowych aut, bez konieczności ręcznego przypinania ofert.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scopeIncludeRental}
                  onChange={(e) => setScopeIncludeRental(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <span className="font-medium text-gray-900">
                    Automatycznie uwzględniaj oferty najmu długoterminowego
                  </span>
                  <p className="text-gray-500">
                    Flaga przygotowana pod integrację matryc najmu (Etap E3).
                  </p>
                </div>
              </label>
            </div>

            <div className="space-y-1.5 pt-1">
              <Label htmlFor="scope-discount" className="text-xs">Dedykowany rabat reguły zasięgu (%) - opcjonalny</Label>
              <Input
                id="scope-discount"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="Np. 8.0 (jeśli puste, obowiązuje domyślny rabat floty)"
                value={scopeDiscountPct}
                onChange={(e) => setScopeDiscountPct(e.target.value)}
                className="text-xs h-8"
              />
              <p className="text-2xs text-gray-500">
                Hierarchia cen: Własna cena oferty &gt; Rabat wyjątku &gt; Rabat reguły zasięgu &gt; Domyślny rabat floty &gt; Cena katalogowa.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <Button
              type="submit"
              disabled={updateProgramMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateProgramMutation.isPending ? 'Zapisywanie...' : 'Zapisz zmiany cennika'}
            </Button>
            {isSavedSuccess && (
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Zmiany zostały zapisane!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Sekcja 2: Pakiety benefitów Moya & Doradca */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-semibold text-gray-900">Pakiety benefitów (Karta Moya, Doradca)</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Konfiguracja dodatków przypisywanych do ofert programu pracowniczego (ADR-07).
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setIsPolicyModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Dodaj pakiet benefitu
          </Button>
        </div>

        {isPoliciesLoading ? (
          <div className="p-6 text-center text-xs text-gray-500">Ładowanie pakietów...</div>
        ) : policies.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400 italic">
            Brak zdefiniowanych pakietów benefitów dla tego programu.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policies.map((p: EmployeeBenefitPolicy) => (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900">{p.name}</span>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      Aktywny
                    </Badge>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1">
                    {p.moyaCardAmount && (
                      <div className="flex items-center gap-1.5">
                        <Fuel className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Karta paliwowa Moya: <strong>{p.moyaCardAmount} zł</strong> na start</span>
                      </div>
                    )}
                    {p.fuelDiscount && (
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Rabat paliwowy: {p.fuelDiscount}</span>
                      </div>
                    )}
                    {p.consultantCare && (
                      <div className="flex items-center gap-1.5 text-purple-700">
                        <UserCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>Indywidualna opieka doradcy Motolii</span>
                      </div>
                    )}
                    {p.termsText && (
                      <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-200/60 line-clamp-2">
                        {p.termsText}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-200/60">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={deletePolicyMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Usunąć pakiet "${p.name}"?`)) {
                        deletePolicyMutation.mutate(p.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Usuń pakiet
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog dodawania pakietu benefitu */}
      <Dialog open={isPolicyModalOpen} onOpenChange={setIsPolicyModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleCreatePolicySubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Fuel className="w-5 h-5 text-emerald-600" />
                Nowy pakiet benefitu
              </DialogTitle>
              <DialogDescription>
                Zdefiniuj warunki benefitów pracowniczych (karta Moya, rabat paliwowy, wsparcie doradcy).
              </DialogDescription>
            </DialogHeader>

            {policyError && (
              <div className="my-3 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {policyError}
              </div>
            )}

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="policy-name">Nazwa pakietu *</Label>
                <Input
                  id="policy-name"
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  placeholder="np. Pakiet Start Moya 500 PLN"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="policy-amount">Kwota zasilenia karty paliwowej (PLN)</Label>
                <Input
                  id="policy-amount"
                  type="number"
                  value={moyaAmount}
                  onChange={(e) => setMoyaAmount(e.target.value)}
                  placeholder="500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="policy-fuel-discount">Rabat paliwowy na stacjach Moya</Label>
                <Input
                  id="policy-fuel-discount"
                  value={fuelDiscount}
                  onChange={(e) => setFuelDiscount(e.target.value)}
                  placeholder="10 gr/l standard, 15 gr/l premium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="policy-terms">Warunki przyznania benefitu (notatka)</Label>
                <Textarea
                  id="policy-terms"
                  value={termsText}
                  onChange={(e) => setTermsText(e.target.value)}
                  placeholder="Karta paliwowa wydawana przy podpisaniu umowy i odbiorze pojazdu."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPolicyModalOpen(false)}>
                Anuluj
              </Button>
              <Button
                type="submit"
                disabled={createPolicyMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {createPolicyMutation.isPending ? 'Zapisywanie...' : 'Dodaj pakiet'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
