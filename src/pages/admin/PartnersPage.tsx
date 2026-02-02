import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnerAdsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { PartnerAd, AdPlacement } from '@/types/partnerAds';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Plus,
    Edit2,
    Trash2,
    ExternalLink,
    Eye,
    EyeOff,
    Loader2,
    Megaphone,
    Layout,
    Sidebar,
    ArrowBigUpDash,
    Info
} from 'lucide-react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

export default function AdminPartnersPage() {
    const { t } = useTranslation();
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAd, setEditingAd] = useState<PartnerAd | null>(null);
    const [overlayOpacity, setOverlayOpacity] = useState(0.9);

    // Fetch Ads
    const { data, isLoading, error } = useQuery({
        queryKey: ['admin-partner-ads'],
        queryFn: () => partnerAdsApi.listAdmin(token || ''),
        enabled: !!token
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (newAd: any) => partnerAdsApi.create(newAd, token || ''),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-partner-ads'] });
            toast.success("Reklama została utworzona");
            setIsDialogOpen(false);
        },
        onError: (err: any) => toast.error(`Błąd: ${err.message}`)
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => partnerAdsApi.update(id, data, token || ''),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-partner-ads'] });
            toast.success("Zmiany zostały zapisane");
            setIsDialogOpen(false);
        },
        onError: (err: any) => toast.error(`Błąd: ${err.message}`)
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => partnerAdsApi.delete(id, token || ''),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-partner-ads'] });
            toast.success("Reklama została usunięta");
        },
        onError: (err: any) => toast.error(`Błąd: ${err.message}`)
    });

    const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const featuresString = formData.get('features') as string;

        const adData = {
            placement: formData.get('placement') as AdPlacement,
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            subtitle: formData.get('subtitle') as string,
            ctaText: formData.get('ctaText') as string,
            url: formData.get('url') as string,
            imageUrl: formData.get('imageUrl') as string,
            brandName: formData.get('brandName') as string,
            priority: parseInt(formData.get('priority') as string) || 0,
            isActive: formData.get('isActive') === 'on',
            overlayOpacity: overlayOpacity,
            features: featuresString ? featuresString.split(',').map(f => f.trim()) : []
        };

        if (editingAd) {
            updateMutation.mutate({ id: editingAd.id, data: adData });
        } else {
            createMutation.mutate(adData);
        }
    };

    const openCreateDialog = () => {
        setEditingAd(null);
        setOverlayOpacity(0.9);
        setIsDialogOpen(true);
    };

    const openEditDialog = (ad: PartnerAd) => {
        setEditingAd(ad);
        setOverlayOpacity(ad.overlayOpacity ?? 0.9);
        setIsDialogOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const ads = data?.ads || [];

    const placementIcons = {
        'SEARCH_GRID': <Layout className="h-4 w-4" />,
        'SEARCH_TOP': <Megaphone className="h-4 w-4" />,
        'DETAIL_SIDEBAR': <Sidebar className="h-4 w-4" />
    };

    const placementLabels = {
        'SEARCH_GRID': 'Lista (In-Feed)',
        'SEARCH_TOP': 'Baner Górny',
        'DETAIL_SIDEBAR': 'Sidebar Szczegółów'
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Partnerzy i Reklamy</h1>
                    <p className="text-muted-foreground">Dynamiczne zarządzanie ofertami partnerskimi w serwisie.</p>
                </div>
                <Button onClick={openCreateDialog} className="gap-2">
                    <Plus className="h-4 w-4" /> Dodaj reklamę
                </Button>
            </div>

            {ads.length === 0 && (
                <Alert className="bg-muted/30">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Brak reklam</AlertTitle>
                    <AlertDescription>
                        Nie masz jeszcze żadnych aktywnych reklam. Kliknij przycisk powyżej, aby dodać pierwszą ofertę.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6">
                {(['SEARCH_TOP', 'SEARCH_GRID', 'DETAIL_SIDEBAR'] as AdPlacement[]).map(placement => {
                    const filteredAds = ads.filter(a => a.placement === placement);
                    if (filteredAds.length === 0 && placement !== 'SEARCH_TOP') return null;

                    return (
                        <div key={placement} className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                {placementIcons[placement]}
                                {placementLabels[placement]}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {filteredAds.map(ad => (
                                    <Card key={ad.id} className={`${!ad.isActive ? 'opacity-60 grayscale-[0.5]' : ''} group relative overflow-hidden`}>
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <Badge variant={ad.isActive ? "default" : "secondary"} className="text-[10px]">
                                                    {ad.isActive ? "AKTYWNA" : "NIEAKTYWNA"}
                                                </Badge>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(ad)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(ad.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <CardTitle className="text-base line-clamp-1 mt-2">{ad.title}</CardTitle>
                                            <CardDescription className="text-xs">{ad.brandName || placementLabels[ad.placement]}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {ad.imageUrl && (
                                                <div className="aspect-video rounded-md overflow-hidden border bg-muted">
                                                    <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <ArrowBigUpDash className="h-3 w-3" />
                                                    Priorytet: {ad.priority}
                                                </div>
                                                <a href={ad.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-accent">
                                                    Link <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {filteredAds.length === 0 && (
                                    <div className="col-span-full py-8 border-2 border-dashed rounded-xl flex items-center justify-center text-muted-foreground text-sm">
                                        Brak reklam w tej sekcji
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <form onSubmit={handleSave}>
                        <DialogHeader>
                            <DialogTitle>{editingAd ? 'Edytuj reklamę' : 'Dodaj nową reklamę'}</DialogTitle>
                            <DialogDescription>
                                Wprowadź dane reklamy. Zmiany będą widoczne natychmiast po zapisaniu.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="placement">Miejsce wyświetlania</Label>
                                    <Select name="placement" defaultValue={editingAd?.placement || 'SEARCH_GRID'}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="SEARCH_TOP">Baner Górny (Wyszukiwarka)</SelectItem>
                                            <SelectItem value="SEARCH_GRID">Lista wyników (In-Feed)</SelectItem>
                                            <SelectItem value="DETAIL_SIDEBAR">Sidebar (Szczegóły)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="brandName">Nazwa partnera/marki</Label>
                                    <Input id="brandName" name="brandName" defaultValue={editingAd?.brandName} placeholder="np. Masterlease" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="title">Tytuł reklamy (Opcjonalny)</Label>
                                <Input id="title" name="title" defaultValue={editingAd?.title} placeholder="Główny tekst reklamy" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="subtitle">Podtytuł / Slogan</Label>
                                <Input id="subtitle" name="subtitle" defaultValue={editingAd?.subtitle} placeholder="Opcjonalny tekst uzupełniający" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Opis korzyści</Label>
                                <Input id="description" name="description" defaultValue={editingAd?.description} placeholder="Dłuższy opis oferty" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ctaText">Tekst przycisku (Opcjonalny)</Label>
                                    <Input id="ctaText" name="ctaText" defaultValue={editingAd?.ctaText} placeholder="np. Sprawdź ofertę" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="priority">Priorytet (Sortowanie)</Label>
                                    <Input id="priority" name="priority" type="number" defaultValue={editingAd?.priority || 0} />
                                </div>
                            </div>

                            <div className="space-y-4 p-3 border rounded-lg bg-orange-50/50">
                                <div className="flex justify-between items-center">
                                    <Label>Przezroczystość tła (Baner)</Label>
                                    <span className="text-xs font-mono bg-orange-100 px-1.5 py-0.5 rounded text-orange-700">
                                        {Math.round(overlayOpacity * 100)}%
                                    </span>
                                </div>
                                <Slider
                                    value={[overlayOpacity]}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    onValueChange={(val) => setOverlayOpacity(val[0])}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Kontroluje stopień przezroczystości pomarańczowego tła w formacie Baner Górny.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="url">Link docelowy (URL)</Label>
                                <Input id="url" name="url" defaultValue={editingAd?.url} required placeholder="https://..." />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="imageUrl">URL Obrazka / Baneru</Label>
                                <Input id="imageUrl" name="imageUrl" defaultValue={editingAd?.imageUrl} placeholder="https://images.unsplash.com/..." />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="features">Cechy / Atuty (oddzielone przecinkiem)</Label>
                                <Input id="features" name="features" defaultValue={editingAd?.features.join(', ')} placeholder="Cecha 1, Cecha 2, Cecha 3" />
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                                <div className="space-y-0.5">
                                    <Label>Status aktywności</Label>
                                    <p className="text-[10px] text-muted-foreground">Czy reklama ma być wyświetlana publicznie?</p>
                                </div>
                                <Switch name="isActive" defaultChecked={editingAd ? editingAd.isActive : true} />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Anuluj</Button>
                            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                {createMutation.isPending || updateMutation.isPending ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Zapisywanie...</>
                                ) : 'Zapisz reklamę'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
