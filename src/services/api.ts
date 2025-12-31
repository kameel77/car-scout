import type { TranslationEntry, TranslationPayload } from '@/types/translations';
import type { User, UserPayload } from '@/types/user';

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
    getListingOptions: async () => {
        // Options are public, no token needed
        const response = await fetch(`${API_BASE_URL}/api/listings/options`);
        if (!response.ok) {
            throw new Error('Failed to fetch listing options');
        }
        return response.json() as Promise<{ makes: string[]; models: { make: string; model: string }[] }>;
    },

    getListings: async (filters?: any) => {
        const params = new URLSearchParams();

        if (filters) {
            // Helper for array filters
            const appendArray = (key: string, values: string[]) => {
                if (values && values.length > 0) {
                    // Backend expects comma-separated string for 'in' query
                    params.append(key, values.join(','));
                }
            };

            appendArray('make', filters.makes);
            appendArray('model', filters.models);

            if (filters.priceFrom) params.append('priceMin', filters.priceFrom.toString());
            if (filters.priceTo) params.append('priceMax', filters.priceTo.toString());

            if (filters.yearFrom) params.append('yearMin', filters.yearFrom.toString());
            if (filters.yearTo) params.append('yearMax', filters.yearTo.toString());

            if (filters.mileageFrom) params.append('mileageMin', filters.mileageFrom.toString());
            if (filters.mileageTo) params.append('mileageMax', filters.mileageTo.toString());

            appendArray('fuelType', filters.fuelTypes);
            appendArray('transmission', filters.transmissions);
            appendArray('bodyType', filters.bodyTypes);
            appendArray('drive', filters.drives);

            if (filters.powerFrom) params.append('powerMin', filters.powerFrom.toString());
            if (filters.powerTo) params.append('powerMax', filters.powerTo.toString());

            if (filters.capacityFrom) params.append('capacityMin', filters.capacityFrom.toString());
            if (filters.capacityTo) params.append('capacityMax', filters.capacityTo.toString());

            if (filters.sortBy) params.append('sortBy', filters.sortBy);
            if (filters.query) params.append('q', filters.query);
            if (filters.currency) params.append('currency', filters.currency);
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
    },

    refreshImages: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}/refresh-images`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Refresh failed');
        }

        return response.json();
    }
};

// Settings API
export const settingsApi = {
    getSettings: async () => {
        const response = await fetch(`${API_BASE_URL}/api/settings`);
        return response.json();
    },

    updateSettings: async (settings: any, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(settings)
        });

        return response.json();
    },

    recalculatePrices: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/settings/recalculate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return response.json();
    }
};

// Translations API
export const translationsApi = {
    list: async (
        params?: { category?: string; search?: string },
        token?: string
    ): Promise<{ translations: TranslationEntry[] }> => {
        const queryParams = new URLSearchParams();
        if (params?.category) queryParams.append('category', params.category);
        if (params?.search) queryParams.append('search', params.search);

        const response = await fetch(`${API_BASE_URL}/api/translations?${queryParams.toString()}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
        });

        if (!response.ok) {
            throw new Error('Failed to fetch translations');
        }

        return response.json();
    },

    save: async (payload: TranslationPayload, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/translations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save translation');
        }

        return response.json();
    },

    delete: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/translations/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete translation');
        }

        return response.json();
    }
};

// Users API
export const usersApi = {
    list: async (token: string): Promise<{ users: User[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }
        return response.json();
    },
    create: async (payload: UserPayload, token: string): Promise<{ user: User }> => {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create user');
        }
        return data;
    },
    update: async (id: string, payload: UserPayload, token: string): Promise<{ user: User }> => {
        const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to update user');
        }
        return data;
    },
    delete: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete user');
        }
        return data;
    }
};
