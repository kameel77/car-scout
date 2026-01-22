import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financingApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import {
    FinancingProduct,
    FinancingProductPayload,
    FinancingProviderConnection,
    FinancingProviderConnectionPayload
} from '@/types/financing';
import { useAppSettings } from '@/hooks/useAppSettings';
import { settingsApi } from '@/services/api';
import { AdminNav } from '@/components/admin/AdminNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { LogOut, Plus, RefreshCw, Trash2, Edit } from 'lucide-react';

const EMPTY_FORM: FinancingProductPayload = {
    category: 'CREDIT',
    name: '',
    currency: 'PLN',
    provider: 'OWN',
    priority: 0,
    minAmount: null,
    maxAmount: null,
    providerConfig: {
        productCode: '',
        paymentDay: undefined,
        responseLevel: 'simple',
        currency: 'PLN',
    },
    referenceRate: 0,
    margin: 0,
    commission: 0,
    maxInitialPayment: 0,
    maxFinalPayment: 0,
    minInstallments: 12,
    maxInstallments: 84,
    isDefault: false,
};

const EMPTY_CONNECTION_FORM: FinancingProviderConnectionPayload = {
    provider: 'INBANK',
    name: '',
    apiBaseUrl: '',
    apiKey: '',
    apiSecret: '',
    shopUuid: '',
    isActive: true,
};

