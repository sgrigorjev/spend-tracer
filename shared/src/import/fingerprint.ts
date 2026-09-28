import { createHash } from "node:crypto";

/** Normalize a header cell so reordering and whitespace do not change the key. */
export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Fingerprint a statement format from its normalized, sorted header set, the
 * column count, the file kind and a signature of the sample data. Headers are
 * sorted so a bank reordering columns still matches; the sample signature
 * separates two banks that happen to share generic header names.
 */
export function formatFingerprint(kind: string, headers: string[], sampleRows: string[][]): string {
  const normalized = headers.map(normalizeHeader).sort();
  const signature = sampleRows
    .slice(0, 3)
    .map((row) => row.slice(0, headers.length).map(shapeOf).join("|"))
    .join("\n");
  return sha256(JSON.stringify({ kind, count: headers.length, headers: normalized, signature }));
}

/** A coarse shape marker for a sample cell: whether it looks like a date or number. */
function shapeOf(value: string | undefined): string {
  const cell = (value ?? "").trim();
  if (cell === "") return "empty";
  if (/\d{1,4}[./-]\d{1,2}[./-]\d{1,4}/.test(cell)) return "date";
  if (/-?\d[\d\s\u00a0.,'-]*/.test(cell) && /\d/.test(cell)) return "number";
  return "text";
}

/**
 * Fingerprint one statement row from the fields that identify it. A stable key
 * lets a re-import of an overlapping statement skip rows already stored.
 */
export function rowFingerprint(fields: {
  account: string | null;
  paidAt: string | null;
  amountMinor: number | null;
  currency: string | null;
  description: string;
  balanceMinor: number | null;
  sequence: number;
}): string {
  return sha256(
    JSON.stringify([
      fields.account,
      fields.paidAt,
      fields.amountMinor,
      fields.currency,
      fields.description,
      fields.balanceMinor,
      fields.sequence,
    ]),
  );
}
