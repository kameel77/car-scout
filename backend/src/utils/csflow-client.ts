import fetch from 'node-fetch';

const CSFLOW_API_URL = process.env.CSFLOW_API_URL || 'https://webapi.demo.csflow.pl';

/**
 * Zwraca listę pojazdów z CSFlow.
 * Dokumentacja wskazuje także na możliwość `/cars-updated`, ale /cars służy jako główne źródło, 
 * które możemy odpytać, aby zsynchronizować bazę.
 */
export async function getCSFlowCars(): Promise<any[]> {
    const url = new URL(`${CSFLOW_API_URL}/cars`);
    // W środowisku produkcyjnym można użyć paginacji, jeśli endpoint ją wspiera,
    // domyślnie dodajemy wysoki limit
    url.searchParams.append('limit', '500');

    try {
        const response = await fetch(url.toString(), {
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
export async function getCSFlowCarDetails(id: string | number): Promise<any> {
    const url = new URL(`${CSFLOW_API_URL}/car`);
    url.searchParams.append('id', id.toString());

    try {
        const response = await fetch(url.toString(), {
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
