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
import type { CrmTrackingVisit, CrmTrackingResponse } from '@/types/crmTracking';
import type { PartnerAd, PartnerAdPayload } from '@/types/partnerAds';
import type { PublicSeoContent, SeoContentPage, SeoContentPayload } from '@/types/seo-content';

export interface PartnerApiIntegration {
    id: string;
    name: string;
    hasApiKey: boolean;
    apiKeyLast4: string | null;
    nip?: string | null;
    contactPerson?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    mappings?: {
        externalId: string;
        dealerId: string;
        dealer?: { name: string };
    }[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

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
            body: JSON.stringify({ email: email.trim().toLowerCase(), password })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Login failed' }));
            throw new Error(error.error || error.message || 'Login failed');
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

export const crmTrackingApi = {
    trackVisit: async (payload: CrmTrackingVisit): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_BASE_URL}/api/crm-tracking/visit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
        });

        if (!response.ok) {
            throw new Error('Failed to track visit');
        }

        return response.json();
    },

    getTracking: async (
        uuid: string,
        params?: { from?: string; to?: string },
        token?: string
    ): Promise<CrmTrackingResponse> => {
        const queryParams = new URLSearchParams(params as Record<string, string>);
        const headers: Record<string, string> = {};

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(
            `${API_BASE_URL}/api/crm-tracking/${uuid}?${queryParams}`,
            { headers }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch tracking data');
        }

        return response.json();
    }
};

