import fs from 'fs/promises';

async function check() {
  const dir = '/Users/kamiltonkowicz/Documents/Coding/github/car-scout/uploads/csflow-images/csflow-62090/';
  try {
    const files = await fs.readdir(dir);
    console.log('Files in dir:', files);
  } catch(e) {
    console.log('Directory does not exist');
  }
}
check();
