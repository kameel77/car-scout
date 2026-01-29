import { Listing } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import {
    Eye,
    Archive,
    MoreVertical,
    Calendar,
    Gauge,
    Fuel,
    Settings2
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

interface AdminListingItemProps {
    listing: Listing;
    onArchive?: (id: string) => void;
    onRestore?: (id: string) => void;
}

export function AdminListingItem({ listing, onArchive, onRestore }: AdminListingItemProps) {
    const isArchived = listing.is_archived;

    return (
        <div className={cn(
            "group bg-white rounded-xl border p-4 hover:shadow-md transition-all duration-200",
            isArchived && "opacity-75 bg-gray-50"
        )}>
            <div className="flex gap-6">
                {/* Thumbnail */}
                <div className="relative w-48 h-32 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {listing.primary_image_url ? (
                        <img
                            src={listing.primary_image_url}
                            alt={`${listing.make} ${listing.model}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No image
                        </div>
                    )}
                    {isArchived && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white font-bold text-xs uppercase tracking-wider bg-black/60 px-2 py-1 rounded">
                                Archiwalny
                            </span>
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 leading-tight truncate">
                                {listing.make} {listing.model}
                            </h3>
                            <p className="text-sm text-gray-500 truncate">
                                {listing.version}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold text-blue-600">
                                {listing.price_display}
                            </p>
                            {listing.vin && (
                                <p className="text-[10px] text-gray-400 font-mono mt-1">
                                    VIN: {listing.vin}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Specs Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-2 gap-x-4 mt-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>{listing.production_year}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Gauge className="w-3.5 h-3.5 text-gray-400" />
                            <span>{listing.mileage_km.toLocaleString()} km</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Fuel className="w-3.5 h-3.5 text-gray-400" />
                            <span className="capitalize">{listing.fuel_type}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Settings2 className="w-3.5 h-3.5 text-gray-400" />
                            <span className="truncate">{listing.transmission}</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end justify-between">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500">
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                                <a href={`/listing/${listing.listing_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    <span>Zobacz w serwisie</span>
                                </a>
                            </DropdownMenuItem>
                            {isArchived ? (
                                <DropdownMenuItem onClick={() => onRestore?.(listing.listing_id)} className="text-green-600">
                                    <Archive className="w-4 h-4 mr-2" />
                                    <span>Przywróć</span>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onClick={() => onArchive?.(listing.listing_id)} className="text-red-600">
                                    <Archive className="w-4 h-4 mr-2" />
                                    <span>Archiwizuj</span>
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                            <a href={`/listing/${listing.listing_id}`} target="_blank" rel="noopener noreferrer">
                                <Eye className="w-3.5 h-3.5" />
                                Podgląd
                            </a>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
