import fs from 'fs/promises';
import path from 'path';

async function check() {
  const p1 = '/Users/kamiltonkowicz/Documents/Coding/github/car-scout/uploads/csflow-images/csflow-62090/0.webp';
  const p2 = '/Users/kamiltonkowicz/Documents/Coding/github/car-scout/uploads/csflow-images/csflow-62090/0-thumb.webp';
  try {
    const s1 = await fs.stat(p1);
    console.log('0.webp EXISTS, size:', s1.size);
  } catch(e) {
    console.log('0.webp DOES NOT EXIST');
  }
  try {
    const s2 = await fs.stat(p2);
    console.log('0-thumb.webp EXISTS, size:', s2.size);
  } catch(e) {
    console.log('0-thumb.webp DOES NOT EXIST');
  }
}
check();
