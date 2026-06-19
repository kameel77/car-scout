import { Input } from '@/components/ui/input';
import type { SectionProps } from '../types';

export function IdentificationSection({ form, setField, mode, isImported, errors }: SectionProps) {
    return (
        <fieldset disabled={isImported} className={isImported ? 'opacity-60' : ''}>
            {isImported && (
                <p className="text-xs text-amber-700 mb-2">
                    Pola pochodzą z importu CSV/CSFlow i są zarządzane automatycznie.
                </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Marka *</label>
                    <Input value={form.make} onChange={e => setField('make', e.target.value)} required placeholder="np. BMW" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Model *</label>
                    <Input value={form.model} onChange={e => setField('model', e.target.value)} required placeholder="np. X3" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Wersja</label>
                    <Input value={form.version} onChange={e => setField('version', e.target.value)} placeholder="np. xDrive20d" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Rok produkcji *</label>
                    <Input type="number" value={form.productionYear} onChange={e => setField('productionYear', e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">VIN</label>
                    <Input 
                        value={form.vin} 
                        onChange={e => setField('vin', e.target.value.toUpperCase())} 
                        placeholder="17 znaków" 
                        maxLength={17} 
                        className={errors?.vin ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {errors?.vin && <p className="text-xs text-red-600">{errors.vin}</p>}
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Stan *</label>
                    <div className="flex gap-4 pt-2">
                        <label className="flex items-center gap-2">
                            <input type="radio" checked={form.condition === 'NEW'} onChange={() => setField('condition', 'NEW')} />
                            <span>Nowy</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="radio" checked={form.condition === 'USED'} onChange={() => setField('condition', 'USED')} />
                            <span>Używany</span>
                        </label>
                    </div>
                </div>
            </div>
        </fieldset>
    );
}
