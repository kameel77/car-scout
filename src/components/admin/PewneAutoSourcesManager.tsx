import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { pewneautoApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, Plus, Loader2, Play, Eye, Trash2, ShieldAlert, CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '');

interface PewneAutoSource {
    id: string;
    name: string;
    slug: string;
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    apiUrl: string;
    isEnabled: boolean;
    dealerGroupId: string | null;
    dealerGroup: { id: string; name: string } | null;
    lastSyncAt: string | null;
    lastSuccessfulSyncAt: string | null;
    lastSuccessfulSyncCount: number | null;
    activeListings: number;
}

interface DealerGroupOption {
    id: string;
    name: string;
}

interface DryRunReportData {
    sourceId: string;
    sourceSlug: string;
    providerName: string;
    totalFetched: number;
    totalActiveInDb: number;
    toInsertCount: number;
    toUpdateCount: number;
    toArchiveCount: number;
    matchedByVinCount: number;
    matchedByExternalIdCount: number;
    priceChangesCount: number;
    reservedCount: number;
    circuitBreakerTriggered: boolean;
    circuitBreakerReason?: string;
    warnings: string[];
    samples: {
        toInsert: Array<{ externalId: string; vin?: string | null; make: string; model: string; pricePln: number }>;
        toUpdate: Array<{ externalId: string; vin?: string | null; make: string; model: string; oldPrice?: number; newPrice: number }>;
        toArchive: Array<{ listingId: string | null; vin?: string | null; make: string; model: string }>;
    };
}

