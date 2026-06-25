import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { specificationsApi } from '@/services/specifications-api';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, Save, ArrowLeft, UploadCloud, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { ImagesSection } from '@/components/admin/VehicleForm/sections/ImagesSection';

export default function SpecificationEditPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const { config } = useBrand();
    const queryClient = useQueryClient();

    const [parsingPdf, setParsingPdf] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['specification', id],
        queryFn: () => specificationsApi.getSpecification(id!, token!),
        enabled: !!token && !!id
    });

    const [formData, setFormData] = useState<any>(null);

    React.useEffect(() => {
        if (data?.specification && !formData) {
            setFormData(data.specification);
        }
    }, [data, formData]);

    const updateMutation = useMutation({
        mutationFn: (updateData: any) => specificationsApi.updateSpecification(id!, updateData, token!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['specification', id] });
            queryClient.invalidateQueries({ queryKey: ['specifications'] });
            toast.success('Zapisano pomyślnie');
        },
        onError: () => {
            toast.error('Błąd zapisu specyfikacji');
        }
    });

    const parseNumber = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const parsed = parseInt(val.replace(/\s/g, ''), 10);
            return isNaN(parsed) ? null : parsed;
        }
        return null;
    };

    const handleSave = () => {
        if (!formData) return;
        updateMutation.mutate({
            displayMode: formData.displayMode,
            brand: formData.brand,
            model: formData.model,
            version: formData.version,
            color: formData.color,
            manufacturingYear: parseNumber(formData.manufacturingYear),
            enginePowerHp: parseNumber(formData.enginePowerHp),
            engineCapacityCm3: parseNumber(formData.engineCapacityCm3),
            fuelType: formData.fuelType,
            transmission: formData.transmission,
            drive: formData.drive,
            bodyType: formData.bodyType,
            catalogPrice: parseNumber(formData.catalogPrice),
            discountedPrice: parseNumber(formData.discountedPrice),
            equipmentAudioMultimedia: typeof formData.equipmentAudioMultimedia === 'string' 
                ? formData.equipmentAudioMultimedia.split('\n').filter(Boolean) 
                : formData.equipmentAudioMultimedia,
            equipmentSafety: typeof formData.equipmentSafety === 'string' 
                ? formData.equipmentSafety.split('\n').filter(Boolean) 
                : formData.equipmentSafety,
            equipmentComfortExtras: typeof formData.equipmentComfortExtras === 'string' 
                ? formData.equipmentComfortExtras.split('\n').filter(Boolean) 
                : formData.equipmentComfortExtras,
            equipmentOther: typeof formData.equipmentOther === 'string' 
                ? formData.equipmentOther.split('\n').filter(Boolean) 
                : formData.equipmentOther,
        });
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !token) return;

        try {
            setParsingPdf(true);
            toast.info('Trwa analizowanie PDF przez AI...');
            const res = await specificationsApi.parsePdf(file, token);
            
            if (res.data) {
                setFormData((prev: any) => ({
                    ...prev,
                    brand: res.data.brand || prev.brand,
                    model: res.data.model || prev.model,
                    version: res.data.version || prev.version,
                    color: res.data.color || prev.color,
                    manufacturingYear: res.data.manufacturingYear || prev.manufacturingYear,
                    enginePowerHp: res.data.enginePowerHp || prev.enginePowerHp,
                    engineCapacityCm3: res.data.engineCapacityCm3 || prev.engineCapacityCm3,
                    fuelType: res.data.fuelType || prev.fuelType,
                    transmission: res.data.transmission || prev.transmission,
                    drive: res.data.drive || prev.drive,
                    bodyType: res.data.bodyType || prev.bodyType,
                    catalogPrice: res.data.catalogPrice || prev.catalogPrice,
                    discountedPrice: res.data.discountedPrice || prev.discountedPrice,
                    equipmentAudioMultimedia: res.data.equipmentAudioMultimedia || prev.equipmentAudioMultimedia,
                    equipmentSafety: res.data.equipmentSafety || prev.equipmentSafety,
                    equipmentComfortExtras: res.data.equipmentComfortExtras || prev.equipmentComfortExtras,
                    equipmentOther: res.data.equipmentOther || prev.equipmentOther,
                }));
                toast.success('Dane zostały wyodrębnione i wstawione do formularza. Zweryfikuj i zapisz.');
            }
        } catch (error: any) {
            toast.error(error.message || 'Błąd parsowania PDF');
        } finally {
            setParsingPdf(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (isLoading || !formData) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const formatArrayForTextarea = (val: string[] | string | undefined) => {
        if (!val) return '';
        if (Array.isArray(val)) return val.join('\n');
        return val;
    };

    return (
        <div className="space-y-6 max-w-6xl pb-24">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => navigate('/admin/specifications')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Edycja Specyfikacji
                        </h1>
                        <p className="text-muted-foreground">Aktualizuj szablon wyposażenia i dane techniczne</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button 
                        onClick={handleSave} 
                        disabled={updateMutation.isPending}
                        className="bg-slate-900 hover:bg-slate-800"
                    >
                        {updateMutation.isPending ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Zapisz zmiany
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="pb-4 border-b">
                            <CardTitle className="text-lg">Identyfikacja Pojazdu</CardTitle>
                            <CardDescription>
                                Podstawowe dane określające markę, model i wersję specyfikacji.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Marka</Label>
                                    <Input 
                                        value={formData.brand || ''} 
                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })} 
                                        placeholder="np. Ford"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Model</Label>
                                    <Input 
                                        value={formData.model || ''} 
                                        onChange={(e) => setFormData({ ...formData, model: e.target.value })} 
                                        placeholder="np. Kuga"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Wersja (Trim)</Label>
                                    <Input 
                                        value={formData.version || ''} 
                                        onChange={(e) => setFormData({ ...formData, version: e.target.value })} 
                                        placeholder="np. ST-Line"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kolor nadwozia</Label>
                                    <Input 
                                        value={formData.color || ''} 
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })} 
                                        placeholder="np. Biały"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Rok produkcji</Label>
                                    <Input 
                                        type="number"
                                        value={formData.manufacturingYear || ''} 
                                        onChange={(e) => setFormData({ ...formData, manufacturingYear: e.target.value })} 
                                        placeholder="np. 2024"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-4 border-b">
                            <CardTitle className="text-lg">Dane Techniczne</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Pojemność silnika (cm³)</Label>
                                    <Input 
                                        type="number"
                                        value={formData.engineCapacityCm3 || ''} 
                                        onChange={(e) => setFormData({ ...formData, engineCapacityCm3: e.target.value })} 
                                        placeholder="np. 1998"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Moc silnika (KM)</Label>
                                    <Input 
                                        type="number"
                                        value={formData.enginePowerHp || ''} 
                                        onChange={(e) => setFormData({ ...formData, enginePowerHp: e.target.value })} 
                                        placeholder="np. 150"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Rodzaj paliwa</Label>
                                    <Input 
                                        value={formData.fuelType || ''} 
                                        onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })} 
                                        placeholder="np. Hybryda"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Skrzynia biegów</Label>
                                    <Input 
                                        value={formData.transmission || ''} 
                                        onChange={(e) => setFormData({ ...formData, transmission: e.target.value })} 
                                        placeholder="np. Automatyczna"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Napęd</Label>
                                    <Input 
                                        value={formData.drive || ''} 
                                        onChange={(e) => setFormData({ ...formData, drive: e.target.value })} 
                                        placeholder="np. 4x4"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Rodzaj nadwozia</Label>
                                    <Input 
                                        value={formData.bodyType || ''} 
                                        onChange={(e) => setFormData({ ...formData, bodyType: e.target.value })} 
                                        placeholder="np. SUV"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-4 border-b">
                            <CardTitle className="text-lg">Zarządzanie Wyposażeniem</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="font-semibold">Bezpieczeństwo</Label>
                                    <Textarea 
                                        rows={8}
                                        value={formatArrayForTextarea(formData.equipmentSafety)}
                                        onChange={(e) => setFormData({ ...formData, equipmentSafety: e.target.value })}
                                        placeholder="ABS&#10;Poduszki powietrzne..."
                                        className="resize-y"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold">Komfort i Dodatki</Label>
                                    <Textarea 
                                        rows={8}
                                        value={formatArrayForTextarea(formData.equipmentComfortExtras)}
                                        onChange={(e) => setFormData({ ...formData, equipmentComfortExtras: e.target.value })}
                                        placeholder="Klimatyzacja&#10;Podgrzewane fotele..."
                                        className="resize-y"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold">Audio i Multimedia</Label>
                                    <Textarea 
                                        rows={8}
                                        value={formatArrayForTextarea(formData.equipmentAudioMultimedia)}
                                        onChange={(e) => setFormData({ ...formData, equipmentAudioMultimedia: e.target.value })}
                                        placeholder="Nawigacja&#10;Bluetooth..."
                                        className="resize-y"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold">Inne (np. Wygląd Zewnętrzny)</Label>
                                    <Textarea 
                                        rows={8}
                                        value={formatArrayForTextarea(formData.equipmentOther)}
                                        onChange={(e) => setFormData({ ...formData, equipmentOther: e.target.value })}
                                        placeholder="Felgi aluminiowe 18'&#10;Przyciemniane szyby..."
                                        className="resize-y"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-blue-200 bg-blue-50/50">
                        <CardHeader className="pb-4 border-b border-blue-100">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <CardTitle className="text-lg text-blue-900">Import z PDF</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <p className="text-sm text-blue-800">
                                Wgraj dokument PDF ze specyfikacją. Sztuczna Inteligencja uzupełni wszystkie pola na tej stronie (marka, dane techniczne, wyposażenie).
                            </p>
                            <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handlePdfUpload}
                            />
                            <Button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={parsingPdf}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {parsingPdf ? (
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <UploadCloud className="w-4 h-4 mr-2" />
                                )}
                                {parsingPdf ? 'Przetwarzanie...' : 'Wybierz specyfikację PDF'}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-4 border-b">
                            <CardTitle className="text-lg">Ceny bazowe</CardTitle>
                            <CardDescription>
                                Wyciągnięte ze specyfikacji, pomagają przy mapowaniu
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="space-y-2">
                                <Label>Cena katalogowa (PLN)</Label>
                                <Input 
                                    type="number"
                                    value={formData.catalogPrice || ''} 
                                    onChange={(e) => setFormData({ ...formData, catalogPrice: e.target.value })} 
                                    placeholder="np. 150000"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Cena z uwzględnionym rabatem / Do finansowania (PLN)</Label>
                                <Input 
                                    type="number"
                                    value={formData.discountedPrice || ''} 
                                    onChange={(e) => setFormData({ ...formData, discountedPrice: e.target.value })} 
                                    placeholder="np. 135000"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-4 border-b">
                            <CardTitle className="text-lg">Zdjęcia i Galeria</CardTitle>
                            <CardDescription>Zdjęcia poglądowe dla tej specyfikacji</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <ImagesSection
                                mode="specification"
                                vehicleId={id}
                                imageUrls={formData.imageUrls || []}
                                primaryImageUrl={null}
                                onUpdated={({ imageUrls }) => setFormData({ ...formData, imageUrls })}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-4 border-b">
                            <CardTitle className="text-lg">Ustawienia</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="space-y-2">
                                <Label>Tryb Wyświetlania (Grupowanie)</Label>
                                <Select
                                    value={formData.displayMode}
                                    onValueChange={(val) => setFormData({ ...formData, displayMode: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wybierz tryb" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="GROUPED">Grupowanie (GROUPED)</SelectItem>
                                        <SelectItem value="ALL">Wszystkie pojedynczo (ALL)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500 mt-1">
                                    {formData.displayMode === 'GROUPED' 
                                        ? 'Tylko jedna (reprezentatywna) oferta pokaże się na liście.' 
                                        : 'Wszystkie auta z tą specyfikacją pokażą się na liście osobno.'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
