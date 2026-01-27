import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { crmTrackingApi } from '@/services/api';
import {
    CRM_OFFER_PARAM,
    generateSessionId,
    parseOfferDiscount,
    parseOfferPayload,
    readCrmOfferDiscount,
    readCrmSessionId,
    readCrmUuid,
    writeCrmOfferDiscount,
    writeCrmSessionId,
    writeCrmUuid,
} from '@/utils/crmTracking';

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
        const offerParam = params.get(CRM_OFFER_PARAM);
        const payload = parseOfferPayload(offerParam);
        if (!payload) return;

        const payloadUuid = payload.get('uuid');
        const payloadDiscount = parseOfferDiscount(payload.get('offerDiscount'));

        if (payloadUuid) {
            writeCrmUuid(payloadUuid);
            setUuid(payloadUuid);
        }

        if (payloadDiscount !== null) {
            writeCrmOfferDiscount(payloadDiscount);
            setOfferDiscount(payloadDiscount);
        }
    }, [location.search]);

    useEffect(() => {
        if (!uuid || !sessionId) return;
        if (location.pathname.startsWith('/admin')) return;

        const visitedAt = new Date().toISOString();
        const url = `${location.pathname}${location.search}`;

        crmTrackingApi.trackVisit({
            uuid,
            sessionId,
            url,
            visitedAt
        }).catch(() => undefined);
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
