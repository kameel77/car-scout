import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { heroBannersApi, HeroBanner, HeroBannerInput } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, RefreshCw, Trash2, Upload, GripVertical, Save } from 'lucide-react';
import {
    DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
    SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const EMPTY_FORM: HeroBannerInput = {
    altText: '',
    buttonLabel: '',
    buttonUrl: '',
    buttonPositionYPct: 60,
    buttonAlign: 'left',
    isActive: true,
};

function SortableRow({
    banner, onEdit, onDelete, onUpload, uploadingKey,
}: {
    banner: HeroBanner;
    onEdit: (b: HeroBanner) => void;
    onDelete: (id: string) => void;
    onUpload: (id: string, slot: 'desktop' | 'mobile', file: File) => void;
    uploadingKey: string | null;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: banner.id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
            <button type="button" className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600" {...attributes} {...listeners} aria-label="Przeciągnij">
                <GripVertical className="w-5 h-5" />
            </button>
            <div className="w-28 h-16 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                {banner.imageUrlDesktop ? (
                    <img src={banner.imageUrlDesktop} alt={banner.altText} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">brak</div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{banner.buttonLabel || '(bez przycisku)'}</p>
                <p className="text-xs text-slate-500 truncate">{banner.buttonUrl || '—'} · poz. {banner.buttonPositionYPct}% · {banner.buttonAlign}</p>
                {!banner.isActive && <span className="text-xs text-amber-600">(nieaktywny)</span>}
            </div>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                {uploadingKey === `${banner.id}:desktop` ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Desktop
                <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden"
                    disabled={uploadingKey === `${banner.id}:desktop`}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(banner.id, 'desktop', f); e.target.value = ''; }} />
            </label>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                {uploadingKey === `${banner.id}:mobile` ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Mobile
                <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden"
                    disabled={uploadingKey === `${banner.id}:mobile`}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(banner.id, 'mobile', f); e.target.value = ''; }} />
            </label>
            <Button variant="outline" size="sm" onClick={() => onEdit(banner)}>Edytuj</Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(banner.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
            </Button>
        </div>
    );
}

export default function HeroBannersPage() {
    const { token } = useAuth();
    const qc = useQueryClient();
    const [form, setForm] = React.useState<HeroBannerInput>(EMPTY_FORM);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [uploadingKey, setUploadingKey] = React.useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['hero-banners', 'admin'],
        queryFn: () => heroBannersApi.listAdmin(token!),
        enabled: !!token,
    });
    const banners = data?.banners || [];

    const createMut = useMutation({
        mutationFn: () => heroBannersApi.create(form, token!),
        onSuccess: () => { toast.success('Baner utworzony'); setForm(EMPTY_FORM); qc.invalidateQueries({ queryKey: ['hero-banners'] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const updateMut = useMutation({
        mutationFn: (id: string) => heroBannersApi.update(id, form, token!),
        onSuccess: () => { toast.success('Baner zaktualizowany'); setForm(EMPTY_FORM); setEditingId(null); qc.invalidateQueries({ queryKey: ['hero-banners'] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const deleteMut = useMutation({
        mutationFn: (id: string) => heroBannersApi.remove(id, token!),
        onSuccess: () => { toast.success('Baner usunięty'); qc.invalidateQueries({ queryKey: ['hero-banners'] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const reorderMut = useMutation({
        mutationFn: (order: string[]) => heroBannersApi.reorder(order, token!),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-banners'] }),
        onError: (e: Error) => toast.error(e.message),
    });

    const handleUpload = async (id: string, slot: 'desktop' | 'mobile', file: File) => {
        try {
            setUploadingKey(`${id}:${slot}`);
            await heroBannersApi.uploadImage(id, file, slot, token!);
            qc.invalidateQueries({ queryKey: ['hero-banners'] });
            toast.success('Grafika zapisana');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Upload failed');
        } finally {
            setUploadingKey(null);
        }
    };

    const handleEdit = (b: HeroBanner) => {
        setEditingId(b.id);
        setForm({
            altText: b.altText, buttonLabel: b.buttonLabel, buttonUrl: b.buttonUrl,
            buttonPositionYPct: b.buttonPositionYPct, buttonAlign: b.buttonAlign, isActive: b.isActive,
        });
    };

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const ids = banners.map((b) => b.id);
        const oldIdx = ids.indexOf(String(active.id));
        const newIdx = ids.indexOf(String(over.id));
        if (oldIdx < 0 || newIdx < 0) return;
        const newOrder = arrayMove(ids, oldIdx, newIdx);
        qc.setQueryData(['hero-banners', 'admin'], { banners: arrayMove(banners, oldIdx, newIdx) });
        reorderMut.mutate(newOrder);
    };

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Banery hero (strona główna Motolia)</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Grafiki przygotowujesz osobno (tekst wtopiony w obraz). CMS steruje przyciskiem: etykietą, linkiem i pozycją w pionie na desktopie.
                </p>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>{editingId ? 'Edytuj baner' : 'Nowy baner'}</CardTitle>
                    <CardDescription>Najpierw zapisz baner, potem wgraj grafikę desktop/mobile na liście poniżej.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Opis grafiki (alt / SEO)</Label>
                            <Input value={form.altText} onChange={(e) => setForm({ ...form, altText: e.target.value })} placeholder="np. Wyprzedaż aut premium" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Etykieta przycisku</Label>
                            <Input value={form.buttonLabel} onChange={(e) => setForm({ ...form, buttonLabel: e.target.value })} placeholder="np. Sprawdź oferty" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Link przycisku</Label>
                            <Input value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })} placeholder="/nowe?bodyType=SUV" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Wyrównanie przycisku (poziom)</Label>
                            <Select value={form.buttonAlign} onValueChange={(v) => setForm({ ...form, buttonAlign: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="left">Do lewej</SelectItem>
                                    <SelectItem value="center">Wyśrodkowany</SelectItem>
                                    <SelectItem value="right">Do prawej</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Pozycja przycisku w pionie (desktop): {form.buttonPositionYPct}%</Label>
                        <Slider value={[form.buttonPositionYPct]} min={0} max={100} step={1}
                            onValueChange={(v) => setForm({ ...form, buttonPositionYPct: v[0] })} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} id="active" />
                        <Label htmlFor="active" className="cursor-pointer">Aktywny</Label>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => editingId ? updateMut.mutate(editingId) : createMut.mutate()}
                            disabled={!form.buttonLabel || !form.buttonUrl || createMut.isPending || updateMut.isPending}>
                            {(createMut.isPending || updateMut.isPending)
                                ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                : editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            {editingId ? 'Zapisz zmiany' : 'Dodaj baner'}
                        </Button>
                        {editingId && (
                            <Button variant="outline" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Anuluj</Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Lista banerów ({banners.length})</CardTitle>
                    <CardDescription>Przeciągnij za uchwyt, żeby zmienić kolejność rotacji.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-slate-400" /></div>
                    ) : banners.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">Brak banerów. Dodaj pierwszy powyżej.</p>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={banners.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">
                                    {banners.map((banner) => (
                                        <SortableRow key={banner.id} banner={banner} onEdit={handleEdit}
                                            onDelete={(id) => { if (confirm('Usunąć baner?')) deleteMut.mutate(id); }}
                                            onUpload={handleUpload} uploadingKey={uploadingKey} />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
