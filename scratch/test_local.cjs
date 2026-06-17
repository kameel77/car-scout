const fetch = require('node-fetch');
const API_URL = 'http://localhost:3000/api/v1/external/listings';
const API_KEY = 'cs_partner_35dd34e79428b862503ffb4507083f0a';

const listing1 = {
    externalDealerId: "003-s1",
    vin: "TESTVIN001S19999",
    make: "Porsche",
    model: "911",
    version: "Carrera S",
    productionYear: 2023,
    mileageKm: 15000,
    pricePln: 750000,
    fuelType: "Benzyna",
    transmission: "Automatyczna",
    enginePowerHp: 450,
    engineCapacityCm3: 2981,
    drive: "AWD (4x4)",
    bodyType: "Coupe",
    doors: 2,
    seats: 4,
    color: "Czarny",
    paintType: "Metalik",
    condition: "USED",
    equipmentAudioMultimedia: ["Apple CarPlay", "Android Auto", "Bose Surround System"],
    equipmentSafety: ["ABS", "ESP", "Asystent pasa ruchu"],
    equipmentComfortExtras: ["Klimatyzacja automatyczna 2-strefowa", "Podgrzewane fotele"],
    equipmentOther: ["Sport Chrono", "PDLS+"],
    images: ["https://picsum.photos/seed/porsche/800/600"]
};

async function createListing(listing) {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(listing)
    });
    
    if (!res.ok) {
        const err = await res.text();
        console.error(`Failed:`, err);
    } else {
        const data = await res.json();
        console.log(`Success:`, data);
    }
}
createListing(listing1);
