import type { User, UserPayload } from '@/types/user';
import { API_BASE_URL } from './api';

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
    },

    getTelemetrySummary: async (days: number = 7, token: string) => {
        const response = await fetch(
            `${API_BASE_URL}/api/analytics/telemetry/summary?days=${days}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!response.ok) {
            throw new Error('Failed to fetch telemetry summary');
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
