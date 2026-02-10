import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Calendar,
  Gauge,
  Fuel,
  Settings2,
  Zap,
  Cog,
  Car,
  Hash,
} from 'lucide-react';
import { formatNumber } from '@/utils/formatters';
import { translateTechnicalValue } from '@/utils/i18n-utils';

interface SpecsGridProps {
  year: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  drive: string;
  power: number;
  capacity: number;
  bodyType: string;
}

export function SpecsGrid(props: SpecsGridProps) {
  const { t } = useTranslation();

  const specs = [
    { key: 'year', icon: Calendar, label: t('filters.productionYear'), value: String(props.year) },
    { key: 'mileage', icon: Gauge, label: t('filters.mileage'), value: `${formatNumber(props.mileage)} ${t('listing.km')}` },
    { key: 'fuelType', icon: Fuel, label: t('filters.fuelType'), value: translateTechnicalValue('fuel', props.fuelType, t) },
    { key: 'transmission', icon: Settings2, label: t('filters.transmission'), value: translateTechnicalValue('transmission', props.transmission, t) },
    { key: 'drive', icon: Cog, label: t('filters.drive'), value: translateTechnicalValue('drive', props.drive, t) },
    { key: 'power', icon: Zap, label: t('filters.power'), value: `${props.power} ${t('listing.hp')}` },
    { key: 'capacity', icon: Hash, label: t('filters.engineCapacity'), value: `${formatNumber(props.capacity)} ${t('listing.ccm')}` },
    { key: 'bodyType', icon: Car, label: t('filters.bodyType'), value: translateTechnicalValue('body', props.bodyType, t) },
  ];

  return (
    <div className="spec-grid">
      {specs.map((spec, index) => {
        const Icon = spec.icon;

        return (
          <motion.div
            key={spec.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            className="spec-item"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <span className="spec-label">{spec.label}</span>
            </div>
            <span className="spec-value capitalize">{spec.value}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