// FAQ API
export const faqApi = {
    list: async (params: { page?: string; pageContext?: string; financingType?: string }, token?: string): Promise<{ entries: FaqEntry[] }> => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.pageContext) queryParams.append('pageContext', params.pageContext);
        if (params.financingType) queryParams.append('financingType', params.financingType);

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
    getSources: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/import/sources`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch import sources');
        }
        return response.json();
    },

    uploadCSV: async (
        file: File,
        token: string,
        source: string,
        mode: ImportMode = 'replace',
        onProgress?: (phase: 'uploading' | 'processing', percent: number) => void
    ) => {
        const CHUNK_THRESHOLD = 25 * 1024 * 1024; // 25MB — always chunk if over chunk size
        const CHUNK_SIZE = 25 * 1024 * 1024;       // 25MB per chunk

        // ── Small file: single request (original path) ──
        if (file.size <= CHUNK_THRESHOLD) {
            onProgress?.('uploading', 0);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/api/import/csv?mode=${mode}&source=${encodeURIComponent(source)}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Upload failed');
            }

            onProgress?.('processing', 100);
            return response.json();
        }

        // ── Large file: chunked upload ──
        const uploadId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2) + Date.now().toString(36);

        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        // Phase 1: Upload all chunks
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append('file', chunk, file.name);

            const response = await fetch(`${API_BASE_URL}/api/import/csv-chunk`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Upload-ID': uploadId,
                    'X-Chunk-Index': i.toString(),
                    'X-Total-Chunks': totalChunks.toString(),
                    'X-Original-Filename': file.name
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `Chunk ${i + 1}/${totalChunks} upload failed`);
            }

            // Upload progress: 0-80%
            const uploadPercent = Math.round(((i + 1) / totalChunks) * 80);
            onProgress?.('uploading', uploadPercent);
        }

        // Phase 2: Finalize — reassemble + import
        onProgress?.('processing', 85);

        const finalizeResponse = await fetch(
            `${API_BASE_URL}/api/import/csv-finalize?uploadId=${uploadId}&mode=${mode}&source=${encodeURIComponent(source)}`,
            {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );

        if (!finalizeResponse.ok) {
            const error = await finalizeResponse.json().catch(() => ({}));
            throw new Error(error.error || 'Import finalization failed');
        }

        onProgress?.('processing', 100);
        return finalizeResponse.json();
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
    },

    syncCSFlow: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/csflow/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'CSFlow Sync failed');
        }

        return response.json();
    }
};

// CSFlow Sources API
export const csflowApi = {
    getSources: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/csflow/sources`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Nie udało się pobrać źródeł CSFlow');
        return response.json();
    },

    createSource: async (data: { name: string; apiUrl: string; slug?: string; dealerGroupId?: string | null }, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/csflow/sources`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Nie udało się utworzyć źródła');
        }
        return response.json();
    },

    updateSource: async (id: string, data: { name?: string; apiUrl?: string; dealerGroupId?: string | null; isEnabled?: boolean }, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/csflow/sources/${id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Nie udało się zaktualizować źródła');
        }
        return response.json();
    },

    syncSource: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/csflow/sources/${id}/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Synchronizacja źródła nie powiodła się');
        }
        return response.json();
    },
};

// PewneAuto Sources API
export const pewneautoApi = {
    getSources: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/pewneauto/sources`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Nie udało się pobrać źródeł PewneAuto');
        return response.json();
    },

    createSource: async (data: {
        name: string;
        clientId: string;
        clientSecret: string;
        slug?: string;
        dealerGroupId?: string | null;
        tokenUrl?: string;
        apiUrl?: string;
    }, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/pewneauto/sources`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Nie udało się utworzyć źródła PewneAuto');
        }
        return response.json();
    },

    updateSource: async (id: string, data: {
        name?: string;
        clientId?: string;
        clientSecret?: string;
        dealerGroupId?: string | null;
        isEnabled?: boolean;
        tokenUrl?: string;
        apiUrl?: string;
    }, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/pewneauto/sources/${id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Nie udało się zaktualizować źródła PewneAuto');
        }
        return response.json();
    },

    deleteSource: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/pewneauto/sources/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Nie udało się usunąć źródła PewneAuto');
        }
        return response.json();
    },

    runDryRun: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/pewneauto/sources/${id}/dry-run`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Symulacja Dry-Run nie powiodła się');
        }
        return response.json();
    },

    syncSource: async (id: string, token: string, forceSync: boolean = false) => {
        const response = await fetch(`${API_BASE_URL}/api/pewneauto/sources/${id}/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ forceSync })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Synchronizacja źródła PewneAuto nie powiodła się');
        }
        return response.json();
    },

    syncAll: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/pewneauto/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Globalna synchronizacja PewneAuto nie powiodła się');
        }
        return response.json();
    },
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
    getListingOptions: async (status?: 'new' | 'used') => {
        // Options are public, no token needed
        const qs = status ? `?status=${status}` : '';
        const response = await fetch(`${API_BASE_URL}/api/listings/options${qs}`);
        if (!response.ok) {
            throw new Error('Failed to fetch listing options');
        }
        return response.json() as Promise<{ makes: string[]; models: { make: string; model: string }[]; bodyTypes: string[]; cities: string[] }>;
    },

    getListings: async (filters?: any, token?: string | null) => {
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
            appendArray('city', filters.cities);

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
            appendArray('status', filters.statuses);

            if (filters.powerFrom) params.append('powerMin', filters.powerFrom.toString());
            if (filters.powerTo) params.append('powerMax', filters.powerTo.toString());

            if (filters.capacityFrom) params.append('capacityMin', filters.capacityFrom.toString());
            if (filters.capacityTo) params.append('capacityMax', filters.capacityTo.toString());

            if (filters.rateFrom) params.append('rateMin', filters.rateFrom.toString());
            if (filters.rateTo) params.append('rateMax', filters.rateTo.toString());
            if (filters.rateType) params.append('rateType', filters.rateType);
            if (filters.rateBasis) params.append('rateBasis', filters.rateBasis);

            if (filters.sortBy) params.append('sortBy', filters.sortBy);
            if (filters.query) params.append('q', filters.query);
            if (filters.currency) params.append('currency', filters.currency);
            if (filters.page) params.append('page', filters.page.toString());
            if (filters.perPage) params.append('perPage', filters.perPage.toString());
            if (filters.entrySource) params.append('entrySource', filters.entrySource);
            if (filters.lastManualEditBefore) params.append('lastManualEditBefore', filters.lastManualEditBefore);
        }

        const url = `${API_BASE_URL}/api/listings?${params.toString()}`;
        console.log('Making API call to:', url);

        // Check for catalog prefetch injected by SSR (#Task 3)
        if (typeof window !== 'undefined' && (window as any).__CATALOG_PREFETCH__) {
            const prefetch = (window as any).__CATALOG_PREFETCH__;
            if (prefetch && prefetch.url === url && prefetch.p) {
                (window as any).__CATALOG_PREFETCH__ = null;
                try {
                    const data = await prefetch.p;
                    if (data) {
                        return data;
                    }
                } catch {
                    // Fall through to normal fetch
                }
            }
        }

        try {
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(url, { headers });
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

    getListing: async (idOrSlug: string) => {
        // Check if the identifier looks like a slug (contains hyphens and is longer than typical ID)
        // or if it's a legacy ID format (just call the regular endpoint)
        const isSlug = idOrSlug.includes('-') && idOrSlug.length > 25;

        const endpoint = isSlug
            ? `${API_BASE_URL}/api/listings/by-slug/${idOrSlug}`
            : `${API_BASE_URL}/api/listings/${idOrSlug}`;

        // Z tokenem backend zwraca pełne dane dealera (adres + kontakt);
        // bez tokenu sanitizeListing tnie je dla anonimowych odwiedzających.
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        const response = await fetch(endpoint, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
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

    toggleFeatured: async (id: string, isFeatured: boolean, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}/featured`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isFeatured })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to toggle featured status');
        }

        return response.json();
    },

    toggleBusinessFeatured: async (id: string, isBusinessFeatured: boolean, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}/featured`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isBusinessFeatured })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to toggle business featured status');
        }

        return response.json();
    },

    deleteListing: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Delete failed');
        }

        return response.json();
    },

    duplicateModel: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}/duplicate-model`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to duplicate model');
        }

        return response.json();
    },

    duplicateOffer: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}/duplicate-offer`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to duplicate offer');
        }

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
    },

    getListingsByIds: async (ids: string[]) => {
        if (!ids.length) return { listings: [] };

        const response = await fetch(`${API_BASE_URL}/api/listings/by-ids?ids=${ids.join(',')}`);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return response.json();
    },

    getSources: async (token: string): Promise<{ sources: { source: string | null; csflowSourceId?: string | null; csflowSourceName?: string | null; activeCount: number; archivedCount: number }[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/listings/sources`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch listing sources');
        return response.json();
    },

    archiveBySource: async (source: string | null, token: string, csflowSourceId?: string | null): Promise<{ success: boolean; count: number }> => {
        const response = await fetch(`${API_BASE_URL}/api/listings/bulk/archive-by-source`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ source, ...(csflowSourceId ? { csflowSourceId } : {}) })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Archive failed');
        return data;
    },

    deleteBySource: async (source: string | null, includeArchived: boolean, token: string, csflowSourceId?: string | null): Promise<{ success: boolean; count: number }> => {
        const response = await fetch(`${API_BASE_URL}/api/listings/bulk/delete-by-source`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ source, includeArchived, ...(csflowSourceId ? { csflowSourceId } : {}) })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Delete failed');
        return data;
    },

    createListing: async (data: any, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data),
        });
        const body = await response.json();
        if (!response.ok) {
            const errorMsg = body.error || (body.errors && Array.isArray(body.errors) ? body.errors.map((e: any) => e.message).join(', ') : 'Create failed');
            throw new Error(errorMsg);
        }
        return body;
    },

    updateListing: async (id: string, data: any, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data),
        });
        const body = await response.json();
        if (!response.ok) {
            const errorMsg = body.error || (body.errors && Array.isArray(body.errors) ? body.errors.map((e: any) => e.message).join(', ') : 'Update failed');
            const err = new Error(errorMsg) as any;
            if (body.errors && Array.isArray(body.errors)) {
                err.errors = body.errors;
            }
            throw err;
        }
        return body;
    },

    uploadImages: async (id: string, files: File[], setPrimary: boolean, token: string) => {
        const fd = new FormData();
        files.forEach(f => fd.append('files', f));
        fd.append('setPrimary', String(setPrimary));
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}/images`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd,
        });
        if (!response.ok) throw new Error('Upload failed');
        return response.json();
    },

    deleteImage: async (id: string, url: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}/images`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ url }),
        });
        if (!response.ok) throw new Error('Delete failed');
        return response.json();
    },

    uploadSpecificationPdf: async (id: string, file: File, token: string) => {
        const fd = new FormData();
        fd.append('file', file);
        const response = await fetch(`${API_BASE_URL}/api/listings/${id}/specs`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd,
        });
        if (!response.ok) throw new Error('PDF upload failed');
        return response.json();
    },
};

