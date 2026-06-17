import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { VehicleDataForm } from '@/components/admin/VehicleForm/VehicleDataForm';
import { useAuth } from '@/contexts/AuthContext';
import { listingsApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '');

async function fetchDealers(token: string) {
    const res = await fetch(`${API_BASE_URL}/api/admin/dealers`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to load dealers');
    return res.json();
}

async function fetchRawListing(id: string) {
    const res = await fetch(`${API_BASE_URL}/api/listings/${id}`);
    if (!res.ok) throw new Error('Failed to load listing');
    const data = await res.json();
    return data.listing;
}

export default function ListingEditPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const { data: listing, isLoading } = useQuery({
        queryKey: ['admin-listing-raw', id],
        queryFn: () => fetchRawListing(id!),
        enabled: !!id,
    });

    const { data: dealersData } = useQuery({
        queryKey: ['admin-dealers'],
        queryFn: () => fetchDealers(token!),
        enabled: !!token,
    });

    const isImported = listing?.entrySource === 'CSFLOW';

    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
    const queryClient = useQueryClient();

    const handleSave = async (data: any) => {
        if (!token || !id) return;
        setIsSaving(true);
        setServerErrors({});
        try {
            await listingsApi.updateListing(id, data, token);
            queryClient.invalidateQueries({ queryKey: ['admin-listing-raw', id] });
            queryClient.invalidateQueries({ queryKey: ['listings'] });
            queryClient.invalidateQueries({ queryKey: ['financing-products'] });
            toast({ title: 'Zapisano zmiany' });
            navigate('/admin/listings');
        } catch (e: any) {
            toast({ title: 'Błąd', description: e.message, variant: 'destructive' });
            if (e.errors) {
                const errMap: Record<string, string> = {};
                e.errors.forEach((err: any) => {
                    errMap[err.field] = err.message;
                });
                setServerErrors(errMap);
            }
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-6">Ładowanie...</div>;
    if (!listing) return <div className="p-6">Pojazd nie znaleziony</div>;

    return (
        <div className="p-6 max-w-5xl space-y-6">
            <h1 className="text-2xl font-bold">Edytuj pojazd</h1>
            {isImported && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-800">
                    Ten pojazd pochodzi z importu {listing.entrySource}. Edytować można tylko: cenę katalogową, flagi, opis dodatkowy i zdjęcia.
                </div>
            )}
            <VehicleDataForm
                mode="sale"
                vehicle={listing}
                dealers={dealersData?.dealers || []}
                isImported={isImported}
                onSave={handleSave}
                onCancel={() => navigate('/admin/listings')}
                isSaving={isSaving}
                serverErrors={serverErrors}
            />
        </div>
    );
}
