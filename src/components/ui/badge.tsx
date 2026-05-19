import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-blue-600 text-white",
        secondary:   "border-zinc-200 bg-zinc-100 text-zinc-700",
        destructive: "border-transparent bg-red-100 text-red-700",
        outline:     "border-zinc-200 text-zinc-700 bg-white",
        success:     "border-green-200 bg-green-50 text-green-700",
        warning:     "border-amber-200 bg-amber-50 text-amber-700",
        info:        "border-blue-200 bg-blue-50 text-blue-700",
        muted:       "border-zinc-200 bg-zinc-50 text-zinc-500",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
