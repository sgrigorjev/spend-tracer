import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "../../lib/utils";
import { categoryLabel, formatCurrency, formatDelta, formatShare } from "../../lib/format";
import type { Summary } from "./useExpenseDashboard";

function KpiCard({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {children}
    </div>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div
      className={cn(
        "mt-1 flex items-center gap-1 text-xs",
        up ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {formatDelta(value)} vs previous period
    </div>
  );
}

/** The four summary cards for the selected period. */
export function SummaryCards({ summary }: { summary: Summary }) {
  const { currency, total, count, pendingCount, avgPerDay, topCategory, totalDeltaPct, avgPerDayDeltaPct } =
    summary;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total spent" value={formatCurrency(total, currency)}>
        <Delta value={totalDeltaPct} />
      </KpiCard>

      <KpiCard label="Transactions" value={count}>
        {pendingCount > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{pendingCount} awaiting confirmation</p>
        )}
      </KpiCard>

      <KpiCard label="Daily average" value={formatCurrency(avgPerDay, currency)}>
        <Delta value={avgPerDayDeltaPct} />
      </KpiCard>

      <KpiCard label="Top category" value={topCategory ? categoryLabel(topCategory.category) : "—"}>
        {topCategory && (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCurrency(topCategory.amount, currency)} · {formatShare(topCategory.share)} of spend
          </p>
        )}
      </KpiCard>
    </div>
  );
}
