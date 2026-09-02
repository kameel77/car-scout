import React from 'react';
import { PipelineOpportunitySummary } from '../types';
import { NextActionBadge } from './NextActionBadge';
import { LeadSourceBadge } from './LeadSourceBadge';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Building2, Car, User, GripVertical } from 'lucide-react';

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

      {/* Vehicle */}
      {vehicleLabel && (
        <div className="flex items-center gap-1 text-xs font-medium text-foreground bg-muted/40 px-2 py-1 rounded border border-border/50">
          <Car className="w-3 h-3 text-primary shrink-0" />
          <span className="truncate">{vehicleLabel}</span>
        </div>
      )}

      {/* Next action SLA */}
      <div className="pt-1">
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
