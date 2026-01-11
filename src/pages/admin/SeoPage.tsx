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
import { AdminNav } from "@/components/admin/AdminNav";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useSeoConfig, type SeoConfig } from "@/components/seo/SeoManager";

export default function SeoPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("general");

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header - Consistent with AdminDashboard */}
            <header className="bg-white border-b shadow-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Zarządzanie SEO
                            </h1>
                            <p className="text-sm text-gray-600">
                                Konfiguracja meta tagów i integracji
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <AdminNav />
                            <Button onClick={handleLogout} variant="outline">
                                <LogOut className="w-4 h-4 mr-2" />
                                Logout
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-6">
                    <div className="flex items-center justify-end">
                        <Button onClick={handleSubmit(onSubmit)} disabled={mutation.isPending || isLoading}>
                            {mutation.isPending ? 'Zapisywanie...' : 'Zapisz Zmiany'}
                        </Button>
                    </div>

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
                                                <Button onClick={handleSubmit(onSubmit)} disabled={mutation.isPending || isLoading}>
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
                    )}
                </div>
            </main>
        </div>
    );
}
