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

                    <div className="flex items-center gap-2">
                        <input
                            id="showMotoliaDiscount"
                            type="checkbox"
                            checked={form.showMotoliaDiscount}
                            onChange={e => setField('showMotoliaDiscount', e.target.checked)}
                        />
                        <label htmlFor="showMotoliaDiscount" className="text-sm">Rabat Motolia (tag na zdjęciu)</label>
                    </div>
                </>
            )}
        </div>
    );
}
