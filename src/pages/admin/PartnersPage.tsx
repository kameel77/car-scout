import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, ExternalLink, Code2, Rocket } from 'lucide-react';
import { ADS_CONFIG } from '@/config/ads';
import { Button } from '@/components/ui/button';

export default function AdminPartnersPage() {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Partnerzy i Reklamy</h1>
                    <p className="text-muted-foreground">Zarządzanie ofertami partnerskimi i banerami w serwisie.</p>
                </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 font-semibold">Etap 2: Centralna Konfiguracja</AlertTitle>
                <AlertDescription className="text-blue-700">
                    Obecnie reklamy są zarządzane poprzez centralny plik konfiguracji. Aby zmienić treści, linki lub obrazki, edytuj plik:
                    <code className="mx-2 px-1 py-0.5 bg-blue-100 rounded text-blue-900 border border-blue-200 font-mono">src/config/ads.ts</code>
                </AlertDescription>
            </Alert>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Search Top Banner */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Baner Główny (Search Top)</CardTitle>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">Aktywny</span>
                        </div>
                        <CardDescription>Wyświetlany nad wynikami wyszukiwania.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="aspect-[3/1] rounded-lg overflow-hidden border">
                            <img src={ADS_CONFIG.searchTopBanner.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold">{ADS_CONFIG.searchTopBanner.title}</p>
                            <p className="text-xs text-muted-foreground">{ADS_CONFIG.searchTopBanner.subtitle}</p>
                        </div>
                        <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                            <a href={ADS_CONFIG.searchTopBanner.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" /> Sprawdź link
                            </a>
                        </Button>
                    </CardContent>
                </Card>

                {/* Search Grid Ads */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Reklamy In-Feed (Grid)</CardTitle>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">Aktywne</span>
                        </div>
                        <CardDescription>Wstrzykiwane co 6-ty element na liście.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {ADS_CONFIG.searchGridAds.map(ad => (
                            <div key={ad.id} className="flex gap-4 p-3 border rounded-lg">
                                <img src={ad.imageUrl} className="w-20 h-20 rounded object-cover shrink-0" alt="" />
                                <div className="min-w-0">
                                    <p className="text-sm font-bold truncate">{ad.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{ad.description}</p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Detail Sidebar Ads */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Reklamy na stronie szczegółów (Sidebar/Mobile)</CardTitle>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">Aktywne</span>
                        </div>
                        <CardDescription>Wyświetlane pod kalkulatorem finansowym.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {ADS_CONFIG.detailSidebarAds.map(ad => (
                            <div key={ad.id} className="space-y-3 p-4 border rounded-xl bg-muted/20">
                                <p className="text-xs font-bold text-accent uppercase tracking-wider">{ad.brandName}</p>
                                <h4 className="font-bold">{ad.title}</h4>
                                <p className="text-sm text-muted-foreground">{ad.description}</p>
                                {ad.features && (
                                    <ul className="text-xs space-y-1">
                                        {ad.features.map((f, i) => <li key={i} className="flex items-center gap-2">• {f}</li>)}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Roadmap to Stage 3 */}
                <Card className="md:col-span-2 border-dashed bg-muted/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Rocket className="h-5 w-5 text-purple-600" />
                            Nadchodzi: Etap 3
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Wkrótce tutaj pojawi się pełny edytor wizualny, który pozwoli Ci na zmianę treści reklam bezpośrednio z tego miejsca, bez konieczności edytowania plików kodu. Będziesz mógł również wgrywać własne grafiki i mierzyć klikalność każdej oferty.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
