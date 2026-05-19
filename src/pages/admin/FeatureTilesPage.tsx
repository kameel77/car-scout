import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { featureTilesApi, FeatureTile } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, RefreshCw, Trash2, Upload, GripVertical, ExternalLink, Save } from 'lucide-react';
import {
    DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
    SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const EMPTY_FORM = { title: '', targetUrl: '', isActive: true };

function SortableRow({
    tile, onEdit, onDelete, onUpload, uploadingId,
}: {
    tile: FeatureTile;
    onEdit: (t: FeatureTile) => void;
    onDelete: (id: string) => void;
    onUpload: (id: string, file: File) => void;
    uploadingId: string | null;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tile.id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    const uploading = uploadingId === tile.id;
    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
            <button
                type="button"
                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                {...attributes}
                {...listeners}
                aria-label="Przeciągnij"
            >
                <GripVertical className="w-5 h-5" />
            </button>
            <div className="w-24 h-16 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                {tile.imageUrl ? (
                    <img src={tile.imageUrl} alt={tile.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">brak</div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{tile.title}</p>
                <a
                    href={tile.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 truncate max-w-full"
                >
                    {tile.targetUrl}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
                {!tile.isActive && <span className="ml-2 text-xs text-amber-600">(nieaktywny)</span>}
            </div>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'Wgrywanie…' : 'Grafika'}
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUpload(tile.id, f);
                        e.target.value = '';
                    }}
                />
            </label>
            <Button variant="outline" size="sm" onClick={() => onEdit(tile)}>Edytuj</Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(tile.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
            </Button>
        </div>
    );
}

export default function FeatureTilesPage() {
    const { token } = useAuth();
    const qc = useQueryClient();
    const [form, setForm] = React.useState(EMPTY_FORM);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [uploadingId, setUploadingId] = React.useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['feature-tiles', 'admin'],
        queryFn: () => featureTilesApi.listAdmin(token!),
        enabled: !!token,
    });
    const tiles = data?.tiles || [];

    const createMut = useMutation({
        mutationFn: () => featureTilesApi.create(form, token!),
        onSuccess: () => {
            toast.success('Kafel utworzony');
            setForm(EMPTY_FORM);
            qc.invalidateQueries({ queryKey: ['feature-tiles'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const updateMut = useMutation({
        mutationFn: (id: string) => featureTilesApi.update(id, form, token!),
        onSuccess: () => {
            toast.success('Kafel zaktualizowany');
            setForm(EMPTY_FORM);
            setEditingId(null);
            qc.invalidateQueries({ queryKey: ['feature-tiles'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => featureTilesApi.remove(id, token!),
        onSuccess: () => {
            toast.success('Kafel usunięty');
            qc.invalidateQueries({ queryKey: ['feature-tiles'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const reorderMut = useMutation({
        mutationFn: (order: string[]) => featureTilesApi.reorder(order, token!),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['feature-tiles'] }),
        onError: (e: Error) => toast.error(e.message),
    });

    const handleUpload = async (id: string, file: File) => {
        try {
            setUploadingId(id);
            await featureTilesApi.uploadImage(id, file, token!);
            qc.invalidateQueries({ queryKey: ['feature-tiles'] });
            toast.success('Grafika zapisana');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Upload failed');
        } finally {
            setUploadingId(null);
        }
    };

    const handleEdit = (t: FeatureTile) => {
        setEditingId(t.id);
        setForm({ title: t.title, targetUrl: t.targetUrl, isActive: t.isActive });
    };

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const ids = tiles.map((t) => t.id);
        const oldIdx = ids.indexOf(String(active.id));
        const newIdx = ids.indexOf(String(over.id));
        if (oldIdx < 0 || newIdx < 0) return;
        const newOrder = arrayMove(ids, oldIdx, newIdx);
        // optimistic — backend persistence + cache invalidation handled by mutation
        qc.setQueryData(['feature-tiles', 'admin'], {
            tiles: arrayMove(tiles, oldIdx, newIdx),
        });
        reorderMut.mutate(newOrder);
    };

    return (
        <div className="space-y-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground">Kafle na stronie głównej</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Każdy kafel linkuje do listingu z filtrem. Liczba pojazdów jest automatycznie liczona z podanego URL.
                    </p>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{editingId ? 'Edytuj kafel' : 'Nowy kafel'}</CardTitle>
                        <CardDescription>
                            Podaj nagłówek i URL filtra. Akceptowane ścieżki: <code>/nowe</code>, <code>/uzywane</code>, <code>/samochody</code>, <code>/wynajem</code> z parametrami zapytania.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Headline</Label>
                                <Input
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="np. Chińskie samochody"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>URL filtra</Label>
                                <Input
                                    value={form.targetUrl}
                                    onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                                    placeholder="/nowe?bodyType=SUV"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={form.isActive}
                                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                                id="active"
                            />
                            <Label htmlFor="active" className="cursor-pointer">Aktywny</Label>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => editingId ? updateMut.mutate(editingId) : createMut.mutate()}
                                disabled={!form.title || !form.targetUrl || createMut.isPending || updateMut.isPending}
                            >
                                {(createMut.isPending || updateMut.isPending)
                                    ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    : editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                {editingId ? 'Zapisz zmiany' : 'Dodaj kafel'}
                            </Button>
                            {editingId && (
                                <Button variant="outline" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>
                                    Anuluj
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Lista kafli ({tiles.length})</CardTitle>
                        <CardDescription>Przeciągnij za uchwyt, żeby zmienić kolejność.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-slate-400" /></div>
                        ) : tiles.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-8 text-center">Brak kafli. Dodaj pierwszy powyżej.</p>
                        ) : (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={tiles.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-2">
                                        {tiles.map((tile) => (
                                            <SortableRow
                                                key={tile.id}
                                                tile={tile}
                                                onEdit={handleEdit}
                                                onDelete={(id) => {
                                                    if (confirm('Usunąć kafel?')) deleteMut.mutate(id);
                                                }}
                                                onUpload={handleUpload}
                                                uploadingId={uploadingId}
                                            />
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
