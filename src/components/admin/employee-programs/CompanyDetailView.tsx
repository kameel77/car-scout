import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { ArrowLeft, Building2, KeyRound, Sparkles, FileSpreadsheet, Settings, ExternalLink, Users, Edit3, Loader2, Mail, CreditCard } from 'lucide-react';
import { EmployeeCompanyItem, EmployeeProgramSummary, employeeAdminApi } from '@/services/employee-admin.service';
import { RegistrationCodesTab } from './RegistrationCodesTab';
import { SpecialOffersTab } from './SpecialOffersTab';
import { MatrixImportTab } from './MatrixImportTab';
import { ProgramSettingsTab } from './ProgramSettingsTab';
import { EmployeesTab } from './EmployeesTab';
import { ProductOverridesTab } from './ProductOverridesTab';

interface Props {
  company: EmployeeCompanyItem;
  token: string;
  onBack: () => void;
}

export const CompanyDetailView: React.FC<Props> = ({ company, token, onBack }) => {
  const queryClient = useQueryClient();

  // If company has multiple programs, default to the first
  const [activeProgramId, setActiveProgramId] = useState<string>(
    company.programs[0]?.id || ''
  );

  // Edit company modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(company.name);
  const [editNip, setEditNip] = useState(company.nip || '');
  const [editAccountManagerEmail, setEditAccountManagerEmail] = useState(company.accountManagerEmail || '');
  const [editError, setEditError] = useState<string | null>(null);

  const updateCompanyMutation = useMutation({
    mutationFn: (data: { name?: string; nip?: string | null; accountManagerEmail?: string | null }) =>
      employeeAdminApi.updateCompany(company.id, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-employee-companies'] });
      queryClient.invalidateQueries({ queryKey: ['employee-companies'] });
      setIsEditOpen(false);
      setEditError(null);
    },
    onError: (err: unknown) => {
      setEditError(err instanceof Error ? err.message : 'Błąd podczas zapisywania zmian');
    }
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    updateCompanyMutation.mutate({
      name: editName.trim() || undefined,
      nip: editNip.trim() || null,
      accountManagerEmail: editAccountManagerEmail.trim() || null
    });
  };

  const activeProgram = company.programs.find((p: EmployeeProgramSummary) => p.id === activeProgramId) || company.programs[0];

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack} className="shrink-0 rounded-xl">
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-gray-900">{company.name}</h2>
              <Badge className={company.isActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-gray-100 text-gray-600'}>
                {company.isActive ? 'Organizacja aktywna' : 'Wstrzymana'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditName(company.name);
                  setEditNip(company.nip || '');
                  setEditAccountManagerEmail(company.accountManagerEmail || '');
                  setEditError(null);
                  setIsEditOpen(true);
                }}
                className="h-7 px-2 text-xs text-gray-500 hover:text-gray-900"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                Edytuj
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
              {company.nip && <span>NIP: <strong className="text-gray-700">{company.nip}</strong></span>}
              <span>·</span>
              <span>Identyfikator: <code className="text-gray-600 bg-gray-100 px-1 py-0.5 rounded">{company.slug}</code></span>
              {company.accountManagerEmail && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-gray-400" />
                    Opiekun: <strong className="text-gray-700">{company.accountManagerEmail}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {activeProgram && (
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 pl-2">Program:</span>
            <span className="text-xs font-semibold text-gray-900 bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs">
              {activeProgram.name}
            </span>
          </div>
        )}
      </div>

      {/* Edit company modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edytuj dane organizacji</DialogTitle>
            <DialogDescription>
              Zaktualizuj nazwę, NIP oraz dedykowany adres e-mail opiekuna zgłoszeń dla {company.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="company-name" className="text-xs font-semibold">
                Nazwa organizacji <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-nip" className="text-xs font-semibold">
                NIP firmy
              </Label>
              <Input
                id="company-nip"
                value={editNip}
                onChange={(e) => setEditNip(e.target.value)}
                placeholder="np. 1234567890"
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-account-manager-email" className="text-xs font-semibold">
                E-mail opiekuna zgłoszeń (Account Manager)
              </Label>
              <Input
                id="company-account-manager-email"
                type="email"
                value={editAccountManagerEmail}
                onChange={(e) => setEditAccountManagerEmail(e.target.value)}
                placeholder="opiekun@twojafirma.pl"
                className="text-xs"
              />
              <p className="text-2xs text-gray-500">
                Na ten adres e-mail będą wysyłane powiadomienia o nowych zapytaniach pracowników tej organizacji. W razie braku adresu używany jest główny odbiorca platformy.
              </p>
            </div>

            {editError && (
              <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs">
                {editError}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={updateCompanyMutation.isPending}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateCompanyMutation.isPending || !editName.trim()}
              >
                {updateCompanyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Zapisz zmiany
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tabs navigation */}
      {activeProgram ? (
        <Tabs defaultValue="codes" className="w-full space-y-6">
          <TabsList className="bg-white p-1 rounded-xl border border-gray-200 h-auto gap-1">
            <TabsTrigger
              value="codes"
              className="flex items-center gap-2 py-2 px-3.5 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all"
            >
              <KeyRound className="w-4 h-4" />
              Kody rejestracyjne
            </TabsTrigger>

            <TabsTrigger
              value="offers"
              className="flex items-center gap-2 py-2 px-3.5 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Oferty specjalne
            </TabsTrigger>

            <TabsTrigger
              value="matrix"
              className="flex items-center gap-2 py-2 px-3.5 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Prywatne matryce najmu (CSV)
            </TabsTrigger>

            <TabsTrigger
              value="employees"
              className="flex items-center gap-2 py-2 px-3.5 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all"
            >
              <Users className="w-4 h-4" />
              Pracownicy
            </TabsTrigger>

            <TabsTrigger
              value="settings"
              className="flex items-center gap-2 py-2 px-3.5 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all"
            >
              <Settings className="w-4 h-4" />
              Ustawienia & Benefity
            </TabsTrigger>

            <TabsTrigger
              value="product-overrides"
              className="flex items-center gap-2 py-2 px-3.5 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all"
            >
              <CreditCard className="w-4 h-4" />
              Produkty finansowe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="codes" className="mt-0 outline-none">
            <RegistrationCodesTab programId={activeProgram.id} token={token} />
          </TabsContent>

          <TabsContent value="employees" className="mt-0 outline-none">
            <EmployeesTab companyId={company.id} token={token} />
          </TabsContent>

          <TabsContent value="offers" className="mt-0 outline-none">
            <SpecialOffersTab programId={activeProgram.id} token={token} />
          </TabsContent>

          <TabsContent value="matrix" className="mt-0 outline-none">
            <MatrixImportTab programId={activeProgram.id} token={token} />
          </TabsContent>

          <TabsContent value="settings" className="mt-0 outline-none">
            <ProgramSettingsTab program={activeProgram} token={token} />
          </TabsContent>

          <TabsContent value="product-overrides" className="mt-0 outline-none">
            <ProductOverridesTab programId={activeProgram.id} token={token} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="p-8 bg-white rounded-xl border border-gray-200 text-center text-sm text-gray-500">
          Ta organizacja nie posiada jeszcze przypisanego programu.
        </div>
      )}
    </div>
  );
};
