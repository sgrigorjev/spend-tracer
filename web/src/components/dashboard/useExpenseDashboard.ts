import { useCallback, useEffect, useState } from "react";

export type PeriodPreset = "day" | "week" | "two_weeks" | "month";

export interface DateRange {
  from: string;
  to: string;
}

export interface Period {
  preset: PeriodPreset;
  from: string;
  to: string;
  /** Last day of the period's calendar unit; the chart axis spans `from` to `end`. */
  end: string;
}

export interface DailyPoint {
  date: string;
  amount: number;
  count: number;
}

export interface CategoryTotal {
  category: string;
  amount: number;
  share: number;
}

export interface Summary {
  currency: string;
  period: Period;
  comparison: DateRange;
  total: number;
  count: number;
  pendingCount: number;
  pendingTotal: number;
  avgPerDay: number;
  totalDeltaPct: number | null;
  avgPerDayDeltaPct: number | null;
  daily: DailyPoint[];
  byCategory: CategoryTotal[];
  topCategory: CategoryTotal | null;
  projected: Array<{ date: string; amount: number }>;
  projectedTotal: number | null;
}

export interface ExpenseItem {
  id: number;
  expense_date: string;
  description: string;
  category: string;
  amount: number | null;
  currency: string;
  status: "confirmed" | "pending";
}

export interface ExpenseList {
  currency: string;
  period: Period;
  total: number;
  items: ExpenseItem[];
}

export const PAGE_SIZE = 10;

export interface ExpenseDashboard {
  preset: PeriodPreset;
  setPreset: (preset: PeriodPreset) => void;
  page: number;
  setPage: (page: number) => void;
  summary: Summary | null;
  list: ExpenseList | null;
  loading: boolean;
  error: boolean;
}

/** Read the summary and the expense list for the selected period and page. */
export function useExpenseDashboard(): ExpenseDashboard {
  const [preset, setPresetState] = useState<PeriodPreset>("month");
  const [page, setPage] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [list, setList] = useState<ExpenseList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const setPreset = useCallback((next: PeriodPreset) => {
    setPresetState(next);
    setPage(0);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    const summaryUrl = `/api/expenses/summary?${new URLSearchParams({ preset })}`;
    const listUrl = `/api/expenses?${new URLSearchParams({
      preset,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    })}`;

    const get = <T,>(url: string): Promise<T> =>
      fetch(url, { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error(url);
        return res.json() as Promise<T>;
      });

    Promise.all([get<Summary>(summaryUrl), get<ExpenseList>(listUrl)])
      .then(([nextSummary, nextList]) => {
        setSummary(nextSummary);
        setList(nextList);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [preset, page]);

  return { preset, setPreset, page, setPage, summary, list, loading, error };
}
