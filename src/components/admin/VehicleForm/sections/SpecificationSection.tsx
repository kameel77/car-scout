import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { VehicleFormMode } from '../types';
import { FileText, Link2, Upload, X } from 'lucide-react';

interface SpecificationSectionProps {
    mode: VehicleFormMode;
    vehicleId?: string;
    specificationUrl?: string | null;
    onUpdated: (specificationUrl: string | null) => void;
}

/**
 * Zwraca base URL dla endpointów specyfikacji
 * - sale:   /api/listings/:id/specs
 * - rental: /api/rental-vehicles/:id/specs
 */
function specBase(mode: VehicleFormMode, id: string) {
    return mode === 'sale'
        ? `/api/listings/${id}/specs`
        : `/api/rental-vehicles/${id}/specs`;
}

export function SpecificationSection({ mode, vehicleId, specificationUrl, onUpdated }: SpecificationSectionProps) {
    const { token } = useAuth();
    const { toast } = useToast();
    const [urlInput, setUrlInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [savingUrl, setSavingUrl] = useState(false);
    const [clearing, setClearing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!vehicleId) {
        return <p className="text-sm text-gray-500">Specyfikację będzie można dodać po zapisaniu pojazdu.</p>;
    }

    const auth = { Authorization: `Bearer ${token}` };
    const base = specBase(mode, vehicleId);

    // ── Upload PDF ────────────────────────────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            const res = await fetch(base, { method: 'POST', headers: auth, body: formData });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            // Both listing and rental return specificationUrl at top level or inside vehicle/listing
            const url = data.specificationUrl
                ?? data.listing?.specificationUrl
                ?? data.vehicle?.specificationUrl
                ?? null;
            onUpdated(url);
            toast({ title: 'Specyfikacja wgrana' });
        } catch {
            toast({ title: 'Błąd wgrywania specyfikacji', variant: 'destructive' });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ── Save URL ──────────────────────────────────────────────────────────────
    const handleSaveUrl = async () => {
        if (!urlInput.trim()) return;
        setSavingUrl(true);
        try {
            let url: string | null = null;
            if (mode === 'sale') {
                // listing uses PATCH /specs with { specificationUrl }
                const res = await fetch(base, {
                    method: 'PATCH',
                    headers: { ...auth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ specificationUrl: urlInput.trim() }),
                });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                url = data.listing?.specificationUrl ?? urlInput.trim();
            } else {
                // rental uses PATCH /api/rental-vehicles/:id with { specificationUrl }
                const res = await fetch(`/api/rental-vehicles/${vehicleId}`, {
                    method: 'PATCH',
                    headers: { ...auth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ specificationUrl: urlInput.trim() }),
                });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                url = data.vehicle?.specificationUrl ?? urlInput.trim();
            }
            onUpdated(url);
            setUrlInput('');
            toast({ title: 'Link do specyfikacji zapisany' });
        } catch {
            toast({ title: 'Błąd zapisywania linku', variant: 'destructive' });
        } finally {
            setSavingUrl(false);
        }
    };

    // ── Clear ─────────────────────────────────────────────────────────────────
    const handleClear = async () => {
        if (!confirm('Usunąć specyfikację?')) return;
        setClearing(true);
        try {
            if (mode === 'sale') {
                const res = await fetch(base, {
                    method: 'PATCH',
                    headers: { ...auth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ specificationUrl: null }),
                });
                if (!res.ok) throw new Error(await res.text());
            } else {
                const res = await fetch(`/api/rental-vehicles/${vehicleId}`, {
                    method: 'PATCH',
                    headers: { ...auth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ specificationUrl: null }),
                });
                if (!res.ok) throw new Error(await res.text());
            }
            onUpdated(null);
            toast({ title: 'Specyfikacja usunięta' });
        } catch {
            toast({ title: 'Błąd usuwania specyfikacji', variant: 'destructive' });
        } finally {
            setClearing(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Current spec display */}
            {specificationUrl && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <a
                        href={specificationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline truncate flex-1"
                    >
                        {specificationUrl.startsWith('/uploads/') ? 'Wgrany plik PDF' : specificationUrl}
                    </a>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 flex-shrink-0"
                        onClick={handleClear}
                        disabled={clearing}
                        title="Usuń specyfikację"
                    >
                        <X className="w-3 h-3" />
                    </Button>
                </div>
            )}

            {/* URL input */}
            <div className="flex gap-2 items-end">
                <div className="flex-1">
                    <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                        <Link2 className="w-3 h-3" /> Dodaj link URL do specyfikacji:
                    </label>
                    <Input
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        placeholder="https://..."
                        className="h-8 text-sm"
                        onKeyDown={e => { if (e.key === 'Enter' && urlInput.trim()) { e.preventDefault(); handleSaveUrl(); } }}
                    />
                </div>
                <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveUrl}
                    disabled={!urlInput.trim() || savingUrl}
                    className="h-8"
                >
                    {savingUrl ? 'Zapisywanie...' : 'Zapisz'}
                </Button>
            </div>

            {/* PDF upload */}
            <div>
                <label className="text-xs text-gray-500 block mb-1">Lub wgraj plik PDF (max 10MB):</label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                >
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Wgrywanie...' : 'Dodaj plik PDF'}
                </Button>
            </div>
        </div>
    );
}
