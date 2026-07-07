import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { csflowApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, Plus, Loader2 } from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '');

interface CsflowSource {
    id: string;
    name: string;
    slug: string;
    apiUrl: string;
    isEnabled: boolean;
    dealerGroupId: string | null;
    dealerGroup: { id: string; name: string } | null;
    lastSyncAt: string | null;
    activeListings: number;
}

interface DealerGroupOption {
    id: string;
    name: string;
}

export function CSFlowSourcesManager() {
    const { token } = useAuth();
    const [sources, setSources] = useState<CsflowSource[]>([]);
    const [groups, setGroups] = useState<DealerGroupOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formGroupId, setFormGroupId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        setError(null);
        try {
            const [sourcesRes, groupsRes] = await Promise.all([
                csflowApi.getSources(token),
                fetch(`${API_BASE_URL}/api/dealer-groups`, {
                    headers: { Authorization: `Bearer ${token}` },
                }).then(r => (r.ok ? r.json() : { groups: [] })),
            ]);
            setSources(sourcesRes.sources);
            setGroups(groupsRes.groups ?? []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleCreate = async () => {
        if (!token || !formName.trim() || !formUrl.trim()) return;
        setIsSaving(true);
        setError(null);
        try {
            await csflowApi.createSource(
                { name: formName.trim(), apiUrl: formUrl.trim(), dealerGroupId: formGroupId || null },
                token
            );
            setFormName(''); setFormUrl(''); setFormGroupId('');
            setShowForm(false);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (source: CsflowSource, enabled: boolean) => {
        if (!token) return;
        if (!enabled && !window.confirm(
            `Wyłączenie źródła "${source.name}" zarchiwizuje ${source.activeListings} aktywnych ofert. Kontynuować?`
        )) return;
        try {
            await csflowApi.updateSource(source.id, { isEnabled: enabled }, token);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleGroupChange = async (source: CsflowSource, dealerGroupId: string) => {
        if (!token) return;
        try {
            await csflowApi.updateSource(source.id, { dealerGroupId: dealerGroupId || null }, token);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleSync = async (source: CsflowSource) => {
        if (!token) return;
        setSyncingId(source.id);
        setSyncMessage(null);
        try {
            const { result } = await csflowApi.syncSource(source.id, token);
            setSyncMessage(
                `${source.name}: dodano ${result.inserted}, zaktualizowano ${result.updated}, zarchiwizowano ${result.archived}, błędy ${result.failed}`
            );
            await loadData();
        } catch (err: any) {
            setSyncMessage(`${source.name}: błąd — ${err.message}`);
        } finally {
            setSyncingId(null);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Źródła CSFlow</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}>
                    <Plus className="h-4 w-4 mr-1" /> Dodaj źródło
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && <p className="text-sm text-destructive">{error}</p>}
                {syncMessage && <p className="text-sm text-muted-foreground">{syncMessage}</p>}

                {showForm && (
                    <div className="border rounded-md p-4 space-y-3">
                        <div>
                            <Label htmlFor="csflow-src-name">Nazwa</Label>
                            <Input id="csflow-src-name" value={formName} onChange={e => setFormName(e.target.value)} placeholder="np. Grupa Carsed" />
                        </div>
                        <div>
                            <Label htmlFor="csflow-src-url">Adres API</Label>
                            <Input id="csflow-src-url" value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="https://webapi.carsed.csflow.pl" />
                        </div>
                        <div>
                            <Label htmlFor="csflow-src-group">Grupa dealerska (opcjonalnie)</Label>
                            <select
                                id="csflow-src-group"
                                className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                value={formGroupId}
                                onChange={e => setFormGroupId(e.target.value)}
                            >
                                <option value="">— brak —</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                        <Button onClick={handleCreate} disabled={isSaving || !formName.trim() || !formUrl.trim()}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Zapisz źródło
                        </Button>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie źródeł...
                    </div>
                ) : sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Brak skonfigurowanych źródeł CSFlow.</p>
                ) : (
                    <div className="space-y-3">
                        {sources.map(source => (
                            <div key={source.id} className="border rounded-md p-4 flex flex-wrap items-center gap-4">
                                <div className="flex-1 min-w-[220px]">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{source.name}</span>
                                        <Badge variant={source.isEnabled ? 'default' : 'secondary'}>
                                            {source.isEnabled ? 'Włączone' : 'Wyłączone'}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{source.apiUrl}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Aktywne oferty: {source.activeListings}
                                        {source.lastSyncAt && ` · Ostatnia synchronizacja: ${new Date(source.lastSyncAt).toLocaleString('pl-PL')}`}
                                    </p>
                                </div>
                                <select
                                    className="h-9 border rounded-md px-2 text-sm bg-background"
                                    value={source.dealerGroupId ?? ''}
                                    onChange={e => handleGroupChange(source, e.target.value)}
                                    title="Grupa dealerska"
                                >
                                    <option value="">— brak grupy —</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                                <Switch
                                    checked={source.isEnabled}
                                    onCheckedChange={checked => handleToggle(source, checked)}
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!source.isEnabled || syncingId !== null}
                                    onClick={() => handleSync(source)}
                                >
                                    {syncingId === source.id
                                        ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                        : <RefreshCw className="h-4 w-4 mr-1" />}
                                    Synchronizuj
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
