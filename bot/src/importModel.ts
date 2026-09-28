import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { openai } from "./openai.ts";
import { config } from "./config.ts";
import {
  buildMappingPrompt,
  parseMappingReply,
  type MappingRequest,
  type MappingResult,
} from "../../shared/src/import/learn.ts";
import { parseDate, type TransactionDraft } from "../../shared/src/import/profile.ts";
import { rowFingerprint } from "../../shared/src/import/fingerprint.ts";
import { toMinor } from "../../shared/src/money.ts";

const nullableString = { type: ["string", "null"] } as const;

const mappingSchema = {
  type: "object",
  properties: {
    bank: nullableString,
    roles: {
      type: "object",
      properties: {
        date: nullableString,
        amount: nullableString,
        amount_currency: nullableString,
        account_amount: nullableString,
        account_currency: nullableString,
        description: nullableString,
        category: nullableString,
        balance: nullableString,
        card: nullableString,
        account: nullableString,
        direction: nullableString,
        debit: nullableString,
        credit: nullableString,
      },
      required: [
        "date",
        "amount",
        "amount_currency",
        "account_amount",
        "account_currency",
        "description",
        "category",
        "balance",
        "card",
        "account",
        "direction",
        "debit",
        "credit",
      ],
      additionalProperties: false,
    },
    directives: {
      type: "object",
      properties: {
        date_format: nullableString,
        decimal: nullableString,
        thousands: nullableString,
        sign: nullableString,
        prefer: nullableString,
        header_row: { type: ["integer", "null"] },
      },
      required: ["date_format", "decimal", "thousands", "sign", "prefer", "header_row"],
      additionalProperties: false,
    },
  },
  required: ["bank", "roles", "directives"],
  additionalProperties: false,
} as const;

const documentSchema = {
  type: "object",
  properties: {
    bank: nullableString,
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          amount: { type: "number" },
          currency: nullableString,
          description: { type: "string" },
          category: nullableString,
          direction: { type: "string" },
          card: nullableString,
          account: nullableString,
          balance: { type: ["number", "null"] },
        },
        required: ["date", "amount", "currency", "description", "category", "direction", "card", "account", "balance"],
        additionalProperties: false,
      },
    },
  },
  required: ["bank", "transactions"],
  additionalProperties: false,
} as const;

/** Ask the model to infer a column mapping for an unknown statement format. */
export async function generateMapping(request: MappingRequest): Promise<MappingResult> {
  const res = await openai.chat.completions.create({
    model: config.modelText,
    messages: [{ role: "user", content: buildMappingPrompt(request) }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "import_mapping", strict: true, schema: mappingSchema as unknown as Record<string, unknown> },
    },
  });
  const content = res.choices[0]?.message.content;
  if (!content) throw new Error("model returned no mapping");
  return parseMappingReply(JSON.parse(content));
}

interface DocumentReply {
  bank: string | null;
  transactions: Array<{
    date: string;
    amount: number;
    currency: string | null;
    description: string;
    category: string | null;
    direction: string;
    card: string | null;
    account: string | null;
    balance: number | null;
  }>;
}

/** Extract transactions from a PDF or image statement through the vision model. */
export async function extractDocument({
  kind,
  filePath,
}: {
  kind: "pdf" | "image";
  filePath: string;
}): Promise<TransactionDraft[]> {
  const bytes = await readFile(filePath);
  const mime = kind === "pdf" ? "application/pdf" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  const content: OpenAI.Chat.ChatCompletionContentPart[] =
    kind === "pdf"
      ? [
          { type: "text", text: "Extract every account transaction from this bank statement." },
          { type: "file", file: { filename: "statement.pdf", file_data: dataUrl } },
        ]
      : [
          { type: "text", text: "Extract every account transaction from this bank statement." },
          { type: "image_url", image_url: { url: dataUrl } },
        ];
  const res = await openai.chat.completions.create({
    model: config.modelVision,
    messages: [{ role: "user", content }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "statement_transactions",
        strict: true,
        schema: documentSchema as unknown as Record<string, unknown>,
      },
    },
  });
  const raw = res.choices[0]?.message.content;
  if (!raw) throw new Error("model returned no transactions");
  const reply = JSON.parse(raw) as DocumentReply;
  return reply.transactions.map((item, index) => {
    const paidAt = parseDate(item.date);
    const currency = item.currency ? item.currency.toUpperCase() : null;
    const direction = item.direction === "inflow" || item.direction === "transfer" ? item.direction : "outflow";
    const magnitude = direction === "outflow" ? -Math.abs(item.amount) : Math.abs(item.amount);
    const draft: TransactionDraft = {
      account: item.account,
      paid_at: paidAt,
      expense_date: paidAt ? paidAt.slice(0, 10) : "",
      amount_minor: currency ? toMinor(magnitude, currency) : null,
      currency,
      account_amount_minor: null,
      account_currency: null,
      description: item.description,
      category: item.category,
      balance_minor: item.balance === null ? null : toMinor(item.balance, currency ?? "EUR"),
      direction,
      card: item.card,
      fingerprint: "",
    };
    draft.fingerprint = rowFingerprint({
      account: draft.account,
      paidAt: draft.paid_at,
      amountMinor: draft.amount_minor,
      currency: draft.currency,
      description: draft.description,
      balanceMinor: draft.balance_minor,
      sequence: index,
    });
    return draft;
  });
}