// Settings API
export const settingsApi = {
    getSettings: async () => {
        const response = await fetch(`${API_BASE_URL}/api/settings`);
        return response.json();
    },

    getAdminSettings: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/admin/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
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

    uploadLegalDoc: async (
        file: File,
        key: 'imprint' | 'privacyPolicy' | 'terms' | 'cookies',
        lang: 'pl' | 'en' | 'de',
        token: string,
    ) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('key', key);
        formData.append('lang', lang);

        const response = await fetch(`${API_BASE_URL}/api/settings/legal-doc`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Legal document upload failed');
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

// Feature Tiles API
export interface FeatureTile {
    id: string;
    title: string;
    imageUrl: string | null;
    targetUrl: string;
    sortOrder: number;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface PublicFeatureTile {
    id: string;
    title: string;
    imageUrl: string | null;
    targetUrl: string;
    vehicleCount: number | null;
}

export const featureTilesApi = {
    listPublic: async (): Promise<{ tiles: PublicFeatureTile[] }> => {
        const r = await fetch(`${API_BASE_URL}/api/feature-tiles/public`);
        if (!r.ok) throw new Error('Failed to fetch feature tiles');
        return r.json();
    },
    listAdmin: async (token: string): Promise<{ tiles: FeatureTile[] }> => {
        const r = await fetch(`${API_BASE_URL}/api/feature-tiles`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) throw new Error('Failed to fetch feature tiles');
        return r.json();
    },
    create: async (data: { title: string; targetUrl: string; imageUrl?: string | null; isActive?: boolean }, token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/feature-tiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to create tile');
        return json as { tile: FeatureTile };
    },
    update: async (id: string, data: Partial<Pick<FeatureTile, 'title' | 'targetUrl' | 'imageUrl' | 'isActive'>>, token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/feature-tiles/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to update tile');
        return json as { tile: FeatureTile };
    },
    remove: async (id: string, token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/feature-tiles/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || 'Failed to delete tile');
        }
        return true;
    },
    reorder: async (order: string[], token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/feature-tiles/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ order })
        });
        if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || 'Failed to reorder');
        }
        return true;
    },
    uploadImage: async (id: string, file: File, token: string) => {
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch(`${API_BASE_URL}/api/feature-tiles/${id}/image`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to upload image');
        return json as { tile: FeatureTile; url: string };
    },
};

