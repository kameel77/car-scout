import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { seoContentApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useListingOptions } from '@/hooks/useListingOptions';
import { sanitizeForSlug } from '@/utils/url-utils';
import type { SeoContentPage as SeoContentPageEntry, SeoContentPayload } from '@/types/seo-content';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Eye, FileEdit, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NO_MODEL = '__brand_only__';

interface FormState {
  make: string;
  model: string; // NO_MODEL = strona marki (bez modelu)
  contentMd: string;
  metaTitle: string;
  metaDescription: string;
  isPublished: boolean;
}

const EMPTY_FORM: FormState = {
  make: '',
  model: NO_MODEL,
  contentMd: '',
  metaTitle: '',
  metaDescription: '',
  isPublished: false,
};

// Prosty (nie 1:1 z backendowym renderem markdown→HTML) podgląd redakcyjny — wystarczający,
// żeby zweryfikować strukturę treści przed zapisem. Whitelist tagów i sanityzacja są robione
// dopiero na backendzie (services/seo-content.ts), ten podgląd nic nie sanityzuje.
function simpleMarkdownPreview(md: string): string {
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

  const lines = md.split(/\r?\n/);
  const html: string[] = [];
  let listTag: 'ul' | 'ol' | null = null;
  const closeList = () => { if (listTag) { html.push(`</${listTag}>`); listTag = null; } };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    const ul = line.match(/^[-*]\s+(.+)$/);
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (h2) { closeList(); html.push(`<h2>${inline(h2[1])}</h2>`); }
    else if (h3) { closeList(); html.push(`<h3>${inline(h3[1])}</h3>`); }
    else if (ul) { if (listTag !== 'ul') { closeList(); html.push('<ul>'); listTag = 'ul'; } html.push(`<li>${inline(ul[1])}</li>`); }
    else if (ol) { if (listTag !== 'ol') { closeList(); html.push('<ol>'); listTag = 'ol'; } html.push(`<li>${inline(ol[1])}</li>`); }
    else if (line.trim() === '') closeList();
    else { closeList(); html.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  return html.join('\n');
}

export default function SeoContentPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data: options } = useListingOptions();
  const [formState, setFormState] = React.useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-seo-content'],
    queryFn: async () => {
      if (!token) throw new Error('Brak tokenu');
      return seoContentApi.list(token);
    },
    enabled: !!token,
  });

  const pages = data?.pages || [];

  const modelsForMake = React.useMemo(
    () => (options?.models || []).filter((m) => m.make === formState.make),
    [options?.models, formState.make],
  );

  const urlPath = formState.make
    ? `/samochody/${sanitizeForSlug(formState.make)}${formState.model !== NO_MODEL ? `/${sanitizeForSlug(formState.model)}` : ''}`
    : '';

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Brak tokenu');
      const payload: SeoContentPayload = {
        id: editingId || undefined,
        urlPath,
        contentMd: formState.contentMd,
        metaTitle: formState.metaTitle.trim() || null,
        metaDescription: formState.metaDescription.trim() || null,
        isPublished: formState.isPublished,
      };
      return editingId
        ? seoContentApi.update(editingId, payload, token)
        : seoContentApi.create(payload, token);
    },
    onSuccess: () => {
      toast.success('Treść SEO zapisana');
      setFormState(EMPTY_FORM);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-seo-content'] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać treści SEO');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!token) throw new Error('Brak tokenu');
      return seoContentApi.delete(id, token);
    },
    onSuccess: () => {
      toast.success('Treść SEO usunięta');
      queryClient.invalidateQueries({ queryKey: ['admin-seo-content'] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Nie udało się usunąć treści SEO');
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.make) {
      toast.error('Wybierz markę');
      return;
    }
    if (!formState.contentMd.trim()) {
      toast.error('Treść (markdown) jest wymagana');
      return;
    }
    saveMutation.mutate();
  };

  const handleEdit = (entry: SeoContentPageEntry) => {
    const parts = entry.urlPath.replace('/samochody/', '').split('/');
    const makeSlug = parts[0];
    const modelSlug = parts[1];
    const make = options?.makes.find((m) => sanitizeForSlug(m) === makeSlug) || '';
    const model = modelSlug
      ? options?.models.find((m) => m.make === make && sanitizeForSlug(m.model) === modelSlug)?.model || ''
      : NO_MODEL;
    setEditingId(entry.id);
    setFormState({
      make,
      model: model || NO_MODEL,
      contentMd: entry.contentMd,
      metaTitle: entry.metaTitle || '',
      metaDescription: entry.metaDescription || '',
      isPublished: entry.isPublished,
    });
  };

  const resetForm = () => {
    setFormState(EMPTY_FORM);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Treści SEO
        </h1>
        <p className="text-gray-600">
          Redakcyjna treść (markdown) dla stron marek i modeli (/samochody/marka[/model]) — wyświetlana pod
          listingiem, indeksowana i cytowalna w wyszukiwarkach AI.
        </p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="w-4 h-4 text-blue-600" />
              {editingId ? 'Edytuj treść SEO' : 'Dodaj treść SEO'}
            </CardTitle>
            <CardDescription>
              Nagłówki <code>## Pytanie?</code> (kończące się pytajnikiem) trafiają automatycznie do FAQ
              (widoczne + FAQPage JSON-LD). Wspierany markdown: <code>## / ###</code>, listy, <code>**pogrubienie**</code>,{' '}
              <code>[link](adres)</code>, tabele.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Marka</Label>
                  <Select
                    value={formState.make}
                    onValueChange={(value) => setFormState((prev) => ({ ...prev, make: value, model: NO_MODEL }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Wybierz markę" />
                    </SelectTrigger>
                    <SelectContent>
                      {(options?.makes || []).map((make) => (
                        <SelectItem key={make} value={make}>{make}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Model (opcjonalnie)</Label>
                  <Select
                    value={formState.model}
                    onValueChange={(value) => setFormState((prev) => ({ ...prev, model: value }))}
                    disabled={!formState.make}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="— strona marki —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_MODEL}>— strona marki (bez modelu) —</SelectItem>
                      {modelsForMake.map((m) => (
                        <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {urlPath && (
                <div className="text-xs text-slate-500">
                  URL: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{urlPath}</code>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Meta title (opcjonalnie — nadpisuje domyślny)</Label>
                  <Input
                    value={formState.metaTitle}
                    onChange={(e) => setFormState((prev) => ({ ...prev, metaTitle: e.target.value }))}
                    placeholder="Zostaw puste, żeby użyć domyślnego"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meta description (opcjonalnie — nadpisuje domyślny)</Label>
                  <Input
                    value={formState.metaDescription}
                    onChange={(e) => setFormState((prev) => ({ ...prev, metaDescription: e.target.value }))}
                    placeholder="Zostaw puste, żeby użyć domyślnego"
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Treść (markdown)</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((p) => !p)}>
                    <Eye className="w-4 h-4 mr-1" />
                    {showPreview ? 'Ukryj podgląd' : 'Podgląd'}
                  </Button>
                </div>
                <Textarea
                  value={formState.contentMd}
                  onChange={(e) => setFormState((prev) => ({ ...prev, contentMd: e.target.value }))}
                  placeholder={'## Historia marki\n\nTreść akapitu...\n\n## Czy warto kupić X?\n\nOdpowiedź trafi też do FAQ.'}
                  className="bg-white min-h-[240px] font-mono text-sm"
                />
                {showPreview && (
                  <div
                    className="rounded-md border bg-slate-50 p-4 text-sm [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: simpleMarkdownPreview(formState.contentMd) }}
                  />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isPublished"
                    checked={formState.isPublished}
                    onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, isPublished: checked }))}
                  />
                  <Label htmlFor="isPublished">Opublikowane</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Wyczyść
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                    {saveMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Zapisz
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-blue-600" />
              Lista treści SEO
            </CardTitle>
            <CardDescription>Kliknij wiersz, aby edytować.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Meta title</TableHead>
                    <TableHead className="w-28 text-right">Status</TableHead>
                    <TableHead className="w-20 text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6">
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Ładowanie...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-slate-500">
                        Brak treści SEO.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pages.map((entry) => (
                      <TableRow
                        key={entry.id}
                        className={cn(
                          'cursor-pointer hover:bg-slate-50 transition-colors',
                          editingId === entry.id && 'bg-blue-50'
                        )}
                        onClick={() => handleEdit(entry)}
                      >
                        <TableCell className="max-w-[220px] truncate font-mono text-xs">{entry.urlPath}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{entry.metaTitle || '—'}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={entry.isPublished ? 'default' : 'secondary'}>
                            {entry.isPublished ? 'Opublikowane' : 'Szkic'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEdit(entry); }}>
                              Edytuj
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              disabled={deleteMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate(entry.id);
                                if (editingId === entry.id) resetForm();
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Usuń
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {isFetching && !isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Odświeżanie danych...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
