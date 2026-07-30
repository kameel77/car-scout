import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { landingPagesApi, listingsApi } from '@/services/api';
import { rentalPublicApi } from '@/services/rental-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import {
    Plus, Search, Edit2, Trash2, Copy, QrCode, Eye, Check, RefreshCw, Upload, Sparkles, Filter, ListCheck, FileText, LayoutGrid, ShieldAlert
} from 'lucide-react';

interface LandingPageAdmin {
    id: string;
    slug: string;
    name: string;
    audience?: string | null;
    isActive: boolean;
    isIndexable: boolean;
    validFrom?: string | null;
    validTo?: string | null;
    heroTitle: string;
    heroSubtitle?: string | null;
    heroBadge?: string | null;
    heroImageUrl?: string | null;
    ctaLabel: string;
    theme?: 'dark' | 'light';
    heroPosition?: 'before' | 'after';
    contactPhone?: string | null;
    discount?: number | null;
    initialPayment?: number | null;
    selectionMode: 'MANUAL' | 'FILTERED';
    listingIds: string[];
    rentalVehicleIds: string[];
    filterParams?: any;
    maxListings: number;
    sections?: any;
    metaTitle?: string | null;
    metaDescription?: string | null;
    termsFileUrl?: string | null;
    termsLabel?: string | null;
    createdAt: string;
    updatedAt: string;
    leadsTotal?: number;
    leads30d?: number;
}

const DEFAULT_FORM: Partial<LandingPageAdmin> = {
    slug: '',
    name: '',
    audience: '',
    isActive: true,
    isIndexable: false,
    validFrom: '',
    validTo: '',
    heroTitle: '',
    heroSubtitle: '',
    heroBadge: '',
    ctaLabel: 'Oddzwońcie do mnie',
    theme: 'dark',
    heroPosition: 'before',
    contactPhone: '',
    discount: undefined,
    initialPayment: undefined,
    selectionMode: 'FILTERED',
    listingIds: [],
    rentalVehicleIds: [],
    filterParams: { brand: [], bodyType: [], minYear: undefined, minPrice: undefined, maxPrice: undefined, condition: '' },
    maxListings: 12,
    sections: {
        callback: { enabled: true, title: 'Chcesz omówić ofertę?', description: 'Zostaw numer – doradca oddzwoni i w kilka minut przedstawi szczegóły.' },
        listings: { enabled: true, title: 'Dostępne samochody w ofercie', ctaEnabled: true, ctaLabel: 'Sprawdź całą ofertę', ctaUrl: '/samochody' },
        trustBar: { enabled: true, items: ['Zaufani dealerzy w całej Polsce', 'Leasing, kredyt i wynajem', 'Przejrzyste warunki', 'Wsparcie konsultanta'] },
        howItWorks: { enabled: true, steps: [
            { title: 'Wybierz auto lub ratę', text: 'Przejrzyj naszą flotę lub opowiedz doradcy czego szukasz.' },
            { title: 'Wypełnij prosty wniosek', text: 'Bez zbędnych dokumentów – decyzję otrzymasz w 24 godziny.' },
            { title: 'Odbierz kluczyki', text: 'Auto dostarczymy prosto pod wskazany adres lub wybierz odbiór własny.' }
        ]},
        faq: { enabled: true, items: [
            { q: 'Na czym polega promocja?', a: 'Podpisz do 30 sierpnia 2026 r. umowę najmu długoterminowego samochodu z jednym z partnerów Motolii, a otrzymasz kartę paliwową o wartości 500 zł.' },
            { q: 'Kto może skorzystać z promocji?', a: 'Promocja jest przeznaczona zarówno dla konsumentów, jak i przedsiębiorców, którzy zawrą umowę najmu długoterminowego za pośrednictwem Motolii i spełnią warunki określone w regulaminie.' },
            { q: 'Jakie samochody są objęte promocją?', a: 'Promocja dotyczy samochodów dostępnych w ofercie najmu długoterminowego prezentowanej przez Motolię. Doradca pomoże Ci wybrać auto oraz dopasować warunki umowy do Twoich potrzeb.' },
            { q: 'Co muszę zrobić, aby otrzymać kartę paliwową?', a: 'Wybierz samochód, skontaktuj się z Motolią i podpisz do 30 sierpnia 2026 r. umowę najmu długoterminowego z partnerem Motolii. Po spełnieniu warunków promocji otrzymasz kartę paliwową od jej operatora.' },
            { q: 'Gdzie można wykorzystać kartę paliwową?', a: 'Kartą będzie można płacić za paliwo na stacjach obsługiwanych przez jej operatora, między innymi w sieciach Shell, BP i Circle K. Pełna lista stacji będzie dostępna w warunkach korzystania z karty.' },
            { q: 'Jak długo karta paliwowa będzie ważna?', a: 'Kartą będzie można wykorzystać w ciągu 12 miesięcy od momentu jej aktywacji. Niewykorzystane środki wygasną po upływie terminu ważności karty.' }
        ]},
        urgency: { enabled: false, text: 'Promocja ograniczona czasowo!' }
    },
    metaTitle: '',
    metaDescription: '',
    termsLabel: '',
};

