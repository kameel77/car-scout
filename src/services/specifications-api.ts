let API_BASE_URL = import.meta.env.VITE_API_URL || '';
if (API_BASE_URL.endsWith('/api')) API_BASE_URL = API_BASE_URL.slice(0, -4);
if (API_BASE_URL.endsWith('/api/')) API_BASE_URL = API_BASE_URL.slice(0, -5);

export const specificationsApi = {
    getSpecifications: async (token: string) => {
        const res = await fetch(`${API_BASE_URL}/api/specifications`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error('Failed to fetch specifications');
        return res.json();
    },

    createSpecification: async (token: string) => {
        const res = await fetch(`${API_BASE_URL}/api/specifications`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error('Failed to create specification');
        return res.json();
    },

    getSpecification: async (id: string, token: string) => {
        const res = await fetch(`${API_BASE_URL}/api/specifications/${id}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error('Failed to fetch specification');
        return res.json();
    },

    updateSpecification: async (id: string, data: any, token: string) => {
        const res = await fetch(`${API_BASE_URL}/api/specifications/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update specification');
        return res.json();
    },

    parsePdf: async (file: File, token: string) => {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE_URL}/api/specifications/parse-pdf`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: formData
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to parse PDF');
        }
        return res.json();
    }
};