export function PewneAutoSourcesManager() {
    const { token } = useAuth();
    const [sources, setSources] = useState<PewneAutoSource[]>([]);
    const [groups, setGroups] = useState<DealerGroupOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formName, setFormName] = useState('');
    const [formClientId, setFormClientId] = useState('');
    const [formClientSecret, setFormClientSecret] = useState('');
    const [formGroupId, setFormGroupId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Action state
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [dryRunningId, setDryRunningId] = useState<string | null>(null);
    const [dryRunReport, setDryRunReport] = useState<DryRunReportData | null>(null);
    const [showDryRunModal, setShowDryRunModal] = useState(false);

    // Force sync confirmation modal
    const [forceSyncSource, setForceSyncSource] = useState<PewneAutoSource | null>(null);
    const [forceSyncChecked, setForceSyncChecked] = useState(false);

    const loadData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [sourcesRes, groupsRes] = await Promise.all([
                pewneautoApi.getSources(token),
                fetch(`${API_BASE_URL}/api/dealer-groups`, {
                    headers: { Authorization: `Bearer ${token}` }
                }).then(r => (r.ok ? r.json() : { groups: [] }))
            ]);
            setSources(sourcesRes.sources || []);
            setGroups(groupsRes.groups ?? []);
        } catch (err: any) {
            toast.error(err.message || 'Nie udało się załadować źródeł PewneAuto');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreate = async () => {
        if (!token || !formName.trim() || !formClientId.trim() || !formClientSecret.trim()) {
            toast.error('Wypełnij wymagane pola: Nazwa, Client ID, Client Secret');
            return;
        }
        setIsSaving(true);
        try {
            await pewneautoApi.createSource(
                {
                    name: formName.trim(),
                    clientId: formClientId.trim(),
                    clientSecret: formClientSecret.trim(),
                    dealerGroupId: formGroupId || null
                },
                token
            );
            toast.success('Źródło PewneAuto zostało utworzone');
            setFormName('');
            setFormClientId('');
            setFormClientSecret('');
            setFormGroupId('');
            setShowCreateModal(false);
            await loadData();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (source: PewneAutoSource, enabled: boolean) => {
        if (!token) return;
        if (!enabled && !window.confirm(
            `Wyłączenie źródła "${source.name}" zarchiwizuje ${source.activeListings} aktywnych ofert. Kontynuować?`
        )) return;

        try {
            await pewneautoApi.updateSource(source.id, { isEnabled: enabled }, token);
            toast.success(enabled ? 'Włączono źródło' : 'Wyłączono źródło i zarchiwizowano oferty');
            await loadData();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleDelete = async (source: PewneAutoSource) => {
        if (!token) return;
        if (!window.confirm(`Czy na pewno chcesz usunąć źródło "${source.name}"? Spowoduje to archiwizację jego ofert.`)) {
            return;
        }
        try {
            await pewneautoApi.deleteSource(source.id, token);
            toast.success('Źródło zostało usunięte');
            await loadData();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleRunDryRun = async (source: PewneAutoSource) => {
        if (!token) return;
        setDryRunningId(source.id);
        try {
            const res = await pewneautoApi.runDryRun(source.id, token);
            setDryRunReport(res.report);
            setShowDryRunModal(true);
        } catch (err: any) {
            toast.error(err.message || 'Błąd symulacji Dry-Run');
        } finally {
            setDryRunningId(null);
        }
    };

    const handleSync = async (source: PewneAutoSource, force: boolean = false) => {
        if (!token) return;
        setSyncingId(source.id);
        try {
            const res = await pewneautoApi.syncSource(source.id, token, force);
            if (res.result?.circuitBreakerTriggered) {
                toast.warning(`Wstrzymano przez bezpiecznik wolumenowy: ${res.result.error}`);
            } else {
                toast.success(
                    `Synchronizacja zakończona: dodano ${res.result.inserted}, zaktualizowano ${res.result.updated}, zarchiwizowano ${res.result.archived}`
                );
            }
            setForceSyncSource(null);
            setForceSyncChecked(false);
            await loadData();
        } catch (err: any) {
            toast.error(err.message || 'Błąd synchronizacji');
        } finally {
            setSyncingId(null);
        }
    };

    return (
        <Card className="mb-8 border-indigo-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Key className="w-5 h-5 text-indigo-600" />
                        Integracja API PewneAuto (Toyota / Lexus)
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-500 mt-1">
                        Zautomatyzowana synchronizacja OAuth2, bezpiecznik wolumenowy (Circuit Breaker) i tryb Dry-Run.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadData}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                        Odśwież
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => setShowCreateModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Dodaj źródło PewneAuto
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Ładowanie źródeł PewneAuto...
                    </div>
                ) : sources.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed text-gray-500">
                        <p className="text-sm">Brak skonfigurowanych źródeł PewneAuto.</p>
                        <p className="text-xs text-gray-400 mt-1">
                            Kliknij „Dodaj źródło PewneAuto”, aby połączyć grupę dealerską (np. Toyota Chodzeń).
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sources.map((source) => (
                            <div
                                key={source.id}
                                className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border bg-white hover:bg-gray-50/50 transition-colors gap-4"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-gray-900">{source.name}</h4>
                                        <Badge variant={source.isEnabled ? 'default' : 'secondary'} className={source.isEnabled ? 'bg-emerald-600' : ''}>
                                            {source.isEnabled ? 'Aktywne' : 'Wyłączone'}
                                        </Badge>
                                        {source.dealerGroup && (
                                            <Badge variant="outline" className="text-indigo-600 border-indigo-200">
                                                Grupa: {source.dealerGroup.name}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                        <span>Slug: <code className="bg-gray-100 px-1 rounded">{source.slug}</code></span>
                                        <span>Client ID: <code className="bg-gray-100 px-1 rounded">{source.clientId}</code></span>
                                        <span>Aktywne oferty: <strong className="text-gray-900">{source.activeListings}</strong></span>
                                        {source.lastSuccessfulSyncAt && (
                                            <span>Ostatni udany sync: {new Date(source.lastSuccessfulSyncAt).toLocaleString('pl-PL')} ({source.lastSuccessfulSyncCount} aut)</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRunDryRun(source)}
                                        disabled={dryRunningId === source.id || syncingId === source.id}
                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                        {dryRunningId === source.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                        ) : (
                                            <Eye className="w-4 h-4 mr-1" />
                                        )}
                                        Dry-Run
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSync(source, false)}
                                        disabled={!source.isEnabled || syncingId === source.id || dryRunningId === source.id}
                                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    >
                                        {syncingId === source.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                        ) : (
                                            <Play className="w-4 h-4 mr-1" />
                                        )}
                                        Synchronizuj
                                    </Button>

                                    <div className="flex items-center space-x-2 pl-2 border-l">
                                        <Switch
                                            checked={source.isEnabled}
                                            onCheckedChange={(checked) => handleToggle(source, checked)}
                                        />
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(source)}
                                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Modal dodawania źródła */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Dodaj nowe źródło PewneAuto</DialogTitle>
                        <DialogDescription>
                            Wprowadź dane dostępowe OAuth2 przekazane przez grupę dealerską PewneAuto.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label htmlFor="pa-name">Nazwa źródła *</Label>
                            <Input
                                id="pa-name"
                                placeholder="np. Toyota Chodzeń"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="pa-client-id">Client ID *</Label>
                            <Input
                                id="pa-client-id"
                                placeholder="np. motolia-chodzen"
                                value={formClientId}
                                onChange={(e) => setFormClientId(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="pa-client-secret">Client Secret * (szyfrowany at-rest AES-256-GCM)</Label>
                            <Input
                                id="pa-client-secret"
                                type="password"
                                placeholder="Wklej tajny klucz API"
                                value={formClientSecret}
                                onChange={(e) => setFormClientSecret(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="pa-group">Grupa dealerska (opcjonalnie)</Label>
                            <select
                                id="pa-group"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                value={formGroupId}
                                onChange={(e) => setFormGroupId(e.target.value)}
                            >
                                <option value="">-- Wybierz grupę dealerską --</option>
                                {groups.map((g) => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                            Anuluj
                        </Button>
                        <Button onClick={handleCreate} disabled={isSaving} className="bg-indigo-600 text-white hover:bg-indigo-700">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                            Zapisz źródło
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal raportu Dry-Run */}
            <Dialog open={showDryRunModal} onOpenChange={setShowDryRunModal}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="w-5 h-5 text-blue-600" />
                            Raport Symulacji Dry-Run ({dryRunReport?.sourceSlug})
                        </DialogTitle>
                        <DialogDescription>
                            Podgląd zmian, które zostaną wprowadzone podczas synchronizacji bez modyfikacji bazy danych.
                        </DialogDescription>
                    </DialogHeader>

                    {dryRunReport && (
                        <div className="space-y-4 py-2 text-sm">
                            {/* Circuit Breaker status */}
                            {dryRunReport.circuitBreakerTriggered ? (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 flex items-start gap-2">
                                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <strong>Bezpiecznik wolumenowy zadziałałby:</strong>
                                        <p className="text-xs mt-0.5">{dryRunReport.circuitBreakerReason}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 flex items-center gap-2 text-xs">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Stan feedu stabilny - brak anomalii wolumenowych.</span>
                                </div>
                            )}

                            {/* Statystyki podsumowujące */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="p-3 bg-gray-50 border rounded-lg text-center">
                                    <div className="text-xs text-gray-500">Pobrane z API</div>
                                    <div className="text-lg font-bold text-gray-900">{dryRunReport.totalFetched}</div>
                                </div>
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
                                    <div className="text-xs text-blue-600">Nowe do wstawienia</div>
                                    <div className="text-lg font-bold text-blue-700">+{dryRunReport.toInsertCount}</div>
                                </div>
                                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-center">
                                    <div className="text-xs text-amber-600">Do aktualizacji</div>
                                    <div className="text-lg font-bold text-amber-700">{dryRunReport.toUpdateCount}</div>
                                </div>
                                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-center">
                                    <div className="text-xs text-rose-600">Do zarchiwizowania</div>
                                    <div className="text-lg font-bold text-rose-700">-{dryRunReport.toArchiveCount}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="p-2 bg-gray-50 border rounded">
                                    Dopasowane po VIN: <strong>{dryRunReport.matchedByVinCount}</strong>
                                </div>
                                <div className="p-2 bg-gray-50 border rounded">
                                    Zmiany cen: <strong>{dryRunReport.priceChangesCount}</strong>
                                </div>
                                <div className="p-2 bg-gray-50 border rounded">
                                    Auta z rezerwacją: <strong>{dryRunReport.reservedCount}</strong>
                                </div>
                            </div>

                            {/* Próbki aut */}
                            {dryRunReport.samples.toInsert.length > 0 && (
                                <div>
                                    <h5 className="font-semibold text-gray-700 mb-1">Przykłady nowych aut do dodania:</h5>
                                    <div className="bg-gray-50 p-2 rounded border text-xs space-y-1">
                                        {dryRunReport.samples.toInsert.map((c, i) => (
                                            <div key={i} className="flex justify-between">
                                                <span>{c.make} {c.model} (VIN: {c.vin || 'brak'})</span>
                                                <strong className="text-gray-900">{c.pricePln.toLocaleString('pl-PL')} zł</strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {dryRunReport.samples.toArchive.length > 0 && (
                                <div>
                                    <h5 className="font-semibold text-gray-700 mb-1">Przykłady aut do zarchiwizowania (brak w feedzie):</h5>
                                    <div className="bg-rose-50/50 p-2 rounded border border-rose-100 text-xs space-y-1 text-rose-900">
                                        {dryRunReport.samples.toArchive.map((c, i) => (
                                            <div key={i}>
                                                <span>{c.make} {c.model} (ID: {c.listingId}, VIN: {c.vin || 'brak'})</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setShowDryRunModal(false)}>
                            Zamknij raport
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
