import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Network, Store, Globe, ChevronDown, Check, Loader2 } from 'lucide-react';
import { useAuth, ScopeType } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ScopeOption {
    scopeType: ScopeType;
    scopeId: string;
    label: string;
    sublabel?: string;
    icon: React.ComponentType<{ className?: string }>;
}

export function ContextSwitcher() {
    const { token, activeContext, switchContext, isPlatformUser } = useAuth();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<ScopeOption[]>([]);
    const [loadingOptions, setLoadingOptions] = useState(false);

    const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '');

    useEffect(() => {
        if (open && isPlatformUser && token) {
            loadOptions();
        }
    }, [open, isPlatformUser, token]);

    const loadOptions = async () => {
        setLoadingOptions(true);
        try {
            const opts: ScopeOption[] = [
                { scopeType: 'PLATFORM', scopeId: 'PLATFORM', label: 'Platforma (wszystko)', icon: Globe },
            ];

            // Fetch dealer groups
            const groupsRes = await fetch(`${API_BASE_URL}/api/dealer-groups`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (groupsRes.ok) {
                const { groups } = await groupsRes.json();
                for (const g of groups) {
                    opts.push({
                        scopeType: 'DEALER_GROUP',
                        scopeId: g.id,
                        label: g.name,
                        sublabel: `${g._count?.dealers ?? 0} dealerów`,
                        icon: Network,
                    });
                }
            }

            // Fetch dealers
            const dealersRes = await fetch(`${API_BASE_URL}/api/admin/dealers`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (dealersRes.ok) {
                const { dealers } = await dealersRes.json();
                for (const d of dealers) {
                    opts.push({
                        scopeType: 'DEALER',
                        scopeId: d.id,
                        label: d.name,
                        sublabel: d.dealerGroup?.name || 'Brak grupy',
                        icon: Store,
                    });
                }
            }

            setOptions(opts);
        } catch (error) {
            console.error('Failed to load context options:', error);
        } finally {
            setLoadingOptions(false);
        }
    };

    const handleSwitch = async (opt: ScopeOption) => {
        setLoading(true);
        const ok = await switchContext(opt.scopeType, opt.scopeId, opt.label);
        setLoading(false);
        if (ok) {
            setOpen(false);
        }
    };

    const isActive = (opt: ScopeOption) =>
        activeContext?.scopeType === opt.scopeType && activeContext?.scopeId === opt.scopeId;

    const currentLabel = activeContext?.label || (activeContext?.scopeType === 'PLATFORM' ? 'Platforma' : 'Kontekst');

    const CurrentIcon = activeContext?.scopeType === 'DEALER_GROUP' ? Network
        : activeContext?.scopeType === 'DEALER' ? Store
            : Globe;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="rounded-xl border-gray-200 hover:border-blue-300 gap-2 max-w-[280px]"
                    disabled={loading}
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <CurrentIcon className="w-4 h-4 text-blue-500" />
                    )}
                    <span className="truncate text-sm">{currentLabel}</span>
                    <ChevronDown className="w-3 h-3 text-gray-400 ml-1" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2 max-h-[400px] overflow-y-auto" align="start">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-2">
                    Przełącz kontekst
                </p>

                {loadingOptions ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {options.map((opt) => {
                            const Icon = opt.icon;
                            const active = isActive(opt);

                            return (
                                <button
                                    key={`${opt.scopeType}-${opt.scopeId}`}
                                    onClick={() => handleSwitch(opt)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                                        active
                                            ? "bg-blue-50 text-blue-700"
                                            : "hover:bg-gray-50 text-gray-700"
                                    )}
                                >
                                    <Icon className={cn(
                                        "w-4 h-4 shrink-0",
                                        active ? "text-blue-500" : "text-gray-400"
                                    )} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{opt.label}</p>
                                        {opt.sublabel && (
                                            <p className="text-xs text-gray-400 truncate">{opt.sublabel}</p>
                                        )}
                                    </div>
                                    {active && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                                </button>
                            );
                        })}

                        {options.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-4">
                                Brak dostępnych kontekstów
                            </p>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
