import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { VehicleFormMode } from '../types';
import { ChevronLeft, ChevronRight, Star, Trash2, Upload } from 'lucide-react';

interface ImagesSectionProps {
    mode: VehicleFormMode;
    vehicleId?: string;
    primaryImageUrl?: string | null;
    imageUrls?: string[];
    onUpdated: (data: { primaryImageUrl: string | null; imageUrls: string[] }) => void;
    pendingImageFiles?: File[];
    onUpdatePendingFiles?: (files: File[]) => void;
}

const BASE = (mode: VehicleFormMode, id: string) => {
    if (mode === 'sale') return `/api/listings/${id}/images`;
    if (mode === 'specification') return `/api/specifications/${id}/images`;
    return `/api/rental-vehicles/${id}/images`;
};

/**
 * Extracts {primaryImageUrl, imageUrls} from API responses regardless of shape.
 * - Listing upload POST → { listing: { primaryImageUrl, imageUrls } }
 * - Listing PATCH primary/reorder/url → { listing: { … } }
 * - Rental upload POST → { primaryImageUrl, urls }
 * - Rental PATCH primary → { success, primaryImageUrl }
 * - Rental POST url / PATCH reorder → { success, imageUrls, primaryImageUrl }
 */
function extractImages(data: any, mode: VehicleFormMode, fallback: { primaryImageUrl: string | null; imageUrls: string[] }) {
    if (mode === 'sale') {
        const l = data?.listing;
        return {
            primaryImageUrl: l?.primaryImageUrl ?? fallback.primaryImageUrl,
            imageUrls: l?.imageUrls ?? fallback.imageUrls,
        };
    }
    if (mode === 'specification') {
        const s = data?.specification || data;
        return {
            primaryImageUrl: null,
            imageUrls: s?.imageUrls ?? (data?.urls ? [...(fallback.imageUrls), ...(data.urls)] : fallback.imageUrls),
        };
    }
    // rental - various shapes
    return {
        primaryImageUrl: data?.primaryImageUrl ?? fallback.primaryImageUrl,
        imageUrls: data?.imageUrls ?? (data?.urls ? [...(fallback.imageUrls), ...(data.urls)] : fallback.imageUrls),
    };
}

