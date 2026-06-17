import { getCSFlowCars, getCSFlowCarDetails } from './utils/csflow-client.js';

async function main() {
    process.env.CSFLOW_API_URL = 'https://webapi.grupabemo.csflow.pl';
    process.env.CSFLOW_LIMIT = '9999';
    
    console.log('Fetching cars from CSFlow...');
    const cars = await getCSFlowCars();
    console.log(`Fetched ${cars.length} cars. Searching details...`);
    
    let matchCount = 0;
    
    for (let i = 0; i < cars.length; i++) {
        try {
            const detail = await getCSFlowCarDetails(cars[i].id);
            if (!detail) continue;
            
            const detailStr = JSON.stringify(detail);
            if (detailStr.toLowerCase().includes('autopunkt')) {
                console.log(`\nFound "Autopunkt" in car ID ${cars[i].id} (${detail.brand_name || ''} ${detail.model_name || ''}):`);
                
                // Let's find exactly where it matches
                if (detail.description_header && detail.description_header.toLowerCase().includes('autopunkt')) {
                    console.log('-> In description_header:', detail.description_header);
                }
                if (detail.description_footer && detail.description_footer.toLowerCase().includes('autopunkt')) {
                    console.log('-> In description_footer:', detail.description_footer);
                }
                if (detail.dealer) {
                    const dealerStr = JSON.stringify(detail.dealer);
                    if (dealerStr.toLowerCase().includes('autopunkt')) {
                        console.log('-> In dealer object:', dealerStr);
                    }
                }
                matchCount++;
            }
        } catch (e: any) {
            console.error(`Error fetching detail for car ${cars[i].id}:`, e.message);
        }
    }
    
    console.log(`\nSearch finished. Found ${matchCount} cars matching "Autopunkt".`);
}

main();
