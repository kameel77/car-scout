import { Input } from '@/components/ui/input';
import type { SectionProps } from '../types';

export function PricingSection({ form, setField, mode, isImported }: SectionProps) {
    const technicalDisabled = isImported;

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
                    <div className="space-y-2">
                        <fieldset disabled={isImported} className={isImported ? 'opacity-60' : ''}>
                            <label className="text-sm font-medium text-gray-700">Cena sprzedaży brutto (PLN) *</label>
                            <Input type="number" value={form.pricePln} onChange={e => setField('pricePln', e.target.value)} required />
                        </fieldset>
                    </div>
                )}

                {mode === 'rental' && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Cena sprzedaży (PLN)</label>
                        <Input type="number" value={form.sellingPrice} onChange={e => setField('sellingPrice', e.target.value)} />
                    </div>
                )}
            </div>

            {mode === 'sale' && (
                <fieldset disabled={technicalDisabled} className={`mt-4 ${technicalDisabled ? 'opacity-60' : ''}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Przebieg (km) {form.condition === 'NEW' ? '(< 100)' : '*'}
                            </label>
                            <Input type="number" value={form.mileageKm} onChange={e => setField('mileageKm', e.target.value)} required />
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
            )}
        </div>
    );
}
