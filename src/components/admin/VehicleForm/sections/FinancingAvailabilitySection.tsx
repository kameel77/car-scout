import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import type { SectionProps } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '');

async function fetchFinancingProducts() {
    const res = await fetch(`${API_BASE_URL}/api/financing/calculator`);
    if (!res.ok) throw new Error('Failed to load products');
    const data = await res.json();
    return data.products || [];
}

export function FinancingAvailabilitySection({ form, setField, mode }: SectionProps) {
    const { data: products } = useQuery({
        queryKey: ['financing-products'],
        queryFn: fetchFinancingProducts,
    });

    if (mode !== 'sale') return null;

    const creditProducts = products?.filter((p: any) => p.category === 'CREDIT') || [];
    const leasingProducts = products?.filter((p: any) => p.category === 'LEASING') || [];

    return (
        <div className="space-y-6">
            {/* Klient */}
            <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold text-gray-800">Dostępność per Klient</h3>
                <div className="flex gap-6">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={form.availableForPrivate}
                            onChange={(e) => setField('availableForPrivate', e.target.checked)}
                        />
                        <span>Prywatny</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={form.availableForCompany}
                            onChange={(e) => setField('availableForCompany', e.target.checked)}
                        />
                        <span>Firma</span>
                    </label>
                </div>
            </div>

            {/* Kredyt */}
            <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={form.creditAvailable}
                        onChange={(e) => setField('creditAvailable', e.target.checked)}
                    />
                    Kredyt dostępny
                </h3>
                {form.creditAvailable && (
                    <div className="space-y-4 pl-6">
                        <div className="space-y-2 max-w-sm">
                            <label className="text-sm font-medium text-gray-700">Domyślny produkt kredytowy (opcjonalnie)</label>
                            <select
                                className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
                                value={form.creditProductId || ''}
                                onChange={(e) => setField('creditProductId', e.target.value)}
                            >
                                <option value="">-- domyślny z ustawień Dealera --</option>
                                {creditProducts.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.provider})</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Override Ceny Kredytu (Prywatny) PLN</label>
                                <Input
                                    type="number"
                                    placeholder="Pozostaw puste aby użyć domyślnej ceny"
                                    value={form.pricePrivateCreditPln}
                                    onChange={(e) => setField('pricePrivateCreditPln', e.target.value)}
                                    disabled={!form.availableForPrivate}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Override Ceny Kredytu (Firma) PLN</label>
                                <Input
                                    type="number"
                                    placeholder="Pozostaw puste aby użyć domyślnej ceny"
                                    value={form.priceCompanyCreditPln}
                                    onChange={(e) => setField('priceCompanyCreditPln', e.target.value)}
                                    disabled={!form.availableForCompany}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Leasing */}
            <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={form.leasingAvailable}
                        onChange={(e) => setField('leasingAvailable', e.target.checked)}
                    />
                    Leasing dostępny
                </h3>
                {form.leasingAvailable && (
                    <div className="space-y-4 pl-6">
                        <div className="space-y-2 max-w-sm">
                            <label className="text-sm font-medium text-gray-700">Domyślny produkt leasingowy (opcjonalnie)</label>
                            <select
                                className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
                                value={form.leasingProductId || ''}
                                onChange={(e) => setField('leasingProductId', e.target.value)}
                            >
                                <option value="">-- domyślny z ustawień Dealera --</option>
                                {leasingProducts.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.provider})</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Override Ceny Leasingu (Prywatny) PLN</label>
                                <Input
                                    type="number"
                                    placeholder="Pozostaw puste aby użyć domyślnej ceny"
                                    value={form.pricePrivateLeasingPln}
                                    onChange={(e) => setField('pricePrivateLeasingPln', e.target.value)}
                                    disabled={!form.availableForPrivate}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Override Ceny Leasingu (Firma) PLN</label>
                                <Input
                                    type="number"
                                    placeholder="Pozostaw puste aby użyć domyślnej ceny"
                                    value={form.priceCompanyLeasingPln}
                                    onChange={(e) => setField('priceCompanyLeasingPln', e.target.value)}
                                    disabled={!form.availableForCompany}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
