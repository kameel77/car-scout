import React from 'react';
import { useBrand } from '@/contexts/BrandContext';
import CarsalonHomePage from './CarsalonHomePage';
import MotoliaHomePage from './MotoliaHomePage';

export default function HomePage() {
  const { config } = useBrand();

  if (config.id === 'motolia') {
    return <MotoliaHomePage />;
  }

  return <CarsalonHomePage />;
}
