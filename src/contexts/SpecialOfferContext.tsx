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
    initialPayment: number | null;
    hasSpecialOffer: boolean;
    setProgrammaticOffer: (offer: { discount: number; initialPayment?: number | null } | null) => void;
}

const SpecialOfferContext = createContext<SpecialOfferContextType | undefined>(undefined);

export function SpecialOfferProvider({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const [discount, setDiscount] = useState<number>(() => readSpecialOfferDiscount() ?? 0);
    const [initialPayment, setInitialPayment] = useState<number | null>(null);
    const [programmaticOffer, setProgrammaticOffer] = useState<{ discount: number; initialPayment?: number | null } | null>(null);

    useEffect(() => {
        if (programmaticOffer !== null) return;
        const params = new URLSearchParams(location.search);
        const paramValue = params.get(OFFER_PARAM);
        const parsed = parseDiscountFromOfferParam(paramValue);

        if (parsed !== null) {
            writeSpecialOfferDiscount(parsed.discount);
            setDiscount(parsed.discount);
            if (parsed.initialPayment) {
                setInitialPayment(parsed.initialPayment);
            }
            return;
        }

        const cookieValue = readSpecialOfferDiscount();
        if (cookieValue !== null && cookieValue !== discount) {
            setDiscount(cookieValue);
        }
    }, [location.search, discount, programmaticOffer]);

    const activeDiscount = programmaticOffer !== null ? programmaticOffer.discount : discount;
    const activeInitialPayment = programmaticOffer !== null ? (programmaticOffer.initialPayment ?? null) : initialPayment;

    const value = useMemo(() => ({
        discount: activeDiscount,
        initialPayment: activeInitialPayment,
        hasSpecialOffer: activeDiscount > 0,
        setProgrammaticOffer,
    }), [activeDiscount, activeInitialPayment]);

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
