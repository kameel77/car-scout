// Mock data for AutoFinder

export interface Listing {
  listing_id: string;
  listing_url: string;
  make: string;
  model: string;
  version: string;
  vin: string;
  price_pln: number;
  dealer_price_net_pln?: number;
  dealer_price_net_eur?: number;
  broker_price_pln?: number;
  broker_price_eur?: number;
  price_display: string;
  production_year: number;
  mileage_km: number;
  fuel_type: string;
  transmission: string;
  drive: string;
  engine_power_hp: number;
  engine_capacity_cm3: number;
  body_type: string;
  first_registration_date: string;
  registration_number?: string;
  primary_image_url: string;
  image_urls: string[];
  dealer_name: string;
  dealer_address_line1: string;
  dealer_address_line2?: string;
  dealer_address_line3?: string;
  dealer_city: string;
  contact_phone: string;
  google_rating?: number;
  google_reviews_count?: number;
  specifications: { label: string; value: string }[];
  equipment: {
    audioMultimedia: string[];
    safety: string[];
    comfort: string[];
    performance: string[];
    driverAssist: string[];
    other: string[];
  };
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  status: 'new' | 'contacted' | 'in_progress' | 'sold' | 'closed';
  listing_id: string;
  listing_make: string;
  listing_model: string;
  listing_vin?: string;
  listing_price: string;
  listing_year?: number;
  listing_mileage?: string;
  dealer_price_net_pln?: number;
  dealer_price_net_eur?: number;
  broker_price_pln?: number;
  broker_price_eur?: number;
  dealer_name?: string;
  dealer_address?: string;
  dealer_phone?: string;
  consent_marketing_at: string;
  consent_privacy_at: string;
  created_at: string;
}

export interface Make {
  id: string;
  name: string;
  count: number;
}

export interface Model {
  id: string;
  makeId: string;
  name: string;
  count: number;
}

export const makes: Make[] = [
  { id: 'toyota', name: 'Toyota', count: 245 },
  { id: 'volkswagen', name: 'Volkswagen', count: 198 },
  { id: 'bmw', name: 'BMW', count: 167 },
  { id: 'mercedes', name: 'Mercedes-Benz', count: 156 },
  { id: 'audi', name: 'Audi', count: 143 },
  { id: 'ford', name: 'Ford', count: 132 },
  { id: 'opel', name: 'Opel', count: 98 },
  { id: 'skoda', name: 'Škoda', count: 87 },
  { id: 'hyundai', name: 'Hyundai', count: 76 },
  { id: 'kia', name: 'Kia', count: 65 },
  { id: 'mazda', name: 'Mazda', count: 54 },
  { id: 'honda', name: 'Honda', count: 43 },
  { id: 'volvo', name: 'Volvo', count: 38 },
  { id: 'renault', name: 'Renault', count: 35 },
  { id: 'peugeot', name: 'Peugeot', count: 32 },
];

