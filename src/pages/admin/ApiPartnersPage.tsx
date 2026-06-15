import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnerManagementApi, PartnerApiIntegration } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, KeyRound, Copy, Check, Loader2, Info, Building2, UserCircle2 } from 'lucide-react';
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

export default function ApiPartnersPage() {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState<PartnerApiIntegration | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-api-partners'] });
            toast.success("Klucz API został wygenerowany pomyślnie.");
            setIsDialogOpen(false);
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-api-partners'] });
            toast.success("Nowy klucz API został wygenerowany.");
        },
        onError: (err: any) => toast.error(`Błąd: ${err.message}`)
    });

    const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const dealerIdVal = formData.get('dealerId') as string;

        const partnerData = {
            name: formData.get('name') as string,
            nip: formData.get('nip') as string,
            contactPerson: formData.get('contactPerson') as string,
            contactEmail: formData.get('contactEmail') as string,
            contactPhone: formData.get('contactPhone') as string,
            dealerId: dealerIdVal === 'none' ? null : dealerIdVal,
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
                    <p className="text-muted-foreground">Zarządzaj dostępem dla systemów zewnętrznych i dealerów (zewnętrzne API v1).</p>
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
                                        {partner.apiKey}
                                    </code>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(partner.apiKey)}>
                                        {copiedKey === partner.apiKey ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="space-y-1 pt-2 border-t">
                                <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                                    <Building2 className="h-3 w-3" /> Przypisany Dealer
                                </div>
                                <div className="text-sm font-medium">
                                    {partner.dealer ? partner.dealer.name : <span className="text-muted-foreground">Brak przypisania (Dostęp globalny / Zablokowany)</span>}
                                </div>
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

                            <div className="pt-4 flex justify-end">
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
                <DialogContent>
                    <form onSubmit={handleSave}>
                        <DialogHeader>
                            <DialogTitle>{editingPartner ? 'Edytuj Partnera API' : 'Nowy Partner API'}</DialogTitle>
                            <DialogDescription>
                                System automatycznie wygeneruje nowy, bezpieczny token po utworzeniu partnera.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nazwa Partnera (Firmy / Systemu) *</Label>
                                <Input id="name" name="name" defaultValue={editingPartner?.name} required placeholder="np. Auto CRM Sp. z o.o." />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="dealerId">Przypisz Dealera (Dla kogo działa to API?)</Label>
                                <Select name="dealerId" defaultValue={editingPartner?.dealerId || 'none'}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wybierz dealera..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Brak (Uwaga! Zablokuje modyfikację aut na frontendzie, tylko GET)</SelectItem>
                                        {dealers.map((d: any) => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
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
        </div>
    );
}
