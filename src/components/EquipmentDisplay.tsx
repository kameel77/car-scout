import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Music,
  Shield,
  Sofa,
  Gauge,
  Radio,
  MoreHorizontal,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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

export function EquipmentDisplay({ equipment }: EquipmentDisplayProps) {
  const { t } = useTranslation();

  const activeSections = sectionConfig.filter(
    (section) => (equipment[section.key] || []).length > 0
  );

  if (activeSections.length === 0) return null;

  return (
    <Accordion type="multiple" defaultValue={[activeSections[0].key]} className="w-full">
      {activeSections.map((section) => {
        const Icon = section.icon;
        const items = equipment[section.key];
        return (
          <AccordionItem key={section.key} value={section.key}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <span>{t(section.labelKey)}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  ({items.length})
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="equipment-list">
                {items.map((item, i) => (
                  <div key={i} className="equipment-item">
                    {translateFeature(item, t)}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