export const models: Model[] = [
  // Toyota
  { id: 'corolla', makeId: 'toyota', name: 'Corolla', count: 45 },
  { id: 'yaris', makeId: 'toyota', name: 'Yaris', count: 38 },
  { id: 'camry', makeId: 'toyota', name: 'Camry', count: 32 },
  { id: 'rav4', makeId: 'toyota', name: 'RAV4', count: 56 },
  { id: 'chr', makeId: 'toyota', name: 'C-HR', count: 28 },
  { id: 'aygo', makeId: 'toyota', name: 'Aygo X', count: 22 },
  { id: 'highlander', makeId: 'toyota', name: 'Highlander', count: 15 },

  // Volkswagen
  { id: 'golf', makeId: 'volkswagen', name: 'Golf', count: 67 },
  { id: 'passat', makeId: 'volkswagen', name: 'Passat', count: 45 },
  { id: 'tiguan', makeId: 'volkswagen', name: 'Tiguan', count: 38 },
  { id: 'polo', makeId: 'volkswagen', name: 'Polo', count: 28 },
  { id: 'arteon', makeId: 'volkswagen', name: 'Arteon', count: 12 },
  { id: 'id4', makeId: 'volkswagen', name: 'ID.4', count: 8 },

  // BMW
  { id: '3series', makeId: 'bmw', name: '3 Series', count: 56 },
  { id: '5series', makeId: 'bmw', name: '5 Series', count: 34 },
  { id: 'x3', makeId: 'bmw', name: 'X3', count: 28 },
  { id: 'x5', makeId: 'bmw', name: 'X5', count: 22 },
  { id: '1series', makeId: 'bmw', name: '1 Series', count: 18 },
  { id: 'ix3', makeId: 'bmw', name: 'iX3', count: 9 },

  // Mercedes
  { id: 'cclass', makeId: 'mercedes', name: 'C-Class', count: 48 },
  { id: 'eclass', makeId: 'mercedes', name: 'E-Class', count: 36 },
  { id: 'aclass', makeId: 'mercedes', name: 'A-Class', count: 32 },
  { id: 'glc', makeId: 'mercedes', name: 'GLC', count: 24 },
  { id: 'gle', makeId: 'mercedes', name: 'GLE', count: 16 },

  // Audi
  { id: 'a4', makeId: 'audi', name: 'A4', count: 52 },
  { id: 'a3', makeId: 'audi', name: 'A3', count: 38 },
  { id: 'q5', makeId: 'audi', name: 'Q5', count: 28 },
  { id: 'a6', makeId: 'audi', name: 'A6', count: 18 },
  { id: 'q3', makeId: 'audi', name: 'Q3', count: 7 },
];

const carImages = [
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1526726538690-5cbf956ae2fd?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&h=600&fit=crop',
];

const galleryImages = [
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200&h=800&fit=crop',
  'https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=1200&h=800&fit=crop',
  'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=1200&h=800&fit=crop',
  'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=1200&h=800&fit=crop',
  'https://images.unsplash.com/photo-1542362567-b07e54358753?w=1200&h=800&fit=crop',
  'https://images.unsplash.com/photo-1494905998402-395d579af36f?w=1200&h=800&fit=crop',
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=1200&h=800&fit=crop',
  'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200&h=800&fit=crop',
];

const fuelTypes = ['benzyna', 'diesel', 'hybryda', 'elektryczny', 'lpg'];
const transmissions = ['manualna', 'automatyczna'];
const drives = ['FWD', 'RWD', 'AWD'];
const bodyTypes = ['sedan', 'hatchback', 'SUV', 'kombi', 'coupe'];

const dealers = [
  { name: 'Toyota Warszawa', city: 'Warszawa', address: 'ul. Puławska 123', phone: '+48 22 123 45 67', rating: 4.7, reviews: 234 },
  { name: 'Auto Premium Kraków', city: 'Kraków', address: 'ul. Krakowska 45', phone: '+48 12 234 56 78', rating: 4.5, reviews: 187 },
  { name: 'Centrum Motoryzacyjne Poznań', city: 'Poznań', address: 'ul. Głogowska 89', phone: '+48 61 345 67 89', rating: 4.8, reviews: 312 },
  { name: 'Auto-Salon Wrocław', city: 'Wrocław', address: 'ul. Legnicka 56', phone: '+48 71 456 78 90', rating: 4.3, reviews: 156 },
  { name: 'Premium Cars Gdańsk', city: 'Gdańsk', address: 'ul. Grunwaldzka 78', phone: '+48 58 567 89 01', rating: 4.6, reviews: 203 },
];

const equipmentAudioMultimedia = [
  'Radio cyfrowe DAB',
  'Apple CarPlay',
  'Android Auto',
  'Nawigacja satelitarna',
  'Bluetooth',
  'Gniazdo USB',
  'System audio premium',
  'Wyświetlacz HUD',
  'Ładowanie indukcyjne telefonu',
];

