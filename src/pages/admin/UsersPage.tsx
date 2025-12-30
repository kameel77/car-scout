import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { User, UserPayload } from '@/types/user';
import { AdminNav } from '@/components/admin/AdminNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { LogOut, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

const emptyForm: UserPayload = {
  email: '',
  name: '',
  password: '',
  role: 'manager',
  isActive: true,
};

export default function UsersPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<UserPayload>(emptyForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      if (!token) throw new Error('Brak tokenu');
      return usersApi.list(token);
    },
    enabled: !!token,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Brak tokenu');
      if (editingId) {
        const payload = { ...form };
        if (!payload.password) {
          delete payload.password;
        }
        return usersApi.update(editingId, payload, token);
      }
      return usersApi.create(form, token);
    },
    onSuccess: () => {
      toast.success('Użytkownik zapisany');
      setForm(emptyForm);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Nie udało się zapisać użytkownika');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!token) throw new Error('Brak tokenu');
      return usersApi.delete(id, token);
    },
    onSuccess: () => {
      toast.success('Użytkownik usunięty');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (editingId) {
        setEditingId(null);
        setForm(emptyForm);
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Nie udało się usunąć użytkownika');
    },
  });

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setForm({
      email: u.email,
      name: u.name || '',
      password: '',
      role: u.role,
      isActive: u.isActive,
    });
  };

  const users = data?.users || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Users
              </h1>
              <p className="text-sm text-gray-600">
                Zarządzaj kontami administratorów i managerów.
              </p>
              <p className="text-xs text-gray-500">
                Zalogowany jako {user?.name || user?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <AdminNav />
              <Button onClick={handleLogout} variant="outline">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="w-4 h-4 text-blue-600" />
                {editingId ? 'Edytuj użytkownika' : 'Dodaj użytkownika'}
              </CardTitle>
              <CardDescription>
                Hasło wpisz tylko przy zakładaniu konta lub zmianie hasła.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Imię i nazwisko</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Opcjonalnie"
                    className="bg-white"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Rola</Label>
                    <Select
                      value={form.role}
                      onValueChange={(value) => setForm((p) => ({ ...p, role: value as any }))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Wybierz rolę" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="manager">manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.isActive ? 'active' : 'inactive'}
                      onValueChange={(value) => setForm((p) => ({ ...p, isActive: value === 'active' }))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Aktywny</SelectItem>
                        <SelectItem value="inactive">Nieaktywny</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Hasło {editingId && '(zostaw puste aby nie zmieniać)'}</Label>
                  <Input
                    type="password"
                    value={form.password || ''}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="******"
                    className="bg-white"
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setForm(emptyForm);
                      setEditingId(null);
                    }}
                  >
                    Wyczyść formularz
                  </Button>
                  <Button
                    onClick={() => saveMutation.mutate()}
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
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Lista użytkowników</CardTitle>
              <CardDescription>Zobacz i zarządzaj kontami.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Imię</TableHead>
                      <TableHead>Rola</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-28 text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6">
                          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Ładowanie użytkowników...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-slate-500">
                          Brak użytkowników.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((u) => (
                        <TableRow
                          key={u.id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => startEdit(u)}
                        >
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell>{u.name || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{u.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.isActive ? 'default' : 'secondary'}>
                              {u.isActive ? 'Aktywny' : 'Nieaktywny'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              disabled={deleteMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate(u.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Usuń
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
