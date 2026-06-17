import { getCSFlowCars, getCSFlowCarDetails } from './utils/csflow-client.js';

async function main() {
    process.env.CSFLOW_API_URL = 'https://webapi.grupabemo.csflow.pl';
    process.env.CSFLOW_LIMIT = '100'; // fetch some cars to see different dealers
    
    console.log('Fetching cars...');
    const cars = await getCSFlowCars();
    console.log(`Fetched ${cars.length} cars. Fetching details...`);
    
    const dealers = new Map<number, any>();
    
    // Fetch details for first 50 cars to gather dealer objects
    for (let i = 0; i < Math.min(cars.length, 50); i++) {
        const detail = await getCSFlowCarDetails(cars[i].id);
        if (detail && detail.dealer) {
            dealers.set(detail.dealer.id, detail.dealer);
        }
    }
    
    console.log('Unique dealers found:');
    for (const [id, dealer] of dealers.entries()) {
        console.log(`Dealer ID ${id}:`, JSON.stringify(dealer, null, 2));
    }
}

main();
