import { Listing } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Eye,
    Archive,
    MoreVertical,
    Trash2,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { getListingUrlPath } from '@/utils/url-utils';

interface AdminListingItemProps {
    listing: Listing;
    isSelected?: boolean;
    onSelect?: (id: string, selected: boolean) => void;
    onArchive?: (id: string) => void;
    onRestore?: (id: string) => void;
    onDelete?: (id: string) => void;
}

export function AdminListingItem({ listing, isSelected = false, onSelect, onArchive, onRestore, onDelete }: AdminListingItemProps) {
    const isArchived = listing.is_archived;

    return (
        <div className={cn(
            "group bg-white rounded-xl border p-3 hover:shadow-md transition-all duration-200",
            isArchived && "opacity-75 bg-gray-50",
            isSelected && "ring-2 ring-blue-500 border-blue-500"
        )}>
            <div className="flex items-center gap-4">
                {/* Checkbox */}
                <div className="shrink-0 pl-1">
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onSelect?.(listing.listing_id, checked as boolean)}
                        className="h-5 w-5"
                    />
                </div>

                {/* Thumbnail */}
                <div className="relative w-24 h-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
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
                            <span className="text-white font-bold text-[8px] uppercase tracking-wider bg-black/60 px-1 py-0.5 rounded">
                                Archiwalny
                            </span>
                        </div>
                    )}
                </div>

                {/* Identity Group (3 rows) */}
                <div className="w-48 shrink-0 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 leading-tight truncate">
                        {listing.make} {listing.model}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">
                        {listing.version}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">
                        {listing.vin || 'Brak VIN'}
                    </p>
                </div>

                {/* Specs Columns */}
                <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                    <div className="text-xs text-center text-gray-600 truncate px-1">
                        <span className="block text-[10px] text-gray-400 mb-0.5 uppercase tracking-tighter">Nadwozie</span>
                        {listing.body_type}
                    </div>
                    <div className="text-xs text-center text-gray-600 truncate px-1 border-l">
                        <span className="block text-[10px] text-gray-400 mb-0.5 uppercase tracking-tighter">Rocznik</span>
                        {listing.production_year}
                    </div>
                    <div className="text-xs text-center text-gray-600 truncate px-1 border-l">
                        <span className="block text-[10px] text-gray-400 mb-0.5 uppercase tracking-tighter">Przebieg</span>
                        {listing.mileage_km.toLocaleString()} km
                    </div>
                    <div className="text-xs text-center text-gray-600 truncate px-1 border-l">
                        <span className="block text-[10px] text-gray-400 mb-0.5 uppercase tracking-tighter">Paliwo</span>
                        <span className="capitalize">{listing.fuel_type}</span>
                    </div>
                    <div className="text-xs text-center text-gray-600 truncate px-1 border-l">
                        <span className="block text-[10px] text-gray-400 mb-0.5 uppercase tracking-tighter">Skrzynia</span>
                        <span className="truncate">{listing.transmission}</span>
                    </div>
                </div>

                {/* Price Group */}
                <div className="w-40 shrink-0 text-right pr-2">
                    <p className="text-sm font-bold text-blue-600">
                        {listing.price_display}
                    </p>
                    {(listing.dealer_price_net_pln || listing.broker_price_pln) && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            Cena netto: {(listing.dealer_price_net_pln || listing.broker_price_pln || 0).toLocaleString('pl-PL')} PLN
                        </p>
                    )}
                </div>

                {/* Actions Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:bg-gray-100 rounded-full">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                            <a 
                                href={getListingUrlPath({
                                    id: listing.listing_id,
                                    make: listing.make,
                                    model: listing.model,
                                    version: listing.version,
                                    productionYear: listing.production_year,
                                    bodyType: listing.body_type,
                                    fuelType: listing.fuel_type
                                })} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-2"
                            >
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                            onClick={() => onDelete?.(listing.listing_id)} 
                            className="text-red-700 hover:text-red-800 hover:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            <span>Usuń definitywnie</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
