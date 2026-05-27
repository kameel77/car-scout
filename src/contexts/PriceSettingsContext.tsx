import React, { createContext, useContext, useState } from 'react';

type PriceType = 'gross' | 'net';
export type CustomerType = 'private' | 'business';

interface PriceSettingsContextType {
    priceType: PriceType;
    setPriceType: (type: PriceType) => void;
    customerType: CustomerType;
    setCustomerType: (type: CustomerType) => void;
}

const PriceSettingsContext = createContext<PriceSettingsContextType | undefined>(undefined);

export function PriceSettingsProvider({ children }: { children: React.ReactNode }) {
    const [customerType, setCustomerTypeState] = useState<CustomerType>(() => {
        const saved = localStorage.getItem('customerType');
        return (saved as CustomerType) || 'private';
    });

    const [priceType, setPriceTypeState] = useState<PriceType>(() => {
        const saved = sessionStorage.getItem('priceType');
        return (saved as PriceType) || 'gross';
    });

    const setPriceType = (type: PriceType) => {
        setPriceTypeState(type);
        sessionStorage.setItem('priceType', type);
    };

    const setCustomerType = (type: CustomerType) => {
        setCustomerTypeState(type);
        localStorage.setItem('customerType', type);

        if (type === 'business') {
            setPriceType('net');
        } else {
            setPriceType('gross');
        }
    };

    return (
        <PriceSettingsContext.Provider value={{ priceType, setPriceType, customerType, setCustomerType }}>
            {children}
        </PriceSettingsContext.Provider>
    );
}

export function usePriceSettings() {
    const context = useContext(PriceSettingsContext);
    if (context === undefined) {
        throw new Error('usePriceSettings must be used within a PriceSettingsProvider');
    }
    return context;
}
