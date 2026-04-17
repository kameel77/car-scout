import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Trash, Edit, ExternalLink, Code } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { WidgetForm } from '@/components/admin/Widgets/WidgetForm';

type Widget = {
  id: string;
  name: string;
  isActive: boolean;
  placement: string;
  selectionMode: string;
  vehicleSources: string[];
  createdAt: string;
};

export default function WidgetsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEmbedOpen, setIsEmbedOpen] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);

  const { data: widgets, isLoading } = useQuery<Widget[]>({
    queryKey: ['widgets'],
    queryFn: async () => {
      const res = await api.get('/admin/widgets');
      return res.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/widgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      toast({ title: 'Usunięto widget' });
    }
  });

  const handleDelete = (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć ten widget?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (w: Widget) => {
    setSelectedWidget(w);
    setIsFormOpen(true);
  };

  const handleOpenEmbed = (w: Widget) => {
    setSelectedWidget(w);
    setIsEmbedOpen(true);
  };

  if (isLoading) return <div className="p-8">Ładowanie...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Widgety</h1>
          <p className="text-muted-foreground mt-2">
            Zarządzaj sekcjami polecanych pojazdów na stronie głównej, podstronach oraz jako osadzone iFrame'y.
          </p>
        </div>
        <Button onClick={() => { setSelectedWidget(null); setIsFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Dodaj widget
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa</TableHead>
              <TableHead>Lokalizacja</TableHead>
              <TableHead>Tryb</TableHead>
              <TableHead>Źródła</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {widgets?.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium">{w.name}</TableCell>
                <TableCell><Badge variant="outline">{w.placement}</Badge></TableCell>
                <TableCell>
                  {w.selectionMode === 'FEATURED' ? (
                     <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Wybrane (Gwiazdka)</Badge>
                  ) : (
                     <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Algorytm / Filtry</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {w.vehicleSources.map(s => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {w.isActive ? (
                    <span className="text-green-600 font-medium text-sm">Aktywny</span>
                  ) : (
                    <span className="text-gray-400 font-medium text-sm">Nieaktywny</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {w.placement === 'EXTERNAL' && (
                      <Button variant="outline" size="sm" onClick={() => handleOpenEmbed(w)}>
                        <Code className="w-4 h-4 mr-1" /> Kod
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(w)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(w.id)}>
                      <Trash className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {widgets?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  Brak utworzonych widgetów.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {isFormOpen && (
        <WidgetForm 
          widget={selectedWidget} 
          onClose={() => setIsFormOpen(false)} 
        />
      )}

      {isEmbedOpen && selectedWidget && (
        <Dialog open={isEmbedOpen} onOpenChange={setIsEmbedOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kod do umieszczenia na stronie (Embed)</DialogTitle>
              <DialogDescription>Skopiuj poniższy gotowy kod iframe na zewnętrzną stronę aby wyświetlać wybrane samochody z tego widgetu.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 bg-gray-900 text-gray-100 p-4 rounded-md text-sm font-mono break-all whitespace-pre-wrap">
              {`<iframe src="https://carsalon.pl/embed/widget/${selectedWidget.id}" width="100%" height="600" frameborder="0" style="border:0; border-radius: 8px; overflow: hidden; background: transparent;"></iframe>`}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
