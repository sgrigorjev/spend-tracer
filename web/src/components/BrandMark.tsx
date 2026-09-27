import { Wallet } from "lucide-react";
import { cn } from "../lib/utils";

interface BrandMarkProps {
  /** `sm` for the header, `lg` for the login card. */
  size?: "sm" | "lg";
  className?: string;
}

/**
 * The app brand mark: an orange tile with the white wallet glyph, matching
 * `public/favicon.svg`. The tile colour is fixed so the mark looks the same in
 * the light and dark themes; it tracks the `--chart-1` token the favicon uses.
 */
export function BrandMark({ size = "sm", className }: BrandMarkProps) {
  const tile = size === "lg" ? "h-12 w-12 rounded-xl" : "h-8 w-8 rounded-lg";
  const icon = size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <span className={cn("flex items-center justify-center bg-chart-1 text-white", tile, className)}>
      <Wallet className={icon} aria-hidden="true" />
    </span>
  );
}
