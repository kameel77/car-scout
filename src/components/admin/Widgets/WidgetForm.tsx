import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function WidgetForm({ widget, onClose }: { widget: any, onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!widget;

  const [formData, setFormData] = React.useState({
    name: widget?.name || '',
    isActive: widget?.isActive ?? true,
    placement: widget?.placement || 'HOME',
    vehicleSources: widget?.vehicleSources || ['NEW', 'USED'],
    selectionMode: widget?.selectionMode || 'FEATURED',
    filterParams: widget?.filterParams || { bodyType: [], minPrice: '', maxPrice: '' }
  });

  const { token } = useAuth();
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (!token) throw new Error("Brak autoryzacji");
      if (isEditing) {
        return api.widgets.update(widget.id, data, token);
      } else {
        return api.widgets.create(data, token);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      toast({ title: isEditing ? 'Zaktualizowano widget' : 'Utworzono widget' });
      onClose();
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Błąd', description: err.message });
    }
  });

  const toggleSource = (src: string) => {
    setFormData(prev => ({
      ...prev,
      vehicleSources: prev.vehicleSources.includes(src) 
        ? prev.vehicleSources.filter((s: string) => s !== src)
        : [...prev.vehicleSources, src]
    }));
  };

  const setFilterParam = (key: string, val: any) => {
    setFormData(prev => ({
      ...prev,
      filterParams: {
        ...prev.filterParams,
        [key]: val
      }
    }));
  };

  const toggleFilterArray = (key: string, val: string) => {
    const list = formData.filterParams[key] || [];
    setFilterParam(key, list.includes(val) ? list.filter((x: string) => x !== val) : [...list, val]);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edytuj widget' : 'Dodaj nowy widget'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-8 mt-4">
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Nazwa wewnętrzna (dla Ciebie)</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
                placeholder="np. Polecane Suvy Wynajem"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Lokalizacja (Gdzie wyświetlamy)</Label>
              <Select 
                value={formData.placement} 
                onValueChange={(val) => setFormData({...formData, placement: val})}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOME">Strona Główna</SelectItem>
                  <SelectItem value="OFFER">Podstrona Oferty</SelectItem>
                  <SelectItem value="RENTAL">Podstrona Wynajmu</SelectItem>
                  <SelectItem value="STATIC">Własne Podstrony</SelectItem>
                  <SelectItem value="EXTERNAL">Zewnętrzny Serwis (Embed/iframe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch 
              checked={formData.isActive}
              onCheckedChange={(c) => setFormData({...formData, isActive: c})}
            />
            <Label>Aktywny (Wyświetlany)</Label>
          </div>

          <hr />

          <div className="space-y-3">
            <h3 className="text-md font-semibold">Skąd pobieramy pojazdy?</h3>
            <div className="flex gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox 
                  checked={formData.vehicleSources.includes('USED')}
                  onCheckedChange={() => toggleSource('USED')}
                />
                <span>Używane (Brokerskie)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox 
                  checked={formData.vehicleSources.includes('NEW')}
                  onCheckedChange={() => toggleSource('NEW')}
                />
                <span>Nowe (Brokerskie)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox 
                  checked={formData.vehicleSources.includes('RENTAL')}
                  onCheckedChange={() => toggleSource('RENTAL')}
                />
                <span>Wynajem Długoterminowy</span>
              </label>
            </div>
          </div>

          <hr />

          <div className="space-y-4">
            <h3 className="text-md font-semibold">Logika dobierania pojazdów</h3>
            <RadioGroup 
              value={formData.selectionMode} 
              onValueChange={(v) => setFormData({...formData, selectionMode: v})}
              className="flex flex-col space-y-2"
            >
              <div className="flex items-start space-x-3 p-3 border rounded-md">
                <RadioGroupItem value="FEATURED" id="r1" className="mt-1" />
                <div>
                  <Label htmlFor="r1" className="text-base font-medium">Polecane (Oznaczone ikoną żółtej gwiazdki)</Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Widget wyświetli tylko te pojazdy z wybranych źródeł, które ręcznie polubiłeś w zakładce aut klikając na gwiazdkę ulubionych.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded-md">
                <RadioGroupItem value="FILTERED" id="r2" className="mt-1" />
                <div className="w-full">
                  <Label htmlFor="r2" className="text-base font-medium">Algorytm / Konkretne Filtry</Label>
                  <p className="text-sm text-gray-500 mt-1 mb-4">
                    Widget dobierze pojazdy automatycznie bazując na kryteriach które wycelujesz poniżej (np. tylko elektryki, tylko SUVy, zakres cen).
                  </p>

                  {formData.selectionMode === 'FILTERED' && (
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md border mt-2">
                      <div className="space-y-2">
                        <Label>Nadwozie</Label>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {['SUV', 'Sedan', 'Kombi', 'Hatchback', 'Coupe', 'Cabrio', 'Van', 'Pickup', 'Dostawczy', 'Ciężarowy'].map(bt => (
                            <label key={bt} className="flex items-center gap-2">
                               <Checkbox 
                                 checked={(formData.filterParams.bodyType || []).includes(bt)}
                                 onCheckedChange={() => toggleFilterArray('bodyType', bt)}
                               />
                               {bt}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                         <div className="grid grid-cols-2 gap-2">
                           <div className="space-y-1">
                             <Label>Cena Od (PLN)</Label>
                             <Input 
                               type="number" 
                               value={formData.filterParams.minPrice || ''}
                               onChange={e => setFilterParam('minPrice', e.target.value)}
                             />
                           </div>
                           <div className="space-y-1">
                             <Label>Cena Do (PLN)</Label>
                             <Input 
                               type="number" 
                               value={formData.filterParams.maxPrice || ''}
                               onChange={e => setFilterParam('maxPrice', e.target.value)}
                             />
                           </div>
                         </div>
                         <div className="space-y-1">
                           <Label>Rocznik Od</Label>
                           <Input 
                             type="number" 
                             value={formData.filterParams.minYear || ''}
                             onChange={e => setFilterParam('minYear', e.target.value)}
                             placeholder="np. 2020"
                           />
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Zapisywanie...' : 'Zapisz widget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
