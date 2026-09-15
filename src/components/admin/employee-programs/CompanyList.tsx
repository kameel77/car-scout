import React, { useState, useMemo } from 'react';
import { Building2, Search, Plus, Users, Tag, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeCompanyItem } from '@/services/employee-admin.service';

interface CompanyListProps {
    companies: EmployeeCompanyItem[];
    isLoading: boolean;
    onSelectCompany: (company: EmployeeCompanyItem) => void;
    onOpenCreateDialog: () => void;
}

export const CompanyList: React.FC<CompanyListProps> = ({
    companies,
    isLoading,
    onSelectCompany,
    onOpenCreateDialog,
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCompanies = useMemo(() => {
        if (!searchQuery.trim()) return companies;
        const q = searchQuery.toLowerCase();
        return companies.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.slug.toLowerCase().includes(q) ||
                (c.nip && c.nip.toLowerCase().includes(q))
        );
    }, [companies, searchQuery]);

    return (
        <Card className="shadow-xs border-gray-200">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2 text-gray-900">
                            <Building2 className="w-5 h-5 text-blue-600" />
                            Firmy partnerskie
                        </CardTitle>
                        <CardDescription>
                            Zarządzaj programami rabatowymi, flotowymi matrycami najmu i kodami dostępu dla pracowników.
                        </CardDescription>
                    </div>
                    <Button onClick={onOpenCreateDialog} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                        <Plus className="w-4 h-4" />
                        Dodaj firmę
                    </Button>
                </div>

                <div className="mt-4 flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Szukaj po nazwie lub NIP..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="py-16 text-center text-gray-500">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                        <p className="text-sm">Ładowanie firm partnerskich...</p>
                    </div>
                ) : filteredCompanies.length === 0 ? (
                    <div className="py-16 text-center text-gray-500">
                        <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <h3 className="font-semibold text-gray-900 mb-1">
                            {searchQuery ? 'Brak wyników wyszukiwania' : 'Brak firm partnerskich'}
                        </h3>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
                            {searchQuery
                                ? 'Nie znaleziono żadnej firmy pasującej do podanego zapytania.'
                                : 'Nie dodano jeszcze żadnej firmy partnerskiej. Dodaj pierwszą firmę, aby skonfigurować program rabatowy dla jej pracowników.'}
                        </p>
                        {!searchQuery && (
                            <Button onClick={onOpenCreateDialog} variant="outline" className="gap-2">
                                <Plus className="w-4 h-4" />
                                Dodaj firmę
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50/75 border-y border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                <tr>
                                    <th className="py-3 px-4">Firma</th>
                                    <th className="py-3 px-4">NIP</th>
                                    <th className="py-3 px-4">Program</th>
                                    <th className="py-3 px-4 text-center">Kody rejestracyjne</th>
                                    <th className="py-3 px-4 text-center">Oferty specjalne</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4 text-right">Akcje</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCompanies.map((c) => {
                                    const defaultProgram = c.programs?.[0];
                                    const codesCount = defaultProgram?._count?.registrationCodes ?? c._count?.registrationCodes ?? 0;
                                    const offersCount = defaultProgram?._count?.offers ?? 0;

                                    return (
                                        <tr
                                            key={c.id}
                                            onClick={() => onSelectCompany(c)}
                                            className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                                        >
                                            <td className="py-3.5 px-4 font-medium text-gray-900">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                                                        {c.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                            {c.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{c.slug}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-600 font-mono text-xs">
                                                {c.nip || '-'}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {defaultProgram ? (
                                                    <div>
                                                        <div className="font-medium text-gray-800">{defaultProgram.name}</div>
                                                        <div className="text-xs text-gray-500">
                                                            Rabat: {defaultProgram.defaultDiscountPct ? `${defaultProgram.defaultDiscountPct}%` : 'Domyślny'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Brak programu</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <Badge variant="secondary" className="gap-1 font-normal">
                                                    <Users className="w-3 h-3 text-gray-500" />
                                                    {codesCount}
                                                </Badge>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <Badge variant="secondary" className="gap-1 font-normal">
                                                    <Tag className="w-3 h-3 text-gray-500" />
                                                    {offersCount}
                                                </Badge>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {c.isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                        Aktywna
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                                                        <XCircle className="w-3.5 h-3.5 text-gray-400" />
                                                        Nieaktywna
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectCompany(c);
                                                    }}
                                                >
                                                    Zarządzaj
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
