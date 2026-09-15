import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { employeeAdminApi, EmployeeCompanyItem } from '@/services/employee-admin.service';
import { CompanyList } from '@/components/admin/employee-programs/CompanyList';
import { CompanyDetailView } from '@/components/admin/employee-programs/CompanyDetailView';
import { CompanyCreateDialog } from '@/components/admin/employee-programs/CompanyCreateDialog';
import { Building2 } from 'lucide-react';

export const EmployeeProgramsPage: React.FC = () => {
    const queryClient = useQueryClient();
    const { token } = useAuth();
    const [selectedCompany, setSelectedCompany] = useState<EmployeeCompanyItem | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Fetch companies list
    const { data, isLoading: isLoadingCompanies } = useQuery({
        queryKey: ['admin-employee-companies'],
        queryFn: () => employeeAdminApi.listCompanies({ limit: 100 }, token || ''),
        enabled: !!token,
    });

    const companies = data?.companies || [];

    // Keep selectedCompany updated if data refetches
    const currentSelectedCompany = selectedCompany
        ? companies.find((c) => c.id === selectedCompany.id) || selectedCompany
        : null;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Top Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
                        <Building2 className="w-7 h-7 text-blue-600" />
                        Program Samochodowy dla Firm
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Zarządzanie programami benefitowymi pracowników, dedykowanymi ofertami flotowymi i kodami rejestracyjnymi.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            {currentSelectedCompany && token ? (
                <CompanyDetailView
                    company={currentSelectedCompany}
                    token={token}
                    onBack={() => setSelectedCompany(null)}
                />
            ) : (
                <CompanyList
                    companies={companies}
                    isLoading={isLoadingCompanies}
                    onSelectCompany={(company) => setSelectedCompany(company)}
                    onOpenCreateDialog={() => setIsCreateOpen(true)}
                />
            )}

            {/* Create Company Dialog */}
            {token && (
                <CompanyCreateDialog
                    open={isCreateOpen}
                    onOpenChange={setIsCreateOpen}
                    token={token}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['admin-employee-companies'] });
                    }}
                />
            )}
        </div>
    );
};

export default EmployeeProgramsPage;
