// Rental API client — follows same fetch-based pattern as other api modules
import { matchesCatalogPrefetch } from '@/utils/catalogPrefetch';

let API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
if (API_BASE_URL.endsWith('/api')) API_BASE_URL = API_BASE_URL.slice(0, -4);
if (API_BASE_URL.endsWith('/api/')) API_BASE_URL = API_BASE_URL.slice(0, -5);

// ─── Types ───────────────────────────────────────────────────────

export interface RentalVehicle {
    id: string;
    dealerId: string | null;
    ownerRentalCompanyId: string | null;
    make: string;
    model: string;
    version: string | null;
    bodyType: string | null;
    fuelType: string | null;
    transmission: string | null;
    enginePowerHp: number | null;
    engineCapacityCm3: number | null;
    productionYear: number | null;
    color: string | null;
    paintType: string | null;
    doors: number | null;
    seats: number | null;
    drive: string | null;
    catalogPrice: number | null;
    sellingPrice: number | null;
    primaryImageUrl: string | null;
    imageUrls: string[];
    specificationUrl: string | null;
    equipmentAudioMultimedia: string[];
    equipmentSafety: string[];
    equipmentComfortExtras: string[];
    equipmentOther: string[];
    additionalInfoHeader: string | null;
    additionalInfoContent: string | null;
    specsJson: any;
    slug: string | null;
    isActive: boolean;
    isFeatured?: boolean;
    isBusinessFeatured?: boolean;
    isPublished?: boolean;
    createdAt: string;
    updatedAt: string;
    condition?: 'NEW' | 'USED';
    vin?: string | null;
    mileageKm?: number | null;
    firstRegistrationDate?: string | null;
    availableFrom?: string | null;
    registrationNumber?: string | null;
    dealer?: { id: string; name: string; addressLine1?: string; city?: string } | null;
    ownerRentalCompany?: { id: string; name: string; slug?: string | null } | null;
    rentalAssignments?: VehicleRentalAssignment[];
}

export interface RentalOperatorInfo {
    vehicleId: string;
    slug: string;
    vin: string | null;
    firstRegistrationDate: string | null;
    availableFrom: string | null;
    dealer: {
        id: string;
        name: string;
        city?: string;
        addressLine1?: string;
        contactPhone?: string;
    } | null;
    ownerRentalCompany: {
        id: string;
        name: string;
        slug?: string | null;
        logoUrl?: string | null;
    } | null;
}

export interface RentalCompany {
    id: string;
    name: string;
    slug: string | null;
    logoUrl: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    isActive: boolean;
    includedServices?: string[];
    insuranceAddMode?: 'INSURANCE_23' | 'INSURANCE_0' | 'INSURANCE_INCLUDED';
    _count?: { vehicleAssignments: number };
}

export interface VehicleRentalAssignment {
    id: string;
    vehicleId: string;
    rentalCompanyId: string;
    externalVehicleId: string | null;
    calculationId: string | null;
    isActive: boolean;
    includedServicesOverride?: string[] | null;
    insuranceAddModeOverride?: 'INSURANCE_23' | 'INSURANCE_0' | 'INSURANCE_INCLUDED' | null;
    rentalCompany?: { id: string; name: string; slug?: string | null };
    _count?: { matrixEntries: number };
    matrixEntries?: RentalMatrixEntry[];
}

export interface RentalMatrixEntry {
    id: string;
    assignmentId: string;
    annualMileageKm: number;
    contractMonths: number;
    initialPaymentPct: number;
    initialPaymentAmountNet?: number;
    initialPaymentAmountGross?: number;
    monthlyRateNet: number;
    monthlyRateGross: number;
    servicesIncluded: string[];
    overMileageCost: number | null;
    insuranceExcess500: number | null;
    insuranceNoLimit: number | null;
    tiresNoLimit: number | null;
    insuranceNet?: number | null;
    feePct?: number | null;
    offerType?: string;
}

export interface MatrixImportResult {
    totalRows: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
    rentalCompany: string;
    vehiclesProcessed: number;
    format?: 'internal' | 'provider';
}

export interface MatrixOptions {
    annualMileageOptions: number[];
    contractMonthOptions: number[];
    initialPaymentOptions: Array<{ pct: number, amountNet: number, amountGross: number }>;
}

// ─── Helpers ─────────────────────────────────────────────────────

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...options?.headers,
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
}

// ─── Rental Vehicles API ─────────────────────────────────────────

