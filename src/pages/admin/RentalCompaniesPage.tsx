import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { rentalCompaniesApi } from '@/services/rental-api';
import type { RentalCompany } from '@/services/rental-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, X, Building2, Check, Eye, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function RentalCompaniesPage() {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [previewCompanyId, setPreviewCompanyId] = useState<string | null>(null);
    const [form, setForm] = useState<{
        name: string;
        contactEmail: string;
        contactPhone: string;
        includedServices: string[];
        insuranceAddMode: 'INSURANCE_23' | 'INSURANCE_0' | 'INSURANCE_INCLUDED';
    }>({ 
        name: '', 
        contactEmail: '', 
        contactPhone: '',
        includedServices: [],
        insuranceAddMode: 'INSURANCE_23'
    });

    const SERVICE_OPTIONS = [
        { id: 'insurance', label: 'Ubezpieczenie' },
        { id: 'service', label: 'Serwis' },
        { id: 'tires', label: 'Opony' },
        { id: 'other', label: 'Inne' }
    ];

    const { data, isLoading } = useQuery({
        queryKey: ['rental-companies'],
        queryFn: () => rentalCompaniesApi.list(token!),
        enabled: !!token
    });

    const { data: healthData } = useQuery({
        queryKey: ['rental-company-health', editingId],
        queryFn: () => rentalCompaniesApi.getMatrixHealth(editingId!, token!),
        enabled: !!editingId && !!token
    });

    const { data: previewData, isLoading: isPreviewLoading } = useQuery({
        queryKey: ['rental-company-preview', previewCompanyId],
        queryFn: () => rentalCompaniesApi.getCalculationPreview(previewCompanyId!, token!),
        enabled: !!previewCompanyId && !!token
    });

    const createMutation = useMutation({
        mutationFn: (data: Partial<RentalCompany>) => rentalCompaniesApi.create(data, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-companies'] });
            setShowAdd(false);
            resetForm();
            toast({ title: 'Firma dodana' });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<RentalCompany> }) => rentalCompaniesApi.update(id, data, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-companies'] });
            setEditingId(null);
            resetForm();
            toast({ title: 'Firma zaktualizowana' });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => rentalCompaniesApi.delete(id, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-companies'] });
            toast({ title: 'Firma usunięta' });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    const resetForm = () => setForm({ name: '', contactEmail: '', contactPhone: '', includedServices: [], insuranceAddMode: 'INSURANCE_23' });

    const validateForm = (formData: typeof form) => {
        if (formData.insuranceAddMode === 'INSURANCE_INCLUDED' && !formData.includedServices.includes('insurance')) {
            toast({
                title: 'Błąd walidacji',
                description: 'Tryb All-In wymaga zaznaczenia usługi Ubezpieczenie w liście wliczonych usług',
                variant: 'destructive'
            });
            return false;
        }
        return true;
    };

    const startEdit = (company: RentalCompany) => {
        setEditingId(company.id);
        setForm({
            name: company.name,
            contactEmail: company.contactEmail || '',
            contactPhone: company.contactPhone || '',
            includedServices: company.includedServices || [],
            insuranceAddMode: company.insuranceAddMode || 'INSURANCE_23'
        });
    };

    const companies = data?.companies || [];

    return (
        <div className="p-6 max-w-3xl">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Firmy najmowe</h2>
                <Button onClick={() => { setShowAdd(true); resetForm(); }} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Dodaj firmę
                </Button>
            </div>

            {/* Add form */}
            {showAdd && (
                <div className="mb-4 p-4 rounded-xl border bg-white shadow-sm space-y-3">
                    <h3 className="font-medium">Nowa firma najmowa</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Input placeholder="Nazwa firmy *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                        <Input placeholder="Email kontaktowy" type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} />
                        <Input placeholder="Telefon" value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} />
                        
                        <div className="space-y-1 col-span-full md:col-span-2">
                            <label className="text-sm font-medium">Sposób doliczania ubezpieczenia</label>
                            <select
                                value={form.insuranceAddMode}
                                onChange={e => setForm(p => ({ ...p, insuranceAddMode: e.target.value as any }))}
                                className="w-full h-10 px-3 rounded-md border text-sm"
                            >
                                <option value="INSURANCE_23">23% (doliczane do netto, VAT naliczany od całości)</option>
                                <option value="INSURANCE_0">0% (stała kwota z matrycy osobno na fakturze bez VAT)</option>
                                <option value="INSURANCE_INCLUDED">Wliczone w ratę w matrycy (All-In - nie doliczaj dodatkowo)</option>
                            </select>
                        </div>

                        <div className="space-y-1 col-span-full">
                            <label className="text-sm font-medium">Domyślne usługi wliczone w ratę</label>
                            <div className="flex flex-wrap gap-4 mt-2">
                                {SERVICE_OPTIONS.map(svc => (
                                    <label key={svc.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300"
                                            checked={form.includedServices.includes(svc.id)}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setForm(p => ({ ...p, includedServices: [...p.includedServices, svc.id] }));
                                                } else {
                                                    setForm(p => ({ ...p, includedServices: p.includedServices.filter(x => x !== svc.id) }));
                                                }
                                            }}
                                        />
                                        {svc.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => { if (validateForm(form)) createMutation.mutate(form); }} disabled={!form.name || createMutation.isPending}>
                            {createMutation.isPending ? 'Dodawanie...' : 'Dodaj'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Anuluj</Button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="space-y-2">
                {isLoading && <p className="text-gray-500 text-center py-8">Ładowanie...</p>}
                {companies.map((c: RentalCompany) => (
                    <div key={c.id} className="p-4 rounded-xl border bg-white shadow-sm">
                        {editingId === c.id ? (
                            <div className="space-y-3">
                                {healthData && !healthData.isHealthy && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-semibold">Ostrzeżenie jakości danych matrycy:</span>
                                            <p className="mt-0.5">
                                                Wykryto {healthData.missingInsuranceCount} pozycji w cenniku bez kwoty ubezpieczenia (w {healthData.affectedVehiclesCount} przypisanych pojazdach).
                                                W ofertach publicznych te warianty będą oznaczone jako "Wycena ubezpieczenia na zapytanie" i wykluczone z filtru budżetowego.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                                    <Input value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} />
                                    <Input value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} />
                                    
                                    <div className="space-y-1 col-span-full md:col-span-2">
                                        <label className="text-sm font-medium text-gray-700">Sposób doliczania ubezpieczenia</label>
                                        <select
                                            value={form.insuranceAddMode}
                                            onChange={e => setForm(p => ({ ...p, insuranceAddMode: e.target.value as any }))}
                                            className="w-full h-10 px-3 rounded-md border text-sm"
                                        >
                                            <option value="INSURANCE_23">23% (doliczane do netto, VAT naliczany od całości)</option>
                                            <option value="INSURANCE_0">0% (stała kwota z matrycy osobno na fakturze bez VAT)</option>
                                            <option value="INSURANCE_INCLUDED">Wliczone w ratę w matrycy (All-In - nie doliczaj dodatkowo)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1 col-span-full">
                                        <label className="text-sm font-medium text-gray-700">Domyślne usługi wliczone w ratę</label>
                                        <div className="flex flex-wrap gap-4 mt-1">
                                            {SERVICE_OPTIONS.map(svc => (
                                                <label key={svc.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300"
                                                        checked={form.includedServices.includes(svc.id)}
                                                        onChange={e => {
                                                            if (e.target.checked) {
                                                                setForm(p => ({ ...p, includedServices: [...p.includedServices, svc.id] }));
                                                            } else {
                                                                setForm(p => ({ ...p, includedServices: p.includedServices.filter(x => x !== svc.id) }));
                                                            }
                                                        }}
                                                    />
                                                    {svc.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => { if (validateForm(form)) updateMutation.mutate({ id: c.id, data: form }); }} disabled={updateMutation.isPending}>
                                        <Check className="w-3 h-3 mr-1" /> Zapisz
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Anuluj</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <Building2 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{c.name}</span>
                                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                                c.insuranceAddMode === 'INSURANCE_INCLUDED'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : c.insuranceAddMode === 'INSURANCE_0'
                                                    ? 'bg-purple-100 text-purple-800'
                                                    : 'bg-blue-100 text-blue-800'
                                            }`}>
                                                {c.insuranceAddMode === 'INSURANCE_INCLUDED'
                                                    ? 'All-In (wliczone)'
                                                    : c.insuranceAddMode === 'INSURANCE_0'
                                                    ? 'Ubezpieczenie 0%'
                                                    : 'Ubezpieczenie 23%'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 space-x-3 mt-0.5">
                                            {c.contactEmail && <span>{c.contactEmail}</span>}
                                            {c.contactPhone && <span>{c.contactPhone}</span>}
                                            <span className="text-blue-600">{c._count?.vehicleAssignments || 0} pojazdów</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        title="Podgląd kalkulacji (B2B vs Konsument)"
                                        onClick={() => setPreviewCompanyId(c.id)}
                                        className="text-gray-600 hover:text-blue-600"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => startEdit(c)}>
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            if (confirm(`Usunąć firmę "${c.name}"?`)) deleteMutation.mutate(c.id);
                                        }}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {!isLoading && companies.length === 0 && (
                    <p className="text-gray-500 text-center py-8">Brak firm najmowych</p>
                )}
            </div>

            {/* Calculation Preview Dialog */}
            <Dialog open={!!previewCompanyId} onOpenChange={open => !open && setPreviewCompanyId(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Podgląd kalkulacji raty</DialogTitle>
                        <DialogDescription>
                            Weryfikacja reguł podatkowych i prezentacji raty dla firmy: <span className="font-semibold">{previewData?.company?.name}</span>
                        </DialogDescription>
                    </DialogHeader>

                    {isPreviewLoading ? (
                        <div className="py-8 text-center text-sm text-gray-500">Ładowanie przykładowej kalkulacji...</div>
                    ) : !previewData?.hasSample ? (
                        <div className="py-6 text-sm text-gray-600 text-center">
                            {previewData?.message || 'Brak przypisanych pojazdów lub wpisów w cenniku dla tej firmy.'}
                        </div>
                    ) : (
                        <div className="space-y-4 pt-2">
                            <div className="text-xs bg-slate-50 p-2.5 rounded border space-y-1">
                                <div className="font-medium text-slate-900">
                                    Przykładowy pojazd: {previewData.vehicle?.make} {previewData.vehicle?.model} {previewData.vehicle?.productionYear ? `(${previewData.vehicle.productionYear})` : ''}
                                </div>
                                <div className="text-slate-600">
                                    Wariant: {previewData.matrixParams?.contractMonths} mies., {previewData.matrixParams?.annualMileageKm?.toLocaleString('pl-PL')} km/rok, wpłata {previewData.matrixParams?.initialPaymentPct}%
                                </div>
                                <div className="text-slate-600">
                                    Tryb ubezpieczenia: <span className="font-semibold text-slate-800">{previewData.company?.insuranceAddMode || 'INSURANCE_23'}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
                                    <div className="text-xs font-semibold text-blue-900 mb-1">Widok B2B (Firma)</div>
                                    <div className="text-lg font-bold text-blue-700">{previewData.b2bView?.primary}</div>
                                    <div className="text-xs text-slate-600 mt-1">{previewData.b2bView?.secondary}</div>
                                </div>
                                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                                    <div className="text-xs font-semibold text-emerald-900 mb-1">Widok Konsument</div>
                                    <div className="text-lg font-bold text-emerald-700">{previewData.consumerView?.primary}</div>
                                    <div className="text-xs text-slate-600 mt-1">{previewData.consumerView?.secondary}</div>
                                </div>
                            </div>

                            {previewData.breakdown && (
                                <div className="text-xs text-slate-500 border-t pt-2 space-y-1">
                                    <div>Bazowa rata netto: {previewData.breakdown.baseMonthlyRateNet?.toFixed(2)} zł</div>
                                    <div>Ubezpieczenie netto: {previewData.breakdown.insuranceNet?.toFixed(2)} zł ({previewData.breakdown.effectiveInsuranceMode})</div>
                                    {previewData.breakdown.insuranceMissing && (
                                        <div className="text-amber-600 font-medium">Uwaga: Brak kwoty ubezpieczenia (insuranceMissing = true)</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
