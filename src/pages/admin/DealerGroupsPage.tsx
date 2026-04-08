import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, Plus, Edit2, Trash2, Store, X, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '');

interface DealerGroup {
    id: string;
    name: string;
    slug: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    addressLine1: string | null;
    city: string | null;
    nip: string | null;
    isActive: boolean;
    _count: { dealers: number };
}

export default function DealerGroupsPage() {
    const { token } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        name: '', contactName: '', contactEmail: '', contactPhone: '',
        addressLine1: '', city: '', nip: '',
    });

    const { data, isLoading } = useQuery({
        queryKey: ['dealer-groups'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/dealer-groups?includeInactive=true`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to load groups');
            return res.json() as Promise<{ groups: DealerGroup[] }>;
        },
        enabled: !!token,
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof form) => {
            const res = await fetch(`${API_BASE_URL}/api/dealer-groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Create failed');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dealer-groups'] });
            toast({ title: 'Grupa utworzona', description: 'Nowa grupa dealerska została dodana.' });
            setShowCreate(false);
            resetForm();
        },
        onError: (err: Error) => {
            toast({ title: 'Błąd', description: err.message, variant: 'destructive' });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: typeof form }) => {
            const res = await fetch(`${API_BASE_URL}/api/dealer-groups/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Update failed');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dealer-groups'] });
            toast({ title: 'Zapisano', description: 'Grupa została zaktualizowana.' });
            setEditingId(null);
        },
        onError: (err: Error) => {
            toast({ title: 'Błąd', description: err.message, variant: 'destructive' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/api/dealer-groups/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Delete failed');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dealer-groups'] });
            toast({ title: 'Usunięto', description: 'Grupa dealerska została usunięta.' });
        },
        onError: (err: Error) => {
            toast({ title: 'Błąd', description: err.message, variant: 'destructive' });
        },
    });

    const resetForm = () => setForm({
        name: '', contactName: '', contactEmail: '', contactPhone: '',
        addressLine1: '', city: '', nip: '',
    });

    const startEdit = (group: DealerGroup) => {
        setForm({
            name: group.name,
            contactName: group.contactName || '',
            contactEmail: group.contactEmail || '',
            contactPhone: group.contactPhone || '',
            addressLine1: group.addressLine1 || '',
            city: group.city || '',
            nip: group.nip || '',
        });
        setEditingId(group.id);
        setShowCreate(false);
    };

    const groups = data?.groups || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Grupy dealerskie</h1>
                    <p className="text-sm text-gray-500 mt-1">Zarządzaj grupami i przypisanymi dealerami</p>
                </div>
                <Button onClick={() => { setShowCreate(true); setEditingId(null); resetForm(); }} className="gap-2">
                    <Plus className="w-4 h-4" /> Nowa grupa
                </Button>
            </div>

            {/* Create / Edit Form */}
            {(showCreate || editingId) && (
                <Card className="border-blue-200 bg-blue-50/30">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">
                            {editingId ? 'Edytuj grupę' : 'Nowa grupa dealerska'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Input
                                placeholder="Nazwa grupy *"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            />
                            <Input
                                placeholder="Osoba kontaktowa"
                                value={form.contactName}
                                onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                            />
                            <Input
                                placeholder="Email kontaktowy"
                                value={form.contactEmail}
                                onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                            />
                            <Input
                                placeholder="Telefon"
                                value={form.contactPhone}
                                onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                            />
                            <Input
                                placeholder="Adres"
                                value={form.addressLine1}
                                onChange={e => setForm(f => ({ ...f, addressLine1: e.target.value }))}
                            />
                            <Input
                                placeholder="Miasto"
                                value={form.city}
                                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                            />
                            <Input
                                placeholder="NIP"
                                value={form.nip}
                                onChange={e => setForm(f => ({ ...f, nip: e.target.value }))}
                            />
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button
                                onClick={() => {
                                    if (editingId) {
                                        updateMutation.mutate({ id: editingId, data: form });
                                    } else {
                                        createMutation.mutate(form);
                                    }
                                }}
                                disabled={!form.name || createMutation.isPending || updateMutation.isPending}
                                className="gap-2"
                            >
                                {(createMutation.isPending || updateMutation.isPending) ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {editingId ? 'Zapisz' : 'Utwórz'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => { setShowCreate(false); setEditingId(null); resetForm(); }}
                            >
                                <X className="w-4 h-4 mr-1" /> Anuluj
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Groups List */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : groups.length === 0 ? (
                <Card className="py-12">
                    <div className="text-center text-gray-400">
                        <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg font-medium">Brak grup dealerskich</p>
                        <p className="text-sm mt-1">Utwórz pierwszą grupę, aby zacząć organizować dealerów</p>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {groups.map(group => (
                        <Card key={group.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white">
                                            <Network className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-gray-900">{group.name}</h3>
                                                <Badge variant={group.isActive ? "default" : "secondary"}>
                                                    {group.isActive ? 'Aktywna' : 'Nieaktywna'}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Store className="w-3.5 h-3.5" />
                                                    {group._count.dealers} dealerów
                                                </span>
                                                {group.city && <span>· {group.city}</span>}
                                                {group.contactEmail && <span>· {group.contactEmail}</span>}
                                                {group.nip && <span>· NIP: {group.nip}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => startEdit(group)}
                                            className="gap-1"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" /> Edytuj
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                if (confirm(`Usunąć grupę "${group.name}"?`)) {
                                                    deleteMutation.mutate(group.id);
                                                }
                                            }}
                                            className="gap-1 text-red-600 hover:text-red-700 hover:border-red-300"
                                            disabled={group._count.dealers > 0}
                                            title={group._count.dealers > 0 ? 'Usuń najpierw dealerów' : undefined}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Usuń
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
