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
import { RefreshCw, Save, ArrowLeft, UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

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

    const handleSave = () => {
        if (!formData) return;
        updateMutation.mutate({
            displayMode: formData.displayMode,
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
            
            if (res.equipment) {
                setFormData((prev: any) => ({
                    ...prev,
                    equipmentAudioMultimedia: res.equipment.equipmentAudioMultimedia || prev.equipmentAudioMultimedia,
                    equipmentSafety: res.equipment.equipmentSafety || prev.equipmentSafety,
                    equipmentComfortExtras: res.equipment.equipmentComfortExtras || prev.equipmentComfortExtras,
                    equipmentOther: res.equipment.equipmentOther || prev.equipmentOther,
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
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate('/admin/specifications')}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        {formData.brand} {formData.model}
                    </h1>
                    <p className="text-muted-foreground">{formData.version} ({formData.manufacturingYear})</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">Zarządzanie Wyposażeniem</CardTitle>
                            <CardDescription>
                                Możesz wpisać wyposażenie ręcznie (każdy element w nowej linii) lub zaimportować dane z dealerskiego pliku PDF za pomocą wbudowanego modułu AI.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {config.features?.pdfImport !== false && (
                                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-blue-100 rounded-md text-blue-600">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-blue-900">Inteligentny Import z PDF</h3>
                                            <p className="text-sm text-blue-700/80 max-w-md">
                                                Wgraj wycenę dealera w PDF, a sztuczna inteligencja automatycznie wyodrębni wyposażenie i posegreguje je w odpowiednie kategorie.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ml-4 shrink-0">
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
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            {parsingPdf ? (
                                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <UploadCloud className="w-4 h-4 mr-2" />
                                            )}
                                            {parsingPdf ? 'Przetwarzanie...' : 'Wybierz plik PDF'}
                                        </Button>
                                    </div>
                                </div>
                            )}

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
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">Parametry Wyświetlania</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                                        ? 'Tylko jedna (reprezentatywna) oferta dla tego modelu pokaże się na liście.' 
                                        : 'Wszystkie auta z tą specyfikacją pokażą się na liście osobno (np. dla aut używanych).'}
                                </p>
                            </div>

                            <div className="pt-4 mt-4 border-t">
                                <Button 
                                    className="w-full" 
                                    onClick={handleSave} 
                                    disabled={updateMutation.isPending}
                                >
                                    {updateMutation.isPending ? (
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    Zapisz zmiany
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">Informacje o silniku</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-slate-600">
                            <div className="flex justify-between border-b pb-2">
                                <span>Paliwo</span>
                                <span className="font-medium text-slate-900">{formData.fuelType || '-'}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>Pojemność</span>
                                <span className="font-medium text-slate-900">{formData.engineCapacityCm3 ? `${formData.engineCapacityCm3} cm³` : '-'}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>Moc</span>
                                <span className="font-medium text-slate-900">{formData.enginePowerHp ? `${formData.enginePowerHp} KM` : '-'}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>Skrzynia biegów</span>
                                <span className="font-medium text-slate-900">{formData.transmission || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Napęd</span>
                                <span className="font-medium text-slate-900">{formData.drive || '-'}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
