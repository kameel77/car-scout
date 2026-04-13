import { useBrand } from '@/contexts/BrandContext';
import MotoliaContactPage from './MotoliaContactPage';
import CarsalonContactPage from './CarsalonContactPage';

export default function ContactPage() {
  const { config } = useBrand();
  if (config.id === 'motolia') {
    return <MotoliaContactPage />;
  }
  return <CarsalonContactPage />;
}
