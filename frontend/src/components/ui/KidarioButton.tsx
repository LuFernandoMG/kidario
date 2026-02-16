import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 font-display active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover shadow-kidario-md hover:shadow-kidario-lg",
        secondary:
          "bg-secondary/20 text-secondary-foreground hover:bg-secondary/30 border border-secondary/30",
        outline:
          "border-2 border-primary bg-transparent text-primary hover:bg-primary/5",
        ghost:
          "text-foreground hover:bg-muted",
        link:
          "text-primary underline-offset-4 hover:underline",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        coral:
          "bg-accent text-accent-foreground hover:bg-accent/90 shadow-kidario-md",
        hero:
          "bg-primary text-primary-foreground hover:bg-primary-hover shadow-kidario-lg hover:shadow-kidario-elevated text-base",
      },
      size: {
        sm: "h-9 rounded-lg px-3 text-sm",
        default: "h-11 rounded-xl px-5 text-sm",
        lg: "h-12 rounded-xl px-6 text-base",
        xl: "h-14 rounded-2xl px-8 text-base",
        icon: "h-10 w-10 rounded-full",
        "icon-sm": "h-8 w-8 rounded-full",
        "icon-lg": "h-12 w-12 rounded-full",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const KidarioButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
KidarioButton.displayName = "KidarioButton";

export { KidarioButton, buttonVariants };
