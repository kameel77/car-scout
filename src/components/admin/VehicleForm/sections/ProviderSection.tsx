import type { SectionProps } from '../types';

interface ProviderSectionProps extends SectionProps {
    dealers: Array<{ id: string; name: string; city?: string }>;
    companies?: Array<{ id: string; name: string }>;
}

export function ProviderSection({ form, setField, mode, dealers, companies = [] }: ProviderSectionProps) {
    if (mode === 'sale') {
        const dealerId = form.providerId.startsWith('dealer_') ? form.providerId.replace('dealer_', '') : '';
        return (
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Dealer *</label>
                <select
                    value={dealerId}
                    onChange={e => setField('providerId', e.target.value ? `dealer_${e.target.value}` : '')}
                    className="w-full h-10 px-3 rounded-md border text-sm"
                    required
                >
                    <option value="">Wybierz dealera...</option>
                    {dealers.map(d => (
                        <option key={d.id} value={d.id}>{d.name}{d.city ? ` (${d.city})` : ''}</option>
                    ))}
                </select>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Dostawca *</label>
            <select
                value={form.providerId}
                onChange={e => setField('providerId', e.target.value)}
                className="w-full h-10 px-3 rounded-md border text-sm"
                required
            >
                <option value="">Wybierz dostawcę...</option>
                <optgroup label="Firmy Najmujące">
                    {companies.map(c => (
                        <option key={c.id} value={`company_${c.id}`}>{c.name}</option>
                    ))}
                </optgroup>
                <optgroup label="Dealerzy">
                    {dealers.map(d => (
                        <option key={d.id} value={`dealer_${d.id}`}>{d.name}{d.city ? ` (${d.city})` : ''}</option>
                    ))}
                </optgroup>
            </select>
        </div>
    );
}
