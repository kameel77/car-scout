export type VehicleFormMode = 'sale' | 'rental';

export interface VehicleFormState {
    // Identification
    make: string;
    model: string;
    version: string;
    vin: string;                       // sale only
    productionYear: string;
    condition: 'NEW' | 'USED';         // sale only

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
    pricePln: string;                  // sale only
    catalogPrice: string;
    sellingPrice: string;              // rental only
    mileageKm: string;                 // sale only
    firstRegistrationDate: string;     // sale only
    registrationNumber: string;        // sale only

    // Flags — sale
    isChineseBrand: boolean;           // sale only
    isFeatured: boolean;
    financingPriceBase: 'PRICE_PLN' | 'BROKER_PRICE_PLN'; // sale only

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
}
