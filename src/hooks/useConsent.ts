import { useEffect, useState } from 'react';
import {
    ConsentChoice,
    commitConsent,
    loadConsent,
    subscribeConsent,
} from '@/lib/consent';
import { useBrand } from '@/contexts/BrandContext';

export function useConsent() {
    const { config } = useBrand();
    const [choice, setChoice] = useState<ConsentChoice | null>(() => loadConsent());

    useEffect(() => {
        const unsub = subscribeConsent(setChoice);
        return () => { unsub(); };
    }, []);

    const accept = (next: { analytics: boolean; marketing: boolean }) =>
        commitConsent(next, { brandId: config.id });

    return {
        choice,
        hasDecided: choice !== null,
        accept,
        acceptAll: () => accept({ analytics: true, marketing: true }),
        rejectOptional: () => accept({ analytics: false, marketing: false }),
    };
}
