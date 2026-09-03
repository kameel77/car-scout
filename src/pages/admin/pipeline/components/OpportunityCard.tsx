import React from 'react';
import { PipelineOpportunitySummary } from '../types';
import { NextActionBadge } from './NextActionBadge';
import { LeadSourceBadge } from './LeadSourceBadge';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Building2, Car, User, GripVertical, FileText, Shuffle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function OpportunityCard({
  opportunity,
  onClick,
}: {
  opportunity: PipelineOpportunitySummary;
  onClick: (opp: PipelineOpportunitySummary) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opportunity.id,
    data: { opportunity },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const selectedVehicle = opportunity.vehicleCandidates?.[0];
  const vehicleLabel = selectedVehicle?.listing
    ? `${selectedVehicle.listing.make} ${selectedVehicle.listing.model}`
    : selectedVehicle?.rentalVehicle
    ? `${selectedVehicle.rentalVehicle.make} ${selectedVehicle.rentalVehicle.model}`
    : selectedVehicle?.customMake
    ? `${selectedVehicle.customMake} ${selectedVehicle.customModel || ''}`
    : null;

  const activeOffer = opportunity.offers?.[0];
  const activeApp = opportunity.applications?.[0];
  const docs = opportunity.documents || [];
  const verifiedDocs = docs.filter((d) => d.status === 'VERIFIED' || d.status === 'WAIVED').length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col gap-2 p-3 bg-card hover:bg-card/90 rounded-xl border shadow-sm cursor-pointer transition-all',
        isDragging && 'opacity-50 ring-2 ring-primary rotate-1 z-50 shadow-xl'
      )}
      onClick={() => onClick(opportunity)}
    >
      {/* Drag handle & Number */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <button
            {...listeners}
            {...attributes}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground p-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] font-bold text-muted-foreground">
            {opportunity.number}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-muted text-muted-foreground">
            {opportunity.clientType}
          </span>
          {opportunity.financingType && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-primary/10 text-primary">
              {opportunity.financingType}
            </span>
          )}
        </div>
      </div>

      {/* Customer Name */}
      <div>
        <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {opportunity.customer?.fullName}
        </h4>
        {opportunity.customer?.companyName && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
            <Building2 className="w-3 h-3 shrink-0" />
            <span>{opportunity.customer.companyName}</span>
          </div>
        )}
      </div>

      {/* Vehicle & Offer */}
      <div className="flex flex-col gap-1">
        {vehicleLabel && (
          <div className="flex items-center gap-1 text-xs font-medium text-foreground bg-muted/40 px-2 py-1 rounded border border-border/50">
            <Car className="w-3 h-3 text-primary shrink-0" />
            <span className="truncate">{vehicleLabel}</span>
          </div>
        )}

        {activeOffer && activeOffer.monthlyRateGrosze > 0 && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>Rata:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {(activeOffer.monthlyRateGrosze / 100).toLocaleString('pl-PL')} zł/mc
            </span>
          </div>
        )}
      </div>

      {/* Active Applications or Docs Indicator */}
      {((opportunity.applications && opportunity.applications.length > 0) || docs.length > 0) && (
        <div className="flex items-center justify-between gap-1 text-[10px] pt-0.5 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {opportunity.applications
              ?.filter((a) => a.state !== 'WITHDRAWN')
              .slice(0, 2)
              .map((app) => (
                <Badge
                  key={app.id}
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 h-4 gap-1 ${
                    app.state === 'APPROVED'
                      ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                      : app.state === 'REJECTED'
                      ? 'border-rose-500/40 text-rose-600 bg-rose-500/10'
                      : 'border-blue-500/40 text-blue-600 bg-blue-500/10'
                  }`}
                >
                  <Shuffle className="h-2 w-2" />
                  {app.financier?.code || 'Partner'}: {app.state === 'APPROVED' ? 'Zgoda' : app.state === 'REJECTED' ? 'Negat' : `Wniosek R${app.roundNumber}`}
                </Badge>
              ))}
          </div>

          {docs.length > 0 && (
            <span className="flex items-center gap-0.5 text-muted-foreground ml-auto">
              <FileText className="h-2.5 w-2.5" />
              {verifiedDocs}/{docs.length}
            </span>
          )}
        </div>
      )}

      {/* Completeness Bar for Next Phase */}
      {opportunity.completeness && opportunity.completeness.total > 0 && (
        <div
          className="space-y-0.5 pt-0.5"
          title={`Wymagania kolejnego etapu: ${opportunity.completeness.met}/${opportunity.completeness.total} (${opportunity.completeness.percentage}%)`}
        >
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>Gotowość do awansu</span>
            <span className="font-semibold text-foreground">
              {opportunity.completeness.met}/{opportunity.completeness.total} ({opportunity.completeness.percentage}%)
            </span>
          </div>
          <div className="w-full bg-muted/80 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                opportunity.completeness.percentage === 100
                  ? 'bg-emerald-500'
                  : opportunity.completeness.percentage >= 50
                  ? 'bg-amber-500'
                  : 'bg-primary/70'
              }`}
              style={{ width: `${opportunity.completeness.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Next action SLA */}
      <div className="pt-0.5">
        <NextActionBadge
          actionType={opportunity.nextActionType}
          dueAt={opportunity.nextActionDueAt}
          note={opportunity.nextActionNote}
        />
      </div>

      {/* Footer: Source & Owner */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
        <LeadSourceBadge source={opportunity.leadSource} />
        {opportunity.owner && (
          <span className="flex items-center gap-1 truncate max-w-[100px]">
            <User className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{opportunity.owner.name?.split(' ')[0] || opportunity.owner.email}</span>
          </span>
        )}
      </div>
    </div>
  );
}
