import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Store, Plus, Edit2, Trash2, Network, AlertTriangle, UserCheck, X, Save, Loader2, Car, ChevronDown, Copy, Check, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '');

interface Dealer {
    id: string;
    name: string;
    addressLine1: string;
    city: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    contactName: string | null;
    dealerGroupId: string | null;
    dealerGroup: { id: string; name: string } | null;
    _count: { listings: number; rentalVehicles: number };
    hasAdminAccount: boolean;
    isAssignedToGroup: boolean;
}

interface DealerGroup {
    id: string;
    name: string;
}

/* ─── Inline Edit Form ─── */
function InlineEditForm({
    dealer,
    groups,
    onSave,
    onCancel,
    isPending,
}: {
    dealer: Dealer;
    groups: DealerGroup[];
    onSave: (data: any) => void;
    onCancel: () => void;
    isPending: boolean;
}) {
    const [form, setForm] = useState({
        name: dealer.name,
        addressLine1: dealer.addressLine1,
        city: dealer.city || '',
        contactPhone: dealer.contactPhone || '',
        contactEmail: dealer.contactEmail || '',
        contactName: dealer.contactName || '',
        dealerGroupId: dealer.dealerGroupId || '',
    });

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Scroll into view smoothly when expanded
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, []);

    return (
        <div
            ref={containerRef}
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ animation: 'slideDown 0.25s ease-out' }}
        >
            <div className="px-4 pb-4 pt-2 border-t border-blue-100 bg-gradient-to-b from-blue-50/60 to-white">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                    <Input
                        placeholder="Nazwa firmy *"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="bg-white"
                    />
                    <Input
                        placeholder="Adres *"
                        value={form.addressLine1}
                        onChange={e => setForm(f => ({ ...f, addressLine1: e.target.value }))}
                        className="bg-white"
                    />
                    <Input
                        placeholder="Miasto"
                        value={form.city}
                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        className="bg-white"
                    />
                    <Input
                        placeholder="Osoba kontaktowa"
                        value={form.contactName}
                        onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                        className="bg-white"
                    />
                    <Input
                        placeholder="Email"
                        value={form.contactEmail}
                        onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                        className="bg-white"
                    />
                    <Input
                        placeholder="Telefon"
                        value={form.contactPhone}
                        onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                        className="bg-white"
                    />
                    <Select
                        value={form.dealerGroupId || 'none'}
                        onValueChange={v => setForm(f => ({ ...f, dealerGroupId: v === 'none' ? '' : v }))}
                    >
                        <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Grupa dealerska" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Brak grupy</SelectItem>
                            {groups.map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        onClick={() => onSave(form)}
                        disabled={!form.name || !form.addressLine1 || isPending}
                        className="gap-1.5"
                    >
                        {isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Save className="w-3.5 h-3.5" />
                        )}
                        Zapisz
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1">
                        <X className="w-3.5 h-3.5" /> Anuluj
                    </Button>
                </div>
            </div>
        </div>
    );
}

/* ─── Copyable ID ─── */
function CopyableId({ id }: { id: string }) {
    const [copied, setCopied] = useState(false);
    const short = id.length > 8 ? `${id.slice(0, 8)}…` : id;

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-50 hover:bg-blue-50 text-[11px] font-mono text-gray-500 hover:text-blue-600 transition-colors border border-gray-200/50"
            title={`Kliknij, aby skopiować ID: ${id}`}
        >
            <span>ID: {short}</span>
            {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
        </button>
    );
}

