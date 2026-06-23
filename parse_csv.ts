import fs from 'fs';
import { parse } from 'csv-parse/sync';

const data = fs.readFileSync('csflow_first_10_raw.csv', 'utf8');
const records = parse(data, { columns: true, skip_empty_lines: true });

records.forEach((r: any) => {
    console.log(`ID: ${r.id}, tax_type_id: ${r.tax_type_id}, invoice_vat: ${r.invoice_vat}`);
});
