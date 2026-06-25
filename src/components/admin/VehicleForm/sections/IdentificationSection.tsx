import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { specificationsApi } from '@/services/specifications-api';
import { useAuth } from '@/contexts/AuthContext';
import type { SectionProps } from '../types';

export function IdentificationSection({ form, setField, mode, isImported, errors }: SectionProps) {
    const { token } = useAuth();
    const { data } = useQuery({
        queryKey: ['specifications'],
        queryFn: () => specificationsApi.getSpecifications(token!),
        enabled: !!token
    });

    const specifications = data?.specifications || [];
    return (
        <fieldset disabled={isImported} className={isImported ? 'opacity-60' : ''}>
            {isImported && (
                <p className="text-xs text-amber-700 mb-2">
                    Pola pochodzą z importu CSV/CSFlow i są zarządzane automatycznie.
                </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                    <label className="text-sm font-medium text-gray-700">Wybierz Specyfikację (Opcjonalnie)</label>
                    <p className="text-xs text-gray-500 mb-1">Połączenie oferty ze specyfikacją pobierze do niej zdjęcia wyposażenie wg. PDF.</p>
                    <Select value={form.specificationId || 'none'} onValueChange={v => setField('specificationId', v === 'none' ? undefined : v)}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Brak przypisanej specyfikacji" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Brak przypisanej specyfikacji</SelectItem>
                            {specifications.map((s: any) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.brand} {s.model} {s.version} ({s.manufacturingYear}) - {s.enginePowerHp}KM
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
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
