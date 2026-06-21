import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { rentalCompaniesApi } from '@/services/rental-api';
import type { RentalCompany } from '@/services/rental-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, X, Building2, Check } from 'lucide-react';

export default function RentalCompaniesPage() {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<{
        name: string;
        contactEmail: string;
        contactPhone: string;
        includedServices: string[];
        insuranceAddMode: 'INSURANCE_23' | 'INSURANCE_0';
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
                        <Button size="sm" onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}>
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
                                    <Button size="sm" onClick={() => updateMutation.mutate({ id: c.id, data: form })} disabled={updateMutation.isPending}>
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
                                        <div className="font-medium">{c.name}</div>
                                        <div className="text-xs text-gray-500 space-x-3">
                                            {c.contactEmail && <span>{c.contactEmail}</span>}
                                            {c.contactPhone && <span>{c.contactPhone}</span>}
                                            <span className="text-blue-600">{c._count?.vehicleAssignments || 0} pojazdów</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
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
        </div>
    );
}
