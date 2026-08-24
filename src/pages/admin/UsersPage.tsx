import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    Plus, RefreshCw, Save, Trash2, Users, Shield, Store, Network,
    ChevronDown, Edit2, X, Loader2, UserPlus, Building2
} from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '');

/* ─── Types ─── */
type ScopeType = 'PLATFORM' | 'DEALER_GROUP' | 'DEALER';
type MemberRole =
    | 'SUPERADMIN_PLATFORM'
    | 'PLATFORM_MANAGER'
    | 'CONTENT_MANAGER_PLATFORM'
    | 'DEALER_GROUP_ADMIN'
    | 'DEALER_ADMIN'
    | 'DEALER_EMPLOYEE';

interface Membership {
    id: string;
    scopeType: ScopeType;
    scopeId: string;
    role: MemberRole;
    isDefaultContext: boolean;
}

interface UserRecord {
    id: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    role: string;
    isActive: boolean;
    lastLogin?: string | null;
    createdAt?: string;
    memberships: Membership[];
}

interface DealerGroup { id: string; name: string }
interface Dealer { id: string; name: string; dealerGroupId?: string | null }

/* ─── Role labels & scope mapping ─── */
const SCOPE_ROLES: Record<ScopeType, { value: MemberRole; label: string }[]> = {
    PLATFORM: [
        { value: 'SUPERADMIN_PLATFORM', label: 'Super Admin' },
        { value: 'PLATFORM_MANAGER', label: 'Manager Platformy' },
        { value: 'CONTENT_MANAGER_PLATFORM', label: 'Content Manager' },
    ],
    DEALER_GROUP: [
        { value: 'DEALER_GROUP_ADMIN', label: 'Admin Grupy' },
    ],
    DEALER: [
        { value: 'DEALER_ADMIN', label: 'Admin Dealera' },
        { value: 'DEALER_EMPLOYEE', label: 'Pracownik' },
    ],
};

const ROLE_LABELS: Record<string, string> = {
    SUPERADMIN_PLATFORM: 'Super Admin',
    PLATFORM_MANAGER: 'Manager',
    CONTENT_MANAGER_PLATFORM: 'Content Manager',
    DEALER_GROUP_ADMIN: 'Admin Grupy',
    DEALER_ADMIN: 'Admin Dealera',
    DEALER_EMPLOYEE: 'Pracownik',
};

const ROLE_COLORS: Record<string, string> = {
    SUPERADMIN_PLATFORM: 'text-purple-700 bg-purple-50 border-purple-200',
    PLATFORM_MANAGER: 'text-blue-700 bg-blue-50 border-blue-200',
    CONTENT_MANAGER_PLATFORM: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    DEALER_GROUP_ADMIN: 'text-orange-700 bg-orange-50 border-orange-200',
    DEALER_ADMIN: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    DEALER_EMPLOYEE: 'text-gray-700 bg-gray-50 border-gray-200',
};

