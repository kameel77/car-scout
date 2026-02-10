import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { faqApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { FaqEntry, FaqPage as FaqPageType, FaqPayload } from '@/types/faq';
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
import { Bold, HelpCircle, Link2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PAGE_OPTIONS: { value: FaqPageType; label: string }[] = [
  { value: 'home', label: 'Strona główna' },
  { value: 'offers', label: 'Strona oferty' },
  { value: 'contact', label: 'Strona kontaktowa' },
];

const EMPTY_FORM: FaqPayload = {
  page: 'home',
  sortOrder: 0,
  questionPl: '',
  answerPl: '',
  questionEn: '',
  answerEn: '',
  questionDe: '',
  answerDe: '',
  isPublished: true,
};

type AnswerField = 'answerPl' | 'answerEn' | 'answerDe';

export default function FaqPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pageFilter, setPageFilter] = React.useState<FaqPageType>('home');
  const [formState, setFormState] = React.useState<FaqPayload>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const textareaRefs: Record<AnswerField, React.RefObject<HTMLTextAreaElement>> = {
    answerPl: React.useRef<HTMLTextAreaElement>(null),
    answerEn: React.useRef<HTMLTextAreaElement>(null),
    answerDe: React.useRef<HTMLTextAreaElement>(null),
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['faq', pageFilter],
    queryFn: async () => {
      if (!token) throw new Error('Brak tokenu');
      return faqApi.list({ page: pageFilter }, token);
    },
    enabled: !!token,
  });

  const entries = (data?.entries || []) as FaqEntry[];

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Brak tokenu');
      const payload = { ...formState, id: editingId || undefined };
      return faqApi.save(payload as FaqPayload, token);
    },
    onSuccess: () => {
      toast.success('FAQ zapisane');
      setFormState(EMPTY_FORM);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['faq'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Nie udało się zapisać wpisu FAQ';
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!token) throw new Error('Brak tokenu');
      return faqApi.delete(id, token);
    },
    onSuccess: () => {
      toast.success('FAQ usunięte');
      queryClient.invalidateQueries({ queryKey: ['faq'] });
      if (editingId) {
        setEditingId(null);
        setFormState(EMPTY_FORM);
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Nie udało się usunąć wpisu FAQ';
      toast.error(message);
    },
  });


  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const requiredFields: (keyof FaqPayload)[] = [
      'questionPl',
      'answerPl',
      'questionEn',
      'answerEn',
      'questionDe',
      'answerDe',
    ];

    for (const field of requiredFields) {
      if (!formState[field] || (formState[field] as string).trim() === '') {
        toast.error('Wszystkie pola pytania i odpowiedzi są wymagane');
        return;
      }
    }

    saveMutation.mutate();
  };

  const handleEdit = (entry: FaqEntry) => {
    setEditingId(entry.id);
    setFormState({
      page: entry.page,
      sortOrder: entry.sortOrder,
      questionPl: entry.questionPl,
      answerPl: entry.answerPl,
      questionEn: entry.questionEn,
      answerEn: entry.answerEn,
      questionDe: entry.questionDe,
      answerDe: entry.answerDe,
      isPublished: entry.isPublished,
      id: entry.id,
    });
    setPageFilter(entry.page);
  };

  const applyFormatting = (field: AnswerField, type: 'bold' | 'link') => {
    const ref = textareaRefs[field].current;
    if (!ref) return;

    const { selectionStart, selectionEnd, value } = ref;
    const selectedText = value.substring(selectionStart, selectionEnd) || 'tekst';

    let formatted = selectedText;
    let cursorOffsetStart = 0;
    let cursorOffsetEnd = 0;

    if (type === 'bold') {
      formatted = `**${selectedText}**`;
      cursorOffsetStart = 2;
      cursorOffsetEnd = formatted.length - 2;
    } else if (type === 'link') {
      formatted = `[${selectedText}](https://)`;
      cursorOffsetStart = 1;
      cursorOffsetEnd = selectedText.length + 1;
    }

    const newValue = `${value.substring(0, selectionStart)}${formatted}${value.substring(selectionEnd)}`;
    setFormState((prev) => ({ ...prev, [field]: newValue }));

    requestAnimationFrame(() => {
      const positionStart = selectionStart + cursorOffsetStart;
      const positionEnd = selectionStart + cursorOffsetEnd;
      ref.focus();
      ref.setSelectionRange(positionStart, positionEnd);
    });
  };

  const resetForm = () => {
    setFormState(EMPTY_FORM);
    setEditingId(null);
  };

  const getPageLabel = (page: string) =>
    PAGE_OPTIONS.find((opt) => opt.value === page)?.label || page;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          FAQ CMS
        </h1>
        <p className="text-gray-600">
          Zarządzaj pytaniami i odpowiedziami dla stron głównej, ofert i kontaktu.
        </p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="w-4 h-4 text-blue-600" />
              {editingId ? 'Edytuj wpis FAQ' : 'Dodaj wpis FAQ'}
            </CardTitle>
            <CardDescription>
              Każda wersja językowa posiada osobne pytania i odpowiedzi. Możesz użyć prostego
              formatowania Markdown: <strong>**pogrubienie**</strong>,{' '}
              <span className="underline">[link](https://adres)</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Strona</Label>
                  <Select
                    value={formState.page}
                    onValueChange={(value) =>
                      setFormState((prev) => ({ ...prev, page: value as FaqPageType }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Wybierz stronę" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kolejność</Label>
                  <Input
                    type="number"
                    value={formState.sortOrder ?? 0}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        sortOrder: Number(e.target.value),
                      }))
                    }
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <HelpCircle className="w-4 h-4" />
                  <span>Formatowanie: **pogrubienie**, [tekst](https://adres)</span>
                </div>
                <div className="text-xs text-slate-500 hidden md:block">
                  Skróty formatowania dostępne w każdym polu odpowiedzi.
                </div>
              </div>

              {(['pl', 'en', 'de'] as const).map((lang) => (
                <div key={lang} className="space-y-3 rounded-md border p-3 bg-white">
                  {(() => {
                    const langKey = lang === 'pl' ? 'Pl' : lang === 'en' ? 'En' : 'De';
                    const questionKey = `question${langKey}` as keyof FaqPayload;
                    const answerKey = `answer${langKey}` as AnswerField;
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="text-sm font-semibold uppercase">{lang}</Label>
                            <p className="text-xs text-slate-500">
                              Pytanie i odpowiedź w języku {lang.toUpperCase()}.
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => applyFormatting(answerKey, 'bold')}
                              aria-label="Dodaj pogrubienie"
                            >
                              <Bold className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => applyFormatting(answerKey, 'link')}
                              aria-label="Dodaj link"
                            >
                              <Link2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Pytanie ({lang})</Label>
                          <Input
                            value={formState[questionKey] as string}
                            onChange={(e) =>
                              setFormState((prev) => ({
                                ...prev,
                                [questionKey]: e.target.value,
                              }))
                            }
                            placeholder="Wprowadź pytanie"
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Odpowiedź ({lang})</Label>
                          <Textarea
                            ref={textareaRefs[answerKey]}
                            value={formState[answerKey] as string}
                            onChange={(e) =>
                              setFormState((prev) => ({
                                ...prev,
                                [answerKey]: e.target.value,
                              }))
                            }
                            placeholder="Dodaj odpowiedź (obsługuje **pogrubienie** i [linki](https://))"
                            className="bg-white min-h-[120px]"
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isPublished"
                    checked={formState.isPublished}
                    onCheckedChange={(checked) =>
                      setFormState((prev) => ({ ...prev, isPublished: checked }))
                    }
                  />
                  <Label htmlFor="isPublished">Opublikowane</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Wyczyść
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
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
              <HelpCircle className="w-4 h-4 text-blue-600" />
              Lista FAQ
            </CardTitle>
            <CardDescription>
              Podstawowe pytania i odpowiedzi dla każdej strony. Kliknij wiersz, aby edytować.
            </CardDescription>
            <div className="pt-3">
              <Label className="sr-only">Filtruj stronę</Label>
              <Select value={pageFilter} onValueChange={(value) => setPageFilter(value as FaqPageType)}>
                <SelectTrigger className="bg-white w-full md:w-64">
                  <SelectValue placeholder="Filtruj stronę" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-28">Strona</TableHead>
                    <TableHead>Pytanie (PL)</TableHead>
                    <TableHead>Pytanie (EN)</TableHead>
                    <TableHead>Pytanie (DE)</TableHead>
                    <TableHead className="w-24 text-right">Status</TableHead>
                    <TableHead className="w-20 text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Ładowanie FAQ...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                        Brak wpisów FAQ dla wybranej strony.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => (
                      <TableRow
                        key={entry.id}
                        className={cn(
                          'cursor-pointer hover:bg-slate-50 transition-colors',
                          editingId === entry.id && 'bg-blue-50'
                        )}
                        onClick={() => handleEdit(entry)}
                      >
                        <TableCell>
                          <Badge variant="outline">{getPageLabel(entry.page)}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate font-medium">
                          {entry.questionPl}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate">{entry.questionEn}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{entry.questionDe}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={entry.isPublished ? 'default' : 'secondary'}>
                            {entry.isPublished ? 'Opublikowane' : 'Szkic'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(entry);
                              }}
                            >
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
