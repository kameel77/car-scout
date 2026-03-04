import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { parseOfferParam, OFFER_PARAM } from '@/utils/offerParser';
import { readPersonalOfferIds, writePersonalOfferIds } from '@/utils/personalOffer';

interface PersonalOfferContextType {
    selectedIds: string[];
    hasPersonalOffer: boolean;
}

const PersonalOfferContext = createContext<PersonalOfferContextType | undefined>(undefined);

export function PersonalOfferProvider({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const [selectedIds, setSelectedIds] = useState<string[]>(() => readPersonalOfferIds());

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const offerParam = params.get(OFFER_PARAM);
        const parsed = parseOfferParam(offerParam);

        if (parsed.type !== 'invalid' && parsed.selectedIds?.length) {
            writePersonalOfferIds(parsed.selectedIds);
            setSelectedIds(parsed.selectedIds);
            return;
        }

        // On mount or URL change without offer param, re-read from cookie
        const cookieIds = readPersonalOfferIds();
        if (cookieIds.length > 0 && JSON.stringify(cookieIds) !== JSON.stringify(selectedIds)) {
            setSelectedIds(cookieIds);
        }
    }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

    const value = useMemo(() => ({
        selectedIds,
        hasPersonalOffer: selectedIds.length > 0,
    }), [selectedIds]);

    return (
        <PersonalOfferContext.Provider value={value}>
            {children}
        </PersonalOfferContext.Provider>
    );
}

export function usePersonalOffer() {
    const context = useContext(PersonalOfferContext);
    if (!context) {
        throw new Error('usePersonalOffer must be used within a PersonalOfferProvider');
    }
    return context;
}
