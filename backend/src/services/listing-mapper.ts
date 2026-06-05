import { Prisma } from '@prisma/client';

export const CSV_EDITABLE_FIELDS = [
    'catalogPrice',
    'motoliaDiscountPln',
    'showMotoliaDiscount',
    'displaySalePrice',
    'financingPriceBase',
    'isChineseBrand',
    'isFeatured',
    'additionalInfoHeader',
    'additionalInfoContent',
] as const;

export type ListingValidationError = { field: string; message: string };

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

export function validateListingPayload(body: any): ListingValidationError[] {
    const errors: ListingValidationError[] = [];
    const currentYear = new Date().getFullYear();

    if (!body.make || typeof body.make !== 'string' || !body.make.trim()) {
        errors.push({ field: 'make', message: 'Make is required' });
    }
    if (!body.model || typeof body.model !== 'string' || !body.model.trim()) {
        errors.push({ field: 'model', message: 'Model is required' });
    }
    if (typeof body.productionYear !== 'number' || body.productionYear < 1990 || body.productionYear > currentYear + 1) {
        errors.push({ field: 'productionYear', message: `Year must be between 1990 and ${currentYear + 1}` });
    }
    if (typeof body.pricePln !== 'number' || body.pricePln <= 0 || body.pricePln > 10_000_000) {
        errors.push({ field: 'pricePln', message: 'Price must be a positive number up to 10,000,000' });
    }
    if (body.condition !== 'NEW' && body.condition !== 'USED') {
        errors.push({ field: 'condition', message: 'Condition must be NEW or USED' });
    }
    if (body.condition === 'NEW') {
        if (typeof body.mileageKm !== 'number' || body.mileageKm < 0 || body.mileageKm >= 100) {
            errors.push({ field: 'mileageKm', message: 'New vehicle mileage must be between 0 and 99 km' });
        }
    } else if (body.condition === 'USED') {
        if (typeof body.mileageKm !== 'number' || body.mileageKm < 0) {
            errors.push({ field: 'mileageKm', message: 'Used vehicle mileage is required and must be non-negative' });
        }
    }
    if (body.vin && !VIN_REGEX.test(body.vin)) {
        errors.push({ field: 'vin', message: 'VIN must be 17 alphanumeric chars (no I, O, Q)' });
    }
    if (body.financingPriceBase && body.financingPriceBase !== 'PRICE_PLN' && body.financingPriceBase !== 'BROKER_PRICE_PLN') {
        errors.push({ field: 'financingPriceBase', message: 'Invalid financingPriceBase value' });
    }
    if (body.motoliaDiscountPln !== undefined && body.motoliaDiscountPln !== null) {
        if (typeof body.motoliaDiscountPln !== 'number' || body.motoliaDiscountPln < 0 || body.motoliaDiscountPln > 10_000_000) {
            errors.push({ field: 'motoliaDiscountPln', message: 'Motolia discount must be a non-negative number up to 10,000,000' });
        }
    }

    return errors;
}

export function mapManualPayloadToListing(body: any, dealerId: string): Prisma.ListingCreateInput {
    return {
        make: body.make.trim().slice(0, 100),
        model: body.model.trim().slice(0, 100),
        version: body.version || undefined,
        vin: body.vin || undefined,
        productionYear: body.productionYear,
        mileageKm: body.mileageKm,
        pricePln: body.pricePln,
        catalogPrice: body.catalogPrice ?? undefined,
        motoliaDiscountPln: body.motoliaDiscountPln ?? undefined,
        showMotoliaDiscount: body.showMotoliaDiscount ?? false,
        displaySalePrice: body.displaySalePrice ?? false,
        condition: body.condition,
        financingPriceBase: body.financingPriceBase || 'BROKER_PRICE_PLN',
        isChineseBrand: body.isChineseBrand ?? false,
        fuelType: body.fuelType || undefined,
        transmission: body.transmission || undefined,
        enginePowerHp: body.enginePowerHp ?? undefined,
        engineCapacityCm3: body.engineCapacityCm3 ?? undefined,
        drive: body.drive || undefined,
        bodyType: body.bodyType || undefined,
        doors: body.doors ?? undefined,
        seats: body.seats ?? undefined,
        color: body.color || undefined,
        paintType: body.paintType || undefined,
        registrationNumber: body.registrationNumber || undefined,
        firstRegistrationDate: body.firstRegistrationDate || undefined,
        equipmentAudioMultimedia: body.equipmentAudioMultimedia || [],
        equipmentSafety: body.equipmentSafety || [],
        equipmentComfortExtras: body.equipmentComfortExtras || [],
        equipmentOther: body.equipmentOther || [],
        additionalInfoHeader: body.additionalInfoHeader || undefined,
        additionalInfoContent: body.additionalInfoContent || undefined,
        isFeatured: body.isFeatured ?? false,
        dealer: { connect: { id: dealerId } },
    };
}

export function mapManualPayloadToListingUpdate(body: any): Prisma.ListingUpdateInput {
    const { dealer, ...rest } = mapManualPayloadToListing(body, 'placeholder') as any;
    return rest;
}

export function pickCsvEditableFields(body: any): Prisma.ListingUpdateInput {
    const result: any = {};
    for (const field of CSV_EDITABLE_FIELDS) {
        if (body[field] !== undefined) {
            result[field] = body[field];
        }
    }
    return result;
}