const equipmentSafety = [
  'ABS',
  'ESP',
  'Poduszki powietrzne przednie',
  'Poduszki powietrzne boczne',
  'Poduszki powietrzne kurtynowe',
  'System ISOFIX',
  'Czujniki parkowania przód/tył',
  'Kamera cofania',
  'Kamera 360°',
  'System monitorowania martwego pola',
];

const equipmentComfort = [
  'Klimatyzacja automatyczna',
  'Klimatyzacja dwustrefowa',
  'Podgrzewane fotele',
  'Wentylowane fotele',
  'Elektrycznie regulowane fotele',
  'Pamięć ustawień fotela',
  'Szyberdach panoramiczny',
  'Przyciemniane szyby',
  'Bezkluczykowy dostęp',
  'Elektryczna klapa bagażnika',
  'Podgrzewana kierownica',
];

const equipmentPerformance = [
  'Tryby jazdy',
  'Zawieszenie sportowe',
  'Pakiet sportowy M',
  'Układ wydechowy sportowy',
  'Felgi aluminiowe 19"',
  'Hamulce wentylowane',
];

const equipmentDriverAssist = [
  'Tempomat adaptacyjny ACC',
  'Asystent pasa ruchu',
  'Automatyczne światła',
  'Czujnik deszczu',
  'Asystent parkowania',
  'Aktywny asystent hamowania',
  'Rozpoznawanie znaków drogowych',
  'Asystent martwego pola',
];

const equipmentOther = [
  'Hak holowniczy',
  'Relingi dachowe',
  'Elektrycznie składane lusterka',
  'Przyciemniane tylne szyby',
  'Pakiet zimowy',
];

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generatePrice(): { pln: number; display: string } {
  const base = Math.floor(Math.random() * 300000) + 30000;
  const rounded = Math.round(base / 1000) * 1000;
  return {
    pln: rounded,
    display: `${rounded.toLocaleString('pl-PL')} PLN`,
  };
}

function generateListingId(): string {
  return Math.random().toString().slice(2, 11);
}

