import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, BadgePercent, Store, ShieldAlert, Calendar, Car } from 'lucide-react';
import type { RentalOperatorInfo } from '@/services/rental-api';

export interface RentalOperatorOfferModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: { make: string; model: string; version?: string | null } | null;
    offer: { company?: { id: string; name: string } } | null;
    feePct: number | null | undefined;
    operatorInfo: RentalOperatorInfo | null | undefined;
    isLoadingInfo?: boolean;
}

export function RentalOperatorOfferModal({
    isOpen,
    onClose,
    vehicle,
    offer,
    feePct,
    operatorInfo,
    isLoadingInfo = false,
}: RentalOperatorOfferModalProps) {
    if (!offer) return null;

    const partnerName = offer.company?.name || 'Brak danych';
    const feeDisplay = feePct !== undefined && feePct !== null ? `${feePct}%` : 'Brak danych';

    const dealerName = operatorInfo?.dealer?.name;
    const dealerCity = operatorInfo?.dealer?.city;
    const ownerCompanyName = operatorInfo?.ownerRentalCompany?.name;

    return (
        <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
            <DialogContent className="sm:max-w-md p-6 bg-white rounded-2xl shadow-xl border border-gray-200">
                <DialogHeader className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded">
                            <ShieldAlert className="w-3 h-3 text-amber-800" />
                            WEWNĘTRZNE
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">Panel operatora Motolia</span>
                    </div>
                    <DialogTitle className="text-lg font-bold text-gray-900">
                        Informacje wewnętrzne oferty
                    </DialogTitle>
                    {vehicle && (
                        <DialogDescription className="text-xs text-muted-foreground">
                            {vehicle.make} {vehicle.model} {vehicle.version || ''}
                        </DialogDescription>
                    )}
                </DialogHeader>

                <div className="space-y-3 py-2">
                    {/* Partner */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                                <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Partner wynajmu (CFM)</p>
                                <p className="text-sm font-semibold text-gray-900">{partnerName}</p>
                            </div>
                        </div>
                    </div>

                    {/* Stawka prowizji */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/60 border border-amber-200/80">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-amber-100 text-amber-900">
                                <BadgePercent className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs text-amber-800 font-medium">Stawka prowizji Motolia</p>
                                <p className="text-base font-bold font-mono text-amber-950">{feeDisplay}</p>
                            </div>
                        </div>
                        {feePct !== undefined && feePct !== null && (
                            <span className="text-xs bg-amber-200/80 text-amber-900 font-semibold px-2 py-0.5 rounded">
                                fee: {feePct}%
                            </span>
                        )}
                    </div>

                    {/* Dostawca pojazdu / Właściciel floty */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                                <Store className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-muted-foreground">Dostawca pojazdu (Dealer)</p>
                                <p className="text-sm font-semibold text-gray-900">
                                    {isLoadingInfo ? (
                                        <span className="text-muted-foreground font-normal">Ładowanie...</span>
                                    ) : dealerName ? (
                                        <>
                                            {dealerName}
                                            {dealerCity ? ` (${dealerCity})` : ''}
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground font-normal">Brak przypisanego dealera</span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {ownerCompanyName && (
                            <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Właściciel floty (CFM):</span>
                                <span className="font-medium text-gray-800">{ownerCompanyName}</span>
                            </div>
                        )}
                    </div>

                    {/* Dodatkowe dane pojazdu dla operatora */}
                    {(operatorInfo?.availableFrom || operatorInfo?.firstRegistrationDate || operatorInfo?.vin) && (
                        <div className="p-3 rounded-xl bg-gray-50/70 border border-gray-200/60 text-xs space-y-1.5">
                            {operatorInfo?.availableFrom && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                        Dostępny od:
                                    </span>
                                    <span className="font-semibold text-gray-900 font-mono">{operatorInfo.availableFrom}</span>
                                </div>
                            )}
                            {operatorInfo?.firstRegistrationDate && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Car className="w-3.5 h-3.5 text-muted-foreground" />
                                        1. rejestracja:
                                    </span>
                                    <span className="font-semibold text-gray-900 font-mono">{operatorInfo.firstRegistrationDate}</span>
                                </div>
                            )}
                            {operatorInfo?.vin && (
                                <div className="flex items-center justify-between pt-1 border-t border-gray-200/40">
                                    <span className="text-muted-foreground">VIN:</span>
                                    <span className="font-mono text-gray-800">{operatorInfo.vin}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-2">
                    <Button onClick={onClose} variant="outline" className="w-full">
                        Zamknij
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
