import React from 'react';
import { LeadSourceChannel, LEAD_SOURCES } from '../types';
import { cn } from '@/lib/utils';
import { Globe, Tv, Facebook, Search, Users, Building, Shield } from 'lucide-react';

const SOURCE_ICONS: Record<LeadSourceChannel, React.ComponentType<{ className?: string }>> = {
  META: Facebook,
  GOOGLE: Search,
  ORGANIC: Globe,
  TV: Tv,
  REFERRAL: Users,
  DEALER: Building,
  PARTNER: Shield,
  OTHER: Globe,
};

export function LeadSourceBadge({
  source,
  detail,
  className,
}: {
  source: LeadSourceChannel;
  detail?: string | null;
  className?: string;
}) {
  const Icon = SOURCE_ICONS[source] || Globe;
  const label = LEAD_SOURCES.find((s) => s.id === source)?.label || source;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-normal text-muted-foreground bg-muted/50 border border-border/50',
        className
      )}
      title={detail ? `Źródło: ${label} (${detail})` : `Źródło: ${label}`}
    >
      <Icon className="w-3 h-3 text-muted-foreground/70" />
      <span>{label}</span>
      {detail && <span className="opacity-70 text-[10px]">({detail})</span>}
    </span>
  );
}
