import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { categoryColor, categoryLabel, formatCurrency, formatDay, initials } from "../../lib/format";
import type { ExpenseList } from "./useExpenseDashboard";

const STATUS: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
};

/** The payer's avatar, with the name available as a tooltip. */
function PayerAvatar({ name, email, avatar }: { name: string | null; email: string; avatar: string | null }) {
  const label = name ?? email;
  if (avatar) {
    return <img src={avatar} alt={label} title={label} className="h-6 w-6 rounded-full object-cover" />;
  }
  return (
    <span
      title={label}
      aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground"
    >
      {initials(name, email)}
    </span>
  );
}

/** The period's expense rows with pagination. */
export function ExpensesTable({
  list,
  page,
  pageSize,
  payer,
  onPage,
}: {
  list: ExpenseList;
  page: number;
  pageSize: number;
  payer: { name: string | null; avatar: string | null; email: string };
  onPage: (page: number) => void;
}) {
  const { items, total, currency } = list;
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground">
      <div className="flex items-center justify-between p-5 pb-3">
        <div>
          <h2 className="text-sm font-medium">Transactions</h2>
          <p className="text-xs text-muted-foreground">Records for the period</p>
        </div>
        <span className="text-xs text-muted-foreground">{total} records</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Payer</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-5 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No expenses in this period.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const status = STATUS[item.status] ?? STATUS.pending;
                return (
                  <tr key={item.id} className="transition-colors hover:bg-muted/50">
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                      {formatDay(item.expense_date)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="line-clamp-1">{item.description}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: categoryColor(item.category) }}
                        />
                        {categoryLabel(item.category)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <PayerAvatar name={payer.name} email={payer.email} avatar={payer.avatar} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">
                      {item.amount === null ? "—" : formatCurrency(item.amount, currency)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                          status.className,
                        )}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border p-4 text-sm">
        <span className="text-muted-foreground">
          Showing {from}–{to} of {total}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={page === 0} onClick={() => onPage(page - 1)}>
            Previous
          </Button>
          <Button variant="outline" disabled={to >= total} onClick={() => onPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
