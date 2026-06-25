import dotenv from 'dotenv';
dotenv.config();

async function fetchAll() {
    const res = await fetch('https://api.csflow.pl/v2/cars', {
        headers: {
            'Authorization': `Bearer ${process.env.CSFLOW_API_KEY}`
        }
    });
    const data = await res.json();
    return data;
}

fetchAll().then(data => {
    // Find car that matches mercedes benz a 180 style 2021
    const cars = data.data || [];
    const car = cars.find((c: any) => c.make?.toLowerCase() === 'mercedes-benz' && c.model?.name?.toLowerCase() === 'a' && c.production_year === '2021');
    console.log("Matched Car:", car?.make, car?.model?.name, car?.version, car?.tax_type_id, car?.invoice_vat, car?.price);
}).catch(console.error);