export const rentalVehiclesApi = {
    list: async (params: Record<string, string | undefined>, token: string) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v) queryParams.append(k, v); });
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles?${queryParams}`, token);
    },

    get: async (id: string, token: string): Promise<{ vehicle: RentalVehicle }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}`, token);
    },

    create: async (data: Partial<RentalVehicle>, token: string): Promise<{ vehicle: RentalVehicle }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    update: async (id: string, data: Partial<RentalVehicle>, token: string): Promise<{ vehicle: RentalVehicle }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}`, token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    archive: async (id: string, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}/archive`, token, { method: 'POST' });
    },

    restore: async (id: string, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}/restore`, token, { method: 'POST' });
    },

    delete: async (id: string, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}`, token, { method: 'DELETE' });
    },

    duplicateModel: async (id: string, token: string): Promise<{ vehicle: RentalVehicle }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}/duplicate-model`, token, { method: 'POST' });
    },

    duplicateOffer: async (id: string, token: string): Promise<{ vehicle: RentalVehicle }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}/duplicate-offer`, token, { method: 'POST' });
    },

    toggleFeatured: async (id: string, isFeatured: boolean, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}/featured`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isFeatured })
        });
    },

    toggleBusinessFeatured: async (id: string, isBusinessFeatured: boolean, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}/featured`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isBusinessFeatured })
        });
    },

    togglePublished: async (id: string, isPublished: boolean, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}/published`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPublished })
        });
    },

    uploadImages: async (id: string, files: File[], setPrimary: boolean, token: string) => {
        const formData = new FormData();
        files.forEach(f => formData.append('images', f));
        if (setPrimary) formData.append('setPrimary', 'true');

        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}/images`, token, {
            method: 'POST',
            body: formData
        });
    },

    deleteImage: async (id: string, imageUrl: string, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}/images`, token, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl })
        });
    },

    setPrimaryImage: async (id: string, imageUrl: string, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}/primary-image`, token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl })
        });
    },

    uploadSpecification: async (id: string, file: File, token: string) => {
        const formData = new FormData();
        formData.append('file', file);

        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${id}/specs`, token, {
            method: 'POST',
            body: formData
        });
    },

    // Assignments
    createAssignment: async (vehicleId: string, data: { rentalCompanyId: string; externalVehicleId?: string; calculationId?: string }, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${vehicleId}/assignments`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    updateAssignment: async (vehicleId: string, assignmentId: string, data: any, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${vehicleId}/assignments/${assignmentId}`, token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    deleteAssignment: async (vehicleId: string, assignmentId: string, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-vehicles/${vehicleId}/assignments/${assignmentId}`, token, {
            method: 'DELETE'
        });
    }
};

// ─── Rental Companies API ────────────────────────────────────────

export const rentalCompaniesApi = {
    list: async (token: string): Promise<{ companies: RentalCompany[] }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-companies`, token);
    },

    get: async (id: string, token: string): Promise<{ company: RentalCompany }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-companies/${id}`, token);
    },

    create: async (data: Partial<RentalCompany>, token: string): Promise<{ company: RentalCompany }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-companies`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    update: async (id: string, data: Partial<RentalCompany>, token: string): Promise<{ company: RentalCompany }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-companies/${id}`, token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    delete: async (id: string, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-companies/${id}`, token, { method: 'DELETE' });
    },

    getMatrixHealth: async (id: string, token: string): Promise<{
        companyId: string;
        companyName: string;
        insuranceAddMode?: string | null;
        totalAssignments: number;
        totalEntries: number;
        missingInsuranceCount: number;
        affectedVehiclesCount: number;
        isHealthy: boolean;
    }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-companies/${id}/matrix-health`, token);
    },

    getCalculationPreview: async (id: string, token: string): Promise<{
        company: { id: string; name: string; insuranceAddMode?: string | null };
        hasSample: boolean;
        message?: string;
        vehicle?: { id: string; make: string; model: string; version?: string | null; productionYear?: number | null };
        matrixParams?: { contractMonths: number; annualMileageKm: number; initialPaymentPct: number };
        breakdown?: any;
        b2bView?: { primary: string; secondary: string };
        consumerView?: { primary: string; secondary: string };
    }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-companies/${id}/calculation-preview`, token);
    }
};

// ─── Rental Matrix API ───────────────────────────────────────────

export const rentalMatrixApi = {
    import: async (file: File, rentalCompanyId: string, token: string): Promise<MatrixImportResult> => {
        const formData = new FormData();
        formData.append('file', file);

        return fetchWithAuth(
            `${API_BASE_URL}/api/rental-matrix/import?rentalCompanyId=${rentalCompanyId}`,
            token,
            { method: 'POST', body: formData }
        );
    },

    getEntries: async (assignmentId: string, token: string): Promise<{ entries: RentalMatrixEntry[] }> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-matrix/${assignmentId}`, token);
    },

    getOptions: async (vehicleId: string, token: string): Promise<MatrixOptions> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-matrix/options/${vehicleId}`, token);
    },

    deleteEntries: async (assignmentId: string, token: string) => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental-matrix/${assignmentId}`, token, { method: 'DELETE' });
    }
};

