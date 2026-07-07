import React, { useEffect, useState, useCallback } from 'react';
import {
    Archive, Trash2, RefreshCw, AlertTriangle, Database,
    CheckCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { listingsApi } from '@/services/api';
import { formatNumber } from '@/utils/formatters';

interface SourceRow {
    source: string | null;
    csflowSourceId?: string | null;
    csflowSourceName?: string | null;
    activeCount: number;
    archivedCount: number;
}

type DialogMode = 'archive' | 'delete' | null;

const SOURCE_LABELS: Record<string, string> = {
    csflow: 'CSFlow',
    otomoto: 'Otomoto',
    csv: 'CSV Import',
    manual: 'Ręcznie dodane',
    __null__: 'Brak źródła',
};

function sourceLabel(source: string | null): string {
    if (!source) return SOURCE_LABELS['__null__'];
    return SOURCE_LABELS[source] ?? source;
}

function rowLabel(row: Pick<SourceRow, 'source' | 'csflowSourceId' | 'csflowSourceName'>): string {
    if (row.source === 'csflow') {
        if (row.csflowSourceId && row.csflowSourceName) return `CSFlow: ${row.csflowSourceName}`;
        if (row.csflowSourceId === null) return 'CSFlow (bez przypisania)';
    }
    return sourceLabel(row.source);
}

export function BulkSourceManager() {
    const { token, user } = useAuth();
    const [sources, setSources] = useState<SourceRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [dialogMode, setDialogMode] = useState<DialogMode>(null);
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [selectedCsflowSourceId, setSelectedCsflowSourceId] = useState<string | null | undefined>(undefined);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ count: number; action: string } | null>(null);

    const fetchSources = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await listingsApi.getSources(token);
            setSources(data.sources);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Błąd ładowania danych');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => { fetchSources(); }, [fetchSources]);

    if (user?.role !== 'admin') return null;

    const openArchiveDialog = (source: string | null, csflowSourceId?: string | null) => {
        setSelectedSource(source);
        setSelectedCsflowSourceId(csflowSourceId);
        setDialogMode('archive');
        setResult(null);
    };

    const openDeleteDialog = (source: string | null, csflowSourceId?: string | null) => {
        setSelectedSource(source);
        setSelectedCsflowSourceId(csflowSourceId);
        setIncludeArchived(false);
        setDialogMode('delete');
        setResult(null);
    };

    const handleConfirm = async () => {
        if (!token || !dialogMode) return;
        setIsProcessing(true);
        try {
            let res;
            if (dialogMode === 'archive') {
                res = await listingsApi.archiveBySource(selectedSource, token, selectedCsflowSourceId);
                setResult({ count: res.count, action: 'zarchiwizowano' });
            } else {
                res = await listingsApi.deleteBySource(selectedSource, includeArchived, token, selectedCsflowSourceId);
                setResult({ count: res.count, action: 'usunięto' });
            }
            await fetchSources();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Operacja nie powiodła się');
        } finally {
            setIsProcessing(false);
            setDialogMode(null);
        }
    };

    const selectedRow = sources.find(s =>
        s.source === selectedSource &&
        (s.csflowSourceId ?? null) === (selectedCsflowSourceId ?? null)
    );

    const affectedCount = dialogMode === 'archive'
        ? selectedRow?.activeCount ?? 0
        : includeArchived
            ? (selectedRow?.activeCount ?? 0) + (selectedRow?.archivedCount ?? 0)
            : selectedRow?.activeCount ?? 0;

    return (
        <>
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Database className="w-5 h-5 text-rose-500" />
                        Zarządzanie ofertami wg źródła
                    </CardTitle>
                    <CardDescription>
                        Archiwizuj lub trwale usuń wszystkie oferty zaimportowane z danego źródła.
                        Operacje są nieodwracalne — usuniętych ofert nie można przywrócić.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && (
                        <div className="flex items-center justify-center py-8 text-slate-400">
                            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                            Ładowanie danych…
                        </div>
                    )}

                    {!isLoading && error && (
                        <div className="flex items-center gap-2 text-rose-600 py-4">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {!isLoading && !error && (
                        <>
                            {result && (
                                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
                                    <CheckCircle className="w-4 h-4 shrink-0" />
                                    <span>
                                        Pomyślnie <strong>{result.action}</strong> {formatNumber(result.count)} ofert.
                                    </span>
                                </div>
                            )}

                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="text-left px-4 py-3 text-slate-600 font-medium">Źródło importu</th>
                                            <th className="text-right px-4 py-3 text-slate-600 font-medium">
                                                <span className="flex items-center justify-end gap-1">
                                                    <ChevronUp className="w-3 h-3 text-emerald-500" /> Aktywne
                                                </span>
                                            </th>
                                            <th className="text-right px-4 py-3 text-slate-600 font-medium">
                                                <span className="flex items-center justify-end gap-1">
                                                    <ChevronDown className="w-3 h-3 text-slate-400" /> Zarchiwizowane
                                                </span>
                                            </th>
                                            <th className="text-right px-4 py-3 text-slate-600 font-medium">Akcje</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sources.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="text-center text-slate-400 py-8">
                                                    Brak ofert w bazie danych.
                                                </td>
                                            </tr>
                                        )}
                                        {sources.map((row, i) => (
                                            <tr
                                                key={row.csflowSourceId !== undefined ? `csflow:${row.csflowSourceId ?? 'null'}` : (row.source ?? '__null__')}
                                                className={`border-b border-slate-100 hover:bg-slate-50/50 ${i === sources.length - 1 ? 'border-b-0' : ''}`}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="font-mono text-xs">
                                                            {row.source ?? 'null'}
                                                        </Badge>
                                                        <span className="font-medium text-slate-800">
                                                            {rowLabel(row)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`font-semibold ${row.activeCount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                        {formatNumber(row.activeCount)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`font-semibold ${row.archivedCount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                                                        {formatNumber(row.archivedCount)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-40"
                                                            disabled={row.activeCount === 0}
                                                            onClick={() => openArchiveDialog(row.source, row.csflowSourceId)}
                                                        >
                                                            <Archive className="w-3.5 h-3.5" />
                                                            Archiwizuj
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 gap-1.5 text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300 disabled:opacity-40"
                                                            disabled={row.activeCount === 0 && row.archivedCount === 0}
                                                            onClick={() => openDeleteDialog(row.source, row.csflowSourceId)}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Usuń
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-3 flex justify-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2 text-slate-500 hover:text-slate-700"
                                    onClick={fetchSources}
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Odśwież
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Confirmation Dialog */}
            <AlertDialog open={dialogMode !== null} onOpenChange={(open) => { if (!open && !isProcessing) setDialogMode(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className={`p-2 rounded-full ${dialogMode === 'delete' ? 'bg-rose-100' : 'bg-amber-100'}`}>
                                {dialogMode === 'delete'
                                    ? <Trash2 className="h-5 w-5 text-rose-600" />
                                    : <Archive className="h-5 w-5 text-amber-600" />
                                }
                            </div>
                            <AlertDialogTitle>
                                {dialogMode === 'delete'
                                    ? `Usuń oferty – ${rowLabel({ source: selectedSource, csflowSourceId: selectedCsflowSourceId })}`
                                    : `Archiwizuj oferty – ${rowLabel({ source: selectedSource, csflowSourceId: selectedCsflowSourceId })}`
                                }
                            </AlertDialogTitle>
                        </div>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                {dialogMode === 'delete' ? (
                                    <>
                                        <p>
                                            Ta operacja <strong>trwale usunie</strong> oferty ze źródła{' '}
                                            <span className="font-mono text-slate-700 bg-slate-100 px-1 rounded">
                                                {selectedSource ?? 'null'}
                                            </span>.
                                            Usuniętych ofert <strong>nie można przywrócić</strong>.
                                        </p>
                                        <div
                                            className="flex items-center gap-2.5 p-3 rounded-lg border bg-slate-50 cursor-pointer"
                                            onClick={() => setIncludeArchived(v => !v)}
                                        >
                                            <Checkbox
                                                id="include-archived"
                                                checked={includeArchived}
                                                onCheckedChange={(v) => setIncludeArchived(Boolean(v))}
                                            />
                                            <label htmlFor="include-archived" className="text-sm cursor-pointer">
                                                Usuń również zarchiwizowane oferty z tego źródła
                                                {selectedRow && (
                                                    <span className="ml-1 text-slate-500">
                                                        (+{formatNumber(selectedRow.archivedCount)} szt.)
                                                    </span>
                                                )}
                                            </label>
                                        </div>
                                    </>
                                ) : (
                                    <p>
                                        Wszystkie <strong>aktywne</strong> oferty ze źródła{' '}
                                        <span className="font-mono text-slate-700 bg-slate-100 px-1 rounded">
                                            {selectedSource ?? 'null'}
                                        </span>{' '}
                                        zostaną przeniesione do archiwum. Można je później przywrócić.
                                    </p>
                                )}
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                                    <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                                    Dotyczy <strong>{formatNumber(affectedCount)}</strong> ofert
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isProcessing}>Anuluj</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirm}
                            disabled={isProcessing || affectedCount === 0}
                            className={dialogMode === 'delete'
                                ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-600'
                                : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-600'
                            }
                        >
                            {isProcessing && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                            {dialogMode === 'delete' ? 'Tak, usuń trwale' : 'Tak, archiwizuj'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
