
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Search, Tags, Globe, FileText, Code } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SeoConfig {
    gtmId: string;
    homeTitle: string;
    homeDescription: string;
    homeOgImage: string;
    listingTitle: string;
    listingDescription: string;
}

export default function SeoPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("general");

    const { data: config, isLoading } = useQuery<SeoConfig>({
        queryKey: ['seo-config-admin'],
        queryFn: async () => {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/seo`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch SEO config');
            return res.json();
        }
    });

    const { register, handleSubmit, reset, setValue } = useForm<SeoConfig>();

    useEffect(() => {
        if (config) {
            reset(config);
        }
    }, [config, reset]);

    const mutation = useMutation({
        mutationFn: async (data: SeoConfig) => {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/seo`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update config');
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Sukces", description: "Ustawienia SEO zostały zapisane." });
            queryClient.invalidateQueries({ queryKey: ['seo-config-admin'] });
            queryClient.invalidateQueries({ queryKey: ['seo-config'] }); // Invalidate global config
        },
        onError: () => {
            toast({ variant: "destructive", title: "Błąd", description: "Nie udało się zapisać zmian." });
        }
    });

    const onSubmit = (data: SeoConfig) => {
        mutation.mutate(data);
    };

    if (isLoading) return <div className="p-8">Ładowanie...</div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-900">Zarządzanie SEO</h1>
                    <Button onClick={handleSubmit(onSubmit)} disabled={mutation.isPending}>
                        {mutation.isPending ? 'Zapisywanie...' : 'Zapisz Zmiany'}
                    </Button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="general" className="gap-2"><Code className="w-4 h-4" /> Ogólne / GTM</TabsTrigger>
                            <TabsTrigger value="home" className="gap-2"><Globe className="w-4 h-4" /> Strona Główna</TabsTrigger>
                            <TabsTrigger value="listings" className="gap-2"><Tags className="w-4 h-4" /> Szablony Ofert</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Integracje i Ustawienia Ogólne</CardTitle>
                                    <CardDescription>Konfiguracja narzędzi zewnętrznych</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="gtmId">Google Tag Manager ID (GTM-XXXXXX)</Label>
                                        <Input id="gtmId" {...register("gtmId")} placeholder="GTM-XXXXXX" />
                                        <p className="text-sm text-gray-500">
                                            Pozostaw puste aby wyłączyć GTM. Kontener zostanie załadowany automatycznie na każdej stronie.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="home">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Meta Tagi Strony Głównej</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="homeTitle">Tytuł (Title)</Label>
                                        <Input id="homeTitle" {...register("homeTitle")} placeholder="Car Scout - Najlepsze samochody" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="homeDescription">Opis (Description)</Label>
                                        <Textarea id="homeDescription" {...register("homeDescription")} placeholder="Znajdź, sprawdź i zamów..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="homeOgImage">Obrazek Udostępniania (OG Image URL)</Label>
                                        <Input id="homeOgImage" {...register("homeOgImage")} placeholder="https://..." />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="listings">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Szablony Meta Tagów dla Ofert</CardTitle>
                                    <CardDescription>
                                        Użyj zmiennych aby dynamicznie generować tytuły i opisy.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-4 bg-muted rounded-md text-sm mb-4">
                                        <p className="font-semibold mb-2">Dostępne zmienne:</p>
                                        <div className="flex gap-2 flex-wrap">
                                            <code className="bg-white px-2 py-1 rounded border">{"{{make}}"}</code>
                                            <code className="bg-white px-2 py-1 rounded border">{"{{model}}"}</code>
                                            <code className="bg-white px-2 py-1 rounded border">{"{{year}}"}</code>
                                            <code className="bg-white px-2 py-1 rounded border">{"{{price}}"}</code>
                                            <code className="bg-white px-2 py-1 rounded border">{"{{fuel}}"}</code>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="listingTitle">Szablon Tytułu</Label>
                                        <Input id="listingTitle" {...register("listingTitle")} placeholder="{{make}} {{model}} {{year}} - Sprawdź cenę!" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="listingDescription">Szablon Opisu</Label>
                                        <Textarea id="listingDescription" {...register("listingDescription")} placeholder="Zobacz ofertę {{make}} {{model}} z roku {{year}}..." />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </form>
            </div>
        </div>
    );
}
