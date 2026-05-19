import { useEffect, useState } from 'react';
import {
    ConsentChoice,
    commitConsent,
    loadConsent,
    subscribeConsent,
    fetchGeo,
} from '@/lib/consent';
import { useBrand } from '@/contexts/BrandContext';

export function useConsent() {
    const { config } = useBrand();
    const [choice, setChoice] = useState<ConsentChoice | null>(() => loadConsent());
    const [isEEA, setIsEEA] = useState<boolean | null>(null);

    useEffect(() => {
        const unsub = subscribeConsent(setChoice);
        return () => { unsub(); };
    }, []);

    useEffect(() => {
        let alive = true;
        fetchGeo().then((g) => { if (alive) setIsEEA(g.isEEA); });
        return () => { alive = false; };
    }, []);

    const accept = (next: { analytics: boolean; marketing: boolean }) =>
        commitConsent(next, { brandId: config.id });

    return {
        choice,
        isEEA,
        hasDecided: choice !== null,
        accept,
        acceptAll: () => accept({ analytics: true, marketing: true }),
        rejectOptional: () => accept({ analytics: false, marketing: false }),
    };
}
