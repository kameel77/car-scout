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
import { Languages, Coins, Percent, RefreshCw, Save, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';

type LegalDocKey = 'imprint' | 'privacyPolicy' | 'terms' | 'cookies';
type LegalDocumentsState = Record<LegalDocKey, Record<string, string>>;

const LEGAL_LANGUAGES = [
    { code: 'pl', label: 'PL' },
    { code: 'en', label: 'EN' },
    { code: 'de', label: 'DE' }
] as const;

const LEGAL_DOCS: { key: LegalDocKey; label: string; helper: string }[] = [
    { key: 'imprint', label: 'Impressum / Imprint', helper: 'Wymagane w DE – dane firmy + kontakt' },
    { key: 'privacyPolicy', label: 'Polityka prywatności', helper: 'RODO / GDPR' },
    { key: 'terms', label: 'Regulamin / AGB', helper: 'Zasady korzystania z serwisu' },
    { key: 'cookies', label: 'Polityka cookies', helper: 'Informacja o plikach cookie' }
];

const withLegalDocs = (raw: any): LegalDocumentsState => ({
    imprint: { ...(raw?.imprint || {}) },
    privacyPolicy: { ...(raw?.privacyPolicy || {}) },
    terms: { ...(raw?.terms || {}) },
    cookies: { ...(raw?.cookies || {}) }
});

export function SettingsModule() {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const { priceType, setPriceType } = usePriceSettings();
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [settings, setSettings] = React.useState<any>(null);
    const [logoUploading, setLogoUploading] = React.useState<{ header: boolean; footer: boolean }>({ header: false, footer: false });
    const headerInputRef = React.useRef<HTMLInputElement | null>(null);
    const footerInputRef = React.useRef<HTMLInputElement | null>(null);

    const normalizeSettings = (data: any) => ({
        ...data,
        enabledLanguages: data?.enabledLanguages || ['pl'],
        displayCurrency: data?.displayCurrency || 'PLN',
        autoRefreshImages: Boolean(data?.autoRefreshImages),
        legalDocuments: withLegalDocs(data?.legalDocuments),
        legalSloganPl: data?.legalSloganPl || '',
        legalSloganEn: data?.legalSloganEn || '',
        legalSloganDe: data?.legalSloganDe || '',
        headerLogoTextPl: data?.headerLogoTextPl || '',
        headerLogoTextEn: data?.headerLogoTextEn || '',
        headerLogoTextDe: data?.headerLogoTextDe || ''
    });

    const fetchSettings = React.useCallback(async () => {
        try {
            setLoading(true);
            const data = await settingsApi.getSettings();
            setSettings(normalizeSettings(data));
        } catch (error) {
            toast.error('Błąd podczas pobierania ustawień');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleSave = async () => {
        if (!token) return;
        try {
            setSaving(true);
            const updated = await settingsApi.updateSettings(settings, token);
            setSettings(normalizeSettings(updated));
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

    const handleLegalDocChange = (docKey: LegalDocKey, lang: string, value: string) => {
        setSettings((prev: any) => {
            const legalDocs = withLegalDocs(prev?.legalDocuments);
            return {
                ...prev,
                legalDocuments: {
                    ...legalDocs,
                    [docKey]: {
                        ...(legalDocs as Record<string, Record<string, string>>)[docKey],
                        [lang]: value
                    }
                }
            };
        });
    };

    const handleLogoUpload = async (target: 'header' | 'footer', file: File | null) => {
        if (!file || !token) return;
        try {
            setLogoUploading((prev) => ({ ...prev, [target]: true }));
            const { url } = await settingsApi.uploadLogo(file, target, token);
            setSettings((prev: any) => ({
                ...prev,
                [`${target}LogoUrl`]: url
            }));
            toast.success(`Logo (${target}) zapisane`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać logo');
        } finally {
            setLogoUploading((prev) => ({ ...prev, [target]: false }));
            // reset input value so the same file can be reselected if needed
            if (target === 'header' && headerInputRef.current) headerInputRef.current.value = '';
            if (target === 'footer' && footerInputRef.current) footerInputRef.current.value = '';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="p-8 text-center text-sm text-muted-foreground">
                Nie udało się załadować ustawień.
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
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-sm font-bold flex items-center gap-2">
                                <Upload className="w-4 h-4 text-slate-500" />
                                Logo serwisu (header)
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={settings.headerLogoUrl || ''}
                                    onChange={(e) => setSettings({ ...settings, headerLogoUrl: e.target.value })}
                                    placeholder="https://cdn.example.com/logo-header.png"
                                    className="bg-white"
                                />
                                <div className="inline-flex">
                                    <input
                                        ref={headerInputRef}
                                        type="file"
                                        accept=".png,.jpg,.jpeg,.svg,.webp"
                                        className="hidden"
                                        onChange={(e) => handleLogoUpload('header', e.target.files?.[0] || null)}
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={logoUploading.header}
                                        onClick={() => headerInputRef.current?.click()}
                                    >
                                        {logoUploading.header ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Upload'}
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                Zalecane: PNG/SVG, minimum 200px szerokości, tło przezroczyste.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold flex items-center gap-2">
                                <Upload className="w-4 h-4 text-slate-500" />
                                Logo w stopce
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={settings.footerLogoUrl || ''}
                                    onChange={(e) => setSettings({ ...settings, footerLogoUrl: e.target.value })}
                                    placeholder="https://cdn.example.com/logo-footer.png"
                                    className="bg-white"
                                />
                                <div className="inline-flex">
                                    <input
                                        ref={footerInputRef}
                                        type="file"
                                        accept=".png,.jpg,.jpeg,.svg,.webp"
                                        className="hidden"
                                        onChange={(e) => handleLogoUpload('footer', e.target.files?.[0] || null)}
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={logoUploading.footer}
                                        onClick={() => footerInputRef.current?.click()}
                                    >
                                        {logoUploading.footer ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Upload'}
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                Zalecane: jasna wersja PNG/SVG, ok. 200x60 px, tło przezroczyste.
                            </p>
                        </div>
                    </div>
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

                    {/* Auto image refresh */}
                    <div className="space-y-3">
                        <Label className="text-sm font-bold">Automatyczne sprawdzanie zdjęć</Label>
                        <div className="flex items-center space-x-3 p-3 rounded-lg border bg-slate-50">
                            <Checkbox
                                id="auto-refresh-images"
                                checked={Boolean(settings.autoRefreshImages)}
                                onCheckedChange={(val) => setSettings({ ...settings, autoRefreshImages: Boolean(val) })}
                            />
                            <div className="space-y-1">
                                <label htmlFor="auto-refresh-images" className="font-medium cursor-pointer">
                                    Sprawdzaj zdjęcia po otwarciu oferty
                                </label>
                                <p className="text-xs text-slate-600">
                                    Przy braku ładujących się zdjęć spróbujemy je automatycznie odświeżyć (wymaga zalogowania).
                                </p>
                            </div>
                        </div>
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

                    <div className="space-y-3">
                        <Label className="text-sm font-bold">Domyślny typ ceny (podstawowy)</Label>
                        <Select
                            value={priceType}
                            onValueChange={(val) => setPriceType(val as 'gross' | 'net')}
                        >
                            <SelectTrigger className="w-full bg-white">
                                <SelectValue placeholder="Wybierz typ ceny" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="gross">Brutto (z VAT)</SelectItem>
                                <SelectItem value="net">Netto (bez VAT)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                            Określa, która cena będzie wyświetlana jako główna (większa) w serwisie.
                        </p>
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

            {/* Legal & Compliance */}
            <Card className="shadow-sm border-slate-200 md:col-span-2">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        Zgodność prawna i dokumenty
                    </CardTitle>
                    <CardDescription>Wymagane informacje dla stopki (Impressum, polityki) zgodnie z wymogami DE/UE.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Pełna nazwa podmiotu</Label>
                            <Input
                                value={settings.legalCompanyName || ''}
                                onChange={(e) => setSettings({ ...settings, legalCompanyName: e.target.value })}
                                placeholder="Nazwa spółki / firmy"
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Adres rejestrowy / korespondencyjny</Label>
                            <Input
                                value={settings.legalAddress || ''}
                                onChange={(e) => setSettings({ ...settings, legalAddress: e.target.value })}
                                placeholder="Ulica, kod, miasto, kraj"
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Email kontaktowy</Label>
                            <Input
                                type="email"
                                value={settings.legalContactEmail || ''}
                                onChange={(e) => setSettings({ ...settings, legalContactEmail: e.target.value })}
                                placeholder="compliance@twojadomena.com"
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Telefon kontaktowy</Label>
                            <Input
                                value={settings.legalContactPhone || ''}
                                onChange={(e) => setSettings({ ...settings, legalContactPhone: e.target.value })}
                                placeholder="+49 ..."
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">NIP / VAT ID</Label>
                            <Input
                                value={settings.legalVatId || ''}
                                onChange={(e) => setSettings({ ...settings, legalVatId: e.target.value })}
                                placeholder="DE999999999"
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Numer rejestrowy (KRS/Handelsregister)</Label>
                            <Input
                                value={settings.legalRegisterNumber || ''}
                                onChange={(e) => setSettings({ ...settings, legalRegisterNumber: e.target.value })}
                                placeholder="HRB 123456"
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Osoba reprezentująca</Label>
                            <Input
                                value={settings.legalRepresentative || ''}
                                onChange={(e) => setSettings({ ...settings, legalRepresentative: e.target.value })}
                                placeholder="Imię i nazwisko"
                                className="bg-white"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div className="text-sm text-slate-700">
                                Podaj linki do wersji PL/DE/EN. Brak linku ukryje pozycję w stopce dla danego języka. Dokument otworzy się w nowej karcie.
                            </div>
                        </div>
                        <div className="grid gap-4">
                            {LEGAL_DOCS.map((doc) => (
                                <div key={doc.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-foreground">{doc.label}</p>
                                            <p className="text-xs text-slate-500">{doc.helper}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                        {LEGAL_LANGUAGES.map((lang) => (
                                            <div key={`${doc.key}-${lang.code}`} className="space-y-2">
                                                <Label className="text-xs uppercase tracking-wide text-slate-600">
                                                    {lang.label}
                                                </Label>
                                                <Input
                                                    placeholder="https://twojadomena.com/dokument.pdf"
                                                    value={settings.legalDocuments?.[doc.key]?.[lang.code] || ''}
                                                    onChange={(e) => handleLegalDocChange(doc.key, lang.code, e.target.value)}
                                                    className="bg-white"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-semibold text-foreground">Tekst przy logo (Header)</p>
                                <p className="text-xs text-slate-500">Tekst wyświetlany obok logo w nagłówku (PL/EN/DE). Obsługuje znacznik &lt;br&gt;.</p>
                            </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3 mb-6">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-slate-600">PL</Label>
                                <Input
                                    value={settings.headerLogoTextPl || ''}
                                    onChange={(e) => setSettings({ ...settings, headerLogoTextPl: e.target.value })}
                                    placeholder="Tekst PL"
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-slate-600">EN</Label>
                                <Input
                                    value={settings.headerLogoTextEn || ''}
                                    onChange={(e) => setSettings({ ...settings, headerLogoTextEn: e.target.value })}
                                    placeholder="Text EN"
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-slate-600">DE</Label>
                                <Input
                                    value={settings.headerLogoTextDe || ''}
                                    onChange={(e) => setSettings({ ...settings, headerLogoTextDe: e.target.value })}
                                    placeholder="Text DE"
                                    className="bg-white"
                                />
                            </div>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-semibold text-foreground">Slogan przy logo</p>
                                <p className="text-xs text-slate-500">Hasło wspierające logotyp (PL/EN/DE). Pokazywane w stopce.</p>
                            </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-slate-600">PL</Label>
                                <Input
                                    value={settings.legalSloganPl || ''}
                                    onChange={(e) => setSettings({ ...settings, legalSloganPl: e.target.value })}
                                    placeholder="Twoje auto. Twój wybór."
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-slate-600">EN</Label>
                                <Input
                                    value={settings.legalSloganEn || ''}
                                    onChange={(e) => setSettings({ ...settings, legalSloganEn: e.target.value })}
                                    placeholder="Your car. Your choice."
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-slate-600">DE</Label>
                                <Input
                                    value={settings.legalSloganDe || ''}
                                    onChange={(e) => setSettings({ ...settings, legalSloganDe: e.target.value })}
                                    placeholder="Dein Auto. Deine Wahl."
                                    className="bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Zapisz ustawienia prawne
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
