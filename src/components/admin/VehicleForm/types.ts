export type VehicleFormMode = 'sale' | 'rental' | 'specification';

export interface VehicleFormState {
    // Identification
    make: string;
    model: string;
    version: string;
    vin: string;                       // sale only
    productionYear: string;
    condition: 'NEW' | 'USED';         // sale only
    specificationId?: string;

    // Technical
    bodyType: string;
    fuelType: string;
    transmission: string;
    enginePowerHp: string;
    engineCapacityCm3: string;
    drive: string;
    doors: string;
    seats: string;
    color: string;
    paintType: string;

    // Pricing — sale
    vatMargin: boolean;                // sale only — fv vat marża
    pricePln: string;                  // sale only — cena w finansowaniu
    motoliaDiscountPln: string;        // sale only — rabat Motolia (źródło prawdy; cena sprzedaży = pricePln + rabat)
    displaySalePrice: boolean;         // sale only — true: "Cena pojazdu" = finansowanie + rabat; false (domyślnie): finansowanie
    catalogPrice: string;
    sellingPrice: string;              // rental only
    mileageKm: string;                 // sale only
    firstRegistrationDate: string;     // sale only
    registrationNumber: string;        // sale only

    // Flags — sale
    isChineseBrand: boolean;           // sale only
    isFeatured: boolean;
    showMotoliaDiscount: boolean;      // sale only — pokaż rabat Motolia na froncie
    financingPriceBase: 'PRICE_PLN' | 'BROKER_PRICE_PLN'; // sale only

    // Dostępność per klient i produkt — sale
    availableForPrivate: boolean;
    availableForCompany: boolean;
    creditAvailable: boolean;
    leasingAvailable: boolean;
    creditProductId: string;
    leasingProductId: string;
    pricePrivateCreditPln: string;
    pricePrivateLeasingPln: string;
    priceCompanyCreditPln: string;
    priceCompanyLeasingPln: string;

    // Description
    additionalInfoHeader: string;
    additionalInfoContent: string;

    // Equipment (newline-separated text in form, array in payload)
    equipmentAudioMultimedia: string;
    equipmentSafety: string;
    equipmentComfortExtras: string;
    equipmentOther: string;

    // Provider — rental only
    providerId: string;
}

export interface SectionProps {
    form: VehicleFormState;
    setField: (field: keyof VehicleFormState, value: any) => void;
    mode: VehicleFormMode;
    /** When true, immutable identification/technical/equipment fields disabled (CSV/CSFLOW guard) */
    isImported?: boolean;
    errors?: Record<string, string>;
}
