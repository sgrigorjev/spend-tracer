import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { config } from "./config.ts";
import {
  imageSystemPrompt,
  textSystemPrompt,
  expenseJsonSchema,
  sanitizeRecord,
  type ExpenseRecord,
} from "./expenseSchema.ts";

/** Context about the incoming message passed to the model. */
export interface MessageMeta {
  sender: string;
  timeIso: string;
}

export const openai = new OpenAI({ apiKey: config.openaiApiKey });

/** Frame the message text together with who sent it and when. */
function userText(text: string, meta: MessageMeta): string {
  return `${text}\n\nSender: ${meta.sender}\nMessage time: ${meta.timeIso}`;
}

/**
 * Run a chat completion with strict structured output and parse the result.
 * Retries once on an empty or unparsable response.
 */
async function complete(messages: OpenAI.Chat.ChatCompletionMessageParam[], model: string): Promise<ExpenseRecord> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await openai.chat.completions.create({
      model,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "expense_record",
          strict: true,
          schema: expenseJsonSchema,
        },
      },
    });
    const content = res.choices[0]?.message.content;
    if (!content) continue;
    try {
      return sanitizeRecord(JSON.parse(content));
    } catch {
      // fall through to retry
    }
  }
  throw new Error("OpenAI returned no usable structured output");
}

/** Extract an expense record from plain text (message or voice transcript). */
export function extractExpense(text: string, meta: MessageMeta): Promise<ExpenseRecord> {
  return complete(
    [
      { role: "system", content: textSystemPrompt },
      { role: "user", content: userText(text, meta) },
    ],
    config.modelText,
  );
}

/** Detect a PNG or JPEG image from its magic bytes. */
function imageMimeType(bytes: Buffer): string {
  const isPng = bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return isPng ? "image/png" : "image/jpeg";
}

/** Extract an expense record from a receipt/purchase photo on disk. */
export async function extractExpenseFromImage(
  filePath: string,
  meta: MessageMeta,
  caption?: string,
): Promise<ExpenseRecord> {
  const bytes = await readFile(filePath);
  const dataUrl = `data:${imageMimeType(bytes)};base64,${bytes.toString("base64")}`;
  return complete(
    [
      { role: "system", content: imageSystemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: userText(caption ? `Receipt or purchase photo. Caption: ${caption}` : "Receipt or purchase photo. Extract the expense.", meta),
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    config.modelVision,
  );
}
