import React from 'react';
import { InboxLeadSummary } from '../types';
import { Button } from '@/components/ui/button';
import { UserCheck, Trash2, Car, Clock, Building2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

export function InboxRow({
  lead,
  onQualify,
  onDismiss,
}: {
  lead: InboxLeadSummary;
  onQualify: (lead: InboxLeadSummary) => void;
  onDismiss: (lead: InboxLeadSummary) => void;
}) {
  const isB2b = lead.leadType === 'employer_b2b';
  const vehicleName = isB2b
    ? 'Program pracowniczy (B2B)'
    : lead.listing
    ? `${lead.listing.make} ${lead.listing.model} (${lead.listing.productionYear ?? ''})`
    : lead.rentalVehicle
    ? `${lead.rentalVehicle.make} ${lead.rentalVehicle.model}`
    : null;

  const timeAgo = formatDistanceToNow(new Date(lead.createdAt), {
    addSuffix: true,
    locale: pl,
  });

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 ${isB2b ? 'bg-stone-50/60 dark:bg-stone-900/40 border-stone-200/80 dark:border-stone-800' : 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/70 dark:border-blue-900/50'} hover:opacity-95 transition-colors rounded-xl border shadow-sm`}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className={`w-9 h-9 rounded-full ${isB2b ? 'bg-[#0f2d1e] text-[#F7F8F2]' : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'} flex items-center justify-center font-bold text-xs shrink-0 mt-0.5`}>
          {isB2b ? 'BNF' : 'IN'}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-bold text-sm text-foreground">{lead.name}</span>
            {isB2b && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#0f2d1e] text-[#F7F8F2]">
                Benefivo B2B
              </span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border">
              {isB2b ? 'benefivo.pl/dla-firm' : (lead.trafficSource || 'Formularz')}
            </span>
            {lead.referenceNumber && (
              <span className="text-[10px] font-mono bg-muted/80 px-1.5 py-0.5 rounded text-muted-foreground">
                {lead.referenceNumber}
              </span>
            )}
          </div>

          {isB2b && lead.metadata?.companyName && (
            <div className="text-xs font-semibold text-stone-800 dark:text-stone-200 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
              <span>{lead.metadata.companyName}</span>
              {lead.metadata.companyNip && (
                <span className="font-mono text-[11px] text-stone-600 dark:text-stone-400 font-normal">
                  (NIP: {lead.metadata.companyNip})
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="hover:text-primary transition-colors">
                {lead.phone}
              </a>
            )}
            {lead.email && <span>{lead.email}</span>}
            {vehicleName && (
              <span className="flex items-center gap-1 font-medium text-primary">
                {isB2b ? <Building2 className="w-3 h-3" /> : <Car className="w-3 h-3" />}
                {vehicleName}
              </span>
            )}
          </div>

          {lead.message && (
            <p className="text-xs text-foreground/80 mt-1 line-clamp-1 italic bg-background/50 px-2 py-0.5 rounded border border-border/40">
              "{lead.message}"
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <Button
          size="sm"
          variant="default"
          className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => onQualify(lead)}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Kwalifikuj leada
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
          title="Odrzuć jako spam"
          onClick={() => onDismiss(lead)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
