import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { translationsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { TranslationEntry, TranslationPayload } from '@/types/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: 'fuel', label: 'Rodzaj paliwa' },
  { value: 'transmission', label: 'Skrzynia biegów' },
  { value: 'drive', label: 'Napęd' },
  { value: 'body', label: 'Typ nadwozia' },
  { value: 'feature', label: 'Wyposażenie' },
] as const;

const EMPTY_FORM: TranslationPayload = {
  category: 'fuel',
  sourceValue: '',
  pl: '',
  en: '',
  de: '',
};

export default function TranslationsPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formState, setFormState] = React.useState<TranslationPayload>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['translations', categoryFilter, debouncedSearch],
    queryFn: async () => {
      return translationsApi.list(
        {
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          search: debouncedSearch || undefined,
        },
        token || undefined
      );
    },
    enabled: !!token,
  });

  const translations = (data?.translations || []) as TranslationEntry[];

  const saveMutation = useMutation({
    mutationFn: (payload: TranslationPayload) => {
      if (!token) throw new Error('Brak tokenu');
      return translationsApi.save(payload, token);
    },
    onSuccess: () => {
      toast.success('Tłumaczenie zapisane');
      setFormState(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['translations'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Nie udało się zapisać tłumaczenia');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!token) throw new Error('Brak tokenu');
      return translationsApi.delete(id, token);
    },
    onSuccess: () => {
      toast.success('Tłumaczenie usunięte');
      queryClient.invalidateQueries({ queryKey: ['translations'] });
      setFormState(EMPTY_FORM);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Nie udało się usunąć tłumaczenia');
    },
  });


  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formState.category || !formState.sourceValue) {
      toast.error('Uzupełnij kategorię i wartość źródłową');
      return;
    }

    saveMutation.mutate(formState);
  };

  const handleEdit = (entry: TranslationEntry) => {
    setFormState({
      id: entry.id,
      category: entry.category,
      sourceValue: entry.sourceValue,
      pl: entry.pl || '',
      en: entry.en || '',
      de: entry.de || '',
    });
  };

  const getCategoryLabel = (value: string) =>
    CATEGORY_OPTIONS.find((opt) => opt.value === value)?.label || value;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Translations Manager
        </h1>
        <p className="text-gray-600">
          Zarządzaj tłumaczeniami specyfikacji technicznych i wyposażenia.
        </p>
      </div>
      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="w-4 h-4 text-blue-600" />
              Dodaj / Edytuj tłumaczenie
            </CardTitle>
            <CardDescription>
              Dodaj nowe tłumaczenia lub edytuj istniejące wpisy. Zapisanie
              zmian od razu aktualizuje aplikację po przeładowaniu tłumaczeń.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label>Kategoria</Label>
                <Select
                  value={formState.category}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Wybierz kategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Wartość źródłowa (PL)</Label>
                <Input
                  required
                  value={formState.sourceValue}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      sourceValue: e.target.value,
                    }))
                  }
                  placeholder="np. Benzyna, Automatyczna, Klimatyzacja"
                  className="bg-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>pl</Label>
                  <Textarea
                    value={formState.pl || ''}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, pl: e.target.value }))
                    }
                    placeholder="Tłumaczenie PL (opcjonalnie)"
                    className="bg-white min-h-[64px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>en</Label>
                  <Textarea
                    value={formState.en || ''}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, en: e.target.value }))
                    }
                    placeholder="Translation EN"
                    className="bg-white min-h-[64px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>de</Label>
                  <Textarea
                    value={formState.de || ''}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, de: e.target.value }))
                    }
                    placeholder="Übersetzung DE"
                    className="bg-white min-h-[64px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setFormState(EMPTY_FORM)}
                >
                  Wyczyść formularz
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
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              Lista tłumaczeń
            </CardTitle>
            <CardDescription>
              Filtruj po kategorii lub wyszukaj po wartości źródłowej i
              tłumaczeniach.
            </CardDescription>
            <div className="flex flex-col md:flex-row gap-3 pt-3">
              <div className="flex-1">
                <Label className="sr-only">Szukaj</Label>
                <div className="relative">
                  <Input
                    placeholder="Szukaj po frazie..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white pl-10"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div className="w-full md:w-64">
                <Label className="sr-only">Filtruj kategorię</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Filtruj kategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie kategorie</SelectItem>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-24">Kategoria</TableHead>
                    <TableHead>Źródło</TableHead>
                    <TableHead>pl</TableHead>
                    <TableHead>en</TableHead>
                    <TableHead>de</TableHead>
                    <TableHead className="w-28 text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Ładowanie tłumaczeń...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : translations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                        Brak wyników dla wybranych filtrów.
                      </TableCell>
                    </TableRow>
                  ) : (
                    translations.map((item) => (
                      <TableRow
                        key={item.id}
                        className={cn(
                          'cursor-pointer hover:bg-slate-50 transition-colors',
                          formState.id === item.id && 'bg-blue-50'
                        )}
                        onClick={() => handleEdit(item)}
                      >
                        <TableCell>
                          <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.sourceValue}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{item.pl || '—'}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{item.en || '—'}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{item.de || '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(item);
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
                                deleteMutation.mutate(item.id);
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
