import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SectionProps } from '../types';

export function DescriptionSection({ form, setField }: SectionProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nagłówek opisu dodatkowego</label>
                <Input value={form.additionalInfoHeader} onChange={e => setField('additionalInfoHeader', e.target.value)} />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Treść opisu dodatkowego</label>
                <Textarea value={form.additionalInfoContent} onChange={e => setField('additionalInfoContent', e.target.value)} rows={6} />
            </div>
        </div>
    );
}
