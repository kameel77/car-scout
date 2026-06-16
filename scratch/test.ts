import { validateListingPayload, mapManualPayloadToListingUpdate } from '../backend/src/services/listing-mapper.ts';

const payload = {
    make: "BMW",
    model: "X5",
    version: null,
    productionYear: 2020,
    bodyType: "SUV",
    fuelType: "diesel",
    transmission: "automatic",
    enginePowerHp: 200,
    engineCapacityCm3: 2000,
    color: "black",
    paintType: null,
    doors: 5,
    seats: 5,
    drive: "AWD",
    catalogPrice: 200000,
    additionalInfoHeader: null,
    additionalInfoContent: null,
    isFeatured: false,
    equipmentAudioMultimedia: [],
    equipmentSafety: [],
    equipmentComfortExtras: [],
    equipmentOther: [],
    vin: null,
    pricePln: 150000,
    motoliaDiscountPln: null,
    showMotoliaDiscount: false,
    displaySalePrice: false,
    mileageKm: 50000,
    firstRegistrationDate: null,
    registrationNumber: null,
    condition: "USED",
    financingPriceBase: "BROKER_PRICE_PLN",
    isChineseBrand: false,
    availableForPrivate: true,
    availableForCompany: true,
    creditAvailable: true,
    leasingAvailable: true,
    creditProductId: null,
    leasingProductId: null,
    pricePrivateCreditPln: 500000,
    pricePrivateLeasingPln: 480000,
    priceCompanyCreditPln: 490000,
    priceCompanyLeasingPln: 450000,
    dealerId: "dealer_test"
};

const errors = validateListingPayload(payload);
console.log("Validation errors:", errors);

const updateData = mapManualPayloadToListingUpdate(payload);
console.log("Update Data:", updateData);
