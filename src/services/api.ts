import type { TranslationEntry, TranslationPayload } from '@/types/translations';
import type { User, UserPayload } from '@/types/user';
import type { FaqEntry, FaqPayload } from '@/types/faq';
import type {
    FinancingProduct,
    FinancingProductPayload,
    FinancingProviderConnection,
    FinancingProviderConnectionPayload
} from '@/types/financing';
import type { SeoConfig } from '@/components/seo/SeoManager';

type ImportMode = 'replace' | 'merge';

// Default: dev hits same origin (proxy), prod uses current origin relative path if not specified.
// We strip trailing /api because all API endpoints in this file are already prefixed with /api/
let API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.MODE === 'development' ? '' : '');

if (API_BASE_URL.endsWith('/api')) {
    API_BASE_URL = API_BASE_URL.slice(0, -4);
}
if (API_BASE_URL.endsWith('/api/')) {
    API_BASE_URL = API_BASE_URL.slice(0, -5);
}

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

// FAQ API
export const faqApi = {
    list: async (params: { page?: string }, token?: string): Promise<{ entries: FaqEntry[] }> => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);

        const response = await fetch(`${API_BASE_URL}/api/faq?${queryParams.toString()}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch FAQ entries');
        }

        return response.json();
    },
    save: async (payload: FaqPayload, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/faq`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to save FAQ entry');
        }
        return data;
    },
    delete: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/faq/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete FAQ entry');
        }
        return data;
    }
};

// Import API
export const importApi = {
    uploadCSV: async (file: File, token: string, mode: ImportMode = 'replace') => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/api/import/csv?mode=${mode}`, {
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

    uploadJSON: async (data: any[], token: string, source?: string, mode: ImportMode = 'replace') => {
        const response = await fetch(`${API_BASE_URL}/api/import/csv-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data, source, mode })
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
            if (filters.page) params.append('page', filters.page.toString());
            if (filters.perPage) params.append('perPage', filters.perPage.toString());
        }

        const url = `${API_BASE_URL}/api/listings?${params.toString()}`;
        console.log('Making API call to:', url);

        try {
            const response = await fetch(url);
            console.log('API response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API error:', response.status, errorText);
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('API data received:', data);
            return data;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
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

    refreshImages: async (id: string, token?: string) => {
        const headers: Record<string, string> = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/api/listings/${id}/refresh-images`, {
            method: 'POST',
            headers
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

    uploadLogo: async (file: File, target: 'header' | 'footer', token: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('target', target);

        const response = await fetch(`${API_BASE_URL}/api/settings/logo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Logo upload failed');
        }
        return data as { url: string };
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

// Leads API
export const leadsApi = {
    submitLead: async (data: {
        listingId: string;
        name: string;
        email: string;
        phone?: string;
        preferredContact: 'email' | 'phone';
        message: string;
        consentMarketing: boolean;
        consentPrivacy: boolean;
        financingProductId?: string;
        financingAmount?: number;
        financingPeriod?: number;
        financingDownPayment?: number;
        financingInstallment?: number;
    }) => {
        const response = await fetch(`${API_BASE_URL}/api/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to submit lead');
        }

        return response.json();
    },

    getLeads: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/leads`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to load leads');
        }

        return response.json();
    },

    applyForFinancing: async (leadId: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/financing/apply/${leadId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to submit financing application');
        }

        return response.json();
    }
};

// Financing API
export const financingApi = {
    list: async (token: string): Promise<{ products: FinancingProduct[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/financing/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch financing products');
        }
        return response.json();
    },

    listPublic: async (): Promise<{ products: FinancingProduct[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/financing/calculator`);
        if (!response.ok) {
            throw new Error('Failed to fetch financing calculator data');
        }
        return response.json();
    },

    calculate: async (payload: {
        productId: string;
        price: number;
        downPaymentAmount: number;
        period: number;
        initialFeePercent?: number;
        finalPaymentPercent?: number;
        manufacturingYear?: number;
        mileageKm?: number;
    }) => {
        const response = await fetch(`${API_BASE_URL}/api/financing/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to calculate financing');
        }

        return response.json() as Promise<{ monthlyInstallment: number; provider: string }>;
    },

    create: async (payload: FinancingProductPayload, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/financing/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create financing product');
        }
        return response.json();
    },

    update: async (id: string, payload: Partial<FinancingProductPayload>, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/financing/products/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update financing product');
        }
        return response.json();
    },

    delete: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/financing/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete financing product');
        }
        return response.json();
    },

    listConnections: async (token: string): Promise<{ connections: FinancingProviderConnection[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/financing/connections`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch financing connections');
        }
        return response.json();
    },

    createConnection: async (payload: FinancingProviderConnectionPayload, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/financing/connections`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create financing connection');
        }
        return response.json();
    },

    updateConnection: async (id: string, payload: Partial<FinancingProviderConnectionPayload>, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/financing/connections/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update financing connection');
        }
        return response.json();
    },

    deleteConnection: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/financing/connections/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete financing connection');
        }
        return response.json();
    },

    testConnection: async (payload: { provider: string; apiBaseUrl: string; apiKey: string; apiSecret?: string; shopUuid?: string }, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/financing/test-connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Connection test failed');
        }
        return response.json();
    }
};

// SEO API
export const seoApi = {
    getConfig: async () => {
        const response = await fetch(`${API_BASE_URL}/api/seo`);
        if (!response.ok) {
            throw new Error('Failed to fetch SEO config');
        }
        return response.json() as Promise<SeoConfig>;
    },
    updateConfig: async (data: SeoConfig, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/seo`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to update SEO config');
        }

        return response.json();
    }
};
