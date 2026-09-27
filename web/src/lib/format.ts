/** Format a monetary amount in the given ISO-4217 currency. */
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

/** A compact monetary value for a chart axis. */
export function formatAxisCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/**
 * A signed percentage delta, one decimal place, e.g. "+12.4%". The input is
 * already a percentage, so 12.4 renders as "+12.4%".
 */
export function formatDelta(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/**
 * A share of the whole as a percentage, e.g. "31.6%". The input is a fraction,
 * so 0.316 renders as "31.6%".
 */
export function formatShare(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

/**
 * Format a `YYYY-MM-DD` calendar day. The value is parsed and formatted as UTC
 * so a date-only value cannot shift to the previous day.
 */
export function formatDay(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** A stable chart color per category, falling back to a slot by index. */
const CATEGORY_COLORS: Record<string, string> = {
  groceries: "var(--chart-1)",
  transport: "var(--chart-2)",
  housing: "var(--chart-3)",
  utilities: "var(--chart-4)",
  dining: "var(--chart-5)",
  entertainment: "var(--chart-6)",
  health: "var(--chart-7)",
  clothing: "var(--chart-8)",
  other: "var(--chart-9)",
};

export function categoryColor(category: string, index = 0): string {
  return CATEGORY_COLORS[category] ?? `var(--chart-${(index % 9) + 1})`;
}

/** Capitalize a category key for display. */
export function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/** Two initials for an avatar fallback, from the name or the email. */
export function initials(name: string | null, email = ""): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}
