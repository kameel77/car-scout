import { Listing } from '@/data/mockData';
import { AdminListingItem } from './AdminListingItem';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminListingListProps {
    listings: Listing[];
    isLoading: boolean;
    onArchive?: (id: string) => void;
    onRestore?: (id: string) => void;
}

export function AdminListingList({ listings, isLoading, onArchive, onRestore }: AdminListingListProps) {
    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-white rounded-xl border p-4 h-[120px] animate-pulse">
                        <div className="flex gap-6 h-full">
                            <div className="w-48 h-full bg-gray-100 rounded-lg" />
                            <div className="flex-1 space-y-3 py-1">
                                <div className="h-4 bg-gray-100 rounded w-1/3" />
                                <div className="h-3 bg-gray-100 rounded w-1/4" />
                                <div className="grid grid-cols-4 gap-4 mt-auto">
                                    <div className="h-3 bg-gray-100 rounded" />
                                    <div className="h-3 bg-gray-100 rounded" />
                                    <div className="h-3 bg-gray-100 rounded" />
                                    <div className="h-3 bg-gray-100 rounded" />
                                </div>
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
            {listings.map((listing) => (
                <AdminListingItem
                    key={listing.listing_id}
                    listing={listing}
                    onArchive={onArchive}
                    onRestore={onRestore}
                />
            ))}
        </div>
    );
}
