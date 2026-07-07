import fetch from 'node-fetch';

const FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, options: any = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: controller.signal as any });
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Zwraca listę pojazdów z CSFlow.
 * Dokumentacja wskazuje także na możliwość `/cars-updated`, ale /cars służy jako główne źródło, 
 * które możemy odpytać, aby zsynchronizować bazę.
 */
export async function getCSFlowCars(apiUrl: string): Promise<any[]> {
    const url = new URL(`${apiUrl}/cars`);
    // Limit można skonfigurować przez CSFLOW_LIMIT w ENV.
    // Domyślnie 9999 — bez limitu CSFlow API zwraca tylko 10 rekordów.
    const limit = process.env.CSFLOW_LIMIT || '9999';
    url.searchParams.append('limit', limit);

    try {
        const response = await fetchWithTimeout(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`CSFlow /cars error! Status: ${response.status}`);
        }

        const data = (await response.json()) as any;
        return data.cars || [];
    } catch (error) {
        console.error('Błąd podczas pobierania /cars z CSFlow:', error);
        throw error;
    }
}

/**
 * Zwraca szczegóły pojedynczego pojazdu z CSFlow (m.in. po to by zdobyć tablicę equipped_groups i duże zdjęcia).
 * @param id ID pojazdu w systemie CSFlow (np. 35203)
 */
export async function getCSFlowCarDetails(apiUrl: string, id: string | number): Promise<any> {
    const url = new URL(`${apiUrl}/car`);
    url.searchParams.append('id', id.toString());

    try {
        const response = await fetchWithTimeout(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`CSFlow /car error! Status: ${response.status}`);
        }

        const data = (await response.json()) as any;
        return data.car || null;
    } catch (error) {
        console.error(`Błąd podczas pobierania /car (id: ${id}) z CSFlow:`, error);
        throw error;
    }
}