export default function DealersPage() {
    const { token } = useAuth();
    const { config } = useBrand();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unassigned'>('all');
    const [groupFilter, setGroupFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [createForm, setCreateForm] = useState({
        name: '', addressLine1: '', city: '', contactPhone: '',
        contactEmail: '', contactName: '', dealerGroupId: '',
    });

    // Load dealers
    const { data: dealersData, isLoading } = useQuery({
        queryKey: ['admin-dealers', filter, groupFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filter === 'unassigned') params.append('unassigned', 'true');
            if (groupFilter !== 'all') params.append('groupId', groupFilter);

            const res = await fetch(`${API_BASE_URL}/api/admin/dealers?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to load dealers');
            return res.json() as Promise<{ dealers: Dealer[] }>;
        },
        enabled: !!token,
    });

    // Load groups for select
    const { data: groupsData } = useQuery({
        queryKey: ['dealer-groups-select'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/dealer-groups`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) return { groups: [] };
            return res.json() as Promise<{ groups: DealerGroup[] }>;
        },
        enabled: !!token,
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof createForm) => {
            const res = await fetch(`${API_BASE_URL}/api/admin/dealers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    ...data,
                    dealerGroupId: data.dealerGroupId || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Create failed');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-dealers'] });
            toast({ title: 'Dealer utworzony' });
            setShowCreate(false);
            setCreateForm({ name: '', addressLine1: '', city: '', contactPhone: '', contactEmail: '', contactName: '', dealerGroupId: '' });
        },
        onError: (err: Error) => {
            toast({ title: 'Błąd', description: err.message, variant: 'destructive' });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const res = await fetch(`${API_BASE_URL}/api/admin/dealers/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    ...data,
                    dealerGroupId: data.dealerGroupId || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Update failed');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-dealers'] });
            toast({ title: 'Zapisano' });
            setEditingId(null);
        },
        onError: (err: Error) => {
            toast({ title: 'Błąd', description: err.message, variant: 'destructive' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/api/admin/dealers/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Delete failed');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-dealers'] });
            toast({ title: 'Usunięto' });
        },
        onError: (err: Error) => {
            toast({ title: 'Błąd', description: err.message, variant: 'destructive' });
        },
    });

    const dealers = (dealersData?.dealers || []).filter(d => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            d.name.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q) ||
            (d.city && d.city.toLowerCase().includes(q)) ||
            (d.contactEmail && d.contactEmail.toLowerCase().includes(q)) ||
            (d.contactPhone && d.contactPhone.toLowerCase().includes(q)) ||
            (d.dealerGroup?.name && d.dealerGroup.name.toLowerCase().includes(q))
        );
    });
    const groups = groupsData?.groups || [];

    return (
        <div className="space-y-6">
            {/* CSS for slide animation */}
            <style>{`
                @keyframes slideDown {
                    from { max-height: 0; opacity: 0; }
                    to   { max-height: 400px; opacity: 1; }
                }
            `}</style>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dealerzy</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {dealers.length} dealerów
                        {dealers.filter(d => !d.isAssignedToGroup).length > 0 && (
                            <span className="text-amber-600 ml-2">
                                · {dealers.filter(d => !d.isAssignedToGroup).length} bez grupy
                            </span>
                        )}
                    </p>
                </div>
                <Button onClick={() => { setShowCreate(s => !s); setEditingId(null); }} className="gap-2">
                    {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showCreate ? 'Zamknij' : 'Nowy dealer'}
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 items-center flex-wrap">
                <Select value={filter} onValueChange={(v: 'all' | 'unassigned') => setFilter(v)}>
                    <SelectTrigger className="w-[200px] bg-white">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Wszyscy</SelectItem>
                        <SelectItem value="unassigned">Bez grupy</SelectItem>
                    </SelectContent>
                </Select>

                <div className="relative w-[250px] shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Szukaj po nazwie, ID..."
                        className="pl-9 bg-white"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {filter === 'all' && groups.length > 0 && (
                    <Select value={groupFilter} onValueChange={setGroupFilter}>
                        <SelectTrigger className="w-[250px] bg-white">
                            <SelectValue placeholder="Filtruj po grupie" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie grupy</SelectItem>
                            {groups.map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Create Form */}
            {showCreate && (
                <Card className="border-blue-200 bg-blue-50/30">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Nowy dealer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Input placeholder="Nazwa firmy *" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
                            <Input placeholder="Adres *" value={createForm.addressLine1} onChange={e => setCreateForm(f => ({ ...f, addressLine1: e.target.value }))} />
                            <Input placeholder="Miasto" value={createForm.city} onChange={e => setCreateForm(f => ({ ...f, city: e.target.value }))} />
                            <Input placeholder="Osoba kontaktowa" value={createForm.contactName} onChange={e => setCreateForm(f => ({ ...f, contactName: e.target.value }))} />
                            <Input placeholder="Email" value={createForm.contactEmail} onChange={e => setCreateForm(f => ({ ...f, contactEmail: e.target.value }))} />
                            <Input placeholder="Telefon" value={createForm.contactPhone} onChange={e => setCreateForm(f => ({ ...f, contactPhone: e.target.value }))} />
                            <Select value={createForm.dealerGroupId || 'none'} onValueChange={v => setCreateForm(f => ({ ...f, dealerGroupId: v === 'none' ? '' : v }))}>
                                <SelectTrigger><SelectValue placeholder="Grupa dealerska" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Brak grupy</SelectItem>
                                    {groups.map(g => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button
                                onClick={() => createMutation.mutate(createForm)}
                                disabled={!createForm.name || !createForm.addressLine1 || createMutation.isPending}
                                className="gap-2"
                            >
                                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Utwórz
                            </Button>
                            <Button variant="outline" onClick={() => setShowCreate(false)}>
                                <X className="w-4 h-4 mr-1" /> Anuluj
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Dealers List */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : dealers.length === 0 ? (
                <Card className="py-12">
                    <div className="text-center text-gray-400">
                        <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg font-medium">Brak dealerów</p>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {dealers.map(dealer => (
                        <Card
                            key={dealer.id}
                            className={`transition-all duration-200 ${editingId === dealer.id
                                ? 'ring-2 ring-blue-300 shadow-lg border-blue-200'
                                : 'hover:shadow-md'
                            }`}
                        >
                            <CardContent className="p-0">
                                {/* Dealer row header */}
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shrink-0">
                                            <Store className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold text-gray-900">{dealer.name}</h3>

                                                {config.id === 'motolia' && (
                                                    <CopyableId id={dealer.id} />
                                                )}

                                                {!dealer.isAssignedToGroup && (
                                                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Brak grupy
                                                    </Badge>
                                                )}
                                                {dealer.isAssignedToGroup && (
                                                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 gap-1">
                                                        <Network className="w-3 h-3" />
                                                        {dealer.dealerGroup?.name}
                                                    </Badge>
                                                )}
                                                {!dealer.hasAdminAccount && (
                                                    <Badge variant="outline" className="text-gray-500 border-gray-200 gap-1">
                                                        Brak konta admin
                                                    </Badge>
                                                )}
                                                {dealer.hasAdminAccount && (
                                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1">
                                                        <UserCheck className="w-3 h-3" />
                                                        Ma admin
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                                {dealer.city && <span>{dealer.city}</span>}
                                                <span className="flex items-center gap-1">
                                                    <Car className="w-3.5 h-3.5" />
                                                    {dealer._count.listings} pojazdów
                                                </span>
                                                {dealer.contactEmail && <span>· {dealer.contactEmail}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            variant={editingId === dealer.id ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setEditingId(editingId === dealer.id ? null : dealer.id)}
                                            className="gap-1"
                                        >
                                            {editingId === dealer.id ? (
                                                <>
                                                    <ChevronDown className="w-3.5 h-3.5 rotate-180 transition-transform" />
                                                    Zwiń
                                                </>
                                            ) : (
                                                <>
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                    Edytuj
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                if (confirm(`Usunąć "${dealer.name}"?`)) {
                                                    deleteMutation.mutate(dealer.id);
                                                }
                                            }}
                                            className="gap-1 text-red-600 hover:text-red-700 hover:border-red-300"
                                            disabled={dealer._count.listings > 0}
                                            title={dealer._count.listings > 0 ? 'Usuń najpierw pojazdy' : undefined}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Inline edit form — accordion */}
                                {editingId === dealer.id && (
                                    <InlineEditForm
                                        dealer={dealer}
                                        groups={groups}
                                        onSave={(data) => updateMutation.mutate({ id: dealer.id, data })}
                                        onCancel={() => setEditingId(null)}
                                        isPending={updateMutation.isPending}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
