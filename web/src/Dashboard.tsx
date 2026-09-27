import { useAuth } from "./auth";
import { PeriodPresets } from "./components/dashboard/PeriodPresets";
import { SummaryCards } from "./components/dashboard/SummaryCards";
import { DailyChart } from "./components/dashboard/DailyChart";
import { CategoryDonut } from "./components/dashboard/CategoryDonut";
import { ExpensesTable } from "./components/dashboard/ExpensesTable";
import { PAGE_SIZE, useExpenseDashboard } from "./components/dashboard/useExpenseDashboard";
import { formatDay } from "./lib/format";

export function Dashboard() {
  const { user } = useAuth();
  const { preset, setPreset, page, setPage, summary, list, loading, error } = useExpenseDashboard();
  const payer = user?.name ?? user?.email ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            {summary ? `${formatDay(summary.period.from)} – ${formatDay(summary.period.to)}` : "…"}
          </p>
        </div>
        <PeriodPresets value={preset} onChange={setPreset} />
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          Could not load your expenses. Please try again.
        </div>
      ) : loading || !summary || !list ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <SummaryCards summary={summary} />
          <div className="grid gap-4 lg:grid-cols-3">
            <DailyChart daily={summary.daily} projected={summary.projected} currency={summary.currency} />
            <CategoryDonut summary={summary} />
          </div>
          <ExpensesTable list={list} page={page} pageSize={PAGE_SIZE} payer={payer} onPage={setPage} />
        </>
      )}
    </div>
  );
}
