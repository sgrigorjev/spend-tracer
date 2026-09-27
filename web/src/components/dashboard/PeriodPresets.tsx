import { cn } from "../../lib/utils";
import type { PeriodPreset } from "./useExpenseDashboard";

const PRESETS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "two_weeks", label: "2 weeks" },
  { value: "month", label: "Month" },
];

/** Segmented control for the period presets. */
export function PeriodPresets({
  value,
  onChange,
}: {
  value: PeriodPreset;
  onChange: (preset: PeriodPreset) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg bg-muted p-1 text-sm" role="tablist" aria-label="Period">
      {PRESETS.map((preset) => {
        const selected = preset.value === value;
        return (
          <button
            key={preset.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(preset.value)}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              selected
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