function generateVIN(): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  return Array.from({ length: 17 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function generateMockListings(count: number = 50): Listing[] {
  const listings: Listing[] = [];

  for (let i = 0; i < count; i++) {
    const make = randomFromArray(makes);
    const modelOptions = models.filter(m => m.makeId === make.id);
    const model = modelOptions.length > 0 ? randomFromArray(modelOptions) : { name: 'Model X', id: 'x' };
    const dealer = randomFromArray(dealers);
    const price = generatePrice();
    const year = Math.floor(Math.random() * 8) + 2017;
    const mileage = Math.floor(Math.random() * 150000) + 5000;
    const power = Math.floor(Math.random() * 250) + 80;
    const capacity = Math.floor(Math.random() * 2000) + 1000;
    const versions = ['Base', 'Comfort', 'Premium', 'Sport', 'Luxury', 'Executive', 'Style', 'Active'];
    const version = `${(capacity / 1000).toFixed(1)} ${randomFromArray(versions)}`;

    listings.push({
      listing_id: generateListingId(),
      listing_url: '#',
      make: make.name,
      model: model.name,
      version,
      vin: generateVIN(),
      price_pln: price.pln,
      price_display: price.display,
      production_year: year,
      mileage_km: mileage,
      fuel_type: randomFromArray(fuelTypes),
      transmission: randomFromArray(transmissions),
      drive: randomFromArray(drives),
      engine_power_hp: power,
      engine_capacity_cm3: capacity,
      body_type: randomFromArray(bodyTypes),
      first_registration_date: `${year}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      registration_number: Math.random() > 0.3 ? `WA ${Math.random().toString(36).substring(2, 7).toUpperCase()}` : undefined,
      primary_image_url: randomFromArray(carImages),
      image_urls: galleryImages.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 5) + 4),
      dealer_name: dealer.name,
      dealer_address_line1: dealer.address,
      dealer_city: dealer.city,
      contact_phone: dealer.phone,
      google_rating: dealer.rating,
      google_reviews_count: dealer.reviews,
      specifications: [
        { label: 'VIN', value: generateVIN() },
        { label: 'Numer rejestracyjny', value: Math.random() > 0.3 ? `WA ${Math.random().toString(36).substring(2, 7).toUpperCase()}` : 'Brak danych' },
        { label: 'Data pierwszej rejestracji', value: `${year}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}` },
        { label: 'Rok produkcji', value: String(year) },
        { label: 'Przebieg', value: `${mileage.toLocaleString('pl-PL')} km` },
        { label: 'Rodzaj paliwa', value: randomFromArray(fuelTypes) },
        { label: 'Skrzynia biegów', value: randomFromArray(transmissions) },
        { label: 'Napęd', value: randomFromArray(drives) },
        { label: 'Moc silnika', value: `${power} KM` },
        { label: 'Pojemność silnika', value: `${capacity} cm³` },
        { label: 'Typ nadwozia', value: randomFromArray(bodyTypes) },
        { label: 'Liczba drzwi', value: String(Math.random() > 0.5 ? 5 : 3) },
        { label: 'Liczba miejsc', value: '5' },
        { label: 'Kolor', value: randomFromArray(['Biały', 'Czarny', 'Srebrny', 'Niebieski', 'Czerwony', 'Szary']) },
        { label: 'Kraj pochodzenia', value: randomFromArray(['Polska', 'Niemcy', 'Francja', 'Belgia']) },
        { label: 'Stan', value: 'Używany' },
      ],
      equipment: {
        audioMultimedia: randomSubset(equipmentAudioMultimedia, 3, 7),
        safety: randomSubset(equipmentSafety, 4, 8),
        comfort: randomSubset(equipmentComfort, 4, 9),
        performance: randomSubset(equipmentPerformance, 0, 4),
        driverAssist: randomSubset(equipmentDriverAssist, 3, 7),
        other: randomSubset(equipmentOther, 1, 4),
      },
    });
  }

  return listings;
}

export const mockListings = generateMockListings(50);

export function getListingById(id: string): Listing | undefined {
  return mockListings.find(l => l.listing_id === id);
}

export function filterListings(filters: {
  makes?: string[];
  models?: string[];
  fuelTypes?: string[];
  yearFrom?: number;
  yearTo?: number;
  mileageFrom?: number;
  mileageTo?: number;
  drives?: string[];
  transmissions?: string[];
  powerFrom?: number;
  powerTo?: number;
  capacityFrom?: number;
  capacityTo?: number;
  bodyTypes?: string[];
  priceFrom?: number;
  priceTo?: number;
  sortBy?: string;
}): Listing[] {
  let result = [...mockListings];

  if (filters.makes?.length) {
    result = result.filter(l => filters.makes!.includes(l.make));
  }

  if (filters.models?.length) {
    result = result.filter(l => filters.models!.includes(l.model));
  }

  if (filters.fuelTypes?.length) {
    result = result.filter(l => filters.fuelTypes!.includes(l.fuel_type));
  }

  if (filters.yearFrom) {
    result = result.filter(l => l.production_year >= filters.yearFrom!);
  }

  if (filters.yearTo) {
    result = result.filter(l => l.production_year <= filters.yearTo!);
  }

  if (filters.mileageFrom) {
    result = result.filter(l => l.mileage_km >= filters.mileageFrom!);
  }

  if (filters.mileageTo) {
    result = result.filter(l => l.mileage_km <= filters.mileageTo!);
  }

  if (filters.drives?.length) {
    result = result.filter(l => filters.drives!.includes(l.drive));
  }

  if (filters.transmissions?.length) {
    result = result.filter(l => filters.transmissions!.includes(l.transmission));
  }

  if (filters.powerFrom) {
    result = result.filter(l => l.engine_power_hp >= filters.powerFrom!);
  }

  if (filters.powerTo) {
    result = result.filter(l => l.engine_power_hp <= filters.powerTo!);
  }

  if (filters.capacityFrom) {
    result = result.filter(l => l.engine_capacity_cm3 >= filters.capacityFrom!);
  }

  if (filters.capacityTo) {
    result = result.filter(l => l.engine_capacity_cm3 <= filters.capacityTo!);
  }

  if (filters.bodyTypes?.length) {
    result = result.filter(l => filters.bodyTypes!.includes(l.body_type));
  }

  if (filters.priceFrom) {
    result = result.filter(l => l.price_pln >= filters.priceFrom!);
  }

  if (filters.priceTo) {
    result = result.filter(l => l.price_pln <= filters.priceTo!);
  }

  // Sorting
  switch (filters.sortBy) {
    case 'cheapest':
      result.sort((a, b) => a.price_pln - b.price_pln);
      break;
    case 'expensive':
      result.sort((a, b) => b.price_pln - a.price_pln);
      break;
    case 'mileage':
      result.sort((a, b) => a.mileage_km - b.mileage_km);
      break;
    case 'newest':
      result.sort((a, b) => b.production_year - a.production_year);
      break;
    default:
      break;
  }

  return result;
}

export const mockLeads: Lead[] = [
  {
    id: 'L1',
    name: 'Jan Kowalski',
    email: 'jan.kowalski@wp.pl',
    phone: '+48 123 456 789',
    message: 'Dzień dobry, czy oferta na model Toyota Corolla jest aktualna i czy auto jest dostępne od ręki?',
    status: 'new',
    listing_id: '1',
    listing_make: 'Toyota',
    listing_model: 'Corolla',
    listing_vin: 'JTNKW120001234567',
    listing_price: '125 900 PLN',
    listing_year: 2023,
    listing_mileage: '12 500 km',
    dealer_name: 'Toyota Central Park',
    dealer_address: 'ul. Czerniakowska 100, 00-454 Warszawa',
    dealer_phone: '+48 22 123 45 67',
    consent_marketing_at: '2025-12-28 10:15:30',
    consent_privacy_at: '2025-12-28 10:15:30',
    created_at: '2025-12-28 10:15:30',
  },
  {
    id: 'L2',
    name: 'Anna Nowak',
    email: 'a.nowak@gmail.com',
    message: 'Interesuje mnie oferta leasingu lub najmu długoterminowego dla tego auta. Proszę o przygotowanie symulacji.',
    status: 'contacted',
    listing_id: '2',
    listing_make: 'Volkswagen',
    listing_model: 'Golf',
    listing_vin: 'WVG5678901234EFGH',
    listing_price: '125 000 PLN',
    listing_year: 2022,
    listing_mileage: '28 500 km',
    dealer_name: 'VW Home Warszawa',
    dealer_address: 'al. Jerozolimskie 200, 02-486 Warszawa',
    dealer_phone: '+48 22 987 65 43',
    consent_marketing_at: '2025-12-27 14:20:00',
    consent_privacy_at: '2025-12-27 14:20:00',
    created_at: '2025-12-27 14:20:00',
  },
  {
    id: 'L3',
    name: 'Marek Wiśniewski',
    email: 'm.wisniewski@firma.pl',
    phone: '500 600 700',
    message: 'Poproszę o przesłanie numeru VIN oraz raportu historii pojazdu dla tego modelu.',
    status: 'in_progress',
    listing_id: '3',
    listing_make: 'BMW',
    listing_model: '3 Series',
    listing_vin: 'WBA1234567890ABCD',
    listing_price: '185 000 PLN',
    listing_year: 2021,
    listing_mileage: '45 000 km',
    dealer_name: 'BMW Premium Selection Warszawa',
    dealer_address: 'ul. Ostrobramska 12, 04-123 Warszawa',
    dealer_phone: '+48 22 555 66 77',
    consent_marketing_at: '2025-12-26 09:00:15',
    consent_privacy_at: '2025-12-26 09:00:15',
    created_at: '2025-12-26 09:00:15',
  },
];
