import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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

export default function ListingNewPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const { data: dealersData } = useQuery({
        queryKey: ['admin-dealers'],
        queryFn: () => fetchDealers(token!),
        enabled: !!token,
    });

    const handleSave = async (data: any) => {
        if (!token) return;
        setIsSaving(true);
        try {
            const result = await listingsApi.createListing(data, token);
            toast({ title: 'Pojazd dodany' });
            navigate(`/admin/listings/${result.listing.id}/edit`);
        } catch (e: any) {
            toast({ title: 'Błąd', description: e.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl space-y-6">
            <h1 className="text-2xl font-bold">Dodaj pojazd</h1>
            <VehicleDataForm
                mode="sale"
                dealers={dealersData?.dealers || []}
                onSave={handleSave}
                onCancel={() => navigate('/admin/listings')}
                isSaving={isSaving}
            />
        </div>
    );
}
