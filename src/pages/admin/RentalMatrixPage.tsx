import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { rentalMatrixApi, rentalCompaniesApi, rentalVehiclesApi } from '@/services/rental-api';
import type { RentalMatrixEntry, MatrixImportResult } from '@/services/rental-api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Trash2, AlertCircle, CheckCircle2, Filter } from 'lucide-react';

export default function RentalMatrixPage() {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [importResult, setImportResult] = useState<MatrixImportResult | null>(null);
    const [previewAssignmentId, setPreviewAssignmentId] = useState('');

    // Fetch companies
    const companiesQuery = useQuery({
        queryKey: ['rental-companies'],
        queryFn: () => rentalCompaniesApi.list(token!),
        enabled: !!token
    });

    // Fetch vehicles for filter
    const vehiclesQuery = useQuery({
        queryKey: ['rental-vehicles-all'],
        queryFn: () => rentalVehiclesApi.list({ limit: '200' }, token!),
        enabled: !!token
    });

    // Fetch matrix entries for preview
    const matrixQuery = useQuery({
        queryKey: ['rental-matrix', previewAssignmentId],
        queryFn: () => rentalMatrixApi.getEntries(previewAssignmentId, token!),
        enabled: !!previewAssignmentId && !!token
    });

    // Import mutation
    const importMutation = useMutation({
        mutationFn: ({ file, companyId }: { file: File; companyId: string }) =>
            rentalMatrixApi.import(file, companyId, token!),
        onSuccess: (result) => {
            setImportResult(result);
            queryClient.invalidateQueries({ queryKey: ['rental-matrix'] });
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            toast({ title: 'Import zakończony', description: `${result.inserted} wpisów zaimportowanych` });
        },
        onError: (e: Error) => toast({ title: 'Błąd importu', description: e.message, variant: 'destructive' })
    });

    // Delete matrix mutation
    const deleteMutation = useMutation({
        mutationFn: (assignmentId: string) => rentalMatrixApi.deleteEntries(assignmentId, token!),
        onSuccess: (result: any) => {
            queryClient.invalidateQueries({ queryKey: ['rental-matrix'] });
            toast({ title: 'Matryca wyczyszczona', description: `Usunięto ${result.deleted} wpisów` });
        }
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedCompanyId) return;
        importMutation.mutate({ file, companyId: selectedCompanyId });
        e.target.value = '';
    };

    const companies = companiesQuery.data?.companies || [];
    const vehicles = vehiclesQuery.data?.vehicles || [];
    const entries = matrixQuery.data?.entries || [];

    // Build pivot table data
    const pivotData = useMemo(() => {
        if (entries.length === 0) return null;

        const mileages = [...new Set(entries.map((e: RentalMatrixEntry) => e.annualMileageKm))].sort((a, b) => a - b);
        const months = [...new Set(entries.map((e: RentalMatrixEntry) => e.contractMonths))].sort((a, b) => a - b);
        const payments = [...new Set(entries.map((e: RentalMatrixEntry) => e.initialPaymentPct))].sort((a, b) => a - b);

        const lookup = new Map<string, RentalMatrixEntry>();
        entries.forEach((e: RentalMatrixEntry) => {
            lookup.set(`${e.annualMileageKm}-${e.contractMonths}-${e.initialPaymentPct}`, e);
        });

        return { mileages, months, payments, lookup };
    }, [entries]);

    // Find assignments for selected vehicle
    const selectedVehicleAssignments = useMemo(() => {
        if (!selectedVehicleId) return [];
        const vehicle = vehicles.find((v: any) => v.id === selectedVehicleId);
        return vehicle?.rentalAssignments || [];
    }, [selectedVehicleId, vehicles]);

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-6">Matryca najmu</h2>

            {/* Import Section */}
            <div className="rounded-xl border bg-white shadow-sm p-6 mb-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-600" /> Import matrycy CSV
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Firma najmowa *</label>
                        <select
                            value={selectedCompanyId}
                            onChange={e => setSelectedCompanyId(e.target.value)}
                            className="w-full h-10 px-3 rounded-md border text-sm"
                        >
                            <option value="">Wybierz firmę...</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Plik CSV</label>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileSelect}
                                disabled={!selectedCompanyId || importMutation.isPending}
                                className="text-sm file:mr-2 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium file:cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                    <p><strong>Format 1 (wewnętrzny):</strong> vehicle_id, annual_mileage_km, contract_months, initial_payment_pct, monthly_rate_net, monthly_rate_gross [, fee_pct]</p>
                    <p><strong>Format 2 (dostawca):</strong> car_id, term_months, mileage_yearly, monthly_cost_net (brutto = netto × 1.23) ... [, fee_pct]</p>
                    <p><strong>fee_pct (opcjonalnie):</strong> stawka prowizji Motolia (0–30, np. <code>7</code>, <code>6.5</code>) na końcu wiersza</p>
                    <p><strong>car_id / vehicle_id:</strong> odpowiada External Vehicle ID w przypisaniu pojazdu do firmy (<em>Pojazdy najmu → Edytuj → Firmy najmowe</em>)</p>
                    <p><strong>Separatory:</strong> przecinek, średnik lub tab (auto-detekcja)</p>
                </div>

                {importMutation.isPending && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 animate-pulse">
                        Importowanie...
                    </div>
                )}

                {importResult && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm space-y-2">
                        <div className="flex items-center gap-2 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Import zakończony — {importResult.rentalCompany}
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-xs">
                            <div className="p-2 bg-white rounded text-center">
                                <div className="text-lg font-bold text-gray-900">{importResult.totalRows}</div>
                                <div className="text-gray-500">Wierszy</div>
                            </div>
                            <div className="p-2 bg-white rounded text-center">
                                <div className="text-lg font-bold text-green-600">{importResult.inserted}</div>
                                <div className="text-gray-500">Dodanych</div>
                            </div>
                            <div className="p-2 bg-white rounded text-center">
                                <div className="text-lg font-bold text-blue-600">{importResult.vehiclesProcessed}</div>
                                <div className="text-gray-500">Pojazdów</div>
                            </div>
                            <div className="p-2 bg-white rounded text-center">
                                <div className="text-lg font-bold text-orange-600">{importResult.skipped}</div>
                                <div className="text-gray-500">Pominięte</div>
                            </div>
                        </div>
                        {importResult.errors.length > 0 && (
                            <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-1 text-red-600 font-medium">
                                    <AlertCircle className="w-3 h-3" /> Błędy ({importResult.errors.length}):
                                </div>
                                {importResult.errors.slice(0, 10).map((err, i) => (
                                    <div key={i} className="text-xs text-red-600">Wiersz {err.row}: {err.error}</div>
                                ))}
                                {importResult.errors.length > 10 && (
                                    <div className="text-xs text-gray-500">...i {importResult.errors.length - 10} więcej</div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Preview Section */}
            <div className="rounded-xl border bg-white shadow-sm p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" /> Podgląd matrycy
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            <Filter className="w-3 h-3" /> Pojazd
                        </label>
                        <select
                            value={selectedVehicleId}
                            onChange={e => { setSelectedVehicleId(e.target.value); setPreviewAssignmentId(''); }}
                            className="w-full h-10 px-3 rounded-md border text-sm"
                        >
                            <option value="">Wybierz pojazd...</option>
                            {vehicles.map((v: any) => (
                                <option key={v.id} value={v.id}>
                                    {v.make} {v.model} {v.version} ({v.productionYear})
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedVehicleId && selectedVehicleAssignments.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Firma / Przypisanie</label>
                            <select
                                value={previewAssignmentId}
                                onChange={e => setPreviewAssignmentId(e.target.value)}
                                className="w-full h-10 px-3 rounded-md border text-sm"
                            >
                                <option value="">Wybierz firmę...</option>
                                {selectedVehicleAssignments.map((a: any) => (
                                    <option key={a.id} value={a.id}>
                                        {a.rentalCompany?.name} ({a._count?.matrixEntries || 0} wpisów)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {matrixQuery.isLoading && <p className="text-gray-500 text-center py-4">Ładowanie matrycy...</p>}

                {pivotData && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                {entries.length} wpisów | {pivotData.mileages.length} przebiegów × {pivotData.months.length} okresów × {pivotData.payments.length} wpłat
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-red-500"
                                onClick={() => {
                                    if (confirm('Wyczyścić całą matrycę dla tego przypisania?')) {
                                        deleteMutation.mutate(previewAssignmentId);
                                    }
                                }}
                            >
                                <Trash2 className="w-3 h-3 mr-1" /> Wyczyść
                            </Button>
                        </div>

                        {/* Pivot tables by mileage */}
                        {pivotData.mileages.map(mileage => (
                            <div key={mileage} className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-700">
                                    🚗 Przebieg: {mileage.toLocaleString('pl-PL')} km/rok
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs border rounded-lg overflow-hidden">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-2 text-left border font-medium">Okres \ Wpłata</th>
                                                {pivotData.payments.map(pct => (
                                                    <th key={pct} className="p-2 text-center border font-medium">{pct}%</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pivotData.months.map(months => (
                                                <tr key={months} className="hover:bg-gray-50">
                                                    <td className="p-2 border font-medium">{months} mies.</td>
                                                    {pivotData.payments.map(pct => {
                                                        const entry = pivotData.lookup.get(`${mileage}-${months}-${pct}`);
                                                        return (
                                                            <td key={pct} className="p-2 border text-center">
                                                                {entry ? (
                                                                    <div>
                                                                        <div className="font-semibold">{entry.monthlyRateGross.toLocaleString('pl-PL')} zł</div>
                                                                        <div className="text-gray-400">{entry.monthlyRateNet.toLocaleString('pl-PL')} netto</div>
                                                                        {entry.feePct !== null && entry.feePct !== undefined && (
                                                                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-mono text-[10px] border border-amber-200">
                                                                                fee: {entry.feePct}%
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-300">—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}

                        {/* Services */}
                        {entries.some((e: RentalMatrixEntry) => e.servicesIncluded.length > 0) && (
                            <div className="p-4 bg-green-50 rounded-lg text-sm">
                                <h4 className="font-medium text-green-800 mb-2">Usługi wliczone w cenę:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {[...new Set(entries.flatMap((e: RentalMatrixEntry) => e.servicesIncluded))].map(service => (
                                        <span key={service} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{service}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {previewAssignmentId && entries.length === 0 && !matrixQuery.isLoading && (
                    <p className="text-gray-500 text-center py-4">Brak wpisów matrycy dla tego przypisania</p>
                )}

                {!previewAssignmentId && !selectedVehicleId && (
                    <p className="text-gray-500 text-center py-8">Wybierz pojazd i firmę aby zobaczyć matrycę</p>
                )}
            </div>
        </div>
    );
}
