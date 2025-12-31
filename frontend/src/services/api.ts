const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Auth API
export const authApi = {
    login: async (email: string, password: string) => {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        return response.json();
    },

    me: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to verify token');
        }

        return response.json();
    },

    logout: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return response.json();
    }
};

// Import API
export const importApi = {
    uploadCSV: async (file: File, token: string) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/api/import/csv`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        return response.json();
    },

    uploadJSON: async (data: any[], token: string, source?: string) => {
        const response = await fetch(`${API_BASE_URL}/api/import/csv-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data, source })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        return response.json();
    },

    getHistory: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/import/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return response.json();
    },

    getImportDetails: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/import/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return response.json();
    }
};

// Analytics API
export const analyticsApi = {
    getPriceTrends: async (params: {
        days?: number;
        make?: string;
        model?: string;
        groupBy?: 'day' | 'week' | 'month';
    }, token: string) => {
        const queryParams = new URLSearchParams();
        if (params.days) queryParams.append('days', params.days.toString());
        if (params.make) queryParams.append('make', params.make);
        if (params.model) queryParams.append('model', params.model);
        if (params.groupBy) queryParams.append('groupBy', params.groupBy);

        const response = await fetch(
            `${API_BASE_URL}/api/analytics/price-trends?${queryParams}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        return response.json();
    }
};

// Listings API
export const listingsApi = {
    getListings: async (filters?: any) => {
        const params = new URLSearchParams();

        if (filters) {
            if (filters.make) params.append('make', filters.make);
            if (filters.model) params.append('model', filters.model);

            if (filters.priceFrom) params.append('priceMin', filters.priceFrom.toString());
            if (filters.priceTo) params.append('priceMax', filters.priceTo.toString());

            if (filters.yearFrom) params.append('yearMin', filters.yearFrom.toString());
            if (filters.yearTo) params.append('yearMax', filters.yearTo.toString());

            if (filters.mileageFrom) params.append('mileageMin', filters.mileageFrom.toString());
            if (filters.mileageTo) params.append('mileageMax', filters.mileageTo.toString());

            if (filters.fuelTypes && filters.fuelTypes.length > 0) params.append('fuelType', filters.fuelTypes.join(','));
            if (filters.transmissions && filters.transmissions.length > 0) params.append('transmission', filters.transmissions.join(','));
            if (filters.bodyTypes && filters.bodyTypes.length > 0) params.append('bodyType', filters.bodyTypes.join(','));

            if (filters.powerFrom) params.append('powerMin', filters.powerFrom.toString());
            if (filters.powerTo) params.append('powerMax', filters.powerTo.toString());

            if (filters.capacityFrom) params.append('capacityMin', filters.capacityFrom.toString());
            if (filters.capacityTo) params.append('capacityMax', filters.capacityTo.toString());

            if (filters.sortBy) params.append('sortBy', filters.sortBy);
        }

        const response = await fetch(`${API_BASE_URL}/api/listings?${params.toString()}`);
        return response.json();
    },

    getListing: async (id: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}`);
        return response.json();
    },

    archiveListing: async (id: string, reason: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}/archive`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason })
        });

        return response.json();
    },

    restoreListing: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}/restore`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return response.json();
    }
};
