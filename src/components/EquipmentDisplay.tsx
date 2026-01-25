import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Music,
  Shield,
  Sofa,
  Gauge,
  Radio,
  MoreHorizontal,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { translateFeature } from '@/utils/i18n-utils';

interface EquipmentSection {
  audioMultimedia: string[];
  safety: string[];
  comfort: string[];
  performance: string[];
  driverAssist: string[];
  other: string[];
}

interface EquipmentDisplayProps {
  equipment: EquipmentSection;
}

const sectionConfig = [
  { key: 'comfort', icon: Sofa, labelKey: 'equipment.comfort' },
  { key: 'safety', icon: Shield, labelKey: 'equipment.safety' },
  { key: 'audioMultimedia', icon: Music, labelKey: 'equipment.audioMultimedia' },
  { key: 'driverAssist', icon: Radio, labelKey: 'equipment.driverAssist' },
  { key: 'performance', icon: Gauge, labelKey: 'equipment.performance' },
  { key: 'other', icon: MoreHorizontal, labelKey: 'equipment.other' },
] as const;

function EquipmentSectionComponent({
  title,
  items,
  icon: Icon,
  index,
}: {
  title: string;
  items: string[];
  icon: React.ElementType;
  index: number;
}) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="equipment-section break-inside-avoid mb-8"
    >
      <div className="equipment-title mb-3">
        <Icon className="h-5 w-5 text-primary" />
        <span>{title}</span>
        <span className="text-sm font-normal text-muted-foreground">
          ({items.length})
        </span>
      </div>

      {items.length > 0 ? (
        <div className="equipment-list">
          {items.map((item, i) => (
            <div key={i} className="equipment-item">
              {translateFeature(item, t)}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <AlertCircle className="h-4 w-4" />
          <span>{t('equipment.noItems')}</span>
        </div>
      )}
    </motion.div>
  );
}

export function EquipmentDisplay({ equipment }: EquipmentDisplayProps) {
  const { t } = useTranslation();

  const activeSections = sectionConfig.filter(
    (section) => (equipment[section.key] || []).length > 0
  );

  return (
    <div className="columns-1 md:columns-2 gap-8 space-y-0">
      {activeSections.map((section, index) => (
        <EquipmentSectionComponent
          key={section.key}
          title={t(section.labelKey)}
          items={equipment[section.key]}
          icon={section.icon}
          index={index}
        />
      ))}
    </div>
  );
}
