// Rental API client — follows same fetch-based pattern as other api modules

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
    productionYear: number;
    color: string | null;
    paintType: string | null;
    doors: number | null;
    seats: number | null;
    drive: string | null;
    catalogPrice: number;
    sellingPrice: number;
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
    createdAt: string;
    updatedAt: string;
    dealer?: { id: string; name: string; addressLine1?: string; city?: string } | null;
    ownerRentalCompany?: { id: string; name: string; slug?: string | null } | null;
    rentalAssignments?: VehicleRentalAssignment[];
}

export interface RentalCompany {
    id: string;
    name: string;
    slug: string | null;
    logoUrl: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    isActive: boolean;
    _count?: { vehicleAssignments: number };
}

export interface VehicleRentalAssignment {
    id: string;
    vehicleId: string;
    rentalCompanyId: string;
    externalVehicleId: string | null;
    calculationId: string | null;
    isActive: boolean;
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
    monthlyRateNet: number;
    monthlyRateGross: number;
    servicesIncluded: string[];
}

export interface MatrixImportResult {
    totalRows: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
    rentalCompany: string;
    vehiclesProcessed: number;
}

export interface MatrixOptions {
    annualMileageOptions: number[];
    contractMonthOptions: number[];
    initialPaymentOptions: number[];
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

        const response = await fetch(`${API_BASE_URL}/api/rental/vehicles?${queryParams}`);
        if (!response.ok) throw new Error('Failed to fetch rental vehicles');
        return response.json();
    },

    getVehicle: async (slug: string) => {
        const response = await fetch(`${API_BASE_URL}/api/rental/vehicles/${slug}`);
        if (!response.ok) throw new Error('Vehicle not found');
        return response.json();
    },

    calculate: async (slug: string, params: { annualMileageKm: number; contractMonths: number; initialPaymentPct: number; offerType?: string }) => {
        const queryParams = new URLSearchParams({
            annualMileageKm: params.annualMileageKm.toString(),
            contractMonths: params.contractMonths.toString(),
            initialPaymentPct: params.initialPaymentPct.toString()
        });
        if (params.offerType) queryParams.set('offerType', params.offerType);

        const response = await fetch(`${API_BASE_URL}/api/rental/vehicles/${slug}/calculate?${queryParams}`);
        if (!response.ok) throw new Error('Calculation failed');
        return response.json();
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
        rentalMonthlyRate?: number;
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
