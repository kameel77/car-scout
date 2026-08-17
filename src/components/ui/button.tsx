import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98]",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline underline-offset-4 decoration-2 hover:no-underline",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98] shadow-md hover:shadow-lg",
        hero: "gradient-accent text-accent-foreground font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
        "outline-primary": "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground active:scale-[0.98]",
        "outline-accent": "border-2 border-accent text-foreground hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        chip: "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-full",
        "chip-active": "bg-primary text-primary-foreground rounded-full hover:bg-primary/90",
      },
      // Brandbook rozdz. 03: przycisk główny 48 px (mobile 52), drugorzędny 44 px,
      // minimalne pole dotyku 44 x 44 px.
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-10 min-h-touch rounded-md px-4",
        lg: "h-btn rounded-lg px-8 text-base",
        xl: "h-[52px] md:h-btn rounded-xl px-10 text-base",
        icon: "h-touch w-touch",
        "icon-sm": "h-10 w-10 min-h-touch min-w-touch",
        chip: "h-11 px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
