import React from 'react';
import { Lead } from '@/data/mockData';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Calendar,
    User,
    Car,
    ShieldCheck,
    ExternalLink,
    UserX,
    Eye,
    MapPin,
    Phone,
    Info,
    DollarSign,
    Search,
    Loader2
} from 'lucide-react';
import { formatNumber } from '@/utils/formatters';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { leadsApi, usersApi, settingsApi } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function LeadList() {
    const { token, effectiveRole } = useAuth();
    const isSuperAdmin = effectiveRole === 'SUPERADMIN_PLATFORM';

    const queryClient = useQueryClient();
    const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedRecipientId, setSelectedRecipientId] = React.useState<string>('default');
    const [isSavingRecipient, setIsSavingRecipient] = React.useState(false);

    const { data: usersData, isLoading: isLoadingUsers } = useQuery({
        queryKey: ['adminUsersList', token],
        queryFn: async () => {
            if (!token) throw new Error('Brak tokenu');
            return usersApi.list(token);
        },
        enabled: !!token && isSuperAdmin
    });

    const { data: settingsData, isLoading: isLoadingSettings } = useQuery({
        queryKey: ['appSettings', token],
        queryFn: async () => {
            return settingsApi.getSettings();
        },
        enabled: !!token && isSuperAdmin
    });

    React.useEffect(() => {
        if (settingsData) {
            setSelectedRecipientId(settingsData.leadRecipientUserId || 'default');
        }
    }, [settingsData]);

    const handleSaveRecipient = async () => {
        if (!token || !settingsData) return;
        try {
            setIsSavingRecipient(true);
            const nextRecipientId = selectedRecipientId === 'default' ? null : selectedRecipientId;
            await settingsApi.updateSettings({
                ...settingsData,
                leadRecipientUserId: nextRecipientId
            }, token);
            await queryClient.invalidateQueries({ queryKey: ['appSettings'] });
            toast.success('Pomyślnie zaktualizowano odbiorcę powiadomień o leadach');
        } catch (error) {
            toast.error('Błąd podczas zapisywania odbiorcy');
            console.error(error);
        } finally {
            setIsSavingRecipient(false);
        }
    };

    const { data, isLoading, isFetching, isError } = useQuery({
        queryKey: ['leads', token],
        queryFn: async () => {
            if (!token) throw new Error('Brak tokenu');
            return leadsApi.getLeads(token);
        },
        enabled: !!token
    });

    const mappedLeads = React.useMemo<Lead[]>(() => {
        const formatDate = (value?: string) => {
            if (!value) return '---';
            const date = new Date(value);
            return isNaN(date.getTime()) ? '---' : date.toLocaleString('pl-PL');
        };

        return (data?.leads || []).map((lead: any): Lead => {
            const listing = lead.listing || {};
            const dealer = listing.dealer || {};

            const listingAddress = [dealer.addressLine1, dealer.addressLine2, dealer.addressLine3]
                .filter(Boolean)
                .join(', ');

            return {
                id: lead.id,
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                message: lead.message,
                status: lead.status || 'new',
                listing_id: lead.listingId || lead.listing?.id || '',
                listing_make: listing.make || '---',
                listing_model: listing.model || '',
                listing_vin: listing.vin,
                listing_price: listing.priceDisplay || (listing.pricePln ? `${listing.pricePln} PLN` : '---'),
                listing_year: listing.productionYear,
                listing_mileage: listing.mileageKm ? `${formatNumber(listing.mileageKm)} km` : undefined,
                dealer_price_net_pln: listing.dealerPriceNetPln,
                dealer_price_net_eur: listing.dealerPriceNetEur,
                broker_price_pln: listing.brokerPricePln,
                broker_price_eur: listing.brokerPriceEur,
                dealer_name: dealer.name,
                dealer_address: listingAddress || dealer.city,
                dealer_phone: dealer.contactPhone,
                consent_marketing_at: formatDate(lead.consentMarketingAt),
                consent_privacy_at: formatDate(lead.consentPrivacyAt),
                created_at: formatDate(lead.createdAt),
                // Financing mapping
                financing_product_id: lead.financingProductId,
                financing_amount: lead.financingAmount,
                financing_period: lead.financingPeriod,
                financing_down_payment: lead.financingDownPayment,
                financing_installment: lead.financingInstallment,
                external_id: lead.externalId,
                external_status: lead.externalStatus,
                provider: lead.financingProduct?.provider
            };
        });
    }, [data]);

    const loading = isLoading || (isFetching && mappedLeads.length === 0);

    const anonymizeLead = (id: string) => {
        if (window.confirm('Czy na pewno chcesz zanonimizować dane tego klienta? Tej operacji nie można cofnąć.')) {
            toast.info('Funkcja anonimizacji w przygotowaniu');
        }
    };

    const filteredLeads = React.useMemo(() => {
        const q = searchQuery.toLowerCase();
        return mappedLeads.filter(lead =>
            lead.name.toLowerCase().includes(q) ||
            (lead.email || '').toLowerCase().includes(q) ||
            // Leady z listy oczekujących (waitlist, F3) nie mają dopiętej oferty — poszukiwana
            // marka/model jest zapisana w treści wiadomości, więc filtrujemy też po niej.
            lead.message.toLowerCase().includes(q)
        );
    }, [mappedLeads, searchQuery]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'new':
                return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Nowy</Badge>;
            case 'contacted':
                return <Badge variant="secondary" className="bg-amber-500 text-white hover:bg-amber-600">Kontakt</Badge>;
            case 'in_progress':
                return <Badge variant="secondary" className="bg-purple-500 text-white hover:bg-purple-600">W toku</Badge>;
            case 'sold':
                return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Sprzedane</Badge>;
            case 'applied':
                return <Badge variant="default" className="bg-indigo-600 hover:bg-indigo-700">Wysłano wniosek</Badge>;
            case 'closed':
                return <Badge variant="outline">Zamknięty</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (!token) {
        return (
            <div className="bg-white rounded-xl shadow-sm border p-6 text-sm text-muted-foreground">
                Wymagane jest ponowne zalogowanie, aby wyświetlić leady.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border p-8 flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Ładowanie leadów...
            </div>
        );
    }

    if (isError) {
        return (
            <div className="bg-white rounded-xl shadow-sm border p-6 text-sm text-destructive">
                Nie udało się pobrać leadów. Sprawdź połączenie z API.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {isSuperAdmin && (
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail-check"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m16 19 2 2 4-4"/></svg>
                                </span>
                                Odbiorca powiadomień o leadach (Superadmin)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Wybierz osobę z zespołu operatora, do której będą przesyłane zapytania klientów z formularzy kontaktowych.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {isLoadingSettings || isLoadingUsers ? (
                                <div className="text-xs text-slate-400 flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                    Wczytywanie...
                                </div>
                            ) : (
                                <>
                                    <Select
                                        value={selectedRecipientId}
                                        onValueChange={setSelectedRecipientId}
                                    >
                                        <SelectTrigger className="w-[280px] bg-slate-50 hover:bg-slate-100/50 border-slate-200 text-sm focus:ring-blue-500 font-medium">
                                            <SelectValue placeholder="Wybierz odbiorcę" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            <SelectItem value="default" className="font-semibold text-slate-500 cursor-pointer">
                                                Domyślny adres SMTP (fallback)
                                            </SelectItem>
                                            {(usersData?.users || [])
                                                .filter(u => u.isActive)
                                                .map(u => (
                                                    <SelectItem key={u.id} value={u.id} className="cursor-pointer">
                                                        {u.name ? `${u.name} (${u.email})` : u.email}
                                                    </SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={handleSaveRecipient}
                                        disabled={isSavingRecipient}
                                        className="bg-blue-600 hover:bg-blue-700 font-medium shadow-sm transition-all duration-200 shrink-0 text-white"
                                    >
                                        {isSavingRecipient ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
                                        )}
                                        Zapisz
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Szukaj po imieniu, nazwisku lub email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white"
                />
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead className="w-[180px] font-bold text-left">Klient</TableHead>
                            <TableHead className="w-[180px] font-bold text-left">Pojazd</TableHead>
                            <TableHead className="font-bold text-left">Wiadomość</TableHead>
                            <TableHead className="font-bold text-left">Status / Data</TableHead>
                            <TableHead className="w-[120px] font-bold text-right">Akcje</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLeads.map((lead) => (
                            <TableRow key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                                <TableCell className="align-top text-left">
                                    <div className="flex flex-col gap-1 items-start">
                                        <span className="font-bold flex items-center gap-1.5 leading-none">
                                            <User className="h-3.5 w-3.5 text-slate-400" />
                                            {lead.name}
                                        </span>
                                        <span className="text-sm text-muted-foreground">{lead.email || 'Brak e-maila'}</span>
                                        {lead.phone && (
                                            <span className="text-sm text-muted-foreground font-mono">{lead.phone}</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="align-top text-left">
                                    <div className="flex flex-col gap-1 items-start">
                                        <Link
                                            to={`/listing/${lead.listing_id}`}
                                            target="_blank"
                                            className="font-bold flex items-center gap-1.5 hover:text-primary transition-colors leading-none"
                                        >
                                            <Car className="h-3.5 w-3.5 text-slate-400" />
                                            {lead.listing_make} {lead.listing_model}
                                            <ExternalLink className="h-3 w-3 text-slate-400" />
                                        </Link>
                                        {lead.listing_vin && (
                                            <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 w-fit">
                                                {lead.listing_vin}
                                            </span>
                                        )}
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-primary">
                                            <DollarSign className="h-3 w-3" />
                                            {lead.listing_price || '---'}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="align-top text-left">
                                    <div className="max-w-[250px]">
                                        <p className="text-sm line-clamp-3 text-slate-600 italic">"{lead.message}"</p>
                                    </div>
                                </TableCell>
                                <TableCell className="align-top text-left">
                                    <div className="flex flex-col gap-2 items-start">
                                        {getStatusBadge(lead.status)}
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {lead.created_at}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right align-top">
                                    <div className="flex items-center justify-end gap-1">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setSelectedLead(lead)}
                                                        className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Szczegóły zapytania</p>
                                                </TooltipContent>
                                            </Tooltip>

                                            {lead.provider === 'INBANK' && lead.status !== 'applied' && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={async () => {
                                                                if (confirm('Czy na pewno wysłać ten wniosek do Inbank?')) {
                                                                    try {
                                                                        await leadsApi.applyForFinancing(lead.id, token);
                                                                        toast.success('Wniosek został wysłany do Inbank');
                                                                        queryClient.invalidateQueries({ queryKey: ['leads'] });
                                                                    } catch (e: any) {
                                                                        toast.error(e.message || 'Błąd wysyłki wniosku');
                                                                    }
                                                                }
                                                            }}
                                                            className="h-8 w-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50"
                                                        >
                                                            <ShieldCheck className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Wyślij do Inbank</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}

                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => anonymizeLead(lead.id)}
                                                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        disabled={lead.name === 'Użytkownik zanonimizowany'}
                                                    >
                                                        <UserX className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Zanonimizuj dane klienta</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {filteredLeads.length === 0 && (
                    <div className="py-20 text-center">
                        <p className="text-muted-foreground font-medium">Nie znaleziono leadów spełniających kryteria.</p>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <Info className="h-6 w-6 text-primary" />
                            Szczegóły zapytania #{selectedLead?.id}
                        </DialogTitle>
                        <DialogDescription>
                            Pełne informacje na temat zgłoszenia oraz dane kontaktowe sprzedawcy.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLead && (
                        <div className="grid gap-6 py-4">
                            <div className="grid grid-cols-2 gap-8">
                                {/* Client Info */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b pb-2">Klient</h4>
                                    <div className="space-y-2">
                                        <p className="font-bold text-lg">{selectedLead.name}</p>
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <span className="font-medium">Email:</span> {selectedLead.email || 'Brak'}
                                        </div>
                                        {selectedLead.phone && (
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <span className="font-medium">Tel:</span> {selectedLead.phone}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Offer Info */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Oferta</h4>
                                        <Link
                                            to={`/listing/${selectedLead.listing_id}`}
                                            target="_blank"
                                            className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
                                        >
                                            Otwórz ogłoszenie <ExternalLink className="h-3 w-3" />
                                        </Link>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-bold text-lg">{selectedLead.listing_make} {selectedLead.listing_model}</p>
                                        <div className="flex flex-wrap gap-2">
                                            <div className="flex items-center gap-1.5 text-sm text-primary font-bold">
                                                <DollarSign className="h-4 w-4" />
                                                {selectedLead.listing_price}
                                            </div>
                                            {selectedLead.listing_year && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md font-medium">
                                                    <Calendar className="h-3 w-3" />
                                                    {selectedLead.listing_year}
                                                </div>
                                            )}
                                            {selectedLead.listing_mileage && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                                                    <Info className="h-3 w-3" />
                                                    {selectedLead.listing_mileage}
                                                </div>
                                            )}
                                        </div>
                                        {selectedLead.listing_vin && (
                                            <div className="text-[11px] font-mono bg-slate-50 border border-slate-100 px-2 py-1 rounded text-slate-500 w-fit">
                                                VIN: {selectedLead.listing_vin}
                                            </div>
                                        )}

                                        {/* Broker Fee display */}
                                        {(selectedLead.broker_price_pln || selectedLead.broker_price_eur) && (
                                            <div className="mt-3 py-2 px-3 bg-amber-50 rounded-lg border border-amber-100/50">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold uppercase text-amber-600/70">Marża brokera (netto)</span>
                                                    <span className="text-sm font-bold text-amber-700">
                                                        {selectedLead.broker_price_pln && selectedLead.dealer_price_net_pln ? (
                                                            `+ ${formatNumber(Math.round(selectedLead.broker_price_pln / 1.23) - selectedLead.dealer_price_net_pln)} PLN`
                                                        ) : selectedLead.broker_price_eur && selectedLead.dealer_price_net_eur ? (
                                                            `+ ${formatNumber(Math.round(selectedLead.broker_price_eur / 1.23) - selectedLead.dealer_price_net_eur)} EUR`
                                                        ) : '---'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Financing Info Section */}
                            {selectedLead.financing_product_id && (
                                <div className="space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                                        <DollarSign className="h-3 w-3" /> Parametry finansowania ({selectedLead.provider})
                                    </h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase text-indigo-400 font-bold tracking-wider">Kwota</p>
                                            <p className="text-sm font-bold">{formatNumber(selectedLead.financing_amount || 0)} PLN</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase text-indigo-400 font-bold tracking-wider">Okres</p>
                                            <p className="text-sm font-bold">{selectedLead.financing_period} m-cy</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase text-indigo-400 font-bold tracking-wider">Rata</p>
                                            <p className="text-sm font-bold text-indigo-700">{formatNumber(selectedLead.financing_installment || 0)} PLN</p>
                                        </div>
                                    </div>
                                    {selectedLead.external_id && (
                                        <div className="pt-2 mt-2 border-t border-indigo-100 flex justify-between items-center">
                                            <span className="text-[11px] text-indigo-500 font-medium">ID wniosku: <span className="font-bold">{selectedLead.external_id}</span></span>
                                            <Badge variant="outline" className="text-[10px] bg-white border-indigo-200 text-indigo-600 uppercase">
                                                Status: {selectedLead.external_status || 'Nieznany'}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Message Content */}
                            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Info className="h-3 w-3" /> Treść zapytania
                                </h4>
                                <p className="text-sm text-slate-700 leading-relaxed italic whitespace-pre-wrap">
                                    "{selectedLead.message}"
                                </p>
                            </div>

                            {/* Dealer Info */}
                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2 mb-3">
                                    <Car className="h-3 w-3" /> Dane Dealera / Sprzedawcy
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">{selectedLead.dealer_name || 'Brak danych'}</p>
                                        <div className="flex items-start gap-1.5 text-[13px] text-slate-600">
                                            <MapPin className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
                                            {selectedLead.dealer_address || 'Nie podano adresu'}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end">
                                        {selectedLead.dealer_phone && (
                                            <div className="flex items-center gap-2 text-sm font-bold bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                                                <Phone className="h-4 w-4 text-primary" />
                                                {selectedLead.dealer_phone}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Consent Info */}
                            <div className="flex justify-between items-center pt-2 border-t text-[11px] text-muted-foreground">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3 text-green-500" />
                                        Zgoda marketingowa: {selectedLead.consent_marketing_at}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3 text-green-500" />
                                        Polityka prywatności: {selectedLead.consent_privacy_at}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Wysłano: {selectedLead.created_at}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <Button variant="outline" onClick={() => setSelectedLead(null)}>Zamknij</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
