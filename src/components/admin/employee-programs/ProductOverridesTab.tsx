import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Loader2, Check, AlertCircle } from 'lucide-react';
import {
  employeeAdminApi,
  EmployeeProductOverrideRow,
  ContractPartyOption,
  ProductAvailabilityStatus
} from '@/services/employee-admin.service';

interface Props {
  programId: string;
  token: string;
}

interface EditableOverride {
  isEnabled: boolean;
  b2cStatus: ProductAvailabilityStatus;
  allowedContractParties: ContractPartyOption[];
  minDownPaymentPct: string;
  maxDownPaymentPct: string;
  allowedPeriods: number[];
}

const CONTRACT_PARTY_LABELS: Record<ContractPartyOption, string> = {
  CONSUMER: 'Osoba prywatna (Konsument)',
  EMPLOYEE_B2B: 'Działalność gospodarcza (B2B)',
  EMPLOYER_COMPANY: 'Firma pracodawcy'
};

const B2C_STATUS_LABELS: Record<ProductAvailabilityStatus, string> = {
  AVAILABLE: 'Potwierdzona dostępność',
  REQUIRES_CONFIRMATION: 'Wymaga potwierdzenia',
  UNAVAILABLE: 'Niedostępne'
};

function buildPeriodOptions(min: number, max: number): number[] {
  const periods: number[] = [];
  for (let p = 12; p <= max; p += 12) {
    if (p >= min) periods.push(p);
  }
  return periods;
}

function defaultEditableOverride(row: EmployeeProductOverrideRow): EditableOverride {
  if (row.override) {
    return {
      isEnabled: row.override.isEnabled,
      b2cStatus: row.override.b2cStatus,
      allowedContractParties: row.override.allowedContractParties,
      minDownPaymentPct: row.override.minDownPaymentPct != null ? String(row.override.minDownPaymentPct) : '',
      maxDownPaymentPct: row.override.maxDownPaymentPct != null ? String(row.override.maxDownPaymentPct) : '',
      allowedPeriods: row.override.allowedPeriods
    };
  }
  return {
    isEnabled: false,
    b2cStatus: 'REQUIRES_CONFIRMATION',
    allowedContractParties: ['EMPLOYEE_B2B', 'EMPLOYER_COMPANY'],
    minDownPaymentPct: '',
    maxDownPaymentPct: '',
    allowedPeriods: []
  };
}

