import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financingApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { FinancingProduct, FinancingProductPayload } from '@/types/financing';
import { AdminNav } from '@/components/admin/AdminNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { LogOut, Plus, RefreshCw, Trash2, Edit } from 'lucide-react';

const EMPTY_FORM: FinancingProductPayload = {
    category: 'CREDIT',
    name: '',
    currency: 'PLN',
    referenceRate: 0,
    margin: 0,
    commission: 0,
    maxInitialPayment: 0,
    maxFinalPayment: 0,
    minInstallments: 12,
    maxInstallments: 84,
    isDefault: false,
};

export default function FinancingPage() {
    const { user, token, logout } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = React.useState<string>('CREDIT');
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [formData, setFormData] = React.useState<FinancingProductPayload>(EMPTY_FORM);

    const { data, isLoading } = useQuery({
        queryKey: ['financing-products'],
        queryFn: async () => {
            if (!token) return { products: [] };
            return financingApi.list(token);
        },
        enabled: !!token,
    });

    const products = (data?.products || []) as FinancingProduct[];
    const filteredProducts = products.filter(p => p.category === activeTab);

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

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    const handleOpenModal = (product?: FinancingProduct) => {
        if (product) {
            setEditingId(product.id);
            setFormData({
                category: product.category,
                name: product.name || '',
                currency: product.currency,
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
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData(EMPTY_FORM);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleNumberChange = (field: keyof FinancingProductPayload, value: string) => {
        const num = parseFloat(value);
        setFormData(prev => ({
            ...prev,
            [field]: isNaN(num) ? 0 : num
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

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Produkty Finansowe</CardTitle>
                                <CardDescription>Lista aktywnych produktów dla kalkulatora</CardDescription>
                            </div>
                            <Button onClick={() => handleOpenModal()}>
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
                                            <TableHead>Waluta</TableHead>
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
                                                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                                                    Ładowanie...
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredProducts.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                                    Brak produktów w tej kategorii.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredProducts.map((product) => (
                                                <TableRow key={product.id}>
                                                    <TableCell className="font-medium">{product.name || '-'}</TableCell>
                                                    <TableCell>{product.currency}</TableCell>
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
                                    onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))}
                                >
                                    <option value="PLN">PLN</option>
                                    <option value="EUR">EUR</option>
                                </select>
                            </div>
                        </div>

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
                                    <Switch
                                        id="is-default"
                                        checked={formData.isDefault}
                                        onCheckedChange={c => setFormData(p => ({ ...p, isDefault: c }))}
                                    />
                                    <Label htmlFor="is-default">Domyślny</Label>
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
        </div>
    );
}
