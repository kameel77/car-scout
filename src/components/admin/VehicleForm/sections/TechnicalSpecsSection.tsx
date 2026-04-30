import { Input } from '@/components/ui/input';
import type { SectionProps } from '../types';

const BODY_TYPES = ['SUV', 'Sedan', 'Kombi', 'Hatchback', 'Coupe', 'Kabriolet', 'Van', 'Pickup'];
const FUEL_TYPES = ['Benzyna', 'Diesel', 'Hybryda', 'Plug-in Hybrid', 'Elektryczny', 'LPG'];

export function TechnicalSpecsSection({ form, setField, isImported }: SectionProps) {
    return (
        <fieldset disabled={isImported} className={isImported ? 'opacity-60' : ''}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Typ nadwozia</label>
                    <select value={form.bodyType} onChange={e => setField('bodyType', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm">
                        <option value="">Wybierz</option>
                        {BODY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Paliwo</label>
                    <select value={form.fuelType} onChange={e => setField('fuelType', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm">
                        <option value="">Wybierz</option>
                        {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Skrzynia biegów</label>
                    <select value={form.transmission} onChange={e => setField('transmission', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm">
                        <option value="">Wybierz</option>
                        <option value="Automatyczna">Automatyczna</option>
                        <option value="Manualna">Manualna</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Moc (KM)</label>
                    <Input type="number" value={form.enginePowerHp} onChange={e => setField('enginePowerHp', e.target.value)} placeholder="np. 190" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Pojemność (cm³)</label>
                    <Input type="number" value={form.engineCapacityCm3} onChange={e => setField('engineCapacityCm3', e.target.value)} placeholder="np. 1998" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Napęd</label>
                    <select value={form.drive} onChange={e => setField('drive', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm">
                        <option value="">Wybierz</option>
                        <option value="Przedni">Przedni</option>
                        <option value="Tylny">Tylny</option>
                        <option value="4x4">4x4</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Drzwi</label>
                    <Input type="number" value={form.doors} onChange={e => setField('doors', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Miejsca</label>
                    <Input type="number" value={form.seats} onChange={e => setField('seats', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Kolor</label>
                    <Input value={form.color} onChange={e => setField('color', e.target.value)} placeholder="np. Czarny" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Rodzaj lakieru</label>
                    <Input value={form.paintType} onChange={e => setField('paintType', e.target.value)} placeholder="np. Metalik" />
                </div>
            </div>
        </fieldset>
    );
}
