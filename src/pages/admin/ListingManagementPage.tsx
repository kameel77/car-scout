import { useState, useMemo } from 'react';
import { useListings } from '@/hooks/useListings';
import { AdminListingList } from '@/components/admin/ListingManagement/AdminListingList';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Car, Filter } from 'lucide-react';
import { FilterState } from '@/components/FilterPanel';
import { listingsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const initialFilters: FilterState = {
    makes: [],
    models: [],
    fuelTypes: [],
    yearFrom: '',
    yearTo: '',
    mileageFrom: '',
    mileageTo: '',
    drives: [],
    transmissions: [],
    powerFrom: '',
    powerTo: '',
    capacityFrom: '',
    capacityTo: '',
    bodyTypes: [],
    priceFrom: '',
    priceTo: '',
    query: ''
};

export default function ListingManagementPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [page, setPage] = useState(1);
    const { token } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const filters = useMemo(() => ({
        ...initialFilters,
        query: searchQuery
    }), [searchQuery]);

    const { data, isLoading } = useListings(filters, sortBy, page, 50);

    const handleArchive = async (id: string) => {
        if (!token) return;
        try {
            await listingsApi.archiveListing(id, 'Admin action', token);
            queryClient.invalidateQueries({ queryKey: ['listings'] });
            toast({
                title: "Pojazd zarchiwizowany",
                description: "Pojazd został pomyślnie przeniesiony do archiwum.",
            });
        } catch (error) {
            toast({
                title: "Błąd",
                description: "Nie udało się zarchiwizować pojazdu.",
                variant: "destructive"
            });
        }
    };

    const handleRestore = async (id: string) => {
        if (!token) return;
        try {
            await listingsApi.restoreListing(id, token);
            queryClient.invalidateQueries({ queryKey: ['listings'] });
            toast({
                title: "Pojazd przywrócony",
                description: "Pojazd został pomyślnie przywrócony do aktywnych ogłoszeń.",
            });
        } catch (error) {
            toast({
                title: "Błąd",
                description: "Nie udało się przywrócić pojazdu.",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Pojazdy
                    </h1>
                    <p className="text-gray-600">
                        Zarządzaj bazą pojazdów, przeglądaj specyfikacje i archiwizuj ogłoszenia.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
                    <Car className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-blue-700">{data?.count || 0}</span>
                    <span>pojazdów w bazie</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Szukaj po marce, modelu, VIN..."
                        className="pl-10 h-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[180px] h-10">
                            <SelectValue placeholder="Sortuj" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Najnowsze</SelectItem>
                            <SelectItem value="price_asc">Cena: rosnąco</SelectItem>
                            <SelectItem value="price_desc">Cena: malejąco</SelectItem>
                            <SelectItem value="mileage_asc">Przebieg: rosnąco</SelectItem>
                            <SelectItem value="year_desc">Rocznik: najnowsze</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" className="h-10 w-10">
                        <Filter className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* List */}
            <AdminListingList
                listings={data?.listings || []}
                isLoading={isLoading}
                onArchive={handleArchive}
                onRestore={handleRestore}
            />

            {/* Pagination placeholder */}
            {data?.totalPages && data.totalPages > 1 && (
                <div className="flex justify-center mt-8">
                    {/* We can add Pagination component here later if needed */}
                    <p className="text-sm text-gray-500">Strona {page} z {data.totalPages}</p>
                </div>
            )}
        </div>
    );
}