// Hero Banners API
export interface HeroBanner {
    id: string;
    imageUrlDesktop: string | null;
    imageUrlMobile: string | null;
    altText: string;
    buttonLabel: string;
    buttonUrl: string;
    buttonPositionYPct: number;
    buttonAlign: string;
    isActive: boolean;
    sortOrder: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface PublicHeroBanner {
    id: string;
    imageUrlDesktop: string | null;
    imageUrlMobile: string | null;
    altText: string;
    buttonLabel: string;
    buttonUrl: string;
    buttonPositionYPct: number;
    buttonAlign: string;
}

export type HeroBannerInput = Pick<
    HeroBanner,
    'altText' | 'buttonLabel' | 'buttonUrl' | 'buttonPositionYPct' | 'buttonAlign' | 'isActive'
>;

export const heroBannersApi = {
    listPublic: async (): Promise<{ banners: PublicHeroBanner[] }> => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners/public`);
        if (!r.ok) throw new Error('Failed to fetch hero banners');
        return r.json();
    },
    listAdmin: async (token: string): Promise<{ banners: HeroBanner[] }> => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error('Failed to fetch hero banners');
        return r.json();
    },
    create: async (data: Partial<HeroBannerInput>, token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(data),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to create banner');
        return json as { banner: HeroBanner };
    },
    update: async (id: string, data: Partial<HeroBannerInput>, token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(data),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to update banner');
        return json as { banner: HeroBanner };
    },
    remove: async (id: string, token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || 'Failed to delete banner');
        }
        return true;
    },
    reorder: async (order: string[], token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ order }),
        });
        if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || 'Failed to reorder');
        }
        return true;
    },
    uploadImage: async (id: string, file: File, slot: 'desktop' | 'mobile', token: string) => {
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch(`${API_BASE_URL}/api/hero-banners/${id}/image?slot=${slot}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to upload image');
        return json as { banner: HeroBanner; url: string };
    },
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

