import { Textarea } from '@/components/ui/textarea';
import type { SectionProps } from '../types';

const GROUPS: Array<{ key: keyof Pick<import('../types').VehicleFormState, 'equipmentAudioMultimedia' | 'equipmentSafety' | 'equipmentComfortExtras' | 'equipmentOther'>; label: string }> = [
    { key: 'equipmentAudioMultimedia', label: 'Audio i multimedia' },
    { key: 'equipmentSafety', label: 'Bezpieczeństwo' },
    { key: 'equipmentComfortExtras', label: 'Komfort' },
    { key: 'equipmentOther', label: 'Inne' },
];

export function EquipmentSection({ form, setField, isImported }: SectionProps) {
    return (
        <fieldset disabled={isImported} className={isImported ? 'opacity-60' : ''}>
            <p className="text-xs text-gray-500 mb-3">Każda pozycja w nowej linii.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {GROUPS.map(g => (
                    <div key={g.key} className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">{g.label}</label>
                        <Textarea
                            value={form[g.key]}
                            onChange={e => setField(g.key, e.target.value)}
                            rows={4}
                        />
                    </div>
                ))}
            </div>
        </fieldset>
    );
}
