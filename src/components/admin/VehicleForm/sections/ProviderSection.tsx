import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Check, ChevronsUpDown } from 'lucide-react';
import type { SectionProps } from '../types';

interface ProviderSectionProps extends SectionProps {
    dealers: Array<{ id: string; name: string; city?: string }>;
    companies?: Array<{ id: string; name: string }>;
}

export function ProviderSection({ form, setField, mode, dealers, companies = [] }: ProviderSectionProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    if (mode === 'sale') {
        const dealerId = form.providerId.startsWith('dealer_') ? form.providerId.replace('dealer_', '') : '';
        const selectedDealer = dealers.find(d => d.id === dealerId);

        const filteredDealers = dealers.filter(d => 
            d.name.toLowerCase().includes(search.toLowerCase()) ||
            d.id.toLowerCase().includes(search.toLowerCase()) ||
            (d.city && d.city.toLowerCase().includes(search.toLowerCase()))
        );

        return (
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 block">Dealer *</label>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between font-normal text-left h-10 px-3 bg-white hover:bg-white border-input"
                        >
                            <span className="truncate">
                                {selectedDealer 
                                    ? `${selectedDealer.name}${selectedDealer.city ? ` (${selectedDealer.city})` : ''}`
                                    : "Wybierz dealera..."
                                }
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-white" align="start">
                        <div className="flex items-center border-b px-3 bg-white">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-gray-500" />
                            <Input
                                placeholder="Szukaj dealera..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-10 shadow-none bg-transparent"
                            />
                        </div>
                        <div className="max-h-[250px] overflow-y-auto p-1 space-y-0.5">
                            {filteredDealers.length === 0 ? (
                                <div className="py-6 text-center text-sm text-gray-500">Nie znaleziono dealera.</div>
                            ) : (
                                filteredDealers.map(d => {
                                    const isSelected = d.id === dealerId;
                                    return (
                                        <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => {
                                                setField('providerId', `dealer_${d.id}`);
                                                setOpen(false);
                                                setSearch('');
                                            }}
                                            className="w-full text-left flex items-center justify-between px-3 py-2 rounded text-sm hover:bg-slate-100 transition-colors text-slate-900"
                                        >
                                            <span className="truncate">{d.name}{d.city ? ` (${d.city})` : ''}</span>
                                            {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        );
    }

    // Rental mode: can choose either a company (starts with `company_`) or a dealer (starts with `dealer_`)
    const selectedCompany = form.providerId.startsWith('company_')
        ? companies.find(c => `company_${c.id}` === form.providerId)
        : null;
    const selectedDealer = form.providerId.startsWith('dealer_')
        ? dealers.find(d => `dealer_${d.id}` === form.providerId)
        : null;

    const selectedLabel = selectedCompany
        ? selectedCompany.name
        : selectedDealer
        ? `${selectedDealer.name}${selectedDealer.city ? ` (${selectedDealer.city})` : ''}`
        : "Wybierz dostawcę...";

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase())
    );
    const filteredDealers = dealers.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.id.toLowerCase().includes(search.toLowerCase()) ||
        (d.city && d.city.toLowerCase().includes(search.toLowerCase()))
    );

    const hasResults = filteredCompanies.length > 0 || filteredDealers.length > 0;

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">Dostawca *</label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between font-normal text-left h-10 px-3 bg-white hover:bg-white border-input"
                    >
                        <span className="truncate">{selectedLabel}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-white" align="start">
                    <div className="flex items-center border-b px-3 bg-white">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-gray-500" />
                        <Input
                            placeholder="Szukaj dostawcy..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-10 shadow-none bg-transparent"
                        />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-1 space-y-1">
                        {!hasResults ? (
                            <div className="py-6 text-center text-sm text-gray-500">Nie znaleziono dostawcy.</div>
                        ) : (
                            <>
                                {filteredCompanies.length > 0 && (
                                    <div>
                                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-50 rounded">Firmy Najmujące</div>
                                        <div className="mt-1 space-y-0.5">
                                            {filteredCompanies.map(c => {
                                                const value = `company_${c.id}`;
                                                const isSelected = form.providerId === value;
                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setField('providerId', value);
                                                            setOpen(false);
                                                            setSearch('');
                                                        }}
                                                        className="w-full text-left flex items-center justify-between px-3 py-2 rounded text-sm hover:bg-slate-100 transition-colors text-slate-900"
                                                    >
                                                        <span className="truncate">{c.name}</span>
                                                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {filteredDealers.length > 0 && (
                                    <div className="mt-2">
                                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-50 rounded">Dealerzy</div>
                                        <div className="mt-1 space-y-0.5">
                                            {filteredDealers.map(d => {
                                                const value = `dealer_${d.id}`;
                                                const isSelected = form.providerId === value;
                                                return (
                                                    <button
                                                        key={d.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setField('providerId', value);
                                                            setOpen(false);
                                                            setSearch('');
                                                        }}
                                                        className="w-full text-left flex items-center justify-between px-3 py-2 rounded text-sm hover:bg-slate-100 transition-colors text-slate-900"
                                                    >
                                                        <span className="truncate">{d.name}{d.city ? ` (${d.city})` : ''}</span>
                                                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