        // Bez parametrów URL musi być identyczny z <link rel="preload"> w index.html
        // (goły /api/translations) — samotny "?" unieważnia dopasowanie preloadu
        const qs = queryParams.toString();
        const response = await fetch(`${API_BASE_URL}/api/translations${qs ? `?${qs}` : ''}`, {
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
        listingId?: string;
        leadType?: string;
        trafficSource?: string;
        name: string;
        email?: string;
        phone?: string;
        preferredContact?: 'email' | 'phone';
        message?: string;
        consentMarketing?: boolean;
        consentPrivacy?: boolean;
        financingProductId?: string;
        financingAmount?: number;
        financingPeriod?: number;
        financingDownPayment?: number;
        financingInstallment?: number;
        financingFinalPayment?: number;
        turnstileToken?: string;
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
    submitNegotiationLead: async (data: {
        listingId: string;
        name: string;
        email?: string;
        phone?: string;
        preferredContact: 'email' | 'phone';
        message?: string;
        proposedPrice: number;
        consentMarketing: boolean;
        consentPrivacy: boolean;
        turnstileToken?: string;
    }) => {
        const response = await fetch(`${API_BASE_URL}/api/leads/negotiation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to submit negotiation lead');
        }

        return response.json();
    },

    submitWaitlistLead: async (data: {
        make: string;
        model?: string;
        name: string;
        email: string;
        phone?: string;
        consentMarketing: boolean;
        consentPrivacy: boolean;
        turnstileToken?: string;
    }) => {
        const response = await fetch(`${API_BASE_URL}/api/leads/waitlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to submit waitlist lead');
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
    },
    submitQuickLead: async (data: {
        phone: string;
        name?: string;
        message?: string;
        listingId?: string;
        company?: string;
        turnstileToken?: string;
        pageUrl?: string;
        landingPageSlug?: string;
        src?: string;
        financingProductId?: string;
        financingAmount?: number;
        financingPeriod?: number;
        financingDownPayment?: number;
        financingInstallment?: number;
        financingFinalPayment?: number;
    }) => {
        const payload = {
            pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
            ...data
        };
        const response = await fetch(`${API_BASE_URL}/api/leads/quick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to submit quick lead');
        }

        return response.json();
    },

    submitRentalLead: async (data: {
        rentalVehicleId: string;
        name: string;
        email?: string;
        phone?: string;
        preferredContact: 'email' | 'phone';
        message?: string;
        consentMarketing: boolean;
        consentPrivacy: boolean;
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

        return response.json() as Promise<{
            monthlyInstallment: number;
            monthlyInstallmentNetto?: number;
            monthlyInstallmentBrutto?: number;
            isGross?: boolean;
            provider: string;
            client?: string;
            initialFee?: number;
            repurchase?: number;
            duration?: number;
            creditCostRateAnnual?: number | null;
            interestRateAnnual?: number | null;
            repaymentsAmountTotal?: number | null;
            creditCostAmountTotal?: number | null;
            contractFeeAmountTotal?: number;
            interestAmountTotal?: number | null;
            lastPaymentAmount?: number | null;
            cars?: Array<{
                state: number;
                manufacturing_year: number;
                price: number;
                installment: number;
                initialFee: number;
                repurchase: number;
                wibor: string;
            }>;
        }>;
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

    testConnection: async (payload: { provider: string; apiBaseUrl: string; apiKey?: string; apiSecret?: string; shopUuid?: string; connectionId?: string }, token: string) => {
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

// SEO Content (CMS) API — strony marek/modeli (/samochody/:marka[/:model])
export const seoContentApi = {
    getPublic: async (path: string): Promise<PublicSeoContent | null> => {
        const response = await fetch(`${API_BASE_URL}/api/seo-content?path=${encodeURIComponent(path)}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Failed to fetch SEO content');
        return response.json();
    },
    list: async (token: string): Promise<{ pages: SeoContentPage[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/admin/seo-content`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch SEO content pages');
        return response.json();
    },
    create: async (payload: SeoContentPayload, token: string): Promise<{ page: SeoContentPage }> => {
        const response = await fetch(`${API_BASE_URL}/api/admin/seo-content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to create SEO content page');
        }
        return response.json();
    },
    update: async (id: string, payload: Partial<SeoContentPayload>, token: string): Promise<{ page: SeoContentPage }> => {
        const response = await fetch(`${API_BASE_URL}/api/admin/seo-content/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to update SEO content page');
        }
        return response.json();
    },
    delete: async (id: string, token: string): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_BASE_URL}/api/admin/seo-content/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete SEO content page');
        return response.json();
    }
};

// Partner Ads API
export const partnerAdsApi = {
    list: async (placement?: string, pageContext?: string): Promise<{ ads: PartnerAd[] }> => {
        const params = new URLSearchParams();
        if (placement) params.append('placement', placement);
        if (pageContext) params.append('pageContext', pageContext);

        const response = await fetch(`${API_BASE_URL}/api/partner-ads?${params}`);
        if (!response.ok) {
            throw new Error('Failed to fetch ads');
        }
        return response.json();
    },

    listAdmin: async (token: string): Promise<{ ads: PartnerAd[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/admin/partner-ads`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch admin ads');
        }
        return response.json();
    },

    create: async (payload: PartnerAdPayload, token: string): Promise<{ ad: PartnerAd }> => {
        const response = await fetch(`${API_BASE_URL}/api/admin/partner-ads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to create ad');
        }
        return response.json();
    },

    update: async (id: string, payload: Partial<PartnerAdPayload>, token: string): Promise<{ ad: PartnerAd }> => {
        const response = await fetch(`${API_BASE_URL}/api/admin/partner-ads/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to update ad');
        }
        return response.json();
    },

    delete: async (id: string, token: string): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_BASE_URL}/api/admin/partner-ads/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Failed to delete ad');
        }
        return response.json();
    }
};

// Widgets API
export const api = {
    widgets: {
        list: async (token?: string) => {
            const response = await fetch(`${API_BASE_URL}/api/admin/widgets`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
            });
            if (!response.ok) throw new Error('Failed to fetch widgets');
            return response.json();
        },
        get: async (id: string, token?: string) => {
            const response = await fetch(`${API_BASE_URL}/api/admin/widgets/${id}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
            });
            if (!response.ok) throw new Error('Failed to fetch widget');
            return response.json();
        },
        create: async (payload: any, token: string) => {
            const response = await fetch(`${API_BASE_URL}/api/admin/widgets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Failed to create widget, server returned:", errorData);
                throw new Error(errorData.error || errorData.message || 'Failed to create widget');
            }
            return response.json();
        },
        update: async (id: string, payload: any, token: string) => {
            const response = await fetch(`${API_BASE_URL}/api/admin/widgets/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Failed to update widget, server returned:", errorData);
                throw new Error(errorData.error || errorData.message || 'Failed to update widget');
            }
            return response.json();
        },
        delete: async (id: string, token: string) => {
            const response = await fetch(`${API_BASE_URL}/api/admin/widgets/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete widget');
            return response.json();
        }
    }
};

// Partner Management (API Keys)
export const partnerManagementApi = {
    list: async (token: string): Promise<{ partners: PartnerApiIntegration[] }> => {
        const response = await fetch(`${API_BASE_URL}/api/partners`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch partners');
        return response.json();
    },
    // Returns only the new plaintext key + id - the one moment it can be shown.
    create: async (data: Partial<PartnerApiIntegration>, token: string): Promise<{ id: string; apiKey: string }> => {
        const response = await fetch(`${API_BASE_URL}/api/partners`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Failed to create partner');
        return json;
    },
    update: async (id: string, data: Partial<PartnerApiIntegration>, token: string): Promise<{ partner: PartnerApiIntegration }> => {
        const response = await fetch(`${API_BASE_URL}/api/partners/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Failed to update partner');
        return json;
    },
    // Returns only the new plaintext key + id - the one moment it can be shown.
    regenerateKey: async (id: string, token: string): Promise<{ id: string; apiKey: string }> => {
        const response = await fetch(`${API_BASE_URL}/api/partners/${id}/regenerate-key`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Failed to regenerate key');
        return json;
    }
};

export const landingPagesApi = {
    getPublic: async (slug: string) => {
        const response = await fetch(`${API_BASE_URL}/api/landing-pages/public/${encodeURIComponent(slug)}`);
        if (response.status === 410) {
            const error: any = new Error('Landing page expired');
            error.status = 410;
            throw error;
        }
        if (!response.ok) {
            const error: any = await response.json().catch(() => ({}));
            const err: any = new Error(error.error || 'Failed to fetch landing page');
            err.status = response.status;
            throw err;
        }
        return response.json();
    },

    list: async () => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/landing-pages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch landing pages');
        return response.json();
    },

    getById: async (id: string) => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/landing-pages/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch landing page');
        return response.json();
    },

    create: async (data: any) => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/landing-pages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to create landing page');
        }
        return response.json();
    },

    update: async (id: string, data: any) => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/landing-pages/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to update landing page');
        }
        return response.json();
    },

    delete: async (id: string) => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/landing-pages/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete landing page');
        return response.json();
    },

    uploadHeroImage: async (id: string, file: File) => {
        const token = localStorage.getItem('auth_token');
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_BASE_URL}/api/landing-pages/${id}/hero-image`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to upload hero image');
        }
        return response.json();
    },

    duplicate: async (id: string) => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/landing-pages/${id}/duplicate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to duplicate landing page');
        }
        return response.json();
    },

    deleteHeroImage: async (id: string) => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/landing-pages/${id}/hero-image`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to delete hero image');
        }
        return response.json();
    },

    uploadTermsFile: async (id: string, file: File) => {
        const token = localStorage.getItem('auth_token');
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_BASE_URL}/api/landing-pages/${id}/terms-file`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to upload terms file');
        }
        return response.json();
    },

    deleteTermsFile: async (id: string) => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/landing-pages/${id}/terms-file`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to delete terms file');
        }
        return response.json();
    },

    getPreviewListings: async (id: string) => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/landing-pages/${id}/preview-listings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch preview listings');
        return response.json();
    }
};