// ─── Public Rental API ───────────────────────────────────────────

export const rentalPublicApi = {
    listVehicles: async (params?: Record<string, string | undefined>) => {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([k, v]) => { if (v) queryParams.append(k, v); });
        }

        const url = `${API_BASE_URL}/api/rental/vehicles?${queryParams}`;
        if (typeof window !== 'undefined') {
            const prefetch = (window as any).__RENTAL_PREFETCH__;
            if (prefetch?.p && matchesCatalogPrefetch(prefetch.url, url, window.location.href)) {
                (window as any).__RENTAL_PREFETCH__ = null;
                try {
                    const data = await prefetch.p;
                    if (data) return data;
                } catch { /* ordinary request below retries a failed fetch-ahead */ }
            }
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch rental vehicles');
        return response.json();
    },

    getVehicle: async (slug: string) => {
        const response = await fetch(`${API_BASE_URL}/api/rental/vehicles/${slug}`);
        if (!response.ok) throw new Error('Vehicle not found');
        return response.json();
    },

    calculate: async (slug: string, params: { annualMileageKm: number; contractMonths: number; initialPaymentPct: number; initialPaymentAmountNet?: number; initialPaymentAmountGross?: number; offerType?: string }) => {
        const queryParams = new URLSearchParams({
            annualMileageKm: params.annualMileageKm.toString(),
            contractMonths: params.contractMonths.toString(),
            initialPaymentPct: params.initialPaymentPct.toString()
        });
        if (params.initialPaymentAmountNet !== undefined) {
            queryParams.append('initialPaymentAmountNet', params.initialPaymentAmountNet.toString());
        }
        if (params.initialPaymentAmountGross !== undefined) {
            queryParams.append('initialPaymentAmountGross', params.initialPaymentAmountGross.toString());
        }
        if (params.offerType) queryParams.set('offerType', params.offerType);

        const response = await fetch(`${API_BASE_URL}/api/rental/vehicles/${slug}/calculate?${queryParams}`);
        if (!response.ok) throw new Error('Calculation failed');
        return response.json();
    },

    getOperatorFinancials: async (slug: string, params: { annualMileageKm: number; contractMonths: number; initialPaymentPct: number; initialPaymentAmountNet?: number; initialPaymentAmountGross?: number; offerType?: string }, token: string): Promise<{
        vehicleId: string;
        offers: Array<{ companyId: string; companyName: string; feePct: number | null }>;
        financialsByCompanyId: Record<string, { feePct: number | null }>;
    }> => {
        const queryParams = new URLSearchParams({
            annualMileageKm: params.annualMileageKm.toString(),
            contractMonths: params.contractMonths.toString(),
            initialPaymentPct: params.initialPaymentPct.toString()
        });
        if (params.initialPaymentAmountNet !== undefined) {
            queryParams.append('initialPaymentAmountNet', params.initialPaymentAmountNet.toString());
        }
        if (params.initialPaymentAmountGross !== undefined) {
            queryParams.append('initialPaymentAmountGross', params.initialPaymentAmountGross.toString());
        }
        if (params.offerType) queryParams.set('offerType', params.offerType);

        return fetchWithAuth(`${API_BASE_URL}/api/rental/vehicles/${slug}/operator-financials?${queryParams}`, token);
    },

    getOperatorInfo: async (slug: string, token: string): Promise<RentalOperatorInfo> => {
        return fetchWithAuth(`${API_BASE_URL}/api/rental/vehicles/${slug}/operator-info`, token);
    },

    submitLead: async (data: {
        rentalVehicleId: string;
        name: string;
        email: string;
        phone?: string;
        preferredContact?: 'email' | 'phone';
        message: string;
        consentMarketing?: boolean;
        consentPrivacy?: boolean;
        rentalCompanyName?: string;
        rentalAnnualMileageKm?: number;
        rentalContractMonths?: number;
        rentalInitialPaymentPct?: number;
        rentalInitialPaymentAmountNet?: number;
        rentalInitialPaymentAmountGross?: number;
        rentalMonthlyRate?: number;
        turnstileToken?: string;
    }) => {
        const response = await fetch(`${API_BASE_URL}/api/leads/rental`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to submit rental lead');
        }

        return response.json();
    }
};
