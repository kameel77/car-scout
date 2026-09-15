import { Prisma, PrismaClient } from '@prisma/client';

export type QuoteInput = {
    unitIdentifier: string; // id or stockNo
    months: number;
    annualKm: number;
    insurance: '1000' | '500' | '0';
    tires: boolean;
    variant: string;
    companyId?: string;
};

export type QuoteResult = {
    unit: {
        id: string;
        rentalCompanyId: string;
        stockNo: string;
        specNo: string;
        specNoNote: string | null;
        vin: string | null;
        make: string | null;
        model: string | null;
        modelDescription: string | null;
        color: string | null;
        vehicleDeliveryDate: Date | null;
    };
    assignmentId: string;
    rentalVehicleId: string;
    rentalVehicle: {
        id: string;
        catalogPrice: number | null;
    };
    variant: string;
    breakdown: {
        baseNet: number;
        insuranceNet: number;
        tiresNet: number;
    };
    monthlyRateNet: number;
    monthlyRateGross: number;
    overMileageNet: number | null;
    overMileageUnavailable?: boolean;
    vehicleDeliveryDate: string | null;
};

export class RentalQuoteError extends Error {
    statusCode: number;
    details?: any;
    constructor(message: string, statusCode = 400, details?: any) {
        super(message);
        this.name = 'RentalQuoteError';
        this.statusCode = statusCode;
        this.details = details;
    }
}

