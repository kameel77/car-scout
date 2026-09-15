import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { FileSpreadsheet, Upload, Plus, CheckCircle2, Eye, Loader2, Building2, AlertCircle } from 'lucide-react';
import {
  employeeAdminApi,
  EmployeeMatrixSet,
  EmployeeMatrixVersionSummary
} from '@/services/employee-admin.service';
import { rentalCompaniesApi } from '@/services/rental-api';

interface Props {
  programId: string;
  token: string;
}

export const MatrixImportTab: React.FC<Props> = ({ programId, token }) => {
  const queryClient = useQueryClient();
  const [isCreateSetOpen, setIsCreateSetOpen] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLabel, setImportLabel] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview modal state
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);

  // Form state for creating a matrix set
  const [rentalCompanyId, setRentalCompanyId] = useState('');
  const [setName, setSetName] = useState('');
  const [setDescription, setSetDescription] = useState('');

  // Fetch matrix sets
  const { data: matrixSetsData, isLoading: isSetsLoading } = useQuery({
    queryKey: ['employee-matrix-sets'],
    queryFn: () => employeeAdminApi.listMatrixSets(token)
  });

  // Fetch rental companies for selector
  const { data: rentalCompaniesData } = useQuery({
    queryKey: ['rental-companies'],
    queryFn: () => rentalCompaniesApi.list(token)
  });

  // Preview query
  const { data: previewData, isLoading: isPreviewLoading } = useQuery({
    queryKey: ['employee-matrix-preview', previewVersionId],
    queryFn: () => employeeAdminApi.previewMatrixVersion(previewVersionId!, token),
    enabled: !!previewVersionId
  });

  const createSetMutation = useMutation({
    mutationFn: (payload: { rentalCompanyId: string; name: string; description?: string | null }) =>
      employeeAdminApi.createMatrixSet(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-matrix-sets'] });
      setIsCreateSetOpen(false);
      setRentalCompanyId('');
      setSetName('');
      setSetDescription('');
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Błąd tworzenia zestawu matrycy');
    }
  });

  const importMutation = useMutation({
    mutationFn: ({ setId, file, label }: { setId: string; file: File; label: string }) =>
      employeeAdminApi.importMatrixCSV(setId, file, label, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-matrix-sets'] });
      setIsImportOpen(false);
      setImportFile(null);
      setImportLabel('');
      setSelectedSetId(null);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Błąd podczas importu pliku CSV');
    }
  });

  const publishMutation = useMutation({
    mutationFn: (versionId: string) => employeeAdminApi.publishMatrixVersion(versionId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-matrix-sets'] });
    }
  });

  const matrixSets = matrixSetsData?.matrixSets || [];
  const rentalCompanies = rentalCompaniesData?.companies || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Prywatne matryce najmu (Hurtowy import CSV)
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Dedykowane matryce stawek najmu (okres, przebieg, wpłata, ubezpieczenie, opony) od dostawców floty (ADR-03).
          </p>
        </div>
        <Button onClick={() => setIsCreateSetOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Nowy zestaw matrycy
        </Button>
      </div>

      {isSetsLoading ? (
        <div className="p-8 text-center text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          Ładowanie zestawów matryc najmu...
        </div>
      ) : matrixSets.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h4 className="text-sm font-medium text-gray-900">Brak prywatnych zestawów matryc</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Utwórz zestaw matrycy powiązany z dostawcą floty (np. Ayvens, Arval) i wgraj plik CSV ze stawkami najmu.
          </p>
          <Button onClick={() => setIsCreateSetOpen(true)} variant="outline" size="sm" className="mt-4">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Utwórz zestaw matrycy
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {matrixSets.map((set: EmployeeMatrixSet) => (
            <div key={set.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
              <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-900">{set.name}</h4>
                    <p className="text-xs text-gray-500">
                      Dostawca: <strong className="text-gray-700">{set.rentalCompany?.name}</strong>
                      {set.description ? ` · ${set.description}` : ''}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    setSelectedSetId(set.id);
                    setIsImportOpen(true);
                  }}
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Wgraj plik CSV
                </Button>
              </div>

              {/* Lista wersji matrycy w zestawie */}
              <div className="p-4">
                {set.versions && set.versions.length > 0 ? (
                  <div className="divide-y divide-gray-100 text-sm">
                    {set.versions.map((ver: EmployeeMatrixVersionSummary) => (
                      <div key={ver.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            v{ver.versionNumber}
                          </span>
                          <span className="font-medium text-gray-900 text-xs">{ver.label}</span>
                          <span className="text-[11px] text-gray-400">
                            ({ver._count?.rows || 0} wierszy kalkulacji)
                          </span>
                          {ver.status === 'PUBLISHED' ? (
                            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px]">
                              Opublikowana
                            </Badge>
                          ) : ver.status === 'DRAFT' ? (
                            <Badge variant="secondary" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                              Wersja robocza (DRAFT)
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-500 text-[10px]">
                              Zarchiwizowana
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-gray-600 hover:text-gray-900"
                            onClick={() => setPreviewVersionId(ver.id)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Podgląd
                          </Button>

                          {ver.status === 'DRAFT' && (
                            <Button
                              size="sm"
                              className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={publishMutation.isPending}
                              onClick={() => {
                                if (window.confirm('Opublikować tę wersję matrycy? Stanie się ona aktywną wersją stawek najmu dla tego programu.')) {
                                  publishMutation.mutate(ver.id);
                                }
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Publikuj wersję
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic py-2">
                    Brak zaimportowanych wersji. Wgraj pierwszy plik CSV z matrycą.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog tworzenia zestawu matrycy */}
      <Dialog open={isCreateSetOpen} onOpenChange={setIsCreateSetOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!rentalCompanyId || !setName.trim()) return;
              createSetMutation.mutate({
                rentalCompanyId,
                name: setName.trim(),
                description: setDescription.trim() || null
              });
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Nowy zestaw matrycy najmu
              </DialogTitle>
              <DialogDescription>
                Wybierz dostawcę floty i zdefiniuj zestaw matrycy dedykowanej dla programów pracowniczych.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="rental-company">Dostawca floty (RentalCompany) *</Label>
                <select
                  id="rental-company"
                  value={rentalCompanyId}
                  onChange={(e) => setRentalCompanyId(e.target.value)}
                  required
                  className="w-full h-9 px-3 py-1 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Wybierz firmę najmową</option>
                  {rentalCompanies.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="set-name">Nazwa zestawu *</Label>
                <Input
                  id="set-name"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  placeholder="np. Ayvens Flota Dedykowana Action"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="set-desc">Opis (opcjonalnie)</Label>
                <Input
                  id="set-desc"
                  value={setDescription}
                  onChange={(e) => setSetDescription(e.target.value)}
                  placeholder="np. Warunki flotowe Q3/Q4 z serwisem i oponami"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateSetOpen(false)}>
                Anuluj
              </Button>
              <Button
                type="submit"
                disabled={!rentalCompanyId || !setName.trim() || createSetMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createSetMutation.isPending ? 'Tworzenie...' : 'Utwórz zestaw'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog importu CSV */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedSetId || !importFile) return;
              importMutation.mutate({
                setId: selectedSetId,
                file: importFile,
                label: importLabel.trim()
              });
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Importuj matrycę z pliku CSV
              </DialogTitle>
              <DialogDescription>
                Wgraj plik CSV od leasingodawcy. Zostanie utworzona wersja robocza (DRAFT) ze stawkami najmu.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="my-3 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="import-label">Etykieta wersji (opcjonalnie)</Label>
                <Input
                  id="import-label"
                  value={importLabel}
                  onChange={(e) => setImportLabel(e.target.value)}
                  placeholder="np. Cennik Jesień 2026 (rabat 6%)"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="csv-file">Wybierz plik CSV *</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  required
                />
                <p className="text-[11px] text-gray-500">
                  Obsługiwane formaty: wewnętrzny (vehicle_id, contract_months...) lub dostawcy (car_id, term_months, monthly_cost_net...).
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsImportOpen(false)}>
                Anuluj
              </Button>
              <Button
                type="submit"
                disabled={!importFile || importMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importowanie...
                  </>
                ) : (
                  'Importuj matrycę'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal podglądu wierszy matrycy */}
      <Dialog open={!!previewVersionId} onOpenChange={(open) => !open && setPreviewVersionId(null)}>
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              Podgląd wierszy matrycy najmu
            </DialogTitle>
            <DialogDescription>
              Próbka 25 pierwszych wierszy kalkulacji przypisanych do pojazdów dostawcy.
            </DialogDescription>
          </DialogHeader>

          {isPreviewLoading ? (
            <div className="p-8 text-center text-xs text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Pobieranie próby wierszy...
            </div>
          ) : !previewData?.sampleRows || previewData.sampleRows.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500">Brak wierszy w tej wersji matrycy.</div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-x-auto text-xs">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Pojazd</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Okres</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Przebieg roczny</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Wpłata (%)</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Rata netto</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Rata brutto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewData.sampleRows.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {r.assignment?.vehicle?.make} {r.assignment?.vehicle?.model}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.contractMonths} msc</td>
                      <td className="px-3 py-2 text-gray-600">{r.annualMileageKm.toLocaleString()} km</td>
                      <td className="px-3 py-2 text-gray-600">{r.initialPaymentPct}%</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">
                        {parseFloat(r.monthlyRateNet).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {parseFloat(r.monthlyRateGross).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewVersionId(null)}>
              Zamknij podgląd
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
