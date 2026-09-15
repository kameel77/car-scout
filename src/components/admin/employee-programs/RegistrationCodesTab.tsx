import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { KeyRound, Plus, Copy, Check, AlertTriangle, ShieldX, Loader2 } from 'lucide-react';
import { employeeAdminApi, EmployeeRegistrationCode } from '@/services/employee-admin.service';

interface Props {
  programId: string;
  token: string;
}

export const RegistrationCodesTab: React.FC<Props> = ({ programId, token }) => {
  const queryClient = useQueryClient();
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  // One-time code revelation dialog state
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['employee-codes', programId],
    queryFn: () => employeeAdminApi.listCodes(programId, { limit: 50 }, token)
  });

  const generateMutation = useMutation({
    mutationFn: (payload: { label?: string | null; customCode?: string; expiresAt?: string | null }) =>
      employeeAdminApi.createCode(programId, payload, token),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['employee-codes', programId] });
      queryClient.invalidateQueries({ queryKey: ['employee-companies'] });
      setIsGenerateOpen(false);
      setLabel('');
      setCustomCode('');
      setExpiresAt('');
      setRevealedCode(res.rawCode);
      setCopied(false);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Błąd podczas generowania kodu');
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: (codeId: string) => employeeAdminApi.deactivateCode(codeId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-codes', programId] });
      queryClient.invalidateQueries({ queryKey: ['employee-companies'] });
    }
  });

  const handleCopyCode = async () => {
    if (!revealedCode) return;
    try {
      await navigator.clipboard.writeText(revealedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    generateMutation.mutate({
      label: label.trim() || null,
      customCode: customCode.trim() || undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
    });
  };

  const codes = data?.codes || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-600" />
            Kody rejestracyjne pracowników
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Kody przekazywane pracownikom (np. przez HR lub intranet) uprawniające do dołączenia do programu.
          </p>
        </div>
        <Button onClick={() => setIsGenerateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Generuj nowy kod
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          Ładowanie kodów rejestracyjnych...
        </div>
      ) : isError ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          Wystąpił błąd podczas ładowania listy kodów.
        </div>
      ) : codes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <KeyRound className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h4 className="text-sm font-medium text-gray-900">Brak aktywnych kodów</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Dla tego programu nie wygenerowano jeszcze żadnego kodu rejestracyjnego.
          </p>
          <Button onClick={() => setIsGenerateOpen(true)} variant="outline" size="sm" className="mt-4">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Utwórz pierwszy kod
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Etykieta / Cel</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ważność</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Utworzono</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((c: EmployeeRegistrationCode) => {
                const isExpired = c.expiresAt && new Date(c.expiresAt) <= new Date();
                const statusBadge = !c.isActive ? (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                    Dezaktywowany
                  </Badge>
                ) : isExpired ? (
                  <Badge variant="destructive" className="bg-amber-50 text-amber-800 border-amber-200">
                    Wygasł
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                    Aktywny
                  </Badge>
                );

                return (
                  <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.label || <span className="text-gray-400 italic">Brak etykiety</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.expiresAt ? (
                        new Date(c.expiresAt).toLocaleDateString('pl-PL', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      ) : (
                        <span className="text-gray-400">Bezterminowo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{statusBadge}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={deactivateMutation.isPending}
                          onClick={() => {
                            if (window.confirm('Czy na pewno chcesz unieważnić ten kod? Pracownicy nie będą mogli się nim zarejestrować.')) {
                              deactivateMutation.mutate(c.id);
                            }
                          }}
                        >
                          <ShieldX className="w-4 h-4 mr-1" />
                          Dezaktywuj
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog generowania kodu */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleGenerateSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                Generuj kod rejestracyjny
              </DialogTitle>
              <DialogDescription>
                Kod umożliwi pracownikom założenie konta w portalu na stronie rejestracji.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="my-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="code-label">Etykieta (dla kogo ten kod?)</Label>
                <Input
                  id="code-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="np. Pilotaż Centrala Q4 lub Pracownicy IT"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custom-code">Własny kod (opcjonalnie)</Label>
                <Input
                  id="custom-code"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="np. ACTION2026 (zostaw puste dla losowego)"
                  className="font-mono uppercase"
                />
                <p className="text-xs text-gray-500">
                  Zostaw puste, aby system wygenerował bezpieczny kod alfanumeryczny.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="code-expiry">Data wygaśnięcia (opcjonalnie)</Label>
                <Input
                  id="code-expiry"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsGenerateOpen(false)}>
                Anuluj
              </Button>
              <Button type="submit" disabled={generateMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generowanie...
                  </>
                ) : (
                  'Wygeneruj kod'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal jednorazowego wyświetlenia wygenerowanego kodu (ADR-02) */}
      <Dialog open={!!revealedCode} onOpenChange={(open) => !open && setRevealedCode(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <Check className="w-5 h-5 text-emerald-600" />
              Kod został wygenerowany pomyślnie
            </DialogTitle>
            <DialogDescription>
              Skopiuj poniższy kod i przekaż go pracownikom.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 p-5 bg-gray-50 rounded-xl border border-gray-200 text-center space-y-3">
            <div className="text-2xl font-mono font-bold tracking-wider text-gray-900 select-all">
              {revealedCode}
            </div>
            <Button
              onClick={handleCopyCode}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  Skopiowano do schowka!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Kopiuj kod do schowka
                </>
              )}
            </Button>
          </div>

          <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 rounded-lg text-amber-800 text-xs leading-relaxed border border-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              <strong>Ważna informacja o bezpieczeństwie:</strong> Zgodnie z architekturą bezpieczeństwa, w bazie danych zapisany został wyłącznie bezpieczny skrót SHA-256. Czysty kod nie będzie możliwy do ponownego odczytania w panelu po zamknięciu tego okna.
            </span>
          </div>

          <DialogFooter className="mt-2">
            <Button onClick={() => setRevealedCode(null)} className="w-full bg-gray-900 text-white hover:bg-gray-800">
              Rozumiem, kod został zapisany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
