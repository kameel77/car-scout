import React, { createContext, useContext, useEffect, useState } from 'react';

type PriceType = 'gross' | 'net';

interface PriceSettingsContextType {
    priceType: PriceType;
    setPriceType: (type: PriceType) => void;
}

const PriceSettingsContext = createContext<PriceSettingsContextType | undefined>(undefined);

export function PriceSettingsProvider({ children }: { children: React.ReactNode }) {
    const [priceType, setPriceTypeState] = useState<PriceType>(() => {
        const saved = sessionStorage.getItem('priceType');
        return (saved as PriceType) || 'gross';
    });

    const setPriceType = (type: PriceType) => {
        setPriceTypeState(type);
        sessionStorage.setItem('priceType', type);
    };

    return (
        <PriceSettingsContext.Provider value={{ priceType, setPriceType }}>
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