export default function FinancingPage() {
    const { user, token, logout } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: settings, refetch: refetchSettings } = useAppSettings();

    const [activeTab, setActiveTab] = React.useState<string>('CREDIT');
    const [isChoiceModalOpen, setIsChoiceModalOpen] = React.useState(false);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [formData, setFormData] = React.useState<FinancingProductPayload>(EMPTY_FORM);
    const [isConnectionModalOpen, setIsConnectionModalOpen] = React.useState(false);
    const [editingConnectionId, setEditingConnectionId] = React.useState<string | null>(null);
    const [connectionFormData, setConnectionFormData] = React.useState<FinancingProviderConnectionPayload>(EMPTY_CONNECTION_FORM);

    const { data, isLoading } = useQuery({
        queryKey: ['financing-products'],
        queryFn: async () => {
            if (!token) return { products: [] };
            return financingApi.list(token);
        },
        enabled: !!token,
    });

    const { data: connectionsData, isLoading: isConnectionsLoading } = useQuery({
        queryKey: ['financing-connections'],
        queryFn: async () => {
            if (!token) return { connections: [] };
            return financingApi.listConnections(token);
        },
        enabled: !!token,
    });

    const products = (data?.products || []) as FinancingProduct[];
    const filteredProducts = products.filter(p => p.category === activeTab);
    const connections = (connectionsData?.connections || []) as FinancingProviderConnection[];

    const saveMutation = useMutation({
        mutationFn: (payload: FinancingProductPayload) => {
            if (!token) throw new Error('Brak tokenu');
            if (editingId) {
                return financingApi.update(editingId, payload, token);
            }
            return financingApi.create(payload, token);
        },
        onSuccess: () => {
            toast.success(editingId ? 'Produkt zaktualizowany' : 'Produkt dodany');
            queryClient.invalidateQueries({ queryKey: ['financing-products'] });
            handleCloseModal();
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Błąd zapisu');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => {
            if (!token) throw new Error('Brak tokenu');
            return financingApi.delete(id, token);
        },
        onSuccess: () => {
            toast.success('Produkt usunięty');
            queryClient.invalidateQueries({ queryKey: ['financing-products'] });
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Nie udało się usunąć produktu');
        },
    });

    const saveConnectionMutation = useMutation({
        mutationFn: (payload: FinancingProviderConnectionPayload) => {
            if (!token) throw new Error('Brak tokenu');
            if (editingConnectionId) {
                return financingApi.updateConnection(editingConnectionId, payload, token);
            }
            return financingApi.createConnection(payload, token);
        },
        onSuccess: () => {
            toast.success(editingConnectionId ? 'Połączenie zaktualizowane' : 'Połączenie dodane');
            queryClient.invalidateQueries({ queryKey: ['financing-connections'] });
            handleCloseConnectionModal();
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Błąd zapisu');
        },
    });

    const testConnectionMutation = useMutation({
        mutationFn: (payload: { apiBaseUrl: string; apiKey: string; shopUuid: string }) => {
            if (!token) throw new Error('Brak tokenu');
            return financingApi.testConnection(payload, token);
        },
        onSuccess: (data: any) => {
            if (data.success) {
                toast.success('Połączenie poprawne! API odpowiedziało.');
            } else {
                toast.error(`Błąd połączenia: ${data.details || 'Nieznany błąd'}`);
            }
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Błąd komunikacji z serwerem');
        },
    });

    const deleteConnectionMutation = useMutation({
        mutationFn: (id: string) => {
            if (!token) throw new Error('Brak tokenu');
            return financingApi.deleteConnection(id, token);
        },
        onSuccess: () => {
            toast.success('Połączenie usunięte');
            queryClient.invalidateQueries({ queryKey: ['financing-connections'] });
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Nie udało się usunąć połączenia');
        },
    });

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    const handleOpenChoiceModal = () => {
        setIsChoiceModalOpen(true);
    };

    const handleSelectProvider = (provider: FinancingProductPayload['provider']) => {
        setIsChoiceModalOpen(false);
        handleOpenModal(undefined, provider);
    };

    const handleOpenModal = (product?: FinancingProduct, forcedProvider?: FinancingProductPayload['provider']) => {
        if (product) {
            setEditingId(product.id);
            setFormData({
                category: product.category,
                name: product.name || '',
                currency: product.currency,
                provider: product.provider,
                priority: product.priority ?? 0,
                minAmount: product.minAmount ?? null,
                maxAmount: product.maxAmount ?? null,
                providerConfig: product.providerConfig ?? {
                    productCode: '',
                    paymentDay: undefined,
                    responseLevel: 'simple',
                    currency: product.currency,
                },
                referenceRate: product.referenceRate,
                margin: product.margin,
                commission: product.commission,
                maxInitialPayment: product.maxInitialPayment,
                maxFinalPayment: product.maxFinalPayment,
                minInstallments: product.minInstallments,
                maxInstallments: product.maxInstallments,
                isDefault: product.isDefault,
            });
        } else {
            setEditingId(null);
            setFormData({
                ...EMPTY_FORM,
                category: activeTab as any,
                provider: forcedProvider || 'OWN',
            });
        }
        setIsModalOpen(true);
    };

    const handleOpenConnectionModal = (connection?: FinancingProviderConnection) => {
        if (connection) {
            setEditingConnectionId(connection.id);
            setConnectionFormData({
                provider: connection.provider,
                name: connection.name,
                apiBaseUrl: connection.apiBaseUrl,
                apiKey: connection.apiKey,
                apiSecret: connection.apiSecret || '',
                shopUuid: connection.shopUuid || '',
                isActive: connection.isActive,
            });
        } else {
            setEditingConnectionId(null);
            setConnectionFormData(EMPTY_CONNECTION_FORM);
        }
        setIsConnectionModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData(EMPTY_FORM);
    };

    const handleCloseConnectionModal = () => {
        setIsConnectionModalOpen(false);
        setEditingConnectionId(null);
        setConnectionFormData(EMPTY_CONNECTION_FORM);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleConnectionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveConnectionMutation.mutate(connectionFormData);
    };

    const updateSettingsMutation = useMutation({
        mutationFn: (newSettings: any) => {
            if (!token) throw new Error('Brak tokenu');
            return settingsApi.updateSettings(newSettings, token);
        },
        onSuccess: () => {
            toast.success('Ustawienia zaktualizowane');
            refetchSettings();
        },
        onError: () => toast.error('Błąd aktualizacji ustawień')
    });

    const handleSettingsChange = (key: string, value: any) => {
        if (!settings) return;
        updateSettingsMutation.mutate({
            ...settings,
            [key]: value
        });
    };

    const handleNumberChange = (field: keyof FinancingProductPayload, value: string) => {
        const num = parseFloat(value);
        setFormData(prev => ({
            ...prev,
            [field]: isNaN(num) ? 0 : num
        }));
    };

    const handleOptionalNumberChange = (field: keyof FinancingProductPayload, value: string) => {
        const num = value === '' ? null : parseFloat(value);
        setFormData(prev => ({
            ...prev,
            [field]: value === '' || isNaN(num as number) ? null : num
        }));
    };

    const handleProviderConfigChange = (field: string, value: string | number | undefined) => {
        setFormData(prev => ({
            ...prev,
            providerConfig: {
                ...(prev.providerConfig || {}),
                [field]: value,
            }
        }));
    };

    return (
        <div className="min-h-screen bg-gray-50/50">
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Finansowanie</h1>
                            <p className="text-sm text-muted-foreground">
                                Zarządzaj ofertą produktów finansowych (Kredyt, Leasing, Najem)
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <AdminNav />
                            <Button onClick={handleLogout} variant="outline" size="sm">
                                <LogOut className="w-4 h-4 mr-2" />
                                Logout
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {/* Global Settings Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Konfiguracja Kalkulatora</CardTitle>
                        <CardDescription>Ustawienia widoczności i umiejscowienia kalkulatora na stronie oferty</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Pokaż kalkulator na karcie pojazdu</Label>
                                <p className="text-sm text-muted-foreground">
                                    Włącz lub wyłącz widoczność modułu finansowania dla klientów
                                </p>
                            </div>
                            <Switch
                                checked={settings?.financingCalculatorEnabled ?? true}
                                onCheckedChange={(checked) => handleSettingsChange('financingCalculatorEnabled', checked)}
                            />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-base">Umiejscowienie kalkulatora</Label>
                            <RadioGroup
                                value={settings?.financingCalculatorLocation ?? 'main'}
                                onValueChange={(val) => handleSettingsChange('financingCalculatorLocation', val)}
                                className="grid grid-cols-2 gap-4"
                            >
                                <div>
                                    <RadioGroupItem value="main" id="loc-main" className="peer sr-only" />
                                    <Label htmlFor="loc-main" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                                        <span className="mb-2 text-lg font-semibold">Część Główna</span>
                                        <span className="text-sm text-center text-muted-foreground">Pod specyfikacją i wyposażeniem (domyślne)</span>
                                    </Label>
                                </div>
                                <div>
                                    <RadioGroupItem value="sidebar" id="loc-sidebar" className="peer sr-only" />
                                    <Label htmlFor="loc-sidebar" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                                        <span className="mb-2 text-lg font-semibold">Panel Boczny (Widget)</span>
                                        <span className="text-sm text-center text-muted-foreground">Pod ceną i przyciskami (wąski wariant)</span>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Połączenia z instytucjami</CardTitle>
                                <CardDescription>Konfiguracja połączeń do API partnerów finansowych</CardDescription>
                            </div>
                            <Button onClick={() => handleOpenConnectionModal()}>
                                <Plus className="w-4 h-4 mr-2" />
                                Dodaj Połączenie
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Partner</TableHead>
                                        <TableHead>Nazwa</TableHead>
                                        <TableHead>URL API</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Akcje</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isConnectionsLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                                                Ładowanie...
                                            </TableCell>
                                        </TableRow>
                                    ) : connections.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Brak skonfigurowanych połączeń.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        connections.map((connection) => (
                                            <TableRow key={connection.id}>
                                                <TableCell className="font-medium">
                                                    {connection.provider === 'INBANK' ? 'Inbank' : connection.provider}
                                                </TableCell>
                                                <TableCell>{connection.name}</TableCell>
                                                <TableCell className="truncate max-w-[240px]">{connection.apiBaseUrl}</TableCell>
                                                <TableCell>
                                                    {connection.isActive ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                            Aktywne
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                            Nieaktywne
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" onClick={() => handleOpenConnectionModal(connection)}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700"
                                                            onClick={() => {
                                                                if (confirm('Czy na pewno usunąć to połączenie?')) {
                                                                    deleteConnectionMutation.mutate(connection.id);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Produkty Finansowe</CardTitle>
                                <CardDescription>Lista aktywnych produktów dla kalkulatora</CardDescription>
                            </div>
                            <Button onClick={handleOpenChoiceModal}>
                                <Plus className="w-4 h-4 mr-2" />
                                Dodaj Produkt
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                            <TabsList>
                                <TabsTrigger value="CREDIT">Kredyt</TabsTrigger>
                                <TabsTrigger value="LEASING">Leasing</TabsTrigger>
                                <TabsTrigger value="RENT">Najem</TabsTrigger>
                            </TabsList>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nazwa</TableHead>
                                            <TableHead>Partner</TableHead>
                                            <TableHead>Waluta</TableHead>
                                            <TableHead>Priorytet</TableHead>
                                            <TableHead>Zakres kwoty</TableHead>
                                            <TableHead>WIBOR/EURIBOR</TableHead>
                                            <TableHead>Marża</TableHead>
                                            <TableHead>Prowizja</TableHead>
                                            <TableHead>Max Wpłata</TableHead>
                                            <TableHead>Raty (min-max)</TableHead>
                                            <TableHead>Domyślny</TableHead>
                                            <TableHead className="text-right">Akcje</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                                                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                                                    Ładowanie...
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredProducts.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                                                    Brak produktów w tej kategorii.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredProducts.map((product) => (
                                                <TableRow key={product.id}>
                                                    <TableCell className="font-medium">{product.name || '-'}</TableCell>
                                                    <TableCell>{product.provider === 'INBANK' ? 'Inbank' : 'Produkt własny'}</TableCell>
                                                    <TableCell>{product.currency}</TableCell>
                                                    <TableCell>{product.priority ?? 0}</TableCell>
                                                    <TableCell>
                                                        {product.minAmount != null || product.maxAmount != null
                                                            ? `${product.minAmount ?? '-'} - ${product.maxAmount ?? '-'}`
                                                            : '-'}
                                                    </TableCell>
                                                    <TableCell>{product.referenceRate}%</TableCell>
                                                    <TableCell>{product.margin}%</TableCell>
                                                    <TableCell>{product.commission}%</TableCell>
                                                    <TableCell>{product.maxInitialPayment}%</TableCell>
                                                    <TableCell>{product.minInstallments}-{product.maxInstallments}</TableCell>
                                                    <TableCell>
                                                        {product.isDefault && (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                                Default
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="sm" onClick={() => handleOpenModal(product)}>
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700"
                                                                onClick={() => {
                                                                    if (confirm('Czy na pewno usunąć ten produkt?')) {
                                                                        deleteMutation.mutate(product.id);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </Tabs>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edytuj produkt' : 'Dodaj nowy produkt'}</DialogTitle>
                        <DialogDescription>
                            Wypełnij parametry produktu finansowego dla kategorii {activeTab}.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nazwa (opcjonalnie)</Label>
                                <Input
                                    value={formData.name || ''}
                                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                    placeholder="np. Leasing Promocyjny"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Waluta</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                    value={formData.currency}
                                    onChange={e => setFormData(p => ({
                                        ...p,
                                        currency: e.target.value,
                                        providerConfig: {
                                            ...(p.providerConfig || {}),
                                            currency: e.target.value,
                                        }
                                    }))}
                                >
                                    <option value="PLN">PLN</option>
                                    <option value="EUR">EUR</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Partner</Label>
                                <div className="flex h-10 w-full rounded-md border border-input bg-slate-100 px-3 py-2 text-sm font-medium">
                                    {formData.provider === 'INBANK' ? 'Inbank' : 'Produkt własny'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Priorytet</Label>
                                <Input
                                    type="number" step="1" required
                                    value={formData.priority}
                                    onChange={e => handleNumberChange('priority', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Zakres kwoty (min / max)</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        type="number"
                                        step="1"
                                        value={formData.minAmount ?? ''}
                                        placeholder="min"
                                        onChange={e => handleOptionalNumberChange('minAmount', e.target.value)}
                                    />
                                    <Input
                                        type="number"
                                        step="1"
                                        value={formData.maxAmount ?? ''}
                                        placeholder="max"
                                        onChange={e => handleOptionalNumberChange('maxAmount', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 flex items-end pb-2">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="is-default"
                                        checked={formData.isDefault}
                                        onCheckedChange={c => setFormData(p => ({ ...p, isDefault: c }))}
                                    />
                                    <Label htmlFor="is-default">Domyślny dla kategorii</Label>
                                </div>
                            </div>
                        </div>

                        {formData.provider === 'INBANK' && (
                            <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
                                <div>
                                    <Label className="text-sm text-muted-foreground">Konfiguracja Inbank</Label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Kod produktu (wymagane)</Label>
                                        <Input
                                            value={formData.providerConfig?.productCode || ''}
                                            onChange={e => handleProviderConfigChange('productCode', e.target.value)}
                                            placeholder="np. car_loan_pledge_..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Dzień płatności</Label>
                                        <Input
                                            type="number"
                                            step="1"
                                            value={formData.providerConfig?.paymentDay ?? ''}
                                            onChange={e => {
                                                const value = e.target.value === '' ? undefined : Number(e.target.value);
                                                handleProviderConfigChange('paymentDay', value);
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Response level</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                            value={formData.providerConfig?.responseLevel || 'simple'}
                                            onChange={e => handleProviderConfigChange('responseLevel', e.target.value)}
                                        >
                                            <option value="simple">simple</option>
                                            <option value="full">full</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Stawka ref. (%)</Label>
                                <Input
                                    type="number" step="0.01" required
                                    value={formData.referenceRate}
                                    onChange={e => handleNumberChange('referenceRate', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Marża (%)</Label>
                                <Input
                                    type="number" step="0.01" required
                                    value={formData.margin}
                                    onChange={e => handleNumberChange('margin', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Prowizja (%)</Label>
                                <Input
                                    type="number" step="0.01" required
                                    value={formData.commission}
                                    onChange={e => handleNumberChange('commission', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Max 1. wpłata (%)</Label>
                                <Input
                                    type="number" step="1" required
                                    value={formData.maxInitialPayment}
                                    onChange={e => handleNumberChange('maxInitialPayment', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Max ost. wpłata (%)</Label>
                                <Input
                                    type="number" step="1" required
                                    value={formData.maxFinalPayment}
                                    onChange={e => handleNumberChange('maxFinalPayment', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2 flex items-end pb-2">
                                <div className="flex items-center space-x-2">
                                    {/* Placeholder to maintain grid spacing */}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Min. ilość rat</Label>
                                <Input
                                    type="number" step="1" required
                                    value={formData.minInstallments}
                                    onChange={e => handleNumberChange('minInstallments', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Max. ilość rat</Label>
                                <Input
                                    type="number" step="1" required
                                    value={formData.maxInstallments}
                                    onChange={e => handleNumberChange('maxInstallments', e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleCloseModal}>Anuluj</Button>
                            <Button type="submit" disabled={saveMutation.isPending}>
                                {saveMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                                Zapisz
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isConnectionModalOpen} onOpenChange={setIsConnectionModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingConnectionId ? 'Edytuj połączenie' : 'Dodaj połączenie'}</DialogTitle>
                        <DialogDescription>
                            Skonfiguruj dostęp do API partnera finansowego.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleConnectionSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Partner</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                value={connectionFormData.provider}
                                onChange={e => setConnectionFormData(p => ({
                                    ...p,
                                    provider: e.target.value as FinancingProviderConnectionPayload['provider']
                                }))}
                            >
                                <option value="INBANK">Inbank</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label>Nazwa połączenia</Label>
                            <Input
                                value={connectionFormData.name}
                                onChange={e => setConnectionFormData(p => ({ ...p, name: e.target.value }))}
                                placeholder="np. Inbank Produkcja"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>URL API (bazowy, np. https://api-demo.inbank.eu)</Label>
                                <Input
                                    value={connectionFormData.apiBaseUrl}
                                    onChange={e => setConnectionFormData(p => ({ ...p, apiBaseUrl: e.target.value }))}
                                    placeholder="https://api-demo.inbank.eu"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Shop UUID</Label>
                                <Input
                                    value={connectionFormData.shopUuid || ''}
                                    onChange={e => setConnectionFormData(p => ({ ...p, shopUuid: e.target.value }))}
                                    placeholder="138d0594-..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>API Key</Label>
                                <Input
                                    value={connectionFormData.apiKey}
                                    onChange={e => setConnectionFormData(p => ({ ...p, apiKey: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>API Secret (opcjonalnie)</Label>
                                <Input
                                    value={connectionFormData.apiSecret || ''}
                                    onChange={e => setConnectionFormData(p => ({ ...p, apiSecret: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="connection-active"
                                    checked={connectionFormData.isActive}
                                    onCheckedChange={checked => setConnectionFormData(p => ({ ...p, isActive: checked }))}
                                />
                                <Label htmlFor="connection-active">Aktywne</Label>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => testConnectionMutation.mutate({
                                    apiBaseUrl: connectionFormData.apiBaseUrl,
                                    apiKey: connectionFormData.apiKey,
                                    shopUuid: connectionFormData.shopUuid || ''
                                })}
                                disabled={testConnectionMutation.isPending || !connectionFormData.apiBaseUrl || !connectionFormData.apiKey}
                            >
                                {testConnectionMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                Testuj połączenie
                            </Button>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleCloseConnectionModal}>Anuluj</Button>
                            <Button type="submit" disabled={saveConnectionMutation.isPending}>
                                {saveConnectionMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                                Zapisz
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isChoiceModalOpen} onOpenChange={setIsChoiceModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Dodaj nowy produkt finansowy</DialogTitle>
                        <DialogDescription>
                            Wybierz partnera finansowego dla tego produktu.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-6">
                        <button
                            onClick={() => handleSelectProvider('INBANK')}
                            className="flex flex-col items-center justify-center p-6 space-y-4 rounded-xl border-2 border-slate-100 hover:border-primary hover:bg-slate-50 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                <Plus className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-lg">Inbank</div>
                                <div className="text-sm text-muted-foreground">Automatyczna kalkulacja przez API</div>
                            </div>
                        </button>

                        <button
                            onClick={() => handleSelectProvider('OWN')}
                            className="flex flex-col items-center justify-center p-6 space-y-4 rounded-xl border-2 border-slate-100 hover:border-primary hover:bg-slate-50 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                <Edit className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-lg">Produkt własny</div>
                                <div className="text-sm text-muted-foreground">Stałe oprocentowanie i marża</div>
                            </div>
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