export default function LandingPagesPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingPage, setEditingPage] = useState<Partial<LandingPageAdmin> | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [heroFile, setHeroFile] = useState<File | null>(null);
    const [termsFile, setTermsFile] = useState<File | null>(null);
    const [previewListings, setPreviewListings] = useState<any[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [manualListingIdInput, setManualListingIdInput] = useState('');
    const [carSearchQuery, setCarSearchQuery] = useState('');
    const [carSearchResults, setCarSearchResults] = useState<any[]>([]);
    const [carSearchLoading, setCarSearchLoading] = useState(false);
    const [carSearchSource, setCarSearchSource] = useState<'NEW' | 'USED' | 'RENTAL'>('NEW');
    const [hasSearchedCars, setHasSearchedCars] = useState(false);

    const { data, isLoading, refetch } = useQuery<{ landingPages: LandingPageAdmin[] }>({
        queryKey: ['admin-landing-pages'],
        queryFn: () => landingPagesApi.list(),
    });

    const createMutation = useMutation({
        mutationFn: async (formData: any) => {
            const res = await landingPagesApi.create(formData);
            if (heroFile && res.landingPage?.id) {
                await landingPagesApi.uploadHeroImage(res.landingPage.id, heroFile);
            }
            if (termsFile && res.landingPage?.id) {
                await landingPagesApi.uploadTermsFile(res.landingPage.id, termsFile);
            }
            return res;
        },
        onSuccess: () => {
            toast.success('Landing page został utworzony');
            queryClient.invalidateQueries({ queryKey: ['admin-landing-pages'] });
            closeModal();
        },
        onError: (err: any) => {
            toast.error(err.message || 'Błąd tworzenia landing page');
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
            const res = await landingPagesApi.update(id, formData);
            if (heroFile) {
                await landingPagesApi.uploadHeroImage(id, heroFile);
            }
            if (termsFile) {
                await landingPagesApi.uploadTermsFile(id, termsFile);
            }
            return res;
        },
        onSuccess: () => {
            toast.success('Zapisano zmiany');
            queryClient.invalidateQueries({ queryKey: ['admin-landing-pages'] });
            closeModal();
        },
        onError: (err: any) => {
            toast.error(err.message || 'Błąd zapisu');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => landingPagesApi.delete(id),
        onSuccess: () => {
            toast.success('Landing page został usunięty');
            queryClient.invalidateQueries({ queryKey: ['admin-landing-pages'] });
        },
        onError: (err: any) => {
            toast.error(err.message || 'Błąd usuwania');
        },
    });

    const deleteHeroMutation = useMutation({
        mutationFn: (id: string) => landingPagesApi.deleteHeroImage(id),
        onSuccess: () => {
            toast.success('Zdjęcie hero zostało usunięte');
            setEditingPage((prev) => (prev ? { ...prev, heroImageUrl: null } : prev));
            setHeroFile(null);
            queryClient.invalidateQueries({ queryKey: ['admin-landing-pages'] });
        },
        onError: (err: any) => {
            toast.error(err.message || 'Błąd usuwania zdjęcia');
        },
    });

    const deleteTermsMutation = useMutation({
        mutationFn: (id: string) => landingPagesApi.deleteTermsFile(id),
        onSuccess: () => {
            toast.success('Regulamin został usunięty');
            setEditingPage((prev) => (prev ? { ...prev, termsFileUrl: null } : prev));
            setTermsFile(null);
            queryClient.invalidateQueries({ queryKey: ['admin-landing-pages'] });
        },
        onError: (err: any) => {
            toast.error(err.message || 'Błąd usuwania regulaminu');
        },
    });

    const pages = data?.landingPages || [];

    const filteredPages = pages.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.heroTitle && p.heroTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.audience && p.audience.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const openCreateModal = () => {
        setEditingPage({ ...DEFAULT_FORM, slug: `promo-${Date.now().toString().slice(-4)}` });
        setHeroFile(null);
        setTermsFile(null);
        setPreviewListings([]);
        setIsModalOpen(true);
    };

    const openEditModal = (page: LandingPageAdmin) => {
        setEditingPage({
            ...page,
            validFrom: page.validFrom ? page.validFrom.slice(0, 16) : '',
            validTo: page.validTo ? page.validTo.slice(0, 16) : '',
        });
        setHeroFile(null);
        setTermsFile(null);
        setIsModalOpen(true);
        if (page.id) {
            loadPreview(page.id);
        }
    };

    const duplicatePage = (page: LandingPageAdmin) => {
        setEditingPage({
            ...page,
            id: undefined,
            name: `${page.name} (Kopia)`,
            slug: `${page.slug}-kopia`,
        });
        setHeroFile(null);
        setTermsFile(null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingPage(null);
        setHeroFile(null);
        setTermsFile(null);
        setPreviewListings([]);
    };

    const handleSave = () => {
        if (!editingPage) return;
        if (!editingPage.name?.trim()) return toast.error('Nazwa jest wymagana');
        if (!editingPage.slug?.trim()) return toast.error('Slug jest wymagany');
        if (!editingPage.heroTitle?.trim()) return toast.error('Tytuł hero jest wymagany');

        const payload = {
            ...editingPage,
            discount: editingPage.discount ? Number(editingPage.discount) : null,
            initialPayment: editingPage.initialPayment ? Number(editingPage.initialPayment) : null,
            maxListings: editingPage.maxListings ? Number(editingPage.maxListings) : 12,
        };

        if (editingPage.id) {
            updateMutation.mutate({ id: editingPage.id, formData: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const copyUrl = (slug: string) => {
        const url = `${window.location.origin}/promo/${slug}`;
        navigator.clipboard.writeText(url);
        toast.success('Skopiowano URL do schowka');
    };

    const downloadQr = async (slug: string) => {
        const url = `${window.location.origin}/promo/${slug}?src=qr`;
        try {
            const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2 });
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `qr-${slug}.png`;
            a.click();
            toast.success('Pobrano kod QR (1024px PNG)');
        } catch {
            toast.error('Błąd generowania kodu QR');
        }
    };

    const loadPreview = async (id: string) => {
        setPreviewLoading(true);
        try {
            const res = await landingPagesApi.getPreviewListings(id);
            setPreviewListings([...(res.listings || []), ...(res.rentalVehicles || [])]);
        } catch {
            // ignore preview error
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleSearchCars = async () => {
        if (!carSearchQuery.trim()) return;
        setCarSearchLoading(true);
        setHasSearchedCars(true);
        try {
            if (carSearchSource === 'RENTAL') {
                const res = await rentalPublicApi.listVehicles({ search: carSearchQuery.trim(), limit: '24' });
                setCarSearchResults(res.vehicles || []);
            } else {
                // getListings mapuje `query` -> ?q i `statuses` -> ?status; `search`/`condition` są ignorowane.
                const res = await listingsApi.getListings({
                    query: carSearchQuery.trim(),
                    statuses: [carSearchSource.toLowerCase()],
                    perPage: 24,
                });
                setCarSearchResults(res.listings || []);
            }
        } catch {
            toast.error('Błąd wyszukiwania pojazdów');
        } finally {
            setCarSearchLoading(false);
        }
    };

    /** Wynajem trafia do osobnej listy — to inna encja niż ogłoszenia sprzedażowe. */
    const isRentalSearch = carSearchSource === 'RENTAL';
    const selectedVehicleIds = isRentalSearch
        ? (editingPage?.rentalVehicleIds || [])
        : (editingPage?.listingIds || []);

    const addVehicleId = (id: string) => {
        if (!editingPage || !id) return;
        const key = isRentalSearch ? 'rentalVehicleIds' : 'listingIds';
        const current = (editingPage[key] as string[]) || [];
        if (current.includes(id)) return;
        setEditingPage({ ...editingPage, [key]: [...current, id] });
    };

    const getStatusBadge = (page: LandingPageAdmin) => {
        const now = new Date();
        if (!page.isActive) {
            return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Nieaktywna</span>;
        }
        if (page.validTo && new Date(page.validTo) < now) {
            return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Wygasła</span>;
        }
        if (page.validFrom && new Date(page.validFrom) > now) {
            return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Zaplanowana</span>;
        }
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Aktywna</span>;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Landing Page'y</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Zarządzanie stronami docelowymi dla kampanii Meta/Google Ads, kodów QR i mailingów.
                    </p>
                </div>
                <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                    <Plus className="w-4 h-4 mr-2" />
                    Nowa Landing Page
                </Button>
            </div>

            {/* Search Bar */}
            <Card className="border-gray-200">
                <CardContent className="p-4 flex items-center gap-3">
                    <Search className="w-5 h-5 text-gray-400 shrink-0" />
                    <Input
                        placeholder="Szukaj po nazwie, lagu lub segmencie..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="border-0 focus-visible:ring-0 shadow-none text-sm"
                    />
                </CardContent>
            </Card>

            {/* List Table */}
            <Card className="border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-3.5">Nazwa & Segment</th>
                                <th className="px-6 py-3.5">URL / Slug</th>
                                <th className="px-6 py-3.5">Status</th>
                                <th className="px-6 py-3.5">Leady (30d / Total)</th>
                                <th className="px-6 py-3.5 text-right">Akcje</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                        Ładowanie listy stron...
                                    </td>
                                </tr>
                            ) : filteredPages.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                        Brak landing page'y spełniających kryteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredPages.map((page) => (
                                    <tr key={page.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900">{page.name}</div>
                                            {page.audience && (
                                                <div className="text-xs text-gray-400 mt-0.5">{page.audience}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-xs bg-gray-100 text-blue-600 px-2 py-1 rounded font-mono">
                                                /promo/{page.slug}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">{getStatusBadge(page)}</td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-gray-900">{page.leads30d ?? 0}</span>
                                            <span className="text-xs text-gray-400"> / {page.leadsTotal ?? 0}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => window.open(`/promo/${page.slug}`, '_blank')}
                                                    title="Podgląd strony"
                                                >
                                                    <Eye className="w-4 h-4 text-gray-500" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => copyUrl(page.slug)}
                                                    title="Kopiuj URL"
                                                >
                                                    <Copy className="w-4 h-4 text-gray-500" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => downloadQr(page.slug)}
                                                    title="Pobierz kod QR"
                                                >
                                                    <QrCode className="w-4 h-4 text-gray-500" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => openEditModal(page)}
                                                    title="Edytuj"
                                                >
                                                    <Edit2 className="w-4 h-4 text-blue-600" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => duplicatePage(page)}
                                                    title="Duplikuj"
                                                >
                                                    <Sparkles className="w-4 h-4 text-purple-600" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        if (confirm(`Czy na pewno usunąć landing page "${page.name}"?`)) {
                                                            deleteMutation.mutate(page.id);
                                                        }
                                                    }}
                                                    title="Usuń"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modal Editor */}
            {isModalOpen && editingPage && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {editingPage.id ? 'Edytuj Landing Page' : 'Nowa Landing Page'}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    Podgląd URL: <code className="text-blue-600 font-mono">/promo/{editingPage.slug || '...'}</code>
                                </p>
                            </div>
                            <Button variant="ghost" onClick={closeModal} className="h-8 w-8 p-0 rounded-full">✕</Button>
                        </div>

                        {/* Modal Body - Tabs */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <Tabs defaultValue="basics" className="space-y-6">
                                <TabsList className="grid grid-cols-6 bg-gray-100 p-1 rounded-xl">
                                    <TabsTrigger value="basics" className="text-xs">Podstawy</TabsTrigger>
                                    <TabsTrigger value="hero" className="text-xs">Hero & CTA</TabsTrigger>
                                    <TabsTrigger value="offer" className="text-xs">Oferta</TabsTrigger>
                                    <TabsTrigger value="cars" className="text-xs">Auta</TabsTrigger>
                                    <TabsTrigger value="sections" className="text-xs">Sekcje</TabsTrigger>
                                    <TabsTrigger value="seo" className="text-xs">SEO</TabsTrigger>
                                </TabsList>

                                {/* TAB 1: PODSTAWY */}
                                <TabsContent value="basics" className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Nazwa robocza w panelu *</Label>
                                            <Input
                                                value={editingPage.name || ''}
                                                onChange={(e) => setEditingPage({ ...editingPage, name: e.target.value })}
                                                placeholder="np. B2B Leasing 1% - Wakacje 2026"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Slug (URL) *</Label>
                                            <Input
                                                value={editingPage.slug || ''}
                                                onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                                                placeholder="np. b2b-leasing-1"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Etykieta segmentu</Label>
                                            <Input
                                                value={editingPage.audience || ''}
                                                onChange={(e) => setEditingPage({ ...editingPage, audience: e.target.value })}
                                                placeholder="np. Firmy B2B / Młody Kierowca"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50 mt-6">
                                            <div>
                                                <Label className="text-xs font-semibold text-gray-900">Strona aktywna</Label>
                                                <p className="text-[11px] text-gray-500">Wyłączenie zwraca status 404</p>
                                            </div>
                                            <Switch
                                                checked={Boolean(editingPage.isActive)}
                                                onCheckedChange={(val) => setEditingPage({ ...editingPage, isActive: val })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Data rozpoczęcia (validFrom)</Label>
                                            <Input
                                                type="datetime-local"
                                                value={editingPage.validFrom || ''}
                                                onChange={(e) => setEditingPage({ ...editingPage, validFrom: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Data zakończenia (validTo)</Label>
                                            <Input
                                                type="datetime-local"
                                                value={editingPage.validTo || ''}
                                                onChange={(e) => setEditingPage({ ...editingPage, validTo: e.target.value })}
                                            />
                                            <p className="text-[11px] text-gray-500">Po wygaśnięciu strona zwraca status 410 i przekierowuje na /samochody</p>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* TAB 2: HERO & CTA */}
                                <TabsContent value="hero" className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-700">Pill Badge Hero</Label>
                                        <Input
                                            value={editingPage.heroBadge || ''}
                                            onChange={(e) => setEditingPage({ ...editingPage, heroBadge: e.target.value })}
                                            placeholder="np. SUPER OFERTA DLA FIRM"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-700">Tytuł Hero (H1) *</Label>
                                        <Input
                                            value={editingPage.heroTitle || ''}
                                            onChange={(e) => setEditingPage({ ...editingPage, heroTitle: e.target.value })}
                                            placeholder="np. Nowe auto w leasingu od 999 zł/miesiąc"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-700">Podtytuł Hero</Label>
                                        <textarea
                                            rows={2}
                                            value={editingPage.heroSubtitle || ''}
                                            onChange={(e) => setEditingPage({ ...editingPage, heroSubtitle: e.target.value })}
                                            placeholder="Opisz krótko główne zalety oferty..."
                                            className="w-full p-2.5 text-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Etykieta przycisku CTA</Label>
                                            <Input
                                                value={editingPage.ctaLabel || ''}
                                                onChange={(e) => setEditingPage({ ...editingPage, ctaLabel: e.target.value })}
                                                placeholder="Oddzwońcie do mnie"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Obraz Hero</Label>
                                            <div className="flex items-center gap-3">
                                                <Input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    onChange={(e) => setHeroFile(e.target.files?.[0] || null)}
                                                    className="text-xs"
                                                />
                                            </div>
                                            {editingPage.heroImageUrl && (
                                                <div className="flex items-center gap-3 pt-1">
                                                    <p className="text-[11px] text-gray-500 truncate">Obecny obraz: {editingPage.heroImageUrl}</p>
                                                    {editingPage.id && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-red-600 border-red-200 hover:bg-red-50 text-[11px] h-6 px-2 shrink-0"
                                                            onClick={() => {
                                                                if (window.confirm('Czy na pewno chcesz usunąć zdjęcie hero?')) {
                                                                    deleteHeroMutation.mutate(editingPage.id!);
                                                                }
                                                            }}
                                                            disabled={deleteHeroMutation.isPending}
                                                        >
                                                            {deleteHeroMutation.isPending ? 'Usuwanie...' : 'Usuń zdjęcie'}
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-700">Numer telefonu na landingu</Label>
                                        <Input
                                            value={editingPage.contactPhone || ''}
                                            onChange={(e) => setEditingPage({ ...editingPage, contactPhone: e.target.value })}
                                            placeholder="+48 22 112 09 50"
                                        />
                                        <p className="text-[11px] text-gray-500">
                                            Puste pole = numer z ustawień serwisu. Osobny numer ułatwia rozliczenie kampanii.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Motyw kolorystyczny</Label>
                                            <div className="flex gap-2">
                                                {(['dark', 'light'] as const).map((mode) => (
                                                    <button
                                                        key={mode}
                                                        type="button"
                                                        onClick={() => setEditingPage({ ...editingPage, theme: mode })}
                                                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                                                            (editingPage.theme || 'dark') === mode
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {mode === 'dark' ? 'Ciemny' : 'Jasny'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Blok hero z telefonem</Label>
                                            <div className="flex gap-2">
                                                {([
                                                    { value: 'before', label: 'Przed ofertami' },
                                                    { value: 'after', label: 'Po ofertach' },
                                                ] as const).map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setEditingPage({ ...editingPage, heroPosition: option.value })}
                                                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                                                            (editingPage.heroPosition || 'before') === option.value
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* TAB 3: OFERTA */}
                                <TabsContent value="offer" className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Rabat kwotowy (PLN)</Label>
                                            <Input
                                                type="number"
                                                value={editingPage.discount ?? ''}
                                                onChange={(e) => setEditingPage({ ...editingPage, discount: e.target.value ? Number(e.target.value) : undefined })}
                                                placeholder="np. 5000"
                                            />
                                            <p className="text-[11px] text-gray-500">Wstrzykiwany automatycznie do kalkulatora rat na stronie LP.</p>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Wpłata własna (PLN)</Label>
                                            <Input
                                                type="number"
                                                value={editingPage.initialPayment ?? ''}
                                                onChange={(e) => setEditingPage({ ...editingPage, initialPayment: e.target.value ? Number(e.target.value) : undefined })}
                                                placeholder="np. 10000"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t space-y-3">
                                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Regulamin promocji (PDF)</h3>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Etykieta linku regulaminu</Label>
                                            <Input
                                                value={editingPage.termsLabel || ''}
                                                onChange={(e) => setEditingPage({ ...editingPage, termsLabel: e.target.value })}
                                                placeholder="Regulamin promocji (PDF)"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-700">Plik regulaminu (PDF, max 8MB)</Label>
                                            <Input
                                                type="file"
                                                accept="application/pdf"
                                                onChange={(e) => setTermsFile(e.target.files?.[0] || null)}
                                                className="text-xs"
                                            />
                                            {editingPage.termsFileUrl && (
                                                <div className="flex items-center gap-3 pt-1">
                                                    <a
                                                        href={editingPage.termsFileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-600 underline truncate max-w-xs"
                                                    >
                                                        Podgląd obecnego PDF ({editingPage.termsFileUrl})
                                                    </a>
                                                    {editingPage.id && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-red-600 border-red-200 hover:bg-red-50 text-[11px] h-6 px-2 shrink-0"
                                                            onClick={() => {
                                                                if (window.confirm('Czy na pewno chcesz usunąć regulamin PDF?')) {
                                                                    deleteTermsMutation.mutate(editingPage.id!);
                                                                }
                                                            }}
                                                            disabled={deleteTermsMutation.isPending}
                                                        >
                                                            {deleteTermsMutation.isPending ? 'Usuwanie...' : 'Usuń regulamin'}
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* TAB 4: AUTA */}
                                <TabsContent value="cars" className="space-y-6">
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                                        <div>
                                            <Label className="text-xs font-semibold text-gray-900">Tryb doboru aut</Label>
                                            <p className="text-[11px] text-gray-500">FILTERED (automatyczny filtr) jest domyślny dla stron evergreen</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs ${editingPage.selectionMode === 'FILTERED' ? 'font-bold text-blue-600' : 'text-gray-500'}`}>FILTERED</span>
                                            <Switch
                                                checked={editingPage.selectionMode === 'MANUAL'}
                                                onCheckedChange={(val) => setEditingPage({ ...editingPage, selectionMode: val ? 'MANUAL' : 'FILTERED' })}
                                            />
                                            <span className={`text-xs ${editingPage.selectionMode === 'MANUAL' ? 'font-bold text-purple-600' : 'text-gray-500'}`}>MANUAL</span>
                                        </div>
                                    </div>

                                    {editingPage.selectionMode === 'FILTERED' ? (
                                        <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-200">
                                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <Filter className="w-3.5 h-3.5 text-blue-600" />
                                                Parametry filtru samochodów
                                            </h3>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div>
                                                    <Label className="text-xs">Marka (rozdziel przecinkami)</Label>
                                                    <Input
                                                        value={Array.isArray(editingPage.filterParams?.brand) ? editingPage.filterParams.brand.join(', ') : (editingPage.filterParams?.brand || '')}
                                                        onChange={(e) => setEditingPage({
                                                            ...editingPage,
                                                            filterParams: { ...editingPage.filterParams, brand: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                                                        })}
                                                        placeholder="np. BMW, Audi"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Nadwozie (rozdziel przecinkami)</Label>
                                                    <Input
                                                        value={Array.isArray(editingPage.filterParams?.bodyType) ? editingPage.filterParams.bodyType.join(', ') : (editingPage.filterParams?.bodyType || '')}
                                                        onChange={(e) => setEditingPage({
                                                            ...editingPage,
                                                            filterParams: { ...editingPage.filterParams, bodyType: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                                                        })}
                                                        placeholder="np. SUV, sedan"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Limit aut</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingPage.maxListings || 12}
                                                        onChange={(e) => setEditingPage({ ...editingPage, maxListings: Number(e.target.value) })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div>
                                                    <Label className="text-xs">Cena min (PLN)</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingPage.filterParams?.minPrice || ''}
                                                        onChange={(e) => setEditingPage({
                                                            ...editingPage,
                                                            filterParams: { ...editingPage.filterParams, minPrice: e.target.value ? Number(e.target.value) : undefined }
                                                        })}
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Cena max (PLN)</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingPage.filterParams?.maxPrice || ''}
                                                        onChange={(e) => setEditingPage({
                                                            ...editingPage,
                                                            filterParams: { ...editingPage.filterParams, maxPrice: e.target.value ? Number(e.target.value) : undefined }
                                                        })}
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Rocznik min</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingPage.filterParams?.minYear || ''}
                                                        onChange={(e) => setEditingPage({
                                                            ...editingPage,
                                                            filterParams: { ...editingPage.filterParams, minYear: e.target.value ? Number(e.target.value) : undefined }
                                                        })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-200">
                                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <ListCheck className="w-3.5 h-3.5 text-purple-600" />
                                                Wybór samochodów (MANUAL)
                                            </h3>

                                            {/* Visual Car Search Picker */}
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-gray-700">Wyszukaj pojazd w bazie</Label>
                                                <div className="flex gap-2">
                                                    {([
                                                        { value: 'NEW', label: 'Nowe' },
                                                        { value: 'USED', label: 'Używane' },
                                                        { value: 'RENTAL', label: 'Wynajem długoterminowy' },
                                                    ] as const).map((option) => (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            onClick={() => {
                                                                setCarSearchSource(option.value);
                                                                setCarSearchResults([]);
                                                                setHasSearchedCars(false);
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                                                carSearchSource === option.value
                                                                    ? 'bg-purple-600 text-white border-purple-600'
                                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={carSearchQuery}
                                                        onChange={(e) => setCarSearchQuery(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchCars(); } }}
                                                        placeholder="np. BMW X5, Audi A4, Mercedes..."
                                                        className="text-xs"
                                                    />
                                                    <Button
                                                        type="button"
                                                        onClick={handleSearchCars}
                                                        disabled={carSearchLoading}
                                                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs shrink-0"
                                                    >
                                                        {carSearchLoading ? 'Szukanie...' : 'Szukaj'}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Search Results List */}
                                            {carSearchResults.length > 0 && (
                                                <div className="space-y-2 border-t pt-3">
                                                    <p className="text-[11px] font-bold text-gray-500 uppercase">Wyniki wyszukiwania ({carSearchResults.length}):</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                                                        {carSearchResults.map((car: any) => {
                                                            const carId = car.id || car.listing_id;
                                                            const isSelected = selectedVehicleIds.includes(carId);
                                                            const mainImage = car.main_image_url || car.image_url || car.images?.[0] || car.primaryImageUrl;
                                                            return (
                                                                <div key={carId} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 text-xs gap-2">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        {mainImage ? (
                                                                            <img src={mainImage} alt="" className="w-10 h-7 object-cover rounded shrink-0 bg-gray-100" />
                                                                        ) : (
                                                                            <div className="w-10 h-7 bg-gray-100 rounded flex items-center justify-center text-[10px] text-gray-400 shrink-0">Brak</div>
                                                                        )}
                                                                        <div className="min-w-0">
                                                                            <p className="font-semibold text-gray-900 truncate">{car.brand || car.make} {car.model}</p>
                                                                            <p className="text-[10px] text-gray-500">
                                                                                {isRentalSearch
                                                                                    ? `${car.minMonthlyRateGross ? `${car.minMonthlyRateGross} PLN/mies.` : 'brak raty'} • ${car.productionYear || ''}`
                                                                                    : `${car.price || car.pricePln || '—'} PLN • ${car.year || car.productionYear || ''}`}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant={isSelected ? "outline" : "default"}
                                                                        className={isSelected ? "text-gray-400 border-gray-200 text-[11px] h-7" : "bg-purple-600 hover:bg-purple-700 text-white text-[11px] h-7"}
                                                                        disabled={isSelected}
                                                                        onClick={() => addVehicleId(carId)}
                                                                    >
                                                                        {isSelected ? 'Dodano' : '+ Dodaj'}
                                                                    </Button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Empty search results explanation */}
                                            {carSearchResults.length === 0 && hasSearchedCars && !carSearchLoading && (
                                                <div className="border-t pt-3">
                                                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
                                                        {carSearchSource === 'RENTAL' && (
                                                            <span>Brak pojazdów w wynikach. Wyszukiwarka wynajmu wymaga, aby pojazd posiadał aktywne przypisanie oraz wprowadzoną macierz rat (matrix entries). Pojazdy bez macierzy rat nie mogą trafić na landing page.</span>
                                                        )}
                                                        {carSearchSource === 'NEW' && (
                                                            <span>Brak wyników wśród ogłoszeń o statusie <strong>NOWE</strong>. Sprawdź frazę lub poszukaj w zakładce „Używane”.</span>
                                                        )}
                                                        {carSearchSource === 'USED' && (
                                                            <span>Brak wyników dla podanej frazy wyszukiwania.</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Manual ID Input Fallback */}
                                            <div className="pt-2 border-t">
                                                <Label className="text-[11px] text-gray-500">Lub wklej ID bezpośrednio (opcjonalnie):</Label>
                                                <div className="flex gap-2 mt-1">
                                                    <Input
                                                        value={manualListingIdInput}
                                                        onChange={(e) => setManualListingIdInput(e.target.value)}
                                                        placeholder="Wklej ID samochodu..."
                                                        className="text-xs"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            addVehicleId(manualListingIdInput.trim());
                                                            setManualListingIdInput('');
                                                        }}
                                                        className="text-xs shrink-0"
                                                    >
                                                        Dodaj ID
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Selected Listing IDs */}
                                            <div className="space-y-1 pt-2">
                                                <p className="text-[11px] font-bold text-gray-700 uppercase">Wybrane auta ({ (editingPage.listingIds || []).length }):</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(editingPage.listingIds || []).map((id) => (
                                                        <span key={id} className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs px-2.5 py-1 rounded-full font-mono">
                                                            {id}
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingPage({
                                                                    ...editingPage,
                                                                    listingIds: (editingPage.listingIds || []).filter(item => item !== id)
                                                                })}
                                                                className="hover:text-purple-950 font-bold ml-1"
                                                            >
                                                                ✕
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Selected Rental Vehicle IDs */}
                                            <div className="space-y-1 pt-2">
                                                <p className="text-[11px] font-bold text-gray-700 uppercase">
                                                    Wybrany wynajem długoterminowy ({(editingPage.rentalVehicleIds || []).length}):
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(editingPage.rentalVehicleIds || []).map((id) => (
                                                        <span key={id} className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 text-xs px-2.5 py-1 rounded-full font-mono">
                                                            {id}
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingPage({
                                                                    ...editingPage,
                                                                    rentalVehicleIds: (editingPage.rentalVehicleIds || []).filter(item => item !== id)
                                                                })}
                                                                className="hover:text-sky-950 font-bold ml-1"
                                                            >
                                                                ✕
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Preview Button */}
                                    {editingPage.id && (
                                        <div className="pt-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => loadPreview(editingPage.id!)}
                                                disabled={previewLoading}
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${previewLoading ? 'animate-spin' : ''}`} />
                                                Odśwież podgląd aut ({previewListings.length})
                                            </Button>

                                            {previewListings.length > 0 && (
                                                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                                                    {previewListings.map((car) => (
                                                        <div key={car.id} className="p-2 rounded-lg bg-gray-100 border text-xs flex items-center gap-2">
                                                            <div className="font-semibold truncate">{car.brand} {car.model}</div>
                                                            <div className="text-gray-500 shrink-0">{car.price} zł</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </TabsContent>

                                {/* TAB 5: SEKCJE */}
                                <TabsContent value="sections" className="space-y-4">
                                    <p className="text-xs text-gray-500">
                                        Włącz/wyłącz stałe sloty sekcji na stronie docelowej oraz edytuj ich treści plain text.
                                    </p>

                                    {/* Callback Section Slot */}
                                    <div className="p-4 rounded-xl border border-gray-200 space-y-3 bg-gray-50/40">
                                        <div className="flex items-center justify-between">
                                            <Label className="font-bold text-sm">Sekcja Formularza CallBack</Label>
                                            <Switch
                                                checked={editingPage.sections?.callback?.enabled !== false}
                                                onCheckedChange={(val) => setEditingPage({
                                                    ...editingPage,
                                                    sections: { ...editingPage.sections, callback: { ...editingPage.sections?.callback, enabled: val } }
                                                })}
                                            />
                                        </div>
                                        <Input
                                            placeholder="Tytuł sekcji callback"
                                            value={editingPage.sections?.callback?.title || ''}
                                            onChange={(e) => setEditingPage({
                                                ...editingPage,
                                                sections: { ...editingPage.sections, callback: { ...editingPage.sections?.callback, title: e.target.value } }
                                            })}
                                        />
                                    </div>

                                    {/* Listings Section Slot */}
                                    <div className="p-4 rounded-xl border border-gray-200 space-y-3 bg-gray-50/40">
                                        <div className="flex items-center justify-between">
                                            <Label className="font-bold text-sm">Sekcja Ofert Samochodowych</Label>
                                            <Switch
                                                checked={editingPage.sections?.listings?.enabled !== false}
                                                onCheckedChange={(val) => setEditingPage({
                                                    ...editingPage,
                                                    sections: { ...editingPage.sections, listings: { ...editingPage.sections?.listings, enabled: val } }
                                                })}
                                            />
                                        </div>
                                        <Input
                                            placeholder="Tytuł sekcji ofert (domyślnie: Dostępne samochody w ofercie)"
                                            value={editingPage.sections?.listings?.title || ''}
                                            onChange={(e) => setEditingPage({
                                                ...editingPage,
                                                sections: { ...editingPage.sections, listings: { ...editingPage.sections?.listings, title: e.target.value } }
                                            })}
                                        />
                                        <div className="pt-2 border-t space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-semibold text-gray-700">Przycisk przejścia do pełnej oferty pod listą</Label>
                                                <Switch
                                                    checked={editingPage.sections?.listings?.ctaEnabled !== false}
                                                    onCheckedChange={(val) => setEditingPage({
                                                        ...editingPage,
                                                        sections: { ...editingPage.sections, listings: { ...editingPage.sections?.listings, ctaEnabled: val } }
                                                    })}
                                                />
                                            </div>
                                            {editingPage.sections?.listings?.ctaEnabled !== false && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                                    <div>
                                                        <Label className="text-xs">Napis na przycisku</Label>
                                                        <Input
                                                            placeholder="Sprawdź całą ofertę"
                                                            value={editingPage.sections?.listings?.ctaLabel || ''}
                                                            onChange={(e) => setEditingPage({
                                                                ...editingPage,
                                                                sections: { ...editingPage.sections, listings: { ...editingPage.sections?.listings, ctaLabel: e.target.value } }
                                                            })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Ścieżka docelowa (względna)</Label>
                                                        <Input
                                                            placeholder="/samochody"
                                                            value={editingPage.sections?.listings?.ctaUrl || ''}
                                                            onChange={(e) => setEditingPage({
                                                                ...editingPage,
                                                                sections: { ...editingPage.sections, listings: { ...editingPage.sections?.listings, ctaUrl: e.target.value } }
                                                            })}
                                                        />
                                                        <p className="text-[10px] text-gray-500 mt-1">Sugerowane: <code>/wynajem-dlugoterminowy</code></p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* TrustBar Slot */}
                                    <div className="p-4 rounded-xl border border-gray-200 space-y-3 bg-gray-50/40">
                                        <div className="flex items-center justify-between">
                                            <Label className="font-bold text-sm">Pasek Zaufania (TrustBar — max 4)</Label>
                                            <Switch
                                                checked={Boolean(editingPage.sections?.trustBar?.enabled)}
                                                onCheckedChange={(val) => setEditingPage({
                                                    ...editingPage,
                                                    sections: { ...editingPage.sections, trustBar: { ...editingPage.sections?.trustBar, enabled: val } }
                                                })}
                                            />
                                        </div>
                                        <Input
                                            placeholder="Wpisy rozdzielone przecinkami (max 4)"
                                            value={Array.isArray(editingPage.sections?.trustBar?.items) ? editingPage.sections.trustBar.items.join(', ') : ''}
                                            onChange={(e) => setEditingPage({
                                                ...editingPage,
                                                sections: {
                                                    ...editingPage.sections,
                                                    trustBar: {
                                                        ...editingPage.sections?.trustBar,
                                                        items: e.target.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4)
                                                    }
                                                }
                                            })}
                                        />
                                    </div>

                                    {/* How It Works Slot */}
                                    <div className="p-4 rounded-xl border border-gray-200 space-y-4 bg-gray-50/40">
                                        <div className="flex items-center justify-between">
                                            <Label className="font-bold text-sm">Sekcja „Jak to działa”</Label>
                                            <Switch
                                                checked={Boolean(editingPage.sections?.howItWorks?.enabled)}
                                                onCheckedChange={(val) => setEditingPage({
                                                    ...editingPage,
                                                    sections: { ...editingPage.sections, howItWorks: { ...editingPage.sections?.howItWorks, enabled: val } }
                                                })}
                                            />
                                        </div>

                                        {editingPage.sections?.howItWorks?.enabled && (
                                            <div className="space-y-4 pt-1">
                                                <p className="text-xs text-gray-500">Podstawowe kroki procesu (max 3):</p>
                                                {([0, 1, 2] as const).map((idx) => {
                                                    const step = editingPage.sections?.howItWorks?.steps?.[idx] || { title: '', text: '' };
                                                    const defaultTitles = ['Wybierz auto lub ratę', 'Wypełnij prosty wniosek', 'Odbierz kluczyki'];
                                                    const defaultTexts = [
                                                        'Przejrzyj naszą flotę lub opowiedz doradcy czego szukasz.',
                                                        'Bez zbędnych dokumentów – decyzję otrzymasz w 24 godziny.',
                                                        'Auto dostarczymy prosto pod wskazany adres lub wybierz odbiór własny.'
                                                    ];
                                                    return (
                                                        <div key={idx} className="p-3 bg-white rounded-lg border border-gray-200 space-y-2">
                                                            <Label className="text-xs font-bold text-gray-700">Krok {idx + 1}</Label>
                                                            <Input
                                                                placeholder={defaultTitles[idx]}
                                                                value={step.title}
                                                                onChange={(e) => {
                                                                    const currentSteps = [...(editingPage.sections?.howItWorks?.steps || [])];
                                                                    while (currentSteps.length <= idx) currentSteps.push({ title: '', text: '' });
                                                                    currentSteps[idx] = { ...currentSteps[idx], title: e.target.value };
                                                                    setEditingPage({
                                                                        ...editingPage,
                                                                        sections: { ...editingPage.sections, howItWorks: { ...editingPage.sections?.howItWorks, steps: currentSteps } }
                                                                    });
                                                                }}
                                                            />
                                                            <textarea
                                                                rows={2}
                                                                placeholder={defaultTexts[idx]}
                                                                value={step.text}
                                                                onChange={(e) => {
                                                                    const currentSteps = [...(editingPage.sections?.howItWorks?.steps || [])];
                                                                    while (currentSteps.length <= idx) currentSteps.push({ title: '', text: '' });
                                                                    currentSteps[idx] = { ...currentSteps[idx], text: e.target.value };
                                                                    setEditingPage({
                                                                        ...editingPage,
                                                                        sections: { ...editingPage.sections, howItWorks: { ...editingPage.sections?.howItWorks, steps: currentSteps } }
                                                                    });
                                                                }}
                                                                className="w-full p-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    );
                                                })}

                                                {/* Opcjonalny 4. kafel odbiór nagrody */}
                                                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-xs font-bold text-amber-900">Kafel odbioru nagrody (opcjonalny 4. krok)</Label>
                                                        <Switch
                                                            checked={Boolean(editingPage.sections?.howItWorks?.steps?.[3]?.title || (editingPage.sections?.howItWorks?.steps?.length === 4))}
                                                            onCheckedChange={(val) => {
                                                                const currentSteps = [...(editingPage.sections?.howItWorks?.steps || [])];
                                                                if (val) {
                                                                    while (currentSteps.length < 3) currentSteps.push({ title: '', text: '' });
                                                                    if (currentSteps.length < 4) {
                                                                        currentSteps[3] = { title: 'Odbierz 500 zł na paliwo', text: 'Po podpisaniu umowy otrzymasz kartę paliwową o wartości 500 zł.' };
                                                                    }
                                                                } else {
                                                                    if (currentSteps.length >= 4) {
                                                                        currentSteps.splice(3, 1);
                                                                    }
                                                                }
                                                                setEditingPage({
                                                                    ...editingPage,
                                                                    sections: { ...editingPage.sections, howItWorks: { ...editingPage.sections?.howItWorks, steps: currentSteps } }
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                    {(editingPage.sections?.howItWorks?.steps?.[3]?.title !== undefined || editingPage.sections?.howItWorks?.steps?.length === 4) && (
                                                        <div className="space-y-2 pt-1">
                                                            <Input
                                                                placeholder="np. Odbierz 500 zł na paliwo"
                                                                value={editingPage.sections?.howItWorks?.steps?.[3]?.title || ''}
                                                                onChange={(e) => {
                                                                    const currentSteps = [...(editingPage.sections?.howItWorks?.steps || [])];
                                                                    while (currentSteps.length < 3) currentSteps.push({ title: '', text: '' });
                                                                    currentSteps[3] = { title: e.target.value, text: currentSteps[3]?.text || '' };
                                                                    setEditingPage({
                                                                        ...editingPage,
                                                                        sections: { ...editingPage.sections, howItWorks: { ...editingPage.sections?.howItWorks, steps: currentSteps } }
                                                                    });
                                                                }}
                                                            />
                                                            <textarea
                                                                rows={2}
                                                                placeholder="np. Po podpisaniu umowy najmu z partnerem otrzymasz kartę paliwową."
                                                                value={editingPage.sections?.howItWorks?.steps?.[3]?.text || ''}
                                                                onChange={(e) => {
                                                                    const currentSteps = [...(editingPage.sections?.howItWorks?.steps || [])];
                                                                    while (currentSteps.length < 3) currentSteps.push({ title: '', text: '' });
                                                                    currentSteps[3] = { title: currentSteps[3]?.title || '', text: e.target.value };
                                                                    setEditingPage({
                                                                        ...editingPage,
                                                                        sections: { ...editingPage.sections, howItWorks: { ...editingPage.sections?.howItWorks, steps: currentSteps } }
                                                                    });
                                                                }}
                                                                className="w-full p-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* FAQ Section Slot */}
                                    <div className="p-4 rounded-xl border border-gray-200 space-y-4 bg-gray-50/40">
                                        <div className="flex items-center justify-between">
                                            <Label className="font-bold text-sm">Sekcja FAQ (Najczęściej zadawane pytania — max 6)</Label>
                                            <Switch
                                                checked={Boolean(editingPage.sections?.faq?.enabled)}
                                                onCheckedChange={(val) => setEditingPage({
                                                    ...editingPage,
                                                    sections: { ...editingPage.sections, faq: { ...editingPage.sections?.faq, enabled: val } }
                                                })}
                                            />
                                        </div>

                                        {editingPage.sections?.faq?.enabled && (
                                            <div className="space-y-3 pt-1">
                                                {((editingPage.sections?.faq?.items as any[]) || []).map((item, idx) => (
                                                    <div key={idx} className="p-3 bg-white rounded-lg border border-gray-200 space-y-2 relative">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-xs font-bold text-gray-700">Pytanie #{idx + 1}</Label>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                                                                onClick={() => {
                                                                    const newItems = [...(editingPage.sections?.faq?.items || [])];
                                                                    newItems.splice(idx, 1);
                                                                    setEditingPage({
                                                                        ...editingPage,
                                                                        sections: { ...editingPage.sections, faq: { ...editingPage.sections?.faq, items: newItems } }
                                                                    });
                                                                }}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                        <Input
                                                            placeholder="Pytanie"
                                                            value={item.q || ''}
                                                            onChange={(e) => {
                                                                const newItems = [...(editingPage.sections?.faq?.items || [])];
                                                                newItems[idx] = { ...newItems[idx], q: e.target.value };
                                                                setEditingPage({
                                                                    ...editingPage,
                                                                    sections: { ...editingPage.sections, faq: { ...editingPage.sections?.faq, items: newItems } }
                                                                });
                                                            }}
                                                        />
                                                        <textarea
                                                            rows={2}
                                                            placeholder="Odpowiedź"
                                                            value={item.a || ''}
                                                            onChange={(e) => {
                                                                const newItems = [...(editingPage.sections?.faq?.items || [])];
                                                                newItems[idx] = { ...newItems[idx], a: e.target.value };
                                                                setEditingPage({
                                                                    ...editingPage,
                                                                    sections: { ...editingPage.sections, faq: { ...editingPage.sections?.faq, items: newItems } }
                                                                });
                                                            }}
                                                            className="w-full p-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                ))}

                                                {((editingPage.sections?.faq?.items || []).length < 6) && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full text-xs"
                                                        onClick={() => {
                                                            const newItems = [...(editingPage.sections?.faq?.items || [])];
                                                            newItems.push({ q: '', a: '' });
                                                            setEditingPage({
                                                                ...editingPage,
                                                                sections: { ...editingPage.sections, faq: { ...editingPage.sections?.faq, items: newItems } }
                                                            });
                                                        }}
                                                    >
                                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                                        Dodaj pytanie
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Urgency Banner Slot */}
                                    <div className="p-4 rounded-xl border border-gray-200 space-y-3 bg-gray-50/40">
                                        <div className="flex items-center justify-between">
                                            <Label className="font-bold text-sm">Baner Pilności (Urgency)</Label>
                                            <Switch
                                                checked={Boolean(editingPage.sections?.urgency?.enabled)}
                                                onCheckedChange={(val) => setEditingPage({
                                                    ...editingPage,
                                                    sections: { ...editingPage.sections, urgency: { ...editingPage.sections?.urgency, enabled: val } }
                                                })}
                                            />
                                        </div>
                                        <Input
                                            placeholder="np. Promocja obowiązuje tylko do końca tego miesiąca!"
                                            value={editingPage.sections?.urgency?.text || ''}
                                            onChange={(e) => setEditingPage({
                                                ...editingPage,
                                                sections: { ...editingPage.sections, urgency: { ...editingPage.sections?.urgency, text: e.target.value } }
                                            })}
                                        />
                                    </div>
                                </TabsContent>

                                {/* TAB 6: SEO */}
                                <TabsContent value="seo" className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-700">Meta Title</Label>
                                        <Input
                                            value={editingPage.metaTitle || ''}
                                            onChange={(e) => setEditingPage({ ...editingPage, metaTitle: e.target.value })}
                                            placeholder="Domyślnie użyje tytułu hero"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-700">Meta Description</Label>
                                        <textarea
                                            rows={2}
                                            value={editingPage.metaDescription || ''}
                                            onChange={(e) => setEditingPage({ ...editingPage, metaDescription: e.target.value })}
                                            placeholder="Domyślnie użyje podtytułu hero"
                                            className="w-full p-2.5 text-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        />
                                    </div>

                                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                                <ShieldAlert className="w-4 h-4 text-amber-600" />
                                                Zezwól na indeksowanie wyszukiwarek (isIndexable)
                                            </Label>
                                            <Switch
                                                checked={Boolean(editingPage.isIndexable)}
                                                onCheckedChange={(val) => setEditingPage({ ...editingPage, isIndexable: val })}
                                            />
                                        </div>
                                        <p className="text-[11px] text-amber-800 leading-normal">
                                            Zgodnie ze strategią SEO Motolia, Landing Page domyślnie posiadają tag <code>noindex</code>. Włącz tę opcję <strong>wyłącznie</strong> dla stron typu evergreen bez daty zakończenia.
                                        </p>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
                            <Button variant="outline" onClick={closeModal}>Anuluj</Button>
                            <Button
                                onClick={handleSave}
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {createMutation.isPending || updateMutation.isPending ? 'Zapisywanie...' : 'Zapisz Landing Page'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
