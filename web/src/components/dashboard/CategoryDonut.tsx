import { Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../ui/chart";
import { categoryColor, categoryLabel, formatCurrency, formatShare } from "../../lib/format";
import type { Summary } from "./useExpenseDashboard";

/** Category totals as a donut with a legend of amount and share. */
export function CategoryDonut({ summary }: { summary: Summary }) {
  const { byCategory, total, currency } = summary;

  if (byCategory.length === 0) {
    return (
      <div className="flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground">
        <h2 className="text-sm font-medium">By category</h2>
        <p className="text-xs text-muted-foreground">Share of each category over the period</p>
        <p className="mt-10 text-center text-sm text-muted-foreground">No spending in this period.</p>
      </div>
    );
  }

  const data = byCategory.map((entry, index) => ({
    category: entry.category,
    label: categoryLabel(entry.category),
    amount: entry.amount,
    share: entry.share,
    fill: categoryColor(entry.category, index),
  }));

  const config: ChartConfig = Object.fromEntries(
    data.map((entry) => [entry.category, { label: entry.label, color: entry.fill }]),
  );

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground">
      <div>
        <h2 className="text-sm font-medium">By category</h2>
        <p className="text-xs text-muted-foreground">Share of each category over the period</p>
      </div>
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row lg:flex-col">
        <div className="relative shrink-0">
          <ChartContainer config={config} className="h-40 w-40">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="label"
                    hideLabel
                    formatter={(value) => formatCurrency(Number(value), currency)}
                  />
                }
              />
              <Pie data={data} dataKey="amount" nameKey="label" innerRadius={54} strokeWidth={0} />
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tabular-nums">{formatCurrency(total, currency)}</span>
          </div>
        </div>
        <ul className="w-full min-w-0 space-y-2 text-sm">
          {data.map((entry) => (
            <li key={entry.category} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.fill }} />
              <span className="flex-1 truncate">{entry.label}</span>
              <span className="tabular-nums text-muted-foreground">{formatCurrency(entry.amount, currency)}</span>
              <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">
                {formatShare(entry.share)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
