import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Building2, KeyRound, Sparkles, FileSpreadsheet, Settings, ExternalLink } from 'lucide-react';
import { EmployeeCompanyItem, EmployeeProgramSummary } from '@/services/employee-admin.service';
import { RegistrationCodesTab } from './RegistrationCodesTab';
import { SpecialOffersTab } from './SpecialOffersTab';
import { MatrixImportTab } from './MatrixImportTab';
import { ProgramSettingsTab } from './ProgramSettingsTab';

interface Props {
  company: EmployeeCompanyItem;
  token: string;
  onBack: () => void;
}

export const CompanyDetailView: React.FC<Props> = ({ company, token, onBack }) => {
  // If company has multiple programs, default to the first
  const [activeProgramId, setActiveProgramId] = useState<string>(
    company.programs[0]?.id || ''
  );

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
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {company.nip && <span>NIP: <strong className="text-gray-700">{company.nip}</strong></span>}
              <span>·</span>
              <span>Identyfikator: <code className="text-gray-600 bg-gray-100 px-1 py-0.5 rounded">{company.slug}</code></span>
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
              value="settings"
              className="flex items-center gap-2 py-2 px-3.5 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all"
            >
              <Settings className="w-4 h-4" />
              Ustawienia & Benefity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="codes" className="mt-0 outline-none">
            <RegistrationCodesTab programId={activeProgram.id} token={token} />
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
        </Tabs>
      ) : (
        <div className="p-8 bg-white rounded-xl border border-gray-200 text-center text-sm text-gray-500">
          Ta organizacja nie posiada jeszcze przypisanego programu.
        </div>
      )}
    </div>
  );
};
