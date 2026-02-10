import { Listing } from '@/data/mockData';
import { AdminListingItem } from './AdminListingItem';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

interface AdminListingListProps {
    listings: Listing[];
    isLoading: boolean;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    onArchive?: (id: string) => void;
    onRestore?: (id: string) => void;
    onDelete?: (id: string) => void;
}

export function AdminListingList({ 
    listings, 
    isLoading, 
    selectedIds, 
    onSelectionChange,
    onArchive, 
    onRestore,
    onDelete 
}: AdminListingListProps) {
    const handleSelect = (id: string, selected: boolean) => {
        if (selected) {
            onSelectionChange([...selectedIds, id]);
        } else {
            onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectionChange(listings.map(l => l.listing_id));
        } else {
            onSelectionChange([]);
        }
    };

    const allSelected = listings.length > 0 && listings.every(l => selectedIds.includes(l.listing_id));
    const someSelected = selectedIds.length > 0 && !allSelected;

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white rounded-xl border p-3 h-[80px] animate-pulse">
                        <div className="flex items-center gap-4 h-full">
                            <div className="w-6 h-6 bg-gray-100 rounded shrink-0" />
                            <div className="w-24 h-16 bg-gray-100 rounded-lg shrink-0" />
                            <div className="w-48 space-y-2">
                                <div className="h-3 bg-gray-100 rounded w-3/4" />
                                <div className="h-2 bg-gray-100 rounded w-1/2" />
                            </div>
                            <div className="flex-1 grid grid-cols-5 gap-4">
                                <div className="h-2 bg-gray-50 rounded" />
                                <div className="h-2 bg-gray-50 rounded" />
                                <div className="h-2 bg-gray-50 rounded" />
                                <div className="h-2 bg-gray-50 rounded" />
                                <div className="h-2 bg-gray-50 rounded" />
                            </div>
                            <div className="w-32 text-right">
                                <div className="h-3 bg-gray-100 rounded w-2/3 ml-auto" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (listings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Brak pojazdów</h3>
                <p className="text-gray-500 mt-1">Nie znaleziono pojazdów spełniających kryteria wyszukiwania.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header with select all */}
            <div className="flex items-center gap-4 px-3 py-2 bg-gray-50 rounded-lg border">
                <div className="shrink-0 pl-1">
                    <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                        className="h-5 w-5"
                    />
                </div>
                <span className="text-sm text-gray-600">
                    {selectedIds.length > 0 ? (
                        <>Zaznaczono <strong>{selectedIds.length}</strong> z {listings.length}</>
                    ) : (
                        <>Zaznacz wszystkie ({listings.length})</>
                    )}
                </span>
            </div>

            {/* Listings */}
            <div className="space-y-3">
                {listings.map((listing) => (
                    <AdminListingItem
                        key={listing.listing_id}
                        listing={listing}
                        isSelected={selectedIds.includes(listing.listing_id)}
                        onSelect={handleSelect}
                        onArchive={onArchive}
                        onRestore={onRestore}
                        onDelete={onDelete}
                    />
                ))}
            </div>
        </div>
    );
}
