import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_25px_hsl(var(--primary)/0.6)]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-primary/40 bg-transparent text-foreground hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:shadow-[0_0_25px_hsl(var(--secondary)/0.6)]",
        ghost: "hover:bg-muted hover:text-primary normal-case tracking-normal",
        link: "text-primary underline-offset-4 hover:underline normal-case tracking-normal",
        hero: "bg-gradient-cyber text-white font-bold hover:scale-105 shadow-[0_0_30px_hsl(var(--primary)/0.5)] hover:shadow-[0_0_50px_hsl(var(--primary)/0.8)]",
        neon: "bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_30px_hsl(var(--primary)/0.7)]",
        cyan: "bg-transparent border-2 border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground hover:shadow-[0_0_30px_hsl(var(--secondary)/0.7)]",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-md px-4 text-xs",
        lg: "h-12 rounded-md px-10 py-3 text-base",
        xl: "h-14 rounded-md px-12 py-4 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
