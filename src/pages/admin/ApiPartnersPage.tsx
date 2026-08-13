import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnerManagementApi, PartnerApiIntegration } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, KeyRound, Copy, Check, Loader2, Info, Building2, UserCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MappingState {
    externalId: string;
    dealerId: string;
}

export default function ApiPartnersPage() {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState<PartnerApiIntegration | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    // Holds the plaintext key right after it is created/regenerated - this is
    // the only moment the backend ever sends it, so it's shown once here and
    // then discarded.
    const [revealedKey, setRevealedKey] = useState<string | null>(null);

    // Controlled state for mappings
    const [mappings, setMappings] = useState<MappingState[]>([]);

    useEffect(() => {
        if (editingPartner) {
            setMappings(editingPartner.mappings ? [...editingPartner.mappings] : []);
        } else {
            setMappings([]);
        }
    }, [editingPartner, isDialogOpen]);

    const { data: dealersData } = useQuery({
        queryKey: ['admin-dealers'],
        queryFn: async () => {
            const API_BASE_URL = import.meta.env.VITE_API_URL || '';
            const baseUrl = API_BASE_URL.replace(/\/api$/, '');
            const response = await fetch(`${baseUrl}/api/admin/dealers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch dealers');
            return response.json();
        },
        enabled: !!token
    });

    const { data, isLoading } = useQuery({
        queryKey: ['admin-api-partners'],
        queryFn: () => partnerManagementApi.list(token || ''),
        enabled: !!token
    });

    const createMutation = useMutation({
        mutationFn: (newPartner: Partial<PartnerApiIntegration>) => partnerManagementApi.create(newPartner, token || ''),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['admin-api-partners'] });
            toast.success("Klucz API został wygenerowany pomyślnie.");
            setIsDialogOpen(false);
            setRevealedKey(result.apiKey);
        },
        onError: (err: any) => toast.error(`Błąd: ${err.message}`)
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<PartnerApiIntegration> }) => partnerManagementApi.update(id, data, token || ''),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-api-partners'] });
            toast.success("Zmiany zostały zapisane.");
            setIsDialogOpen(false);
        },
        onError: (err: any) => toast.error(`Błąd: ${err.message}`)
    });

    const regenerateMutation = useMutation({
        mutationFn: (id: string) => partnerManagementApi.regenerateKey(id, token || ''),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['admin-api-partners'] });
            toast.success("Nowy klucz API został wygenerowany.");
            setRevealedKey(result.apiKey);
        },
        onError: (err: any) => toast.error(`Błąd: ${err.message}`)
    });

    const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        // Validate mappings: all must have externalId and dealerId
        if (mappings.some(m => !m.externalId || !m.dealerId)) {
            toast.error("Wszystkie mapowania muszą mieć wpisane ID z systemu zewnętrznego i przypisanego Dealera.");
            return;
        }

        const partnerData = {
            name: formData.get('name') as string,
            nip: formData.get('nip') as string,
            contactPerson: formData.get('contactPerson') as string,
            contactEmail: formData.get('contactEmail') as string,
            contactPhone: formData.get('contactPhone') as string,
            mappings,
            isActive: formData.get('isActive') === 'on'
        };

        if (editingPartner) {
            updateMutation.mutate({ id: editingPartner.id, data: partnerData });
        } else {
            createMutation.mutate(partnerData);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(text);
        toast.success("Skopiowano klucz API");
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const addMapping = () => {
        setMappings([...mappings, { externalId: '', dealerId: '' }]);
    };

    const updateMapping = (index: number, field: keyof MappingState, value: string) => {
        const newMappings = [...mappings];
        newMappings[index] = { ...newMappings[index], [field]: value };
        setMappings(newMappings);
    };

    const removeMapping = (index: number) => {
        const newMappings = [...mappings];
        newMappings.splice(index, 1);
        setMappings(newMappings);
    };

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const partners = data?.partners || [];
    const dealers = dealersData?.dealers || [];

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Klucze API (Integracje)</h1>
                    <p className="text-muted-foreground">Zarządzaj dostępem dla systemów zewnętrznych DMS do publikacji u wielu Dealerów.</p>
                </div>
                <Button onClick={() => { setEditingPartner(null); setIsDialogOpen(true); }} className="gap-2">
                    <Plus className="h-4 w-4" /> Nowy Partner
                </Button>
            </div>

            {partners.length === 0 && (
                <Alert className="bg-muted/30">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Brak partnerów API</AlertTitle>
                    <AlertDescription>
                        Aktualnie nie masz wygenerowanych żadnych kluczy dostępu do API zewnętrznego. Kliknij przycisk powyżej, aby wygenerować pierwszy klucz.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {partners.map(partner => (
                    <Card key={partner.id} className={`${!partner.isActive ? 'opacity-60' : ''} flex flex-col`}>
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <Badge variant={partner.isActive ? "default" : "secondary"}>
                                    {partner.isActive ? "AKTYWNY" : "ZABLOKOWANY"}
                                </Badge>
                                <Button variant="ghost" size="sm" onClick={() => { setEditingPartner(partner); setIsDialogOpen(true); }}>
                                    Edytuj
                                </Button>
                            </div>
                            <CardTitle className="text-xl mt-2">{partner.name}</CardTitle>
                            {partner.nip && <CardDescription>NIP: {partner.nip}</CardDescription>}
                        </CardHeader>
                        <CardContent className="flex-1 space-y-4">
                            <div className="space-y-1">
                                <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                                    <KeyRound className="h-3 w-3" /> Klucz API (Token Auth)
                                </div>
                                <div className="flex items-center gap-2 mt-1 bg-muted/50 rounded p-1.5 border border-dashed border-primary/20">
                                    <code className="text-xs truncate flex-1 font-mono text-primary font-semibold">
                                        {partner.hasApiKey ? `Ustawiony ••••${partner.apiKeyLast4 ?? ''}` : 'Nie ustawiony'}
                                    </code>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Pełny klucz jest widoczny tylko raz - zaraz po wygenerowaniu lub zresetowaniu.
                                </p>
                            </div>
                            
                            <div className="space-y-1 pt-2 border-t">
                                <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                                    <Building2 className="h-3 w-3" /> Przypisani Dealerzy ({partner.mappings?.length || 0})
                                </div>
                                {partner.mappings && partner.mappings.length > 0 ? (
                                    <div className="space-y-2 mt-2">
                                        {partner.mappings.map((m, idx) => (
                                            <div key={idx} className="flex flex-col text-sm bg-muted/30 p-2 rounded">
                                                <span className="font-medium">{m.dealer?.name || 'Nieznany dealer'}</span>
                                                <span className="text-xs text-muted-foreground">ID z DMS: <code className="font-mono">{m.externalId}</code></span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground">Brak przypisania (Tylko odczyt globalny / Zablokowany)</div>
                                )}
                            </div>

                            {(partner.contactPerson || partner.contactEmail || partner.contactPhone) && (
                                <div className="space-y-1 pt-2 border-t">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                                        <UserCircle2 className="h-3 w-3" /> Osoba kontaktowa
                                    </div>
                                    <div className="text-sm">
                                        {partner.contactPerson && <div>{partner.contactPerson}</div>}
                                        {partner.contactEmail && <div className="text-muted-foreground">{partner.contactEmail}</div>}
                                        {partner.contactPhone && <div className="text-muted-foreground">{partner.contactPhone}</div>}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end mt-auto">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-destructive hover:text-destructive w-full"
                                    onClick={() => {
                                        if (confirm("Czy na pewno chcesz zresetować klucz API dla tego partnera? Systemy integrujące się stracą dostęp ze starym kluczem!")) {
                                            regenerateMutation.mutate(partner.id);
                                        }
                                    }}
                                >
                                    <KeyRound className="h-3 w-3 mr-1" /> Wygeneruj nowy klucz
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <form onSubmit={handleSave}>
                        <DialogHeader>
                            <DialogTitle>{editingPartner ? 'Edytuj Partnera API' : 'Nowy Partner API'}</DialogTitle>
                            <DialogDescription>
                                System automatycznie wygeneruje nowy, bezpieczny token po utworzeniu partnera. Możesz przypisać tu wielu Dealerów mapując ich ID z systemu zewnętrznego partnera (DMS).
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nazwa Partnera (Firmy / Systemu DMS) *</Label>
                                <Input id="name" name="name" defaultValue={editingPartner?.name} required placeholder="np. Auto CRM Sp. z o.o." />
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <Label>Mapowanie Dealerów (Integracja N:M)</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addMapping}>
                                        <Plus className="h-4 w-4 mr-1" /> Dodaj Dealera
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Klucz API pozwala na wprowadzanie aut tylko dla tych dealerów. Musisz zdefiniować jakie identyfikatory ten partner wysyła w payloadzie (externalDealerId) i na jakiego dealera wewnętrznego ma to być zmapowane.
                                </p>
                                
                                {mappings.length === 0 ? (
                                    <Alert className="py-2">
                                        <AlertDescription className="text-xs">
                                            Brak dealerów. Klucz będzie miał uprawnienia tylko do odczytu danych publicznych.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="space-y-3">
                                        {mappings.map((mapping, idx) => (
                                            <div key={idx} className="flex gap-2 items-end bg-muted/20 p-3 rounded border">
                                                <div className="flex-1 space-y-1">
                                                    <Label className="text-xs">ID w systemie DMS (External ID) *</Label>
                                                    <Input 
                                                        value={mapping.externalId} 
                                                        onChange={(e) => updateMapping(idx, 'externalId', e.target.value)} 
                                                        placeholder="np. DMS-WAW-12"
                                                        required
                                                    />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <Label className="text-xs">Wewnętrzny Dealer (Motolia) *</Label>
                                                    <Select 
                                                        value={mapping.dealerId} 
                                                        onValueChange={(val) => updateMapping(idx, 'dealerId', val)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Wybierz..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {dealers.map((d: any) => (
                                                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="text-destructive"
                                                    onClick={() => removeMapping(idx)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div className="space-y-2">
                                    <Label htmlFor="nip">NIP (opcjonalnie)</Label>
                                    <Input id="nip" name="nip" defaultValue={editingPartner?.nip || ''} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contactPhone">Telefon (opcjonalnie)</Label>
                                    <Input id="contactPhone" name="contactPhone" defaultValue={editingPartner?.contactPhone || ''} />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="contactPerson">Osoba Kontaktowa / IT</Label>
                                <Input id="contactPerson" name="contactPerson" defaultValue={editingPartner?.contactPerson || ''} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="contactEmail">Email do wsparcia IT / Alertów</Label>
                                <Input id="contactEmail" name="contactEmail" type="email" defaultValue={editingPartner?.contactEmail || ''} />
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                                <div className="space-y-0.5">
                                    <Label>Dostęp włączony (Aktywny)</Label>
                                    <p className="text-[10px] text-muted-foreground">Czy ten partner może komunikować się z API?</p>
                                </div>
                                <Switch name="isActive" defaultChecked={editingPartner ? editingPartner.isActive : true} />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Anuluj</Button>
                            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Zapisz Partnera
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!revealedKey} onOpenChange={(open) => { if (!open) setRevealedKey(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Nowy klucz API</DialogTitle>
                        <DialogDescription>
                            To jedyny moment, w którym pełny klucz jest widoczny - skopiuj go teraz i zapisz w bezpiecznym miejscu. Po zamknięciu tego okna nie będzie już możliwości jego ponownego wyświetlenia.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-2 mt-1 bg-muted/50 rounded p-2 border border-dashed border-primary/20">
                        <code className="text-xs truncate flex-1 font-mono text-primary font-semibold">
                            {revealedKey}
                        </code>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => revealedKey && copyToClipboard(revealedKey)}
                        >
                            {copiedKey === revealedKey ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={() => setRevealedKey(null)}>Zamknij</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
