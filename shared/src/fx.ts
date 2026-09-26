import type { RateLookup, Store } from "./db.ts";

/** Minimal shape of a fetch response, so tests can inject a stub. */
export interface HttpResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

export type Fetcher = (url: string) => Promise<HttpResponse>;

/**
 * Look up the rate from `base` to `quote` for a date. The cache is consulted
 * first and returns the latest rate on or before the date, which is what a
 * weekend or holiday needs. On a miss, Frankfurter is queried and the result is
 * cached. An identity conversion returns 1 without touching the network.
 */
export async function getRate(
  store: Store,
  base: string,
  quote: string,
  date: string,
  fetchImpl: Fetcher = (url) => fetch(url),
): Promise<RateLookup | null> {
  if (base === quote) return { rate: 1, date, source: "identity" };

  const cached = store.getLatestRate(base, quote, date);
  if (cached) return cached;

  const fetched = await fetchFrankfurter(base, quote, date, fetchImpl);
  if (!fetched) return null;
  store.saveRate(base, quote, fetched.rate, fetched.date, fetched.source);
  return fetched;
}

/** Query Frankfurter for the rate on or before a date. Returns null on any failure. */
async function fetchFrankfurter(
  base: string,
  quote: string,
  date: string,
  fetchImpl: Fetcher,
): Promise<RateLookup | null> {
  try {
    const response = await fetchImpl(`https://api.frankfurter.app/${date}?from=${base}&to=${quote}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const rate = body.rates?.[quote];
    if (typeof rate !== "number" || !body.date) return null;
    return { rate, date: body.date, source: "frankfurter" };
  } catch {
    return null;
  }
}
