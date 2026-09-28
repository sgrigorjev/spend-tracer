import type { ExpenseRow } from "../db.ts";

/** How many days either side of the transaction an expense may sit. */
export const DATE_WINDOW_DAYS = 3;
/** At or above this score, a single clear candidate is linked automatically. */
export const HIGH_SCORE = 0.8;
/** At or above this score, the user is asked to decide. */
export const MID_SCORE = 0.45;
/** Two candidates closer than this are considered equally likely. */
export const AMBIGUITY_GAP = 0.15;

/** One candidate expense with its score against a transaction. */
export interface ScoredCandidate {
  expense: ExpenseRow;
  score: number;
  reasons: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysApart(a: string, b: string): number {
  const first = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const second = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(first) || Number.isNaN(second)) return DATE_WINDOW_DAYS + 1;
  return Math.round(Math.abs(first - second) / DAY_MS);
}

const STOP_WORDS = new Set(["the", "and", "of", "at", "to", "c", "cl", "cc"]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N} ]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word)),
  );
}

/** Jaccard similarity of the word sets of two descriptions, 0 to 1. */
export function descriptionSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared);
}

/**
 * Score a candidate expense against a transaction. The amount is already an
 * exact match by the candidate query, so the score is driven by how close the
 * dates are and how similar the merchant descriptions are.
 */
export function scoreCandidate(
  transaction: { expense_date: string; description: string },
  expense: ExpenseRow,
): ScoredCandidate {
  const days = daysApart(transaction.expense_date, expense.expense_date);
  const dateScore = Math.max(0, 1 - days / (DATE_WINDOW_DAYS + 1));
  const descScore = descriptionSimilarity(transaction.description, expense.description);
  const score = 0.6 * dateScore + 0.4 * descScore;
  const reasons: string[] = [`date +-${days}d`, `desc ${descScore.toFixed(2)}`, "amount exact"];
  return { expense, score, reasons };
}

/** Rank candidates best first. */
export function rankCandidates(
  transaction: { expense_date: string; description: string },
  expenses: ExpenseRow[],
): ScoredCandidate[] {
  return expenses
    .map((expense) => scoreCandidate(transaction, expense))
    .sort((a, b) => b.score - a.score);
}

export type MatchBand = "high" | "middle" | "none";

/** Decide whether a transaction can be linked, must be asked about, or is new. */
export function chooseBand(ranked: ScoredCandidate[]): MatchBand {
  const best = ranked[0];
  if (!best || best.score < MID_SCORE) return "none";
  const second = ranked[1];
  const ambiguous = second !== undefined && best.score - second.score < AMBIGUITY_GAP;
  if (best.score >= HIGH_SCORE && !ambiguous) return "high";
  return "middle";
}
