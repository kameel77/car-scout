import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    OFFER_PARAM,
    parseDiscountFromOfferParam,
    readSpecialOfferDiscount,
    writeSpecialOfferDiscount,
} from '@/utils/specialOffer';

interface SpecialOfferContextType {
    discount: number;
    hasSpecialOffer: boolean;
}

const SpecialOfferContext = createContext<SpecialOfferContextType | undefined>(undefined);

export function SpecialOfferProvider({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const [discount, setDiscount] = useState<number>(() => readSpecialOfferDiscount() ?? 0);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const paramValue = params.get(OFFER_PARAM);
        const parsed = parseDiscountFromOfferParam(paramValue);

        if (parsed !== null) {
            writeSpecialOfferDiscount(parsed);
            setDiscount(parsed);
            return;
        }

        const cookieValue = readSpecialOfferDiscount();
        if (cookieValue !== null && cookieValue !== discount) {
            setDiscount(cookieValue);
        }
    }, [location.search, discount]);

    const value = useMemo(() => ({
        discount,
        hasSpecialOffer: discount > 0,
    }), [discount]);

    return (
        <SpecialOfferContext.Provider value={value}>
            {children}
        </SpecialOfferContext.Provider>
    );
}

export function useSpecialOffer() {
    const context = useContext(SpecialOfferContext);
    if (!context) {
        throw new Error('useSpecialOffer must be used within a SpecialOfferProvider');
    }
    return context;
}
