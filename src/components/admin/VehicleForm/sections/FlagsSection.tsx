import type { SectionProps } from '../types';

export function FlagsSection({ form, setField, mode }: SectionProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <input
                    id="isFeatured"
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={e => setField('isFeatured', e.target.checked)}
                />
                <label htmlFor="isFeatured" className="text-sm">Wyróżnij na liście</label>
            </div>

            {mode === 'sale' && (
                <>
                    <div className="flex items-center gap-2">
                        <input
                            id="isChineseBrand"
                            type="checkbox"
                            checked={form.isChineseBrand}
                            onChange={e => setField('isChineseBrand', e.target.checked)}
                        />
                        <label htmlFor="isChineseBrand" className="text-sm">Marka chińska</label>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Baza ceny do raty finansowania</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    checked={form.financingPriceBase === 'BROKER_PRICE_PLN'}
                                    onChange={() => setField('financingPriceBase', 'BROKER_PRICE_PLN')}
                                />
                                <span className="text-sm">Cena brokera (z markupem)</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    checked={form.financingPriceBase === 'PRICE_PLN'}
                                    onChange={() => setField('financingPriceBase', 'PRICE_PLN')}
                                />
                                <span className="text-sm">Cena sprzedaży brutto</span>
                            </label>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
