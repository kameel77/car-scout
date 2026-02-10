import { useState, useMemo } from 'react';
import { useListings } from '@/hooks/useListings';
import { AdminListingList } from '@/components/admin/ListingManagement/AdminListingList';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Car, Filter, Archive, RotateCcw, X, Trash2 } from 'lucide-react';
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkAction, setBulkAction] = useState<'archive' | 'restore' | 'delete' | null>(null);
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

    const handleDelete = async (id: string) => {
        if (!token) return;
        try {
            await listingsApi.deleteListing(id, token);
            queryClient.invalidateQueries({ queryKey: ['listings'] });
            toast({
                title: "Pojazd usunięty",
                description: "Pojazd został trwale usunięty z bazy danych.",
            });
        } catch (error) {
            toast({
                title: "Błąd",
                description: "Nie udało się usunąć pojazdu.",
                variant: "destructive"
            });
        }
    };

    const handleBulkArchive = async () => {
        if (!token || selectedIds.length === 0) return;
        
        try {
            const promises = selectedIds.map(id => 
                listingsApi.archiveListing(id, 'Bulk admin action', token)
            );
            await Promise.all(promises);
            
            queryClient.invalidateQueries({ queryKey: ['listings'] });
            setSelectedIds([]);
            toast({
                title: "Pojazdy zarchiwizowane",
                description: `${selectedIds.length} pojazdów zostało przeniesionych do archiwum.`,
            });
        } catch (error) {
            toast({
                title: "Błąd",
                description: "Nie udało się zarchiwizować wszystkich pojazdów.",
                variant: "destructive"
            });
        }
        setBulkAction(null);
    };

    const handleBulkRestore = async () => {
        if (!token || selectedIds.length === 0) return;
        
        try {
            const promises = selectedIds.map(id => 
                listingsApi.restoreListing(id, token)
            );
            await Promise.all(promises);
            
            queryClient.invalidateQueries({ queryKey: ['listings'] });
            setSelectedIds([]);
            toast({
                title: "Pojazdy przywrócone",
                description: `${selectedIds.length} pojazdów zostało przywróconych do aktywnych ogłoszeń.`,
            });
        } catch (error) {
            toast({
                title: "Błąd",
                description: "Nie udało się przywrócić wszystkich pojazdów.",
                variant: "destructive"
            });
        }
        setBulkAction(null);
    };

    const handleBulkDelete = async () => {
        if (!token || selectedIds.length === 0) return;
        
        try {
            const promises = selectedIds.map(id => 
                listingsApi.deleteListing(id, token)
            );
            await Promise.all(promises);
            
            queryClient.invalidateQueries({ queryKey: ['listings'] });
            setSelectedIds([]);
            toast({
                title: "Pojazdy usunięte",
                description: `${selectedIds.length} pojazdów zostało trwale usuniętych z bazy danych.`,
            });
        } catch (error) {
            toast({
                title: "Błąd",
                description: "Nie udało się usunąć wszystkich pojazdów.",
                variant: "destructive"
            });
        }
        setBulkAction(null);
    };

    const clearSelection = () => {
        setSelectedIds([]);
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

            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="flex items-center justify-between gap-4 bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-blue-900">
                            Zaznaczono {selectedIds.length} pojazdów
                        </span>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={clearSelection}
                            className="h-8 text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                        >
                            <X className="w-4 h-4 mr-1" />
                            Wyczyść
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setBulkAction('restore')}
                            className="h-9 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Przywróć
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setBulkAction('archive')}
                            className="h-9 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                            <Archive className="w-4 h-4 mr-2" />
                            Archiwizuj
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setBulkAction('delete')}
                            className="h-9 border-red-800 text-red-800 hover:bg-red-100 hover:text-red-900"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Usuń definitywnie
                        </Button>
                    </div>
                </div>
            )}

            {/* List */}
            <AdminListingList
                listings={data?.listings || []}
                isLoading={isLoading}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onArchive={handleArchive}
                onRestore={handleRestore}
                onDelete={handleDelete}
            />

            {/* Pagination placeholder */}
            {data?.totalPages && data.totalPages > 1 && (
                <div className="flex justify-center mt-8">
                    {/* We can add Pagination component here later if needed */}
                    <p className="text-sm text-gray-500">Strona {page} z {data.totalPages}</p>
                </div>
            )}

            {/* Bulk Archive Confirmation Dialog */}
            <AlertDialog open={bulkAction === 'archive'} onOpenChange={() => setBulkAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Zarchiwizować {selectedIds.length} pojazdów?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Te pojazdy zostaną ukryte w serwisie i przeniesione do archiwum. 
                            Możesz je przywrócić w dowolnym momencie.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setBulkAction(null)}>Anuluj</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleBulkArchive}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Archiwizuj
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Restore Confirmation Dialog */}
            <AlertDialog open={bulkAction === 'restore'} onOpenChange={() => setBulkAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Przywrócić {selectedIds.length} pojazdów?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Te pojazdy zostaną przywrócone do aktywnych ogłoszeń i będą widoczne w serwisie.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setBulkAction(null)}>Anuluj</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleBulkRestore}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Przywróć
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Delete Confirmation Dialog */}
            <AlertDialog open={bulkAction === 'delete'} onOpenChange={() => setBulkAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-800">Usunąć {selectedIds.length} pojazdów?</AlertDialogTitle>
                        <AlertDialogDescription className="text-red-600">
                            Te pojazdy zostaną trwale usunięte z bazy danych. 
                            Tej operacji nie można cofnąć. Powiązane dane (leady, historia cen) również zostaną usunięte.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setBulkAction(null)}>Anuluj</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleBulkDelete}
                            className="bg-red-800 hover:bg-red-900"
                        >
                            Usuń definitywnie
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
