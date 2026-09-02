import React from 'react';
import { PipelineOpportunitySummary } from '../types';
import { PhaseBadge } from './PhaseBadge';
import { NextActionBadge } from './NextActionBadge';
import { LeadSourceBadge } from './LeadSourceBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PhoneCall,
  Clock,
  ArrowRight,
  MoreVertical,
  Building2,
  Car,
  User,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function QueueRow({
  opportunity,
  onOpenDetails,
  onOpenLogContact,
  onOpenSetNextAction,
  onOpenTransition,
  onOpenClose,
  onQuickSnooze,
}: {
  opportunity: PipelineOpportunitySummary;
  onOpenDetails: (opp: PipelineOpportunitySummary) => void;
  onOpenLogContact: (opp: PipelineOpportunitySummary) => void;
  onOpenSetNextAction: (opp: PipelineOpportunitySummary) => void;
  onOpenTransition: (opp: PipelineOpportunitySummary) => void;
  onOpenClose: (opp: PipelineOpportunitySummary) => void;
  onQuickSnooze?: (opp: PipelineOpportunitySummary, days: number) => void;
}) {
  const selectedVehicle = opportunity.vehicleCandidates?.[0];
  const vehicleLabel = selectedVehicle?.listing
    ? `${selectedVehicle.listing.make} ${selectedVehicle.listing.model}`
    : selectedVehicle?.rentalVehicle
    ? `${selectedVehicle.rentalVehicle.make} ${selectedVehicle.rentalVehicle.model}`
    : selectedVehicle?.customMake
    ? `${selectedVehicle.customMake} ${selectedVehicle.customModel || ''}`
    : null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-card hover:bg-muted/40 transition-colors rounded-xl border shadow-sm">
      {/* Client & Number */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
          {opportunity.customer?.fullName?.slice(0, 2).toUpperCase() || 'KL'}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span
              onClick={() => onOpenDetails(opportunity)}
              className="font-bold text-sm text-foreground hover:text-primary cursor-pointer transition-colors truncate"
            >
              {opportunity.customer?.fullName}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {opportunity.number}
            </span>
            <PhaseBadge phase={opportunity.phase} />
            <LeadSourceBadge
              source={opportunity.leadSource}
              detail={opportunity.leadSourceDetail}
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {opportunity.customer?.companyName && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-muted-foreground/70" />
                {opportunity.customer.companyName}
              </span>
            )}
            {opportunity.customer?.phone && (
              <a
                href={`tel:${opportunity.customer.phone}`}
                className="hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {opportunity.customer.phone}
              </a>
            )}
            {vehicleLabel && (
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Car className="w-3 h-3 text-primary" />
                {vehicleLabel}
              </span>
            )}
            {opportunity.owner && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-muted-foreground/70" />
                {opportunity.owner.name || opportunity.owner.email}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Next Action SLA */}
      <div className="sm:w-56 shrink-0">
        <NextActionBadge
          actionType={opportunity.nextActionType}
          dueAt={opportunity.nextActionDueAt}
          note={opportunity.nextActionNote}
        />
      </div>

      {/* Quick 1-Click Action Buttons */}
      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1 hover:bg-primary hover:text-primary-foreground transition-all"
          title="Zaloguj kontakt"
          onClick={() => onOpenLogContact(opportunity)}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Kontakt</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          title="Zmień termin kolejnej akcji"
          onClick={() => onOpenSetNextAction(opportunity)}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Termin</span>
        </Button>

        <Button
          size="sm"
          variant="default"
          className="h-8 text-xs gap-1"
          title="Przejdź do kolejnego etapu"
          onClick={() => onOpenTransition(opportunity)}
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Etap</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 text-xs">
            <DropdownMenuItem onClick={() => onOpenDetails(opportunity)}>
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              Szczegóły sprawy
            </DropdownMenuItem>
            {onQuickSnooze && (
              <>
                <DropdownMenuItem onClick={() => onQuickSnooze(opportunity, 1)}>
                  <Clock className="w-3.5 h-3.5 mr-2" />
                  Odłóż na jutro (+1d)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onQuickSnooze(opportunity, 3)}>
                  <Clock className="w-3.5 h-3.5 mr-2" />
                  Odłóż o 3 dni (+3d)
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onClick={() => onOpenClose(opportunity)}
              className="text-red-600 focus:text-red-600 font-medium"
            >
              Zamknij sprawę...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
