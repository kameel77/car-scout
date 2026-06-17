import { Input } from '@/components/ui/input';
import type { SectionProps } from '../types';

export function PricingSection({ form, setField, mode, isImported }: SectionProps) {
    const technicalDisabled = isImported;

    // Cena sprzedaży (gotówka) jest pochodną: cena w finansowaniu + rabat Motolia (źródło prawdy).
    const fin = parseInt(form.pricePln || '0');
    const disc = parseInt(form.motoliaDiscountPln || '0');
    const saleDisplay = form.motoliaDiscountPln ? String(fin + disc) : '';

    return (
        <div>
            {/* Catalog price + main price always editable for sale (catalogPrice whitelisted) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                        Cena katalogowa (PLN) {mode === 'rental' ? '*' : ''}
                    </label>
                    <Input type="number" value={form.catalogPrice} onChange={e => setField('catalogPrice', e.target.value)} required={mode === 'rental'} />
                </div>

                {mode === 'sale' && (
                    <>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Cena w finansowaniu (PLN) *</label>
                            <Input 
                                type="number" 
                                value={form.pricePln} 
                                onChange={e => setField('pricePln', e.target.value)} 
                                disabled={isImported} 
                                required 
                                className={errors?.pricePln ? 'border-red-500 focus-visible:ring-red-500' : ''}
                            />
                            {errors?.pricePln && <p className="text-xs text-red-600">{errors.pricePln}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Cena sprzedaży (PLN)</label>
                            <Input
                                type="number"
                                value={saleDisplay}
                                onChange={e => {
                                    const saleNum = parseInt(e.target.value || '0');
                                    setField('motoliaDiscountPln', e.target.value && saleNum >= fin ? String(saleNum - fin) : '');
                                }}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Rabat Motolia (zł)</label>
                            <Input
                                type="number"
                                value={form.motoliaDiscountPln}
                                onChange={e => setField('motoliaDiscountPln', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2 lg:col-span-3">
                            <label className="text-sm font-medium text-gray-700">Cena pojazdu wyświetlana jako</label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={form.displaySalePrice === false}
                                        onChange={() => setField('displaySalePrice', false)}
                                    />
                                    <span className="text-sm">Cena w finansowaniu</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={form.displaySalePrice === true}
                                        onChange={() => setField('displaySalePrice', true)}
                                    />
                                    <span className="text-sm">Cena w finansowaniu + Rabat Motolia</span>
                                </label>
                            </div>
                        </div>
                    </>
                )}

                {mode === 'rental' && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Cena sprzedaży (PLN)</label>
                        <Input type="number" value={form.sellingPrice} onChange={e => setField('sellingPrice', e.target.value)} />
                    </div>
                )}
            </div>

            <fieldset disabled={mode === 'sale' ? technicalDisabled : false} className={`mt-4 ${mode === 'sale' && technicalDisabled ? 'opacity-60' : ''}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Przebieg (km) {mode === 'sale' ? (form.condition === 'NEW' ? '(< 100)' : '*') : ''}
                        </label>
                        <Input 
                            type="number" 
                            value={form.mileageKm} 
                            onChange={e => setField('mileageKm', e.target.value)} 
                            required={mode === 'sale'} 
                            className={errors?.mileageKm ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        />
                        {errors?.mileageKm && <p className="text-xs text-red-600">{errors.mileageKm}</p>}
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Data pierwszej rejestracji</label>
                        <Input type="text" value={form.firstRegistrationDate} onChange={e => setField('firstRegistrationDate', e.target.value)} placeholder="YYYY-MM-DD" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Numer rejestracyjny</label>
                        <Input value={form.registrationNumber} onChange={e => setField('registrationNumber', e.target.value)} />
                    </div>
                </div>
            </fieldset>
        </div>
    );
}
