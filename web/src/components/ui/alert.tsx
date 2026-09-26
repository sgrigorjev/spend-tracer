import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const alertVariants = cva("flex items-start gap-2 rounded-lg border p-3 text-sm", {
  variants: {
    variant: {
      default: "border-border bg-muted/50 text-muted-foreground",
      destructive: "border-destructive/40 bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export function Alert({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("font-medium tracking-tight", className)}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn(className)} {...props} />;
}
