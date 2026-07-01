import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { specificationsApi } from '@/services/specifications-api';
import { useAuth } from '@/contexts/AuthContext';
import type { SectionProps } from '../types';

export function IdentificationSection({ form, setField, mode, isImported, errors }: SectionProps) {
    const { token } = useAuth();
    const [open, setOpen] = useState(false);
    const { data } = useQuery({
        queryKey: ['specifications'],
        queryFn: () => specificationsApi.getSpecifications(token!),
        enabled: !!token
    });

    const specifications = data?.specifications || [];

    const handleSpecChange = (specId: string) => {
        setField('specificationId', specId === 'none' ? undefined : specId);
        
        if (specId !== 'none') {
            const spec = specifications.find((s: any) => s.id === specId);
            if (spec) {
                if (!form.make) setField('make', spec.brand || '');
                if (!form.model) setField('model', spec.model || '');
                if (!form.version) setField('version', spec.version || '');
                if (!form.productionYear) setField('productionYear', String(spec.manufacturingYear || ''));
                
                setField('condition', spec.condition || 'NEW');

                if (!form.bodyType && spec.bodyType) setField('bodyType', spec.bodyType);
                if (!form.fuelType && spec.fuelType) setField('fuelType', spec.fuelType);
                if (!form.transmission && spec.transmission) setField('transmission', spec.transmission);
                if (!form.enginePowerHp && spec.enginePowerHp) setField('enginePowerHp', String(spec.enginePowerHp));
                if (!form.engineCapacityCm3 && spec.engineCapacityCm3) setField('engineCapacityCm3', String(spec.engineCapacityCm3));
                if (!form.drive && spec.drive) setField('drive', spec.drive);
                if (!form.color && spec.color) setField('color', spec.color);
                
                if (!form.catalogPrice && spec.catalogPrice) setField('catalogPrice', String(spec.catalogPrice));
                
                if (!form.pricePln && spec.discountedPrice) setField('pricePln', String(spec.discountedPrice));
                else if (!form.pricePln && spec.catalogPrice) setField('pricePln', String(spec.catalogPrice));
                
                if (!form.providerId && spec.dealerId) setField('providerId', `dealer_${spec.dealerId}`);

                if (!form.equipmentAudioMultimedia && Array.isArray(spec.equipmentAudioMultimedia) && spec.equipmentAudioMultimedia.length) setField('equipmentAudioMultimedia', spec.equipmentAudioMultimedia.join('\n'));
                if (!form.equipmentSafety && Array.isArray(spec.equipmentSafety) && spec.equipmentSafety.length) setField('equipmentSafety', spec.equipmentSafety.join('\n'));
                if (!form.equipmentComfortExtras && Array.isArray(spec.equipmentComfortExtras) && spec.equipmentComfortExtras.length) setField('equipmentComfortExtras', spec.equipmentComfortExtras.join('\n'));
                if (!form.equipmentOther && Array.isArray(spec.equipmentOther) && spec.equipmentOther.length) setField('equipmentOther', spec.equipmentOther.join('\n'));

                // Images and PDF
                if (Array.isArray(spec.imageUrls) && spec.imageUrls.length) {
                    setField('imageUrls', spec.imageUrls);
                    if (!form.primaryImageUrl) {
                        setField('primaryImageUrl', spec.imageUrls[0]);
                    }
                }
                if (spec.specificationPdfUrl) setField('specificationPdfUrl', spec.specificationPdfUrl);
            }
        }
        setOpen(false);
    };

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
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-full justify-between font-normal text-left px-3"
                            >
                                {form.specificationId
                                    ? (() => {
                                          const s = specifications.find((s: any) => s.id === form.specificationId);
                                          return s ? `${s.brand} ${s.model} ${s.version} (${s.manufacturingYear}) - ${s.enginePowerHp}KM` : "Brak przypisanej specyfikacji";
                                      })()
                                    : "Brak przypisanej specyfikacji"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Szukaj specyfikacji..." />
                                <CommandList>
                                    <CommandEmpty>Nie znaleziono specyfikacji.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem
                                            value="none"
                                            onSelect={() => handleSpecChange('none')}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    !form.specificationId ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            Brak przypisanej specyfikacji
                                        </CommandItem>
                                        {specifications.map((s: any) => (
                                            <CommandItem
                                                key={s.id}
                                                value={`${s.brand} ${s.model} ${s.version} (${s.manufacturingYear}) - ${s.enginePowerHp}KM`}
                                                onSelect={() => handleSpecChange(s.id)}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        form.specificationId === s.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {s.brand} {s.model} {s.version} ({s.manufacturingYear}) - {s.enginePowerHp}KM
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
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
