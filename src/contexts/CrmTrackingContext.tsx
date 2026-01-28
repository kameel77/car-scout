import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { crmTrackingApi } from '@/services/api';
generateSessionId,
    readCrmOfferDiscount,
    readCrmSessionId,
    readCrmUuid,
    writeCrmOfferDiscount,
    writeCrmSessionId,
    writeCrmUuid,
} from '@/utils/crmTracking';
import { parseOfferParam, OFFER_PARAM } from '@/utils/offerParser';

interface CrmTrackingContextType {
    uuid: string | null;
    offerDiscount: number | null;
    sessionId: string | null;
}

const CrmTrackingContext = createContext<CrmTrackingContextType | undefined>(undefined);

export function CrmTrackingProvider({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const [uuid, setUuid] = useState<string | null>(() => readCrmUuid());
    const [offerDiscount, setOfferDiscount] = useState<number | null>(() => readCrmOfferDiscount());
    const [sessionId, setSessionId] = useState<string | null>(() => readCrmSessionId());

    useEffect(() => {
        if (!sessionId) {
            const newSessionId = generateSessionId();
            writeCrmSessionId(newSessionId);
            setSessionId(newSessionId);
        }
    }, [sessionId]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const offerParam = params.get(OFFER_PARAM);
        const parsed = parseOfferParam(offerParam);

        if (parsed.type === 'crm_tracking') {
            writeCrmUuid(parsed.uuid);
            setUuid(parsed.uuid);
            writeCrmOfferDiscount(parsed.discount);
            setOfferDiscount(parsed.discount);
        }
    }, [location.search]);

    useEffect(() => {
        if (!uuid || !sessionId) return;

        // Exclude admin and internal pages
        const excludedPaths = ['/admin', '/dashboard', '/api'];
        if (excludedPaths.some(path => location.pathname.startsWith(path))) return;

        // Debounce rapid navigation
        const timeoutId = setTimeout(() => {
            const visitedAt = new Date().toISOString();
            const url = `${location.pathname}${location.search}`;

            crmTrackingApi.trackVisit({
                uuid,
                sessionId,
                url,
                visitedAt
            }).catch((error) => {
                // Only log in development
                if (import.meta.env.DEV) {
                    console.warn('Failed to track visit:', error);
                }
            });
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [location.pathname, location.search, sessionId, uuid]);

    const value = useMemo(() => ({
        uuid,
        offerDiscount,
        sessionId
    }), [offerDiscount, sessionId, uuid]);

    return (
        <CrmTrackingContext.Provider value={value}>
            {children}
        </CrmTrackingContext.Provider>
    );
}

export function useCrmTracking() {
    const context = useContext(CrmTrackingContext);
    if (!context) {
        throw new Error('useCrmTracking must be used within a CrmTrackingProvider');
    }
    return context;
}
