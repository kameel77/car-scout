import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    OFFER_PARAM,
    parseDiscountFromOfferParam,
    readSpecialOfferDiscount,
    readSpecialOfferInitialPayment,
    writeSpecialOfferDiscount,
    writeSpecialOfferInitialPayment,
} from '@/utils/specialOffer';

interface SpecialOfferContextType {
    discount: number;
    initialPayment: number | null;
    hasSpecialOffer: boolean;
}

const SpecialOfferContext = createContext<SpecialOfferContextType | undefined>(undefined);

export function SpecialOfferProvider({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const [discount, setDiscount] = useState<number>(() => readSpecialOfferDiscount() ?? 0);
    const [initialPayment, setInitialPayment] = useState<number | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const paramValue = params.get(OFFER_PARAM);
        const parsed = parseDiscountFromOfferParam(paramValue);

        if (parsed !== null) {
            writeSpecialOfferDiscount(parsed.discount);
            setDiscount(parsed.discount);
            if (parsed.initialPayment) {
                writeSpecialOfferInitialPayment(parsed.initialPayment);
                setInitialPayment(parsed.initialPayment);
            }
            return;
        }

        const cookieValue = readSpecialOfferDiscount();
        if (cookieValue !== null && cookieValue !== discount) {
            setDiscount(cookieValue);
        }

        const initialPaymentCookie = readSpecialOfferInitialPayment();
        if (initialPaymentCookie !== null && initialPaymentCookie !== initialPayment) {
            setInitialPayment(initialPaymentCookie);
        }
    }, [location.search, discount, initialPayment]);

    const value = useMemo(() => ({
        discount,
        initialPayment,
        hasSpecialOffer: discount > 0,
    }), [discount, initialPayment]);

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
