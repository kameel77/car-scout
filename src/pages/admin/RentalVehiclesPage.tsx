import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { rentalVehiclesApi, rentalCompaniesApi } from '@/services/rental-api';
import type { RentalVehicle, RentalCompany } from '@/services/rental-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { VehicleDataForm } from '@/components/admin/VehicleForm/VehicleDataForm';
import {
    Plus, Search, Edit, Archive, RotateCcw, Trash2, X, Star,
    ChevronLeft, ChevronRight, Image as ImageIcon, Building2, Link2, Copy, Check, Pencil, Upload
} from 'lucide-react';

// ─── Copyable ID ─────────────────────────────────────────────────

function CopyableId({ id }: { id: string }) {
    const [copied, setCopied] = useState(false);
    const short = id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-blue-600 transition-colors"
            title={`Click to copy: ${id}`}
        >
            {short}
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </button>
    );
}

// ─── Assignment Dialog ────────────────────────────────────────────

interface AssignmentSectionProps {
    vehicleId: string;
    assignments: any[];
    companies: RentalCompany[];
}

function AssignmentSection({ vehicleId, assignments, companies }: AssignmentSectionProps) {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [showAdd, setShowAdd] = useState(false);
    const [newAssignment, setNewAssignment] = useState({ rentalCompanyId: '', externalVehicleId: '', calculationId: '' });

    const assignedCompanyIds = new Set(assignments.map((a: any) => a.rentalCompanyId));
    const availableCompanies = companies.filter(c => !assignedCompanyIds.has(c.id));

    const createMutation = useMutation({
        mutationFn: () => rentalVehiclesApi.createAssignment(vehicleId, newAssignment, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            setShowAdd(false);
            setNewAssignment({ rentalCompanyId: '', externalVehicleId: '', calculationId: '' });
            toast({ title: 'Przypisano firmę' });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    const deleteMutation = useMutation({
        mutationFn: (assignmentId: string) => rentalVehiclesApi.deleteAssignment(vehicleId, assignmentId, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            toast({ title: 'Usunięto przypisanie' });
        }
    });

    return (
        <div className="space-y-3 mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Firmy najmowe ({assignments.length})
                </h4>
                {availableCompanies.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
                        <Plus className="w-3 h-3 mr-1" /> Przypisz
                    </Button>
                )}
            </div>

            {assignments.map((a: any) => (
                <AssignmentRow key={a.id} assignment={a} vehicleId={vehicleId} onDelete={() => deleteMutation.mutate(a.id)} />
            ))}

            {showAdd && (
                <div className="p-3 bg-white rounded border space-y-2">
                    <select
                        value={newAssignment.rentalCompanyId}
                        onChange={e => setNewAssignment(p => ({ ...p, rentalCompanyId: e.target.value }))}
                        className="w-full h-9 px-3 rounded border text-sm"
                    >
                        <option value="">Wybierz firmę...</option>
                        {availableCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Input
                        placeholder="External Vehicle ID (opcjonalnie)"
                        value={newAssignment.externalVehicleId}
                        onChange={e => setNewAssignment(p => ({ ...p, externalVehicleId: e.target.value }))}
                        className="h-9 text-sm"
                    />
                    <Input
                        placeholder="Calculation ID (opcjonalnie)"
                        value={newAssignment.calculationId}
                        onChange={e => setNewAssignment(p => ({ ...p, calculationId: e.target.value }))}
                        className="h-9 text-sm"
                    />
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newAssignment.rentalCompanyId || createMutation.isPending}>
                            Przypisz
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Anuluj</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Editable Assignment Row ─────────────────────────────────────

function AssignmentRow({ assignment: a, vehicleId, onDelete }: { assignment: any; vehicleId: string; onDelete: () => void }) {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [editing, setEditing] = useState(false);
    const [extId, setExtId] = useState(a.externalVehicleId || '');
    const [calcId, setCalcId] = useState(a.calculationId || '');

    const updateMutation = useMutation({
        mutationFn: () => rentalVehiclesApi.updateAssignment(vehicleId, a.id, {
            externalVehicleId: extId || null,
            calculationId: calcId || null
        }, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['rental-vehicle'] });
            setEditing(false);
            toast({ title: 'Przypisanie zaktualizowane' });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    if (editing) {
        return (
            <div className="p-3 bg-white rounded border space-y-2">
                <div className="font-medium text-sm">{a.rentalCompany?.name}</div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-gray-500">External Vehicle ID</label>
                        <Input value={extId} onChange={e => setExtId(e.target.value)} className="h-8 text-sm" placeholder="np. 100001" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">Calculation ID</label>
                        <Input value={calcId} onChange={e => setCalcId(e.target.value)} className="h-8 text-sm" placeholder="np. CALC-001" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Zapisz</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Anuluj</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between p-2 bg-white rounded border text-sm">
            <div className="flex-1">
                <span className="font-medium">{a.rentalCompany?.name}</span>
                {a.externalVehicleId && <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">ExtID: {a.externalVehicleId}</span>}
                {a.calculationId && <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Calc: {a.calculationId}</span>}
                {a._count?.matrixEntries > 0 && (
                    <span className="ml-2 text-xs text-green-600">✓ {a._count.matrixEntries} wpisów matrycy</span>
                )}
            </div>
            <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)} title="Edytuj">
                    <Pencil className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-500 hover:text-red-700">
                    <X className="w-3 h-3" />
                </Button>
            </div>
        </div>
    );
}

// ─── Specification Upload ───────────────────────────────────────

function SpecificationSection({ vehicle }: { vehicle: RentalVehicle }) {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [specUrl, setSpecUrl] = useState('');
    const specFileRef = useRef<HTMLInputElement>(null);

    const uploadMutation = useMutation({
        mutationFn: (file: File) => rentalVehiclesApi.uploadSpecification(vehicle.id, file, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['rental-vehicle'] });
            toast({ title: 'Specyfikacja załadowana' });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    const setUrlMutation = useMutation({
        mutationFn: (url: string) => rentalVehiclesApi.update(vehicle.id, { specificationUrl: url || null }, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['rental-vehicle', vehicle.id] });
            setSpecUrl('');
            toast({ title: 'Link do specyfikacji zapisany' });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    return (
        <div className="space-y-3 mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                <Link2 className="w-4 h-4" /> Specyfikacja
            </h4>

            {vehicle.specificationUrl && (
                <div className="flex items-center gap-2 text-sm">
                    <a href={vehicle.specificationUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-xs">
                        {vehicle.specificationUrl.startsWith('/uploads/') ? 'Wgrany plik PDF' : vehicle.specificationUrl}
                    </a>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                        onClick={() => { if (confirm('Usunąć link do specyfikacji?')) setUrlMutation.mutate(''); }}>
                        <X className="w-3 h-3" />
                    </Button>
                </div>
            )}

            <div className="flex gap-2 items-end">
                <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Dodaj link URL do specyfikacji:</label>
                    <Input
                        value={specUrl}
                        onChange={e => setSpecUrl(e.target.value)}
                        placeholder="https://..."
                        className="h-8 text-sm"
                    />
                </div>
                <Button size="sm" onClick={() => setUrlMutation.mutate(specUrl)} disabled={!specUrl || setUrlMutation.isPending} className="h-8">
                    Zapisz
                </Button>
            </div>

            <div>
                <label className="text-xs text-gray-500 block mb-1">Lub wgraj plik PDF (max 10MB):</label>
                <input
                    ref={specFileRef}
                    type="file"
                    accept="application/pdf"
                    onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) uploadMutation.mutate(file);
                    }}
                    className="hidden"
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => specFileRef.current?.click()}
                    disabled={uploadMutation.isPending}
                    className="gap-2"
                >
                    <Upload className="w-4 h-4" />
                    {uploadMutation.isPending ? 'Wgrywanie...' : 'Dodaj plik'}
                </Button>
            </div>
        </div>
    );
}

// ─── Image Upload ────────────────────────────────────────────────

function ImageSection({ vehicle }: { vehicle: RentalVehicle }) {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [imageUrl, setImageUrl] = useState('');
    const imageFileRef = useRef<HTMLInputElement>(null);

    const uploadMutation = useMutation({
        mutationFn: (files: File[]) => rentalVehiclesApi.uploadImages(vehicle.id, files, !vehicle.primaryImageUrl, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['rental-vehicle', vehicle.id] });
            toast({ title: 'Zdjęcia załadowane' });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    const addUrlMutation = useMutation({
        mutationFn: (url: string) => {
            const existingUrls = vehicle.imageUrls || [];
            const newUrls = [...existingUrls, url];
            const updateData: any = { imageUrls: newUrls };
            if (!vehicle.primaryImageUrl) updateData.primaryImageUrl = url;
            return rentalVehiclesApi.update(vehicle.id, updateData, token!);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['rental-vehicle', vehicle.id] });
            setImageUrl('');
            toast({ title: 'Zdjęcie dodane' });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    const setPrimaryMutation = useMutation({
        mutationFn: (url: string) => rentalVehiclesApi.update(vehicle.id, { primaryImageUrl: url }, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['rental-vehicle', vehicle.id] });
            toast({ title: 'Zmieniono zdjęcie główne' });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (url: string) => rentalVehiclesApi.update(vehicle.id, {
            imageUrls: (vehicle.imageUrls || []).filter(u => u !== url),
            ...(vehicle.primaryImageUrl === url ? { primaryImageUrl: null } : {})
        }, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['rental-vehicle', vehicle.id] });
            toast({ title: 'Zdjęcie usunięte' });
        }
    });

    const reorderMutation = useMutation({
        mutationFn: (newUrls: string[]) => rentalVehiclesApi.update(vehicle.id, { imageUrls: newUrls }, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['rental-vehicle', vehicle.id] });
            toast({ title: 'Kolejność zmieniona' });
        }
    });

    const handleMoveLeft = (index: number) => {
        if (index === 0) return;
        const newUrls = [...(vehicle.imageUrls || [])];
        const temp = newUrls[index - 1];
        newUrls[index - 1] = newUrls[index];
        newUrls[index] = temp;
        reorderMutation.mutate(newUrls);
    };

    const handleMoveRight = (index: number) => {
        const urls = vehicle.imageUrls || [];
        if (index === urls.length - 1) return;
        const newUrls = [...urls];
        const temp = newUrls[index + 1];
        newUrls[index + 1] = newUrls[index];
        newUrls[index] = temp;
        reorderMutation.mutate(newUrls);
    };

    return (
        <div className="space-y-3 mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Zdjęcia ({vehicle.imageUrls?.length || 0})
            </h4>

            {vehicle.imageUrls?.length > 0 && (
                <div className="flex gap-4 flex-wrap">
                    {vehicle.imageUrls.map((url, i) => (
                        <div key={i} className={`group relative w-32 h-32 rounded-lg overflow-hidden border-2 ${url === vehicle.primaryImageUrl ? 'border-blue-500 shadow-md' : 'border-gray-200'}`}>
                            <img src={url} alt={`Zdjęcie ${i + 1}`} className="w-full h-full object-cover" />
                            {url === vehicle.primaryImageUrl && (
                                <span className="absolute top-0 left-0 right-0 bg-blue-500/80 text-white text-[10px] font-bold py-0.5 text-center uppercase tracking-wider backdrop-blur-sm">Główne</span>
                            )}
                            
                            {/* Hover ActionsOverlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1">
                                <div className="flex justify-between items-center bg-white/10 rounded backdrop-blur p-1">
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => handleMoveLeft(i)} 
                                            disabled={i === 0 || reorderMutation.isPending}
                                            className="p-1 hover:bg-black/30 rounded text-white disabled:opacity-30 transition-colors"
                                            title="Przesuń w lewo"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleMoveRight(i)} 
                                            disabled={i === (vehicle.imageUrls?.length || 0) - 1 || reorderMutation.isPending}
                                            className="p-1 hover:bg-black/30 rounded text-white disabled:opacity-30 transition-colors"
                                            title="Przesuń w prawo"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex gap-1">
                                        {url !== vehicle.primaryImageUrl && (
                                            <button 
                                                onClick={() => setPrimaryMutation.mutate(url)}
                                                disabled={setPrimaryMutation.isPending}
                                                className="p-1 hover:bg-blue-500/50 rounded text-blue-200 transition-colors"
                                                title="Ustaw jako główne"
                                            >
                                                <Star className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => {
                                                if(confirm('Pewnie że usunąć zdjęcie?')) deleteMutation.mutate(url);
                                            }}
                                            disabled={deleteMutation.isPending}
                                            className="p-1 hover:bg-red-500/50 rounded text-red-200 transition-colors"
                                            title="Usuń zdjęcie"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add by URL */}
            <div className="flex gap-2 items-end">
                <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Dodaj zdjęcie po URL:</label>
                    <Input
                        value={imageUrl}
                        onChange={e => setImageUrl(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        className="h-8 text-sm"
                        onKeyDown={e => { if (e.key === 'Enter' && imageUrl) { e.preventDefault(); addUrlMutation.mutate(imageUrl); } }}
                    />
                </div>
                <Button size="sm" onClick={() => addUrlMutation.mutate(imageUrl)} disabled={!imageUrl || addUrlMutation.isPending} className="h-8">
                    Dodaj
                </Button>
            </div>

            {/* Upload from disk */}
            <div>
                <label className="text-xs text-gray-500 block mb-1">Lub wgraj z dysku:</label>
                <input
                    ref={imageFileRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={e => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) uploadMutation.mutate(files);
                    }}
                    className="hidden"
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => imageFileRef.current?.click()}
                    disabled={uploadMutation.isPending}
                    className="gap-2"
                >
                    <Upload className="w-4 h-4" />
                    {uploadMutation.isPending ? 'Wgrywanie...' : 'Dodaj zdjęcia'}
                </Button>
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function RentalVehiclesPage() {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [view, setView] = useState<'list' | 'add' | 'edit'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const vehiclesQuery = useQuery({
        queryKey: ['rental-vehicles', page, search],
        queryFn: () => rentalVehiclesApi.list({ page: String(page), limit: '20', search: search || undefined }, token!),
        enabled: !!token
    });

    const companiesQuery = useQuery({
        queryKey: ['rental-companies'],
        queryFn: () => rentalCompaniesApi.list(token!),
        enabled: !!token
    });

    // For dealer list, use a simple fetch
    const dealersQuery = useQuery({
        queryKey: ['dealers-simple'],
        queryFn: async () => {
            const res = await fetch(`/api/rental-vehicles?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
            // Fallback: fetch dealers from existing listings endpoint
            const listingsRes = await fetch(`/api/listings?perPage=1`, {});
            const data = await listingsRes.json();
            // Extract unique dealers
            const dealerMap = new Map<string, any>();
            if (data?.listings) {
                data.listings.forEach((l: any) => {
                    if (l.dealer) dealerMap.set(l.dealer.id, l.dealer);
                });
            }
            return Array.from(dealerMap.values());
        },
        enabled: !!token
    });

    const vehicleDetailQuery = useQuery({
        queryKey: ['rental-vehicle', editingId],
        queryFn: () => rentalVehiclesApi.get(editingId!, token!),
        enabled: !!editingId && !!token
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => rentalVehiclesApi.create(data, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            setView('list');
            toast({ title: 'Pojazd dodany' });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => rentalVehiclesApi.update(id, data, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['rental-vehicle'] });
            setView('list');
            setEditingId(null);
            toast({ title: 'Pojazd zaktualizowany' });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    const archiveMutation = useMutation({
        mutationFn: (id: string) => rentalVehiclesApi.archive(id, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            toast({ title: 'Pojazd zarchiwizowany' });
        }
    });

    const restoreMutation = useMutation({
        mutationFn: (id: string) => rentalVehiclesApi.restore(id, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            toast({ title: 'Pojazd przywrócony' });
        }
    });

    const toggleFeaturedMutation = useMutation({
        mutationFn: ({ id, isFeatured }: { id: string, isFeatured: boolean }) => rentalVehiclesApi.toggleFeatured(id, isFeatured, token!),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['rental-vehicles'] });
            toast({ 
                title: variables.isFeatured ? 'Pojazd wyróżniony' : 'Wyróżnienie usunięte',
                description: variables.isFeatured ? 'Pojazd będzie promowany w polecanych.' : 'Pojazd usunięty z polecanych.'
            });
        },
        onError: (e: Error) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' })
    });

    const vehicles = vehiclesQuery.data?.vehicles || [];
    const pagination = vehiclesQuery.data?.pagination;
    const companies = companiesQuery.data?.companies || [];
    const dealers = dealersQuery.data || [];

    if (view === 'add') {
        return (
            <div className="p-6 max-w-5xl">
                <h2 className="text-2xl font-bold mb-6">Dodaj pojazd najmu</h2>
                <VehicleDataForm
                    mode="rental"
                    dealers={dealers}
                    companies={companies}
                    onSave={async data => { await createMutation.mutateAsync(data); }}
                    onCancel={() => setView('list')}
                    isSaving={createMutation.isPending}
                />
            </div>
        );
    }

    if (view === 'edit' && editingId && vehicleDetailQuery.data) {
        return (
            <div className="p-6 max-w-5xl">
                <h2 className="text-2xl font-bold mb-6">Edytuj pojazd najmu</h2>
                <VehicleDataForm
                    mode="rental"
                    vehicle={vehicleDetailQuery.data.vehicle}
                    dealers={dealers}
                    companies={companies}
                    onSave={async data => { await updateMutation.mutateAsync({ id: editingId, data }); }}
                    onCancel={() => { setView('list'); setEditingId(null); }}
                    isSaving={updateMutation.isPending}
                    externalButtons
                    formId="edit-vehicle-form"
                />
                <SpecificationSection vehicle={vehicleDetailQuery.data.vehicle} />
                <ImageSection vehicle={vehicleDetailQuery.data.vehicle} />
                <AssignmentSection
                    vehicleId={editingId}
                    assignments={vehicleDetailQuery.data.vehicle.rentalAssignments || []}
                    companies={companies}
                />

                {/* Save / Cancel at the bottom of the page */}
                <div className="flex gap-3 pt-6 mt-6 border-t">
                    <Button type="submit" form="edit-vehicle-form" disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                        {updateMutation.isPending ? 'Zapisywanie...' : 'Zapisz zmiany'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setView('list'); setEditingId(null); }}>Anuluj</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Pojazdy najmu</h2>
                <Button onClick={() => setView('add')} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Dodaj pojazd
                </Button>
            </div>

            {/* Search */}
            <div className="relative mb-4 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Szukaj: marka, model, wersja..."
                    className="pl-10"
                />
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-3 font-medium text-gray-600">ID</th>
                            <th className="text-left p-3 font-medium text-gray-600">Pojazd</th>
                            <th className="text-left p-3 font-medium text-gray-600">Rok</th>
                            <th className="text-left p-3 font-medium text-gray-600">Dealer</th>
                            <th className="text-right p-3 font-medium text-gray-600">Cena kat.</th>
                            <th className="text-center p-3 font-medium text-gray-600">Firmy</th>
                            <th className="text-center p-3 font-medium text-gray-600">Status</th>
                            <th className="text-right p-3 font-medium text-gray-600">Akcje</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vehicles.map((v: any) => (
                            <React.Fragment key={v.id}>
                                <tr
                                    className="border-b hover:bg-gray-50 cursor-pointer"
                                    onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                                >
                                    <td className="p-3">
                                        <CopyableId id={v.id} />
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            {v.primaryImageUrl ? (
                                                <img src={v.primaryImageUrl} className="w-12 h-10 rounded object-cover" alt="" />
                                            ) : (
                                                <div className="w-12 h-10 rounded bg-gray-100 flex items-center justify-center">
                                                    <ImageIcon className="w-4 h-4 text-gray-400" />
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-medium">{v.make} {v.model}</span>
                                                {v.version && <span className="text-gray-500 ml-1">{v.version}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3">{v.productionYear}</td>
                                    <td className="p-3 text-gray-600">{v.dealer?.name}</td>
                                    <td className="p-3 text-right">{v.catalogPrice?.toLocaleString('pl-PL')} zł</td>
                                    <td className="p-3 text-center">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700">
                                            <Link2 className="w-3 h-3" /> {v.rentalAssignments?.length || 0}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs ${v.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {v.isActive ? 'Aktywny' : 'Archiwalny'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => toggleFeaturedMutation.mutate({ id: v.id, isFeatured: !v.isFeatured })}
                                                className={v.isFeatured ? "text-yellow-500 hover:text-yellow-600 bg-yellow-50" : "text-gray-400 hover:text-yellow-500 hover:bg-gray-100"}
                                                title={v.isFeatured ? "Usuń z wyróżnionych" : "Dodaj do wyróżnionych"}
                                            >
                                                <Star className="w-4 h-4" fill={v.isFeatured ? "currentColor" : "none"} />
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => { setEditingId(v.id); setView('edit'); }}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            {v.isActive ? (
                                                <Button size="sm" variant="ghost" onClick={() => archiveMutation.mutate(v.id)}>
                                                    <Archive className="w-4 h-4 text-orange-500" />
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="ghost" onClick={() => restoreMutation.mutate(v.id)}>
                                                    <RotateCcw className="w-4 h-4 text-green-500" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                {expandedId === v.id && (
                                    <tr>
                                        <td colSpan={8} className="p-0 border-b bg-gray-50/50">
                                            <div className="p-4">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
                                                    {v.fuelType && <div><span className="font-medium">Paliwo:</span> {v.fuelType}</div>}
                                                    {v.transmission && <div><span className="font-medium">Skrzynia:</span> {v.transmission}</div>}
                                                    {v.enginePowerHp && <div><span className="font-medium">Moc:</span> {v.enginePowerHp} KM</div>}
                                                    {v.drive && <div><span className="font-medium">Napęd:</span> {v.drive}</div>}
                                                    {v.color && <div><span className="font-medium">Kolor:</span> {v.color}</div>}
                                                    <div><span className="font-medium">Cena sprz.:</span> {v.sellingPrice?.toLocaleString('pl-PL')} zł</div>
                                                </div>
                                                {v.rentalAssignments?.length > 0 && (
                                                    <div className="mt-3 space-y-1">
                                                        {v.rentalAssignments.map((a: any) => (
                                                            <div key={a.id} className="text-xs flex items-center gap-2">
                                                                <Building2 className="w-3 h-3 text-gray-400" />
                                                                <span className="font-medium">{a.rentalCompany?.name}</span>
                                                                {a._count?.matrixEntries > 0 && (
                                                                    <span className="text-green-600">({a._count.matrixEntries} wpisów)</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                        {vehicles.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                    {vehiclesQuery.isLoading ? 'Ładowanie...' : 'Brak pojazdów najmu'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                    <span>Strona {pagination.page} z {pagination.totalPages} ({pagination.total} pojazdów)</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