export async function calculateRentalQuote(
    prisma: Prisma.TransactionClient | PrismaClient,
    input: QuoteInput
): Promise<QuoteResult> {
    const { unitIdentifier, months, annualKm, insurance, tires, variant, companyId } = input;

    if (isNaN(months) || months <= 0) {
        throw new RentalQuoteError('Nieprawidłowy parametr months (musi być liczbą dodatnią)', 400);
    }
    if (isNaN(annualKm) || annualKm <= 0) {
        throw new RentalQuoteError('Nieprawidłowy parametr annualKm (musi być liczbą dodatnią)', 400);
    }
    if (!['1000', '500', '0'].includes(insurance)) {
        throw new RentalQuoteError('Parametr insurance musi przyjmować wartość 1000, 500 lub 0', 400);
    }

    // Lookup stock unit by id or stockNo
    const whereUnit: Record<string, any> = {
        OR: [
            { id: unitIdentifier },
            { stockNo: unitIdentifier }
        ]
    };
    if (companyId) {
        whereUnit.rentalCompanyId = companyId;
    }

    const unit = await prisma.rentalStockUnit.findFirst({
        where: whereUnit
    });

    if (!unit) {
        throw new RentalQuoteError(`Egzemplarz stoku o identyfikatorze "${unitIdentifier}" nie został znaleziony`, 404);
    }

    if (!unit.specNo) {
        throw new RentalQuoteError(
            'Brak zidentyfikowanego numeru specyfikacji dla tego egzemplarza stoku',
            422,
            { specNoRaw: unit.specNoRaw }
        );
    }

    // Find matching vehicle rental assignments for (rentalCompanyId, externalVehicleId)
    const allCompanyAssignments = await prisma.vehicleRentalAssignment.findMany({
        where: { rentalCompanyId: unit.rentalCompanyId },
        select: {
            id: true,
            externalVehicleId: true,
            vehicleId: true,
            vehicle: {
                select: { id: true, catalogPrice: true }
            }
        }
    });

    const matchingAssignments = allCompanyAssignments.filter(a => {
        if (!a.externalVehicleId) return false;
        const parts = a.externalVehicleId.split(/[,;]/).map(s => s.trim());
        return parts.includes(unit.specNo!);
    });

    if (matchingAssignments.length === 0) {
        throw new RentalQuoteError(
            `Brak przypisania pojazdu do specyfikacji ${unit.specNo} w cenniku firmy najmu`,
            422
        );
    }

    const assignmentIds = matchingAssignments.map(a => a.id);

    // Fetch matrix entries for requested combination across all matching assignments
    const entries = await prisma.rentalMatrixEntry.findMany({
        where: {
            assignmentId: { in: assignmentIds },
            contractMonths: months,
            annualMileageKm: annualKm,
            priceVariant: variant
        },
        orderBy: { assignmentId: 'asc' }
    });

    if (entries.length === 0) {
        const available = await prisma.rentalMatrixEntry.findMany({
            where: {
                assignmentId: { in: assignmentIds }
            },
            select: {
                contractMonths: true,
                annualMileageKm: true,
                priceVariant: true
            },
            distinct: ['contractMonths', 'annualMileageKm', 'priceVariant']
        });

        throw new RentalQuoteError(
            `Brak wyceny dla specyfikacji ${unit.specNo} dla kombinacji: okres ${months} msc, przebieg ${annualKm} km, wariant ${variant}`,
            404,
            {
                availableCombinations: available.map(a => ({
                    months: a.contractMonths,
                    annualKm: a.annualMileageKm,
                    variant: a.priceVariant
                }))
            }
        );
    }

    // Multiple assignments rule: verify all matching entries have identical financial parameters
    if (entries.length > 1) {
        const first = entries[0];
        const hasDiscrepancy = entries.slice(1).some(e =>
            e.monthlyRateNet !== first.monthlyRateNet ||
            e.insuranceExcess500 !== first.insuranceExcess500 ||
            e.insuranceNoLimit !== first.insuranceNoLimit ||
            e.tiresNoLimit !== first.tiresNoLimit ||
            e.overMileageCost !== first.overMileageCost ||
            e.overMileageTiresNoLimit !== first.overMileageTiresNoLimit
        );

        if (hasDiscrepancy) {
            throw new RentalQuoteError(
                `Wykryto niespójne stawki w cenniku dla specyfikacji ${unit.specNo} w ${entries.length} przypisaniach`,
                409,
                {
                    discrepancies: entries.map(e => ({
                        assignmentId: e.assignmentId,
                        monthlyRateNet: e.monthlyRateNet,
                        insuranceExcess500: e.insuranceExcess500,
                        insuranceNoLimit: e.insuranceNoLimit,
                        tiresNoLimit: e.tiresNoLimit,
                        overMileageCost: e.overMileageCost,
                        overMileageTiresNoLimit: e.overMileageTiresNoLimit
                    }))
                }
            );
        }
    }

    // Deterministically pick lowest assignmentId
    const chosenEntry = entries[0];
    const chosenAssignment = matchingAssignments.find(a => a.id === chosenEntry.assignmentId)!;

    const baseNet = chosenEntry.monthlyRateNet;
    let insuranceNet = 0;
    if (insurance === '500') {
        insuranceNet = chosenEntry.insuranceExcess500 ?? 0;
    } else if (insurance === '0') {
        insuranceNet = chosenEntry.insuranceNoLimit ?? 0;
    }

    const tiresNet = tires ? (chosenEntry.tiresNoLimit ?? 0) : 0;
    const monthlyRateNet = Math.round((baseNet + insuranceNet + tiresNet) * 100) / 100;
    const monthlyRateGross = Math.round(monthlyRateNet * 1.23 * 100) / 100;

    let overMileageNet: number | null = null;
    let overMileageUnavailable = false;

    if (tires) {
        if (chosenEntry.overMileageTiresNoLimit !== null && chosenEntry.overMileageTiresNoLimit !== undefined) {
            overMileageNet = chosenEntry.overMileageTiresNoLimit;
        } else {
            overMileageNet = null;
            overMileageUnavailable = true;
        }
    } else {
        overMileageNet = chosenEntry.overMileageCost ?? null;
    }

    const vehicleDeliveryDateStr = unit.vehicleDeliveryDate
        ? unit.vehicleDeliveryDate.toISOString().split('T')[0]
        : null;

    return {
        unit: {
            id: unit.id,
            rentalCompanyId: unit.rentalCompanyId,
            stockNo: unit.stockNo,
            specNo: unit.specNo,
            specNoNote: unit.specNoNote,
            vin: unit.vin,
            make: unit.make,
            model: unit.model,
            modelDescription: unit.modelDescription,
            color: unit.color,
            vehicleDeliveryDate: unit.vehicleDeliveryDate
        },
        assignmentId: chosenEntry.assignmentId,
        rentalVehicleId: chosenAssignment.vehicleId,
        rentalVehicle: {
            id: chosenAssignment.vehicle.id,
            catalogPrice: chosenAssignment.vehicle.catalogPrice
        },
        variant,
        breakdown: {
            baseNet,
            insuranceNet,
            tiresNet
        },
        monthlyRateNet,
        monthlyRateGross,
        overMileageNet,
        ...(overMileageUnavailable ? { overMileageUnavailable: true } : {}),
        vehicleDeliveryDate: vehicleDeliveryDateStr
    };
}
