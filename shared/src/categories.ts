/** Expense categories used across the bot and the importer. */
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

/** Keyword hints used to map a bank category or merchant text to a category. */
const CATEGORY_HINTS: Array<{ category: Category; words: string[] }> = [
  { category: "groceries", words: ["супермаркет", "supermarket", "grocer", "market", "продукти", "food"] },
  { category: "dining", words: ["ресторан", "restaurant", "cafe", "кафе", "бар", "dining", "takeaway", "coffee"] },
  { category: "transport", words: ["азс", "fuel", "petrol", "transport", "такси", "taxi", "parking", "metro"] },
  { category: "utilities", words: ["комунал", "utilit", "internet", "mobile", "зв'язок", "electric", "water"] },
  { category: "housing", words: ["rent", "оренда", "furniture", "ремонт", "household"] },
  { category: "health", words: ["аптек", "pharmac", "clinic", "health", "doctor", "dentist", "medical"] },
  { category: "clothing", words: ["одяг", "clothing", "shoes", "fashion"] },
  { category: "entertainment", words: ["cinema", "game", "concert", "spot", "entertain", "hobby"] },
];

/**
 * Map a bank category or merchant description to one of the known categories.
 * Falls back to `other` when nothing matches, so an unknown bank taxonomy
 * never produces a category the rest of the app does not understand.
 */
export function mapCategoryToKnown(text: string | null | undefined): Category {
  if (!text) return "other";
  const haystack = text.toLowerCase();
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((word) => haystack.includes(word))) return hint.category;
  }
  return "other";
}
