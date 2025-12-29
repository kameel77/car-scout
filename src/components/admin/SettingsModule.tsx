import React from 'react';
import { settingsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Languages, Coins, Percent, RefreshCw, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function SettingsModule() {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [settings, setSettings] = React.useState<any>(null);

    React.useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const data = await settingsApi.getSettings();
            setSettings(data);
        } catch (error) {
            toast.error('Błąd podczas pobierania ustawień');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!token) return;
        try {
            setSaving(true);
            const updated = await settingsApi.updateSettings(settings, token);
            setSettings(updated);
            await queryClient.invalidateQueries({ queryKey: ['appSettings'] });
            await queryClient.invalidateQueries({ queryKey: ['listings'] });
            await queryClient.invalidateQueries({ queryKey: ['listing'] });
            console.log('Settings saved and caches invalidated');
            toast.success('Ustawienia zostały zapisane');
        } catch (error) {
            toast.error('Błąd podczas zapisywania ustawień');
        } finally {
            setSaving(false);
        }
    };


    const toggleLanguage = (lang: string) => {
        const current = settings.enabledLanguages || [];
        const next = current.includes(lang)
            ? current.filter((l: string) => l !== lang)
            : [...current, lang];

        if (next.length === 0) return; // Must have at least one language
        setSettings({ ...settings, enabledLanguages: next });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* General Settings */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Languages className="w-5 h-5 text-blue-500" />
                        Konfiguracja Ogólna
                    </CardTitle>
                    <CardDescription>Wybierz języki i walutę wyświetlania na frontendzie.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Languages */}
                    <div className="space-y-3">
                        <Label className="text-sm font-bold">Dostępne języki</Label>
                        <div className="flex flex-wrap gap-4 pt-1">
                            {['pl', 'en', 'de'].map((lang) => (
                                <div key={lang} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`lang-${lang}`}
                                        checked={settings.enabledLanguages.includes(lang)}
                                        onCheckedChange={() => toggleLanguage(lang)}
                                    />
                                    <label
                                        htmlFor={`lang-${lang}`}
                                        className="text-sm font-medium leading-none cursor-pointer uppercase"
                                    >
                                        {lang}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Currency */}
                    <div className="space-y-3">
                        <Label className="text-sm font-bold">Główna waluta wyświetlania</Label>
                        <Select
                            value={settings.displayCurrency}
                            onValueChange={(val) => setSettings({ ...settings, displayCurrency: val })}
                        >
                            <SelectTrigger className="w-full bg-white">
                                <SelectValue placeholder="Wybierz walutę" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PLN">PLN (Złoty)</SelectItem>
                                <SelectItem value="EUR">EUR (Euro)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Zapisz Ustawienia
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Pricing & Fees */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Coins className="w-5 h-5 text-amber-500" />
                        Finanse i Marże
                    </CardTitle>
                    <CardDescription>Ustaw kursy walut oraz prowizje brokerskie.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <Label className="text-sm font-bold">Kurs EUR (PLN)</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={settings.eurExRate}
                                    onChange={(e) => setSettings({ ...settings, eurExRate: e.target.value })}
                                    className="bg-white pr-10"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">PLN</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-bold">Marża PLN (%)</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={settings.brokerFeePctPln}
                                    onChange={(e) => setSettings({ ...settings, brokerFeePctPln: e.target.value })}
                                    className="bg-white pr-8"
                                />
                                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3 col-start-2">
                            <Label className="text-sm font-bold">Marża EUR (%)</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={settings.brokerFeePctEur}
                                    onChange={(e) => setSettings({ ...settings, brokerFeePctEur: e.target.value })}
                                    className="bg-white pr-8"
                                />
                                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            </div>
                        </div>
                    </div>

                    {/* Automatic update info */}
                    <div className="mt-4 pt-6 border-t border-slate-100">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200/50">
                            <div className="flex gap-3">
                                <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
                                <div className="text-xs text-slate-600 space-y-1">
                                    <p className="font-bold text-blue-700">Inteligentna aktualizacja</p>
                                    <p>Ceny wszystkich ofert są automatycznie przeliczane natychmiast po kliknięciu <strong>"Zapisz Ustawienia"</strong>. Nie musisz już robić tego ręcznie.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
