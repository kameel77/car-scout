import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { VehicleFormMode } from '../types';

interface ImagesSectionProps {
    mode: VehicleFormMode;
    vehicleId?: string;
    primaryImageUrl?: string | null;
    imageUrls?: string[];
    onUpdated: (data: { primaryImageUrl: string | null; imageUrls: string[] }) => void;
}

export function ImagesSection({ mode, vehicleId, primaryImageUrl, imageUrls = [], onUpdated }: ImagesSectionProps) {
    const { token } = useAuth();
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);

    const uploadEndpoint = mode === 'sale'
        ? `/api/listings/${vehicleId}/images`
        : `/api/rental-vehicles/${vehicleId}/images`;

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!vehicleId) {
            toast({ title: 'Najpierw zapisz pojazd', description: 'Zdjęcia można dodać po utworzeniu rekordu.' });
            return;
        }
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        for (const f of Array.from(files)) {
            formData.append('files', f);
        }
        if (imageUrls.length === 0) {
            formData.append('setPrimary', 'true');
        }

        setUploading(true);
        try {
            const res = await fetch(uploadEndpoint, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            const updated = mode === 'sale' ? data.listing : data.vehicle;
            onUpdated({
                primaryImageUrl: updated.primaryImageUrl,
                imageUrls: updated.imageUrls,
            });
            toast({ title: 'Zdjęcia wgrane' });
        } catch (err) {
            toast({ title: 'Błąd uploadu', variant: 'destructive' });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (url: string) => {
        if (!vehicleId || !token) return;
        try {
            const res = await fetch(uploadEndpoint, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            if (!res.ok) throw new Error('Delete failed');
            const data = await res.json();
            const updated = mode === 'sale' ? data.listing : data.vehicle;
            onUpdated({
                primaryImageUrl: updated.primaryImageUrl,
                imageUrls: updated.imageUrls,
            });
        } catch {
            toast({ title: 'Błąd usuwania', variant: 'destructive' });
        }
    };

    const handleSetPrimary = async (url: string) => {
        // For now: client-side reorder; primary is the first one. Backend extension out of scope.
        const reordered = [url, ...imageUrls.filter(u => u !== url)];
        onUpdated({ primaryImageUrl: url, imageUrls: reordered });
    };

    if (!vehicleId) {
        return <p className="text-sm text-gray-500">Zdjęcia będzie można dodać po zapisaniu pojazdu.</p>;
    }

    return (
        <div className="space-y-4">
            <div>
                <input type="file" multiple accept="image/*" onChange={handleUpload} disabled={uploading} />
                {uploading && <span className="ml-2 text-sm text-gray-500">Wgrywanie...</span>}
            </div>
            {imageUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {imageUrls.map(url => (
                        <div key={url} className={`relative border rounded ${url === primaryImageUrl ? 'ring-2 ring-blue-500' : ''}`}>
                            <img src={url} alt="" className="w-full h-32 object-cover" />
                            <div className="absolute top-1 right-1 flex gap-1">
                                {url !== primaryImageUrl && (
                                    <Button type="button" size="sm" variant="secondary" onClick={() => handleSetPrimary(url)}>Primary</Button>
                                )}
                                <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(url)}>×</Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