/* ─── Component ─── */
export default function UsersPage() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const [scopeFilter, setScopeFilter] = useState<ScopeType>('PLATFORM');
    const [scopeIdFilter, setScopeIdFilter] = useState<string>('all');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    // Form for create
    const [form, setForm] = useState({
        email: '',
        name: '',
        phone: '',
        password: '',
        membershipScopeType: 'DEALER' as ScopeType,
        membershipScopeId: '',
        membershipRole: 'DEALER_EMPLOYEE' as MemberRole,
        isActive: true,
    });

    // Form for inline edit
    const [editForm, setEditForm] = useState({
        email: '',
        name: '',
        phone: '',
        password: '',
        isActive: true,
    });

    /* ─── Data Queries ─── */
    const { data: usersData, isLoading } = useQuery({
        queryKey: ['users', scopeFilter, scopeIdFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (scopeFilter !== 'PLATFORM' && scopeIdFilter && scopeIdFilter !== 'all') {
                params.append('scopeType', scopeFilter);
                params.append('scopeId', scopeIdFilter);
            } else if (scopeFilter === 'PLATFORM') {
                params.append('scopeType', 'PLATFORM');
                params.append('scopeId', 'PLATFORM');
            }
            const res = await fetch(`${API_BASE_URL}/api/users?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to fetch users');
            return res.json() as Promise<{ users: UserRecord[] }>;
        },
        enabled: !!token,
    });

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

    const { data: dealersData } = useQuery({
        queryKey: ['admin-dealers-all'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/admin/dealers`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) return { dealers: [] };
            return res.json() as Promise<{ dealers: Dealer[] }>;
        },
        enabled: !!token,
    });

    const groups = groupsData?.groups || [];
    const allDealers = dealersData?.dealers || [];
    const users = usersData?.users || [];

    // Filter dealers by selected group in form (for cascading select)
    const filteredDealersForForm = useMemo(() => {
        if (form.membershipScopeType !== 'DEALER') return [];
        return allDealers;
    }, [form.membershipScopeType, allDealers]);

    /* ─── Mutations ─── */
    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Create failed');
            return data;
        },
        onSuccess: () => {
            toast.success('Użytkownik utworzony');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setShowCreate(false);
            resetCreateForm();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const payload = { ...data };
            if (!payload.password) delete payload.password;
            const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Update failed');
            return result;
        },
        onSuccess: () => {
            toast.success('Zapisano');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setEditingId(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            return data;
        },
        onSuccess: () => {
            toast.success('Użytkownik usunięty');
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const resetCreateForm = () => setForm({
        email: '', name: '', phone: '', password: '',
        membershipScopeType: 'DEALER',
        membershipScopeId: '',
        membershipRole: 'DEALER_EMPLOYEE',
        isActive: true,
    });

    const startEdit = (u: UserRecord) => {
        setEditingId(u.id);
        setEditForm({
            email: u.email,
            name: u.name || '',
            phone: u.phone || '',
            password: '',
            isActive: u.isActive,
        });
    };

    // Get the "best" membership role for a user
    const getPrimaryRole = (u: UserRecord): MemberRole | null => {
        if (!u.memberships?.length) return null;
        const defaultMembership = u.memberships.find(m => m.isDefaultContext);
        return (defaultMembership || u.memberships[0]).role;
    };

    // Determine scope label for a membership
    const getScopeLabel = (m: Membership): string => {
        if (m.scopeType === 'PLATFORM') return 'Platforma';
        if (m.scopeType === 'DEALER_GROUP') {
            const g = groups.find(g => g.id === m.scopeId);
            return g ? `Grupa: ${g.name}` : `Grupa: ${m.scopeId.slice(0, 8)}…`;
        }
        if (m.scopeType === 'DEALER') {
            const d = allDealers.find(d => d.id === m.scopeId);
            return d ? d.name : `Dealer: ${m.scopeId.slice(0, 8)}…`;
        }
        return m.scopeType;
    };

    /* ─── Scope tabs: Platforma / Grupy / Dealerzy ─── */
    const scopeTabs: { value: ScopeType; label: string; icon: React.ReactNode }[] = [
        { value: 'PLATFORM', label: 'Platforma', icon: <Shield className="w-4 h-4" /> },
        { value: 'DEALER_GROUP', label: 'Grupy dealerskie', icon: <Network className="w-4 h-4" /> },
        { value: 'DEALER', label: 'Dealerzy', icon: <Store className="w-4 h-4" /> },
    ];

    return (
        <div className="space-y-6">
            {/* CSS for slide animation */}
            <style>{`
                @keyframes slideDown {
                    from { max-height: 0; opacity: 0; }
                    to   { max-height: 500px; opacity: 1; }
                }
            `}</style>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-6 h-6 text-blue-600" />
                        Użytkownicy
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Zarządzaj kontami w kontekście platformy, grup dealerskich i dealerów.
                    </p>
                </div>
                <Button
                    onClick={() => { setShowCreate(s => !s); setEditingId(null); }}
                    className="gap-2"
                >
                    {showCreate ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {showCreate ? 'Zamknij' : 'Nowy użytkownik'}
                </Button>
            </div>

            {/* Scope Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {scopeTabs.map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => { setScopeFilter(tab.value); setScopeIdFilter('all'); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            scopeFilter === tab.value
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Scope ID selector (for group or dealer) */}
            {scopeFilter === 'DEALER_GROUP' && groups.length > 0 && (
                <Select value={scopeIdFilter} onValueChange={setScopeIdFilter}>
                    <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="Wybierz grupę dealerską" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Wszystkie grupy</SelectItem>
                        {groups.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            {scopeFilter === 'DEALER' && allDealers.length > 0 && (
                <Select value={scopeIdFilter} onValueChange={setScopeIdFilter}>
                    <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="Wybierz dealera" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Wszyscy dealerzy</SelectItem>
                        {allDealers.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            {/* Create Form */}
            {showCreate && (
                <Card className="border-blue-200 bg-blue-50/30">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-blue-600" />
                            Nowy użytkownik
                        </CardTitle>
                        <CardDescription>Utwórz konto z przypisaną rolą i kontekstem.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Credentials */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500 uppercase tracking-wide">Email *</Label>
                                <Input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="email@example.com"
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500 uppercase tracking-wide">Imię i nazwisko</Label>
                                <Input
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Jan Kowalski"
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500 uppercase tracking-wide">Hasło *</Label>
                                <Input
                                    type="password"
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    placeholder="Min. 6 znaków"
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500 uppercase tracking-wide">Telefon</Label>
                                <Input
                                    value={form.phone}
                                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                    placeholder="Opcjonalnie"
                                    className="bg-white"
                                />
                            </div>

                            {/* Scope selection */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500 uppercase tracking-wide">Kontekst</Label>
                                <Select
                                    value={form.membershipScopeType}
                                    onValueChange={(v: ScopeType) => {
                                        setForm(f => ({
                                            ...f,
                                            membershipScopeType: v,
                                            membershipScopeId: v === 'PLATFORM' ? 'PLATFORM' : '',
                                            membershipRole: SCOPE_ROLES[v][0].value,
                                        }));
                                    }}
                                >
                                    <SelectTrigger className="bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PLATFORM">
                                            <span className="flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> Platforma</span>
                                        </SelectItem>
                                        <SelectItem value="DEALER_GROUP">
                                            <span className="flex items-center gap-2"><Network className="w-3.5 h-3.5" /> Grupa dealerska</span>
                                        </SelectItem>
                                        <SelectItem value="DEALER">
                                            <span className="flex items-center gap-2"><Store className="w-3.5 h-3.5" /> Dealer</span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Scope target (group or dealer) */}
                            {form.membershipScopeType === 'DEALER_GROUP' && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Grupa dealerska *</Label>
                                    <Select
                                        value={form.membershipScopeId || 'none'}
                                        onValueChange={v => setForm(f => ({ ...f, membershipScopeId: v === 'none' ? '' : v }))}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Wybierz grupę" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none" disabled>Wybierz…</SelectItem>
                                            {groups.map(g => (
                                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {form.membershipScopeType === 'DEALER' && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Dealer *</Label>
                                    <Select
                                        value={form.membershipScopeId || 'none'}
                                        onValueChange={v => setForm(f => ({ ...f, membershipScopeId: v === 'none' ? '' : v }))}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Wybierz dealera" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none" disabled>Wybierz…</SelectItem>
                                            {filteredDealersForForm.map(d => (
                                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Role */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500 uppercase tracking-wide">Rola</Label>
                                <Select
                                    value={form.membershipRole}
                                    onValueChange={(v: MemberRole) => setForm(f => ({ ...f, membershipRole: v }))}
                                >
                                    <SelectTrigger className="bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SCOPE_ROLES[form.membershipScopeType].map(r => (
                                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-5">
                            <Button
                                onClick={() => createMutation.mutate()}
                                disabled={
                                    !form.email || !form.password ||
                                    (form.membershipScopeType !== 'PLATFORM' && !form.membershipScopeId) ||
                                    createMutation.isPending
                                }
                                className="gap-2"
                            >
                                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Utwórz użytkownika
                            </Button>
                            <Button variant="outline" onClick={() => { setShowCreate(false); resetCreateForm(); }}>
                                <X className="w-4 h-4 mr-1" /> Anuluj
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Users List */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : users.length === 0 ? (
                <Card className="py-12">
                    <div className="text-center text-gray-400">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg font-medium">Brak użytkowników</p>
                        <p className="text-sm mt-1">{
                            scopeFilter !== 'PLATFORM' && scopeIdFilter === 'all'
                                ? 'Wybierz konkretną grupę lub dealera aby zobaczyć użytkowników'
                                : 'Utwórz pierwszego użytkownika klikając "Nowy użytkownik"'
                        }</p>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-3">
                    <p className="text-sm text-gray-500">
                        {users.length} {users.length === 1 ? 'użytkownik' : users.length < 5 ? 'użytkowników' : 'użytkowników'}
                    </p>
                    {users.map(u => {
                        const primaryRole = getPrimaryRole(u);
                        const isEditing = editingId === u.id;

                        return (
                            <Card
                                key={u.id}
                                className={`transition-all duration-200 ${
                                    isEditing ? 'ring-2 ring-blue-300 shadow-lg border-blue-200' : 'hover:shadow-md'
                                }`}
                            >
                                <CardContent className="p-0">
                                    {/* User row */}
                                    <div className="flex items-center justify-between p-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${
                                                primaryRole?.includes('PLATFORM')
                                                    ? 'bg-gradient-to-tr from-purple-500 to-blue-500'
                                                    : primaryRole?.includes('GROUP')
                                                    ? 'bg-gradient-to-tr from-orange-500 to-amber-500'
                                                    : 'bg-gradient-to-tr from-emerald-500 to-teal-500'
                                            }`}>
                                                {primaryRole?.includes('PLATFORM') ? (
                                                    <Shield className="w-5 h-5" />
                                                ) : primaryRole?.includes('GROUP') ? (
                                                    <Network className="w-5 h-5" />
                                                ) : (
                                                    <Store className="w-5 h-5" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-semibold text-gray-900">
                                                        {u.name || u.email}
                                                    </h3>
                                                    {primaryRole && (
                                                        <Badge
                                                            variant="outline"
                                                            className={`gap-1 ${ROLE_COLORS[primaryRole] || ''}`}
                                                        >
                                                            {ROLE_LABELS[primaryRole] || primaryRole}
                                                        </Badge>
                                                    )}
                                                    <Badge
                                                        variant={u.isActive ? 'default' : 'secondary'}
                                                        className="text-xs"
                                                    >
                                                        {u.isActive ? 'Aktywny' : 'Nieaktywny'}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                                    {u.name && <span>{u.email}</span>}
                                                    {u.memberships?.map(m => (
                                                        <span key={m.id} className="flex items-center gap-1">
                                                            {m.scopeType === 'PLATFORM' ? <Shield className="w-3 h-3" /> :
                                                             m.scopeType === 'DEALER_GROUP' ? <Network className="w-3 h-3" /> :
                                                             <Store className="w-3 h-3" />}
                                                            {getScopeLabel(m)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                variant={isEditing ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => isEditing ? setEditingId(null) : startEdit(u)}
                                                className="gap-1"
                                            >
                                                {isEditing ? (
                                                    <><ChevronDown className="w-3.5 h-3.5 rotate-180" /> Zwiń</>
                                                ) : (
                                                    <><Edit2 className="w-3.5 h-3.5" /> Edytuj</>
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    if (confirm(`Usunąć "${u.name || u.email}"?`)) {
                                                        deleteMutation.mutate(u.id);
                                                    }
                                                }}
                                                className="gap-1 text-red-600 hover:text-red-700 hover:border-red-300"
                                                disabled={deleteMutation.isPending}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Inline edit — accordion */}
                                    {isEditing && (
                                        <div
                                            className="overflow-hidden"
                                            style={{ animation: 'slideDown 0.25s ease-out' }}
                                        >
                                            <div className="px-4 pb-4 pt-2 border-t border-blue-100 bg-gradient-to-b from-blue-50/60 to-white">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-gray-400">Email</Label>
                                                        <Input
                                                            value={editForm.email}
                                                            onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                                                            className="bg-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-gray-400">Imię i nazwisko</Label>
                                                        <Input
                                                            value={editForm.name}
                                                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                            className="bg-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-gray-400">Telefon</Label>
                                                        <Input
                                                            value={editForm.phone}
                                                            onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                                            className="bg-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-gray-400">Nowe hasło (puste = bez zmian)</Label>
                                                        <Input
                                                            type="password"
                                                            value={editForm.password}
                                                            onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                                                            placeholder="••••••"
                                                            className="bg-white"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Memberships */}
                                                {u.memberships?.length > 0 && (
                                                    <div className="mb-3">
                                                        <Label className="text-xs text-gray-400 mb-1 block">Członkostwa</Label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {u.memberships.map(m => (
                                                                <Badge
                                                                    key={m.id}
                                                                    variant="outline"
                                                                    className={`gap-1.5 py-1 ${ROLE_COLORS[m.role] || ''}`}
                                                                >
                                                                    {ROLE_LABELS[m.role] || m.role}
                                                                    <span className="text-gray-400 font-normal">@ {getScopeLabel(m)}</span>
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => updateMutation.mutate({ id: u.id, data: editForm })}
                                                        disabled={updateMutation.isPending}
                                                        className="gap-1.5"
                                                    >
                                                        {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                        Zapisz
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="gap-1">
                                                        <X className="w-3.5 h-3.5" /> Anuluj
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
