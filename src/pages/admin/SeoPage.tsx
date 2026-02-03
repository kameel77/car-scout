import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Search, Tags, Globe, FileText, Code, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useSeoConfig, type SeoConfig } from "@/components/seo/SeoManager";
import { seoApi } from "@/services/api";

export default function SeoPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("general");


    // Use shared hook for consistent caching and instant load
    const { data: config, isLoading } = useSeoConfig();

    const { register, handleSubmit, reset, setValue } = useForm<SeoConfig>();

    useEffect(() => {
        if (config) {
            reset(config);
        }
    }, [config, reset]);

    const mutation = useMutation({
        mutationFn: async (data: SeoConfig) => {
            const token = localStorage.getItem('auth_token');
            if (!token) throw new Error('No auth token found');
            return seoApi.updateConfig(data, token);
        },
        onSuccess: () => {
            toast({ title: "Sukces", description: "Ustawienia SEO zostały zapisane." });
            queryClient.invalidateQueries({ queryKey: ['seo-config'] }); // Invalidate global config
        },
        onError: () => {
            toast({ variant: "destructive", title: "Błąd", description: "Nie udało się zapisać zmian." });
        }
    });

    const onSubmit = (data: SeoConfig) => {
        mutation.mutate(data);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Zarządzanie SEO
                </h1>
                <p className="text-gray-600">
                    Konfiguracja meta tagów i integracji.
                </p>
            </div>
            <div className="space-y-6">


                {isLoading ? (
                    <div className="p-12 flex justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                            <TabsList className="bg-white border">
                                <TabsTrigger value="general" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                                    <Code className="w-4 h-4" /> Ogólne / GTM
                                </TabsTrigger>
                                <TabsTrigger value="home" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                                    <Globe className="w-4 h-4" /> Strona Główna
                                </TabsTrigger>
                                <TabsTrigger value="listings" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                                    <Tags className="w-4 h-4" /> Szablony Ofert
                                </TabsTrigger>
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
                                        <div className="flex justify-end pt-4">
                                            <Button onClick={handleSubmit(onSubmit)} disabled={mutation.isPending || isLoading} className="bg-blue-600 hover:bg-blue-700">
                                                {mutation.isPending ? 'Zapisywanie...' : 'Zapisz Zmiany'}
                                            </Button>
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
                                        <Tabs defaultValue="pl" className="w-full">
                                            <TabsList className="grid w-full grid-cols-3">
                                                <TabsTrigger value="pl">Polski</TabsTrigger>
                                                <TabsTrigger value="en">English</TabsTrigger>
                                                <TabsTrigger value="de">Deutsch</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="pl" className="space-y-4 pt-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="homeTitle">Tytuł (Title - PL)</Label>
                                                    <Input id="homeTitle" {...register("homeTitle")} placeholder="Car Scout - Najlepsze samochody" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="homeDescription">Opis (Description - PL)</Label>
                                                    <Textarea id="homeDescription" {...register("homeDescription")} placeholder="Znajdź, sprawdź i zamów..." />
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="en" className="space-y-4 pt-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="homeTitleEn">Title (EN)</Label>
                                                    <Input id="homeTitleEn" {...register("homeTitleEn")} placeholder="Car Scout - Best Cars" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="homeDescriptionEn">Description (EN)</Label>
                                                    <Textarea id="homeDescriptionEn" {...register("homeDescriptionEn")} placeholder="Find, check and order..." />
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="de" className="space-y-4 pt-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="homeTitleDe">Titel (DE)</Label>
                                                    <Input id="homeTitleDe" {...register("homeTitleDe")} placeholder="Car Scout - Beste Autos" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="homeDescriptionDe">Beschreibung (DE)</Label>
                                                    <Textarea id="homeDescriptionDe" {...register("homeDescriptionDe")} placeholder="Suchen, prüfen und bestellen..." />
                                                </div>
                                            </TabsContent>
                                        </Tabs>

                                        <div className="space-y-2">
                                            <Label htmlFor="homeOgImage">Obrazek Udostępniania (OG Image URL)</Label>
                                            <Input id="homeOgImage" {...register("homeOgImage")} placeholder="https://..." />
                                        </div>
                                        <div className="flex justify-end pt-4">
                                            <Button type="submit" disabled={mutation.isPending || isLoading} className="bg-blue-600 hover:bg-blue-700">
                                                {mutation.isPending ? 'Zapisywanie...' : 'Zapisz Zmiany'}
                                            </Button>
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
                                        <div className="p-4 bg-blue-50 text-blue-800 rounded-md text-sm mb-4 border border-blue-100">
                                            <p className="font-semibold mb-2">Dostępne zmienne:</p>
                                            <div className="flex gap-2 flex-wrap">
                                                <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs">{"{{make}}"}</code>
                                                <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs">{"{{model}}"}</code>
                                                <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs">{"{{year}}"}</code>
                                                <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs">{"{{price}}"}</code>
                                                <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs">{"{{fuel}}"}</code>
                                            </div>
                                        </div>

                                        <Tabs defaultValue="pl" className="w-full">
                                            <TabsList className="grid w-full grid-cols-3">
                                                <TabsTrigger value="pl">Polski</TabsTrigger>
                                                <TabsTrigger value="en">English</TabsTrigger>
                                                <TabsTrigger value="de">Deutsch</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="pl" className="space-y-4 pt-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="listingTitle">Szablon Tytułu (PL)</Label>
                                                    <Input id="listingTitle" {...register("listingTitle")} placeholder="{{make}} {{model}} {{year}} - Sprawdź cenę!" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="listingDescription">Szablon Opisu (PL)</Label>
                                                    <Textarea id="listingDescription" {...register("listingDescription")} placeholder="Zobacz ofertę {{make}} {{model}} z roku {{year}}..." />
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="en" className="space-y-4 pt-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="listingTitleEn">Title Template (EN)</Label>
                                                    <Input id="listingTitleEn" {...register("listingTitleEn")} placeholder="{{make}} {{model}} {{year}} - Check price!" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="listingDescriptionEn">Description Template (EN)</Label>
                                                    <Textarea id="listingDescriptionEn" {...register("listingDescriptionEn")} placeholder="See offer for {{make}} {{model}} from {{year}}..." />
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="de" className="space-y-4 pt-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="listingTitleDe">Titel-Vorlage (DE)</Label>
                                                    <Input id="listingTitleDe" {...register("listingTitleDe")} placeholder="{{make}} {{model}} {{year}} - Preis prüfen!" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="listingDescriptionDe">Beschreibung-Vorlage (DE)</Label>
                                                    <Textarea id="listingDescriptionDe" {...register("listingDescriptionDe")} placeholder="Siehe Angebot für {{make}} {{model}} aus {{year}}..." />
                                                </div>
                                            </TabsContent>
                                        </Tabs>

                                        <div className="flex justify-end pt-4">
                                            <Button type="submit" disabled={mutation.isPending || isLoading} className="bg-blue-600 hover:bg-blue-700">
                                                {mutation.isPending ? 'Zapisywanie...' : 'Zapisz Zmiany'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </form>
                )}
            </div>
        </div>
    );
}
