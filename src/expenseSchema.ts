/** Expense categories the model may pick from. */
export const CATEGORIES = [
  "groceries",
  "transport",
  "housing",
  "utilities",
  "dining",
  "entertainment",
  "health",
  "clothing",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** A structured expense extracted by the LLM. */
export interface ExpenseRecord {
  is_expense: boolean;
  amount: number | null;
  currency: string | null;
  category: Category | null;
  description: string;
  paid_at: string | null;
  payer: string | null;
  confidence: number;
  needs_confirmation: boolean;
}

/**
 * Strict JSON Schema mirroring ExpenseRecord. Passed to the OpenAI
 * structured-outputs mode, so the model is forced to produce valid JSON.
 */
export const expenseJsonSchema = {
  type: "object",
  properties: {
    is_expense: { type: "boolean" },
    amount: { type: ["number", "null"] },
    currency: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    description: { type: "string" },
    paid_at: { type: ["string", "null"] },
    payer: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    needs_confirmation: { type: "boolean" },
  },
  required: [
    "is_expense",
    "amount",
    "currency",
    "category",
    "description",
    "paid_at",
    "payer",
    "confidence",
    "needs_confirmation",
  ],
  additionalProperties: false,
} as const;

const categoryPrompt = CATEGORIES.map((c) => `"${c}"`).join(", ");

const baseRules = `You are a personal expense tracker for a family chat. Analyze the incoming message and extract expense information.

Rules:
- If the message does NOT describe a purchase or expense (casual chat, question, greeting, reminder), set is_expense=false and leave amount, category, payer and paid_at as null.
- A message naming an amount and what it was spent on IS an expense even without verbs like "spent" or "bought". Example: "10 евро на OpenAI" means a 10 EUR expense on OpenAI.
- amount: the numeric amount, WITHOUT currency symbol or separators. If it is unclear or missing, use null and set needs_confirmation=true.
- currency: ISO 4217 code (RUB, USD, EUR, ...) if determinable, otherwise null.
- category: one of ${categoryPrompt}. Use "other" when nothing else fits. Set category to null when not an expense.
- description: a short human-readable summary in the original language of the message.
- paid_at: ISO date (YYYY-MM-DD) ONLY if the message explicitly mentions when the purchase happened, otherwise null.
- payer: who paid. The sender is the default payer; only override when the message explicitly says someone else paid.
- confidence: 0..1 — how sure you are about the extracted values.
- needs_confirmation: true when amount is missing or ambiguous, payer is unclear, the message lists multiple purchases, category could not be determined, or confidence is below 0.8.
Return only the JSON object, nothing else.`;

/** System prompt for plain text (message text or voice transcript). */
export const textSystemPrompt = baseRules;

/** System prompt for a receipt/purchase photo. */
export const imageSystemPrompt = `${baseRules}

The user attached an image, usually a photo of a receipt or a payment screen.
- Read the TOTAL paid on the receipt. If there is no clear single total, set amount to null and needs_confirmation=true.
- If the image is NOT a receipt/purchase (selfie, cat, screenshot of chat, etc.), set is_expense=false.
- If the receipt has a date, put it in paid_at.`;

/**
 * Coerce raw parsed JSON into a well-formed ExpenseRecord, guarding against
 * unexpected values (e.g. a category name the model invented).
 */
export function sanitizeRecord(raw: Partial<ExpenseRecord>): ExpenseRecord {
  const category = raw.category ?? null;
  const amount = typeof raw.amount === "number" ? raw.amount : null;
  const confidence = typeof raw.confidence === "number" ? raw.confidence : 0;

  return {
    is_expense: Boolean(raw.is_expense),
    amount,
    currency: typeof raw.currency === "string" ? raw.currency : null,
    category: category && (CATEGORIES as readonly string[]).includes(category) ? (category as Category) : category ? "other" : null,
    description: typeof raw.description === "string" ? raw.description : "",
    paid_at: typeof raw.paid_at === "string" ? raw.paid_at : null,
    payer: typeof raw.payer === "string" ? raw.payer : null,
    confidence,
    needs_confirmation: Boolean(raw.needs_confirmation) || confidence < 0.8,
  };
}
