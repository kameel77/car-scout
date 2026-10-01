import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LazyTooltipProps {
  /** Single element used as the (asChild) tooltip trigger. */
  trigger: React.ReactElement;
  content: React.ReactNode;
  contentProps?: React.ComponentPropsWithoutRef<typeof TooltipContent>;
}

/**
 * Renders only the trigger until the first pointer-enter / focus / click, then mounts the real
 * Radix Tooltip (open for that first interaction). Avoids a Provider + Root per card on lists.
 * Like the previous eager usage, the trigger click is preventDefault-ed (it sits inside a card link).
 */
export function LazyTooltip({ trigger, content, contentProps }: LazyTooltipProps) {
  const [armed, setArmed] = React.useState(false);
  const [open, setOpen] = React.useState(true);

  if (!armed) {
    const arm = () => setArmed(true);
    return React.cloneElement(trigger, {
      onPointerEnter: arm,
      onFocus: arm,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        arm();
      },
    });
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild onClick={(e) => e.preventDefault()}>
        {trigger}
      </TooltipTrigger>
      <TooltipContent {...contentProps}>{content}</TooltipContent>
    </Tooltip>
  );
}
