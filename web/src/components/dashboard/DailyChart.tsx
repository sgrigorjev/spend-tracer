import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../ui/chart";
import { formatAxisCurrency, formatCurrency, formatDay } from "../../lib/format";
import type { DailyPoint } from "./useExpenseDashboard";

const config = {
  actual: { label: "Spent", color: "var(--chart-1)" },
  projected: { label: "Projected", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Spend per day of the period, with the projected remaining days as a dashed line. */
export function DailyChart({
  daily,
  projected,
  currency,
}: {
  daily: DailyPoint[];
  projected: Array<{ date: string; amount: number }>;
  currency: string;
}) {
  const rows: Array<{ date: string; actual: number | null; projected: number | null }> = daily.map((point) => ({
    date: point.date,
    actual: point.amount,
    projected: null,
  }));

  if (projected.length > 0) {
    // Bridge the dashed line onto the last actual day so the two series join up.
    if (rows.length > 0) {
      rows[rows.length - 1]!.projected = rows[rows.length - 1]!.actual;
    }
    for (const point of projected) {
      rows.push({ date: point.date, actual: null, projected: point.amount });
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground lg:col-span-2">
      <div>
        <h2 className="text-sm font-medium">Daily spending</h2>
        <p className="text-xs text-muted-foreground">Amount in {currency} per day of the period</p>
      </div>
      <ChartContainer config={config} className="mt-5 h-64 w-full">
        <LineChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => formatDay(String(value), { day: "numeric" })}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value) => formatAxisCurrency(Number(value), currency)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => formatDay(String(value), { day: "numeric", month: "short" })}
                formatter={(value, name) => (
                  <div className="flex w-full justify-between gap-3">
                    <span className="text-muted-foreground">
                      {config[name as keyof typeof config]?.label ?? name}
                    </span>
                    <span className="font-mono tabular-nums">{formatCurrency(Number(value), currency)}</span>
                  </div>
                )}
              />
            }
          />
          <Line
            dataKey="actual"
            type="monotone"
            stroke="var(--color-actual)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            dataKey="projected"
            type="monotone"
            stroke="var(--color-projected)"
            strokeWidth={2}
            strokeDasharray="6 5"
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