export function ImagesSection({ mode, vehicleId, primaryImageUrl, imageUrls = [], onUpdated, pendingImageFiles = [], onUpdatePendingFiles }: ImagesSectionProps) {
    const { token } = useAuth();
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [addingUrl, setAddingUrl] = useState(false);
    const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
    const [moving, setMoving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const auth = { Authorization: `Bearer ${token}` };
    const baseUrl = vehicleId ? BASE(mode, vehicleId) : '';

    // ── Upload from disk ──────────────────────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (!vehicleId) {
            if (onUpdatePendingFiles) {
                onUpdatePendingFiles([...pendingImageFiles, ...Array.from(files)]);
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
            toast({ title: 'Zdjęcie dodane do kolejki', description: 'Zostanie wgrane po zapisaniu.' });
            return;
        }

        const formData = new FormData();
        for (const f of Array.from(files)) formData.append('files', f);
        if (imageUrls.length === 0) formData.append('setPrimary', 'true');

        setUploading(true);
        try {
            const res = await fetch(baseUrl, { method: 'POST', headers: auth, body: formData });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            onUpdated(extractImages(data, mode, { primaryImageUrl: primaryImageUrl ?? null, imageUrls }));
            toast({ title: 'Zdjęcia wgrane' });
        } catch {
            toast({ title: 'Błąd uploadu', variant: 'destructive' });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ── Add by URL ────────────────────────────────────────────────────────────
    const handleAddUrl = async () => {
        if (!urlInput.trim()) return;

        if (!vehicleId) {
            onUpdated({ primaryImageUrl: primaryImageUrl ?? null, imageUrls: [...imageUrls, urlInput.trim()] });
            setUrlInput('');
            toast({ title: 'Link dodany' });
            return;
        }

        setAddingUrl(true);
        try {
            const res = await fetch(`${baseUrl}/url`, {
                method: 'POST',
                headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlInput.trim() }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            onUpdated(extractImages(data, mode, { primaryImageUrl: primaryImageUrl ?? null, imageUrls }));
            setUrlInput('');
            toast({ title: 'Zdjęcie dodane' });
        } catch {
            toast({ title: 'Błąd dodawania zdjęcia', variant: 'destructive' });
        } finally {
            setAddingUrl(false);
        }
    };

    // ── Set primary ───────────────────────────────────────────────────────────
    const handleSetPrimary = async (url: string) => {
        if (!vehicleId) {
            onUpdated({ primaryImageUrl: url, imageUrls });
            return;
        }

        const endpoint = mode === 'sale'
            ? `${baseUrl}/primary`
            : `/api/rental-vehicles/${vehicleId}/primary-image`;

        const body = mode === 'sale' ? { url } : { imageUrl: url };

        try {
            const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const next = extractImages(data, mode, { primaryImageUrl: primaryImageUrl ?? null, imageUrls });
            // For rental primary-image endpoint, imageUrls is not returned – keep current
            onUpdated({ primaryImageUrl: next.primaryImageUrl, imageUrls: next.imageUrls.length > 0 ? next.imageUrls : imageUrls });
            toast({ title: 'Zmieniono zdjęcie główne' });
        } catch {
            toast({ title: 'Błąd ustawiania zdjęcia głównego', variant: 'destructive' });
        }
    };

    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDelete = async (url: string) => {
        if (!vehicleId) {
            const nextUrls = imageUrls.filter(u => u !== url);
            onUpdated({ primaryImageUrl: primaryImageUrl === url ? (nextUrls[0] || null) : primaryImageUrl, imageUrls: nextUrls });
            return;
        }

        setDeletingUrl(url);
        try {
            // Listing uses body.url, rental uses body.imageUrl
            const body = mode === 'sale' ? { url } : { imageUrl: url };
            const res = await fetch(baseUrl, {
                method: 'DELETE',
                headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const next = extractImages(data, mode, { primaryImageUrl: primaryImageUrl ?? null, imageUrls });

            // Rental DELETE returns remainingImages count - recompute from local state
            if (mode === 'rental' || mode === 'specification') {
                const remaining = imageUrls.filter(u => u !== url);
                const newPrimary = mode === 'specification' ? null : (primaryImageUrl === url ? (remaining[0] ?? null) : (primaryImageUrl ?? null));
                onUpdated({ primaryImageUrl: newPrimary, imageUrls: remaining });
            } else {
                onUpdated(next);
            }
            toast({ title: 'Zdjęcie usunięte' });
        } catch {
            toast({ title: 'Błąd usuwania zdjęcia', variant: 'destructive' });
        } finally {
            setDeletingUrl(null);
        }
    };

    // ── Reorder ───────────────────────────────────────────────────────────────
    const handleMove = async (index: number, direction: 'left' | 'right') => {
        const newIndex = direction === 'left' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= imageUrls.length) return;

        const newUrls = [...imageUrls];
        [newUrls[index], newUrls[newIndex]] = [newUrls[newIndex], newUrls[index]];

        if (!vehicleId) {
            onUpdated({ primaryImageUrl: primaryImageUrl ?? null, imageUrls: newUrls });
            return;
        }

        setMoving(true);
        try {
            const res = await fetch(`${baseUrl}/reorder`, {
                method: 'PATCH',
                headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrls: newUrls }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const next = extractImages(data, mode, { primaryImageUrl: primaryImageUrl ?? null, imageUrls: newUrls });
            onUpdated({ primaryImageUrl: next.primaryImageUrl ?? primaryImageUrl ?? null, imageUrls: next.imageUrls });
        } catch {
            toast({ title: 'Błąd zmiany kolejności', variant: 'destructive' });
        } finally {
            setMoving(false);
        }
    };

    const handleRemovePending = (index: number) => {
        if (onUpdatePendingFiles) {
            const arr = [...pendingImageFiles];
            arr.splice(index, 1);
            onUpdatePendingFiles(arr);
        }
    };

    const totalImagesCount = imageUrls.length + pendingImageFiles.length;

    return (
        <div className="space-y-4">
            {/* Preview grid */}
            {totalImagesCount > 0 && (
                <div className="flex gap-4 flex-wrap">
                    {imageUrls.map((url, i) => (
                        <div
                            key={`${url}-${i}`}
                            className={`group relative w-32 h-32 rounded-lg overflow-hidden border-2 transition-all ${url === primaryImageUrl ? 'border-blue-500 shadow-md ring-2 ring-blue-300' : 'border-gray-200'}`}
                        >
                            <img src={url} alt={`Zdjęcie ${i + 1}`} className="w-full h-full object-cover" />

                            {/* "Główne" badge */}
                            {url === primaryImageUrl && mode !== 'specification' && (
                                <span className="absolute top-0 left-0 right-0 bg-blue-500/85 text-white text-[10px] font-bold py-0.5 text-center uppercase tracking-wider backdrop-blur-sm select-none">
                                    Główne
                                </span>
                            )}

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1">
                                <div className="flex justify-between items-center gap-1">
                                    {/* Move arrows */}
                                    <div className="flex">
                                        <button
                                            type="button"
                                            onClick={() => handleMove(i, 'left')}
                                            disabled={i === 0 || moving}
                                            className="p-1 hover:bg-black/40 rounded text-white disabled:opacity-30 transition-colors"
                                            title="Przesuń w lewo"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMove(i, 'right')}
                                            disabled={i === imageUrls.length - 1 || moving}
                                            className="p-1 hover:bg-black/40 rounded text-white disabled:opacity-30 transition-colors"
                                            title="Przesuń w prawo"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {/* Star + Delete */}
                                    <div className="flex">
                                        {url !== primaryImageUrl && mode !== 'specification' && (
                                            <button
                                                type="button"
                                                onClick={() => handleSetPrimary(url)}
                                                className="p-1 hover:bg-blue-500/60 rounded text-yellow-300 transition-colors"
                                                title="Ustaw jako główne"
                                            >
                                                <Star className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (confirm('Usunąć zdjęcie?')) handleDelete(url);
                                            }}
                                            disabled={deletingUrl === url}
                                            className="p-1 hover:bg-red-500/60 rounded text-red-300 transition-colors disabled:opacity-50"
                                            title="Usuń zdjęcie"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {pendingImageFiles.map((file, i) => (
                        <div key={`pending-${i}`} className="group relative w-32 h-32 rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
                            <img src={URL.createObjectURL(file)} alt="Oczekujące zdjęcie" className="w-full h-full object-cover opacity-80" />
                            <span className="absolute top-0 left-0 right-0 bg-gray-500/85 text-white text-[10px] font-bold py-0.5 text-center uppercase tracking-wider backdrop-blur-sm select-none">
                                Do wgrania
                            </span>
                            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1">
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePending(i)}
                                        className="p-1 hover:bg-red-500/60 rounded text-red-300 transition-colors"
                                        title="Usuń z kolejki"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
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
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        className="h-8 text-sm"
                        onKeyDown={e => { if (e.key === 'Enter' && urlInput.trim()) { e.preventDefault(); handleAddUrl(); } }}
                    />
                </div>
                <Button
                    type="button"
                    size="sm"
                    onClick={handleAddUrl}
                    disabled={!urlInput.trim() || addingUrl}
                    className="h-8"
                >
                    {addingUrl ? 'Dodawanie...' : 'Dodaj'}
                </Button>
            </div>

            {/* Upload from disk */}
            <div>
                <label className="text-xs text-gray-500 block mb-1">Lub wgraj z dysku:</label>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
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
                    {uploading ? 'Wgrywanie...' : 'Dodaj zdjęcia'}
                </Button>
            </div>
        </div>
    );
}
