import { useState } from 'react';
import type { SectionProps } from '../types';

/** Presety tagów marketingowych — wpływają na decyzję klienta (wzorzec: superauto.pl) */
const MARKETING_TAG_PRESETS = [
    'Od ręki',
    'Gwarancja fabryczna',
    'Wyprzedaż rocznika',
    'Ostatnia sztuka',
    'Niski przebieg',
    'Pierwszy właściciel',
    'Salon Polska',
    'Faktura VAT 23%',
    'Darmowa dostawa',
];

const MAX_MARKETING_TAGS = 4;

export function FlagsSection({ form, setField, mode }: SectionProps) {
    const [customTag, setCustomTag] = useState('');
    const tags: string[] = form.marketingTags || [];

    const toggleTag = (tag: string) => {
        if (tags.includes(tag)) {
            setField('marketingTags', tags.filter((t: string) => t !== tag));
        } else if (tags.length < MAX_MARKETING_TAGS) {
            setField('marketingTags', [...tags, tag]);
        }
    };

    const addCustomTag = () => {
        const tag = customTag.trim().slice(0, 30);
        if (tag && !tags.includes(tag) && tags.length < MAX_MARKETING_TAGS) {
            setField('marketingTags', [...tags, tag]);
            setCustomTag('');
        }
    };

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
                            id="isBusinessFeatured"
                            type="checkbox"
                            checked={form.isBusinessFeatured}
                            onChange={e => setField('isBusinessFeatured', e.target.checked)}
                        />
                        <label htmlFor="isBusinessFeatured" className="text-sm">Oferta dla firm (/dla-firm)</label>
                    </div>

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

                    <div className="pt-3 border-t space-y-2">
                        <p className="text-sm font-medium">
                            Tagi marketingowe na karcie oferty
                            <span className="text-xs text-muted-foreground font-normal"> — max {MAX_MARKETING_TAGS}, na karcie widoczne 2 pierwsze</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {MARKETING_TAG_PRESETS.map((tag) => {
                                const active = tags.includes(tag);
                                const disabled = !active && tags.length >= MAX_MARKETING_TAGS;
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        disabled={disabled}
                                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${active
                                            ? 'bg-accent text-accent-foreground border-accent font-semibold'
                                            : 'bg-background text-muted-foreground border-border hover:border-accent'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>
                        {tags.filter((t: string) => !MARKETING_TAG_PRESETS.includes(t)).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {tags.filter((t: string) => !MARKETING_TAG_PRESETS.includes(t)).map((tag: string) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className="px-2.5 py-1 rounded-full text-xs border bg-accent text-accent-foreground border-accent font-semibold"
                                        title="Kliknij, aby usunąć"
                                    >
                                        {tag} ✕
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={customTag}
                                maxLength={30}
                                onChange={e => setCustomTag(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
                                placeholder="Własny tag (max 30 znaków)"
                                className="flex-1 h-8 px-2 rounded border border-border bg-background text-sm"
                            />
                            <button
                                type="button"
                                onClick={addCustomTag}
                                disabled={!customTag.trim() || tags.length >= MAX_MARKETING_TAGS}
                                className="h-8 px-3 rounded border border-border text-sm hover:bg-secondary disabled:opacity-40"
                            >
                                Dodaj
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
