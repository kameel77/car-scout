/**
 * Normalizacja nazw marek samochodowych dla portalu pracowniczego.
 * Zapewnia spójność prezentacji i eliminuje duplikaty w filtrach (np. HYUNDAI i Hyundai).
 */

const BRAND_CANONICAL_MAP: Record<string, string> = {
  'citroen': 'Citroën',
  'citroën': 'Citroën',
  'skoda': 'Škoda',
  'škoda': 'Škoda',
  'mercedes': 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  'volkswagen': 'Volkswagen',
  'vw': 'Volkswagen',
  'alfa romeo': 'Alfa Romeo',
  'land rover': 'Land Rover',
  'aston martin': 'Aston Martin',
  'ds': 'DS Automobiles',
  'ds automobiles': 'DS Automobiles',
  'ssangyong': 'SsangYong/KGM',
  'kgm': 'SsangYong/KGM',
  'ssangyong/kgm': 'SsangYong/KGM',
  'hyundai': 'Hyundai',
  'toyota': 'Toyota',
  'peugeot': 'Peugeot',
  'renault': 'Renault',
  'opel': 'Opel',
  'ford': 'Ford',
  'fiat': 'Fiat',
  'audi': 'Audi',
  'bmw': 'BMW',
  'kia': 'Kia',
  'mazda': 'Mazda',
  'nissan': 'Nissan',
  'suzuki': 'Suzuki',
  'volvo': 'Volvo',
  'porsche': 'Porsche',
  'seat': 'Seat',
  'cupra': 'Cupra',
  'mg': 'MG',
  'omoda': 'Omoda',
  'jaecoo': 'Jaecoo',
  'chery': 'Chery',
  'baic': 'Baic',
  'jac': 'JAC',
  'byd': 'BYD',
  'dacia': 'Dacia',
};

export function normalizeBrand(brand: string | null | undefined): string {
  if (!brand) return 'Inne';

  const trimmed = brand.trim();
  if (!trimmed) return 'Inne';

  const lower = trimmed.toLowerCase();

  if (BRAND_CANONICAL_MAP[lower]) {
    return BRAND_CANONICAL_MAP[lower];
  }

  // Fallback: Title Case (dla marek wieloczłonowych każda litera słowa)
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) return '';
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
