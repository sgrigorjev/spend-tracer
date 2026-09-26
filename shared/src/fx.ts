import type { RateLookup, Store } from "./db.ts";

/** Minimal shape of a fetch response, so tests can inject a stub. */
export interface HttpResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

export type Fetcher = (url: string) => Promise<HttpResponse>;

/**
 * Look up the rate from `base` to `quote` for a date. The cache is keyed by the
 * requested date, so a repeat lookup for the same date is free and a later date
 * still triggers a fresh fetch instead of reusing a stale rate. On a fetch
 * failure the nearest earlier cached rate is used as a fallback. An identity
 * conversion returns 1 without touching the network.
 */
export async function getRate(
  store: Store,
  base: string,
  quote: string,
  date: string,
  fetchImpl: Fetcher = (url) => fetch(url),
): Promise<RateLookup | null> {
  if (base === quote) return { rate: 1, date, source: "identity" };

  const cached = store.getRateForDate(base, quote, date);
  if (cached) return cached;

  const fetched = await fetchFrankfurter(base, quote, date, fetchImpl);
  if (fetched) {
    store.saveRate(base, quote, date, fetched.rate, fetched.date, fetched.source);
    return fetched;
  }

  return store.getNearestRate(base, quote, date) ?? null;
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
