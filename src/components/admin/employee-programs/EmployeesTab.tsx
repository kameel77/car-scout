import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Users,
  Search,
  UserX,
  UserCheck,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  employeeAdminApi,
  EmployeeAccountItem
} from '@/services/employee-admin.service';

interface Props {
  companyId: string;
  token: string;
}

export const EmployeesTab: React.FC<Props> = ({ companyId, token }) => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Revoke dialog state
  const [selectedAccountForRevoke, setSelectedAccountForRevoke] = useState<EmployeeAccountItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Reinstate dialog state
  const [selectedAccountForReinstate, setSelectedAccountForReinstate] = useState<EmployeeAccountItem | null>(null);
  const [reinstateReason, setReinstateReason] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['employee-company-accounts', companyId, page, activeSearch],
    queryFn: () =>
      employeeAdminApi.listCompanyAccounts(
        companyId,
        { page, limit: 15, search: activeSearch || undefined },
        token
      )
  });

  const revokeMutation = useMutation({
    mutationFn: ({ membershipId, reason }: { membershipId: string; reason: string }) =>
      employeeAdminApi.revokeMembership(membershipId, { reason }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-company-accounts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-companies'] });
      setSelectedAccountForRevoke(null);
      setRevokeReason('');
      setRevokeError(null);
    },
    onError: (err: unknown) => {
      setRevokeError(err instanceof Error ? err.message : 'Błąd podczas cofania dostępu');
    }
  });

  const reinstateMutation = useMutation({
    mutationFn: ({ membershipId, reason }: { membershipId: string; reason?: string }) =>
      employeeAdminApi.reinstateMembership(membershipId, { reason }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-company-accounts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-companies'] });
      setSelectedAccountForReinstate(null);
      setReinstateReason('');
    }
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchTerm.trim());
  };

  const handleRevokeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountForRevoke) return;
    if (revokeReason.trim().length < 3) {
      setRevokeError('Powód cofnięcia dostępu musi mieć co najmniej 3 znaki');
      return;
    }
    setRevokeError(null);
    revokeMutation.mutate({
      membershipId: selectedAccountForRevoke.membershipId,
      reason: revokeReason.trim()
    });
  };

  const handleReinstateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountForReinstate) return;
    reinstateMutation.mutate({
      membershipId: selectedAccountForReinstate.membershipId,
      reason: reinstateReason.trim() || undefined
    });
  };

  const accounts = data?.accounts || [];
  const totalPages = data?.pagination?.totalPages || 1;
  const totalCount = data?.pagination?.total || 0;

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Pracownicy z dostępem do platformy
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Zarejestrowane konta pracowników powiązane z tą organizacją. Możesz zarządzać statusem dostępu i sesjami.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Szukaj email, imię..."
              className="pl-9 w-60 h-9 text-xs"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-9 text-xs">
            Szukaj
          </Button>
          {activeSearch && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setSearchTerm('');
                setActiveSearch('');
                setPage(1);
              }}
            >
              Wyczyść
            </Button>
          )}
        </form>
      </div>

      {/* Table section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            Ładowanie listy pracowników...
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-500">
            Wystąpił błąd podczas ładowania pracowników.
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 block mx-auto">
              Spróbuj ponownie
            </Button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            {activeSearch
              ? 'Brak pracowników pasujących do wpisanej frazy wyszukiwania.'
              : 'Brak zarejestrowanych pracowników w tej organizacji.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                <TableHead className="text-xs font-semibold text-gray-600">Pracownik</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Telefon</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Program</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Status</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Data rejestracji</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Ostatnie logowanie</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => {
                const fullName = [acc.firstName, acc.lastName].filter(Boolean).join(' ');
                return (
                  <TableRow key={acc.id} className="hover:bg-gray-50/60 transition-colors">
                    <TableCell className="py-3">
                      <div className="font-medium text-xs text-gray-900">
                        {fullName || 'Brak danych'}
                      </div>
                      <div className="text-2xs text-gray-500">{acc.email}</div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {acc.phone || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      <span className="font-medium">{acc.program.name}</span>
                    </TableCell>
                    <TableCell>
                      {acc.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-2xs font-normal">
                          Aktywny
                        </Badge>
                      ) : (
                        <Badge className="bg-red-50 text-red-800 border-red-200 text-2xs font-normal">
                          Dostęp cofnięty
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {formatDate(acc.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {formatDate(acc.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {acc.isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={() => {
                            setSelectedAccountForRevoke(acc);
                            setRevokeReason('');
                            setRevokeError(null);
                          }}
                        >
                          <UserX className="w-3.5 h-3.5 mr-1.5" />
                          Cofnij dostęp
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                          onClick={() => {
                            setSelectedAccountForReinstate(acc);
                            setReinstateReason('');
                          }}
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                          Przywróć dostęp
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100 text-xs text-gray-500">
            <div>
              Łącznie: <strong className="text-gray-700">{totalCount}</strong> pracowników
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Poprzednia
              </Button>
              <span className="px-2">
                Strona {page} z {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Następna
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Revoke dialog */}
      <Dialog open={!!selectedAccountForRevoke} onOpenChange={(open) => !open && setSelectedAccountForRevoke(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Cofnij dostęp pracownikowi
            </DialogTitle>
            <DialogDescription>
              Cofnięcie dostępu natychmiast zablokuje możliwość korzystania z platformy dla tego pracownika i unieważni wszystkie aktywne sesje logowania.
            </DialogDescription>
          </DialogHeader>

          {selectedAccountForRevoke && (
            <form onSubmit={handleRevokeSubmit} className="space-y-4 py-2">
              <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-gray-500">Pracownik: </span>
                  <strong className="text-gray-800">
                    {[selectedAccountForRevoke.firstName, selectedAccountForRevoke.lastName].filter(Boolean).join(' ') || '-'}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-500">Email: </span>
                  <strong className="text-gray-800">{selectedAccountForRevoke.email}</strong>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="revoke-reason" className="text-xs font-semibold">
                  Powód cofnięcia dostępu <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="revoke-reason"
                  rows={3}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Np. rozwiązanie umowy o pracę, zmiana działu..."
                  className="text-xs resize-none"
                  required
                />
                <p className="text-2xs text-gray-500">
                  Wymagane min. 3 znaki. Informacja zostanie zapisana w audycie członkostwa.
                </p>
              </div>

              {revokeError && (
                <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {revokeError}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAccountForRevoke(null)}
                  disabled={revokeMutation.isPending}
                >
                  Anuluj
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={revokeMutation.isPending || revokeReason.trim().length < 3}
                >
                  {revokeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Potwierdź cofnięcie dostępu
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reinstate dialog */}
      <Dialog open={!!selectedAccountForReinstate} onOpenChange={(open) => !open && setSelectedAccountForReinstate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <UserCheck className="w-5 h-5" />
              Przywróć dostęp pracownikowi
            </DialogTitle>
            <DialogDescription>
              Przywrócenie dostępu pozwoli pracownikowi na ponowne logowanie się do portalu pracowniczego i korzystanie z przypisanego programu rabatowego.
            </DialogDescription>
          </DialogHeader>

          {selectedAccountForReinstate && (
            <form onSubmit={handleReinstateSubmit} className="space-y-4 py-2">
              <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-gray-500">Pracownik: </span>
                  <strong className="text-gray-800">
                    {[selectedAccountForReinstate.firstName, selectedAccountForReinstate.lastName].filter(Boolean).join(' ') || '-'}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-500">Email: </span>
                  <strong className="text-gray-800">{selectedAccountForReinstate.email}</strong>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reinstate-reason" className="text-xs font-semibold">
                  Notatka / powód przywrócenia (opcjonalnie)
                </Label>
                <Textarea
                  id="reinstate-reason"
                  rows={2}
                  value={reinstateReason}
                  onChange={(e) => setReinstateReason(e.target.value)}
                  placeholder="Np. odnowienie kontraktu, pomyłkowa blokada..."
                  className="text-xs resize-none"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAccountForReinstate(null)}
                  disabled={reinstateMutation.isPending}
                >
                  Anuluj
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  size="sm"
                  disabled={reinstateMutation.isPending}
                >
                  {reinstateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Przywróć dostęp
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