export const ProductOverridesTab: React.FC<Props> = ({ programId, token }) => {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, EditableOverride>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['employee-product-overrides', programId],
    queryFn: () => employeeAdminApi.listProductOverrides(programId, token)
  });

  const products = data?.products || [];

  useEffect(() => {
    if (!data) return;
    const initial: Record<string, EditableOverride> = {};
    for (const row of data.products) {
      initial[row.productId] = defaultEditableOverride(row);
    }
    setEdits(initial);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (overrides: Array<{
      financingProductId: string;
      isEnabled: boolean;
      b2cStatus: ProductAvailabilityStatus;
      allowedContractParties: ContractPartyOption[];
      minDownPaymentPct: number | null;
      maxDownPaymentPct: number | null;
      allowedPeriods: number[];
    }>) => employeeAdminApi.updateProductOverrides(programId, { overrides }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-product-overrides', programId] });
      setError(null);
      setIsSavedSuccess(true);
      setTimeout(() => setIsSavedSuccess(false), 3000);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Błąd podczas zapisywania nadpisań produktów');
    }
  });

  const updateEdit = (productId: string, patch: Partial<EditableOverride>) => {
    setEdits((prev) => ({ ...prev, [productId]: { ...prev[productId], ...patch } }));
  };

  const toggleContractParty = (productId: string, party: ContractPartyOption) => {
    setEdits((prev) => {
      const current = prev[productId];
      const has = current.allowedContractParties.includes(party);
      const allowedContractParties = has
        ? current.allowedContractParties.filter((p) => p !== party)
        : [...current.allowedContractParties, party];
      return { ...prev, [productId]: { ...current, allowedContractParties } };
    });
  };

  const togglePeriod = (productId: string, period: number) => {
    setEdits((prev) => {
      const current = prev[productId];
      const has = current.allowedPeriods.includes(period);
      const allowedPeriods = has
        ? current.allowedPeriods.filter((p) => p !== period)
        : [...current.allowedPeriods, period].sort((a, b) => a - b);
      return { ...prev, [productId]: { ...current, allowedPeriods } };
    });
  };

  const handleSave = () => {
    setError(null);
    const overrides = products.map((row) => {
      const edit = edits[row.productId];
      const minVal = edit.minDownPaymentPct.trim() === '' ? null : parseFloat(edit.minDownPaymentPct);
      const maxVal = edit.maxDownPaymentPct.trim() === '' ? null : parseFloat(edit.maxDownPaymentPct);
      return {
        financingProductId: row.productId,
        isEnabled: edit.isEnabled,
        b2cStatus: edit.b2cStatus,
        allowedContractParties: edit.allowedContractParties,
        minDownPaymentPct: minVal !== null && !isNaN(minVal) ? minVal : null,
        maxDownPaymentPct: maxVal !== null && !isNaN(maxVal) ? maxVal : null,
        allowedPeriods: edit.allowedPeriods
      };
    });
    saveMutation.mutate(overrides);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-gray-500">Ładowanie produktów finansowych...</div>;
  }

  if (isError) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">Wystąpił błąd podczas ładowania produktów finansowych.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Produkty finansowe
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Ustal, które produkty leasingowe i kredytowe widzą pracownicy tej firmy oraz na jakich warunkach (strony umowy, wpłata własna, okresy).
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSavedSuccess && (
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
              <Check className="w-4 h-4" /> Zapisano!
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || products.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Zapisz
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          Brak produktów finansowych kategorii Leasing / Kredyt w systemie.
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((row) => {
            const edit = edits[row.productId];
            if (!edit) return null;
            const periodOptions = buildPeriodOptions(row.limits.minInstallments, row.limits.maxInstallments);

            return (
              <div key={row.productId} className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{row.name || row.category}</span>
                    <span className="text-2xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {row.category === 'LEASING' ? 'Leasing' : 'Kredyt'}
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-medium text-gray-700">Dostępny</span>
                    <input
                      type="checkbox"
                      checked={edit.isEnabled}
                      onChange={(e) => updateEdit(row.productId, { isEnabled: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dostępność B2C</Label>
                    <select
                      value={edit.b2cStatus}
                      onChange={(e) => updateEdit(row.productId, { b2cStatus: e.target.value as ProductAvailabilityStatus })}
                      className="w-full h-9 px-3 py-1 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {(['AVAILABLE', 'REQUIRES_CONFIRMATION', 'UNAVAILABLE'] as ProductAvailabilityStatus[]).map((status) => (
                        <option key={status} value={status}>{B2C_STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Dopuszczalne strony umowy</Label>
                    <div className="flex flex-wrap gap-3 pt-1">
                      {(['CONSUMER', 'EMPLOYEE_B2B', 'EMPLOYER_COMPANY'] as ContractPartyOption[]).map((party) => (
                        <label key={party} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={edit.allowedContractParties.includes(party)}
                            onChange={() => toggleContractParty(row.productId, party)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          {CONTRACT_PARTY_LABELS[party]}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Minimalna wpłata własna (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={edit.minDownPaymentPct}
                      onChange={(e) => updateEdit(row.productId, { minDownPaymentPct: e.target.value })}
                      placeholder="0"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Maksymalna wpłata własna (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={edit.maxDownPaymentPct}
                      onChange={(e) => updateEdit(row.productId, { maxDownPaymentPct: e.target.value })}
                      placeholder={String(row.limits.maxInitialPayment)}
                      className="h-9 text-sm"
                    />
                    <p className="text-2xs text-gray-500">
                      maks. wpłata wg produktu: {row.limits.maxInitialPayment}%
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Dopuszczalne okresy umowy (msc)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {periodOptions.map((period) => {
                      const isSelected = edit.allowedPeriods.includes(period);
                      return (
                        <button
                          key={period}
                          type="button"
                          onClick={() => togglePeriod(row.productId, period)}
                          className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {period} msc
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-2xs text-gray-500">
                    Zakres produktu: {row.limits.minInstallments}–{row.limits.maxInstallments} msc. Brak zaznaczeń = dziedziczenie (wszystkie wielokrotności 12 z zakresu).
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
