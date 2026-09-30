import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useConsent } from '@/hooks/useConsent';
import { OPEN_CONSENT_SETTINGS_EVENT } from '@/lib/consent';

const ConsentBanner = lazy(() =>
    import('./ConsentBanner').then((m) => ({ default: m.ConsentBanner })),
);

// Baner i dialog ustawień ładują się tylko gdy brak zapisanej zgody albo gdy ktoś
// poprosił o ustawienia (link „Ustawienia cookies" w stopce). Zdarzenie wysłane przed
// załadowaniem chunka jest zapamiętane i otwiera dialog zaraz po zamontowaniu.
export function ConsentGate() {
    const { hasDecided } = useConsent();
    const [settingsRequested, setSettingsRequested] = useState(false);
    const everNeeded = useRef(false);

    useEffect(() => {
        const handler = () => setSettingsRequested(true);
        window.addEventListener(OPEN_CONSENT_SETTINGS_EVENT, handler);
        return () => window.removeEventListener(OPEN_CONSENT_SETTINGS_EVENT, handler);
    }, []);

    if (!hasDecided || settingsRequested) everNeeded.current = true;
    if (!everNeeded.current) return null;

    return (
        <Suspense fallback={null}>
            <ConsentBanner initialSettingsOpen={settingsRequested} />
        </Suspense>
    );
}
