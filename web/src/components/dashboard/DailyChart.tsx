import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../ui/chart";
import { formatAxisCurrency, formatCurrency, formatDay } from "../../lib/format";
import type { DailyPoint, Period } from "./useExpenseDashboard";

const config = {
  actual: { label: "Spent", color: "var(--chart-1)" },
  projected: { label: "Projected", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Shift a `YYYY-MM-DD` date by whole days, in UTC. */
function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** Spend per day across the whole period, with the projected remaining days dashed. */
export function DailyChart({
  daily,
  projected,
  currency,
  period,
}: {
  daily: DailyPoint[];
  projected: Array<{ date: string; amount: number }>;
  currency: string;
  period: Period;
}) {
  const actualByDate = new Map(daily.map((point) => [point.date, point.amount]));
  const projectedByDate = new Map(projected.map((point) => [point.date, point.amount]));

  // Span the whole period: actuals through the current day, the projection after
  // it, and empty days in between so the axis reaches the period's last day.
  const rows: Array<{ date: string; actual: number | null; projected: number | null }> = [];
  for (let date = period.from; date <= period.end; date = addDays(date, 1)) {
    const actual = date <= period.to ? (actualByDate.get(date) ?? 0) : null;
    let projection = projectedByDate.get(date) ?? null;
    if (date === period.to && projected.length > 0 && actual !== null) {
      // Bridge the dashed line onto the last actual day so the series join up.
      projection = actual;
    }
    rows.push({ date, actual, projected: projection });
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
          <ReferenceLine x={period.to} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
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
