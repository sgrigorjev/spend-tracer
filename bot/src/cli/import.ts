import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { config } from "../config.ts";
import { createStore, type UserRow } from "../db.ts";
import { generateMapping, extractDocument } from "../importModel.ts";
import { fromMinor } from "../../../shared/src/money.ts";
import {
  importStatement,
  type DecisionInput,
  type DecisionOutcome,
  type ImportDeps,
  type ProfilePreview,
} from "../../../shared/src/import/pipeline.ts";

interface CliArgs {
  file: string | null;
  email: string | null;
  yes: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { file: null, email: null, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--file") args.file = argv[++i] ?? null;
    else if (arg === "--email") args.email = argv[++i] ?? null;
    else if (arg === "--yes") args.yes = true;
    else if (!arg.startsWith("--") && !args.file) args.file = arg;
  }
  return args;
}

function amount(draft: { amount_minor: number | null; currency: string | null }): string {
  if (draft.amount_minor === null || !draft.currency) return "?";
  return `${fromMinor(draft.amount_minor, draft.currency)} ${draft.currency}`;
}

function printPreview(preview: ProfilePreview): void {
  stdout.write(`\nLearned a profile for ${preview.bank ?? "an unknown bank"}.\n`);
  stdout.write(`Parsed ${preview.rows.length} rows, integrity: ${preview.integrity.ok ? "ok" : "FAILED"}.\n`);
  for (const row of preview.rows.slice(0, 5)) {
    stdout.write(`  ${row.expense_date}  ${amount(row)}  ${row.direction}  ${row.description}\n`);
  }
}

function printDecision(input: DecisionInput): void {
  stdout.write(`\nUncertain match for ${input.draft.expense_date} ${amount(input.draft)} ${input.draft.description}\n`);
  input.ranked.slice(0, 3).forEach((candidate, index) => {
    stdout.write(
      `  ${index + 1}) ${candidate.expense.expense_date} ${candidate.expense.description} ` +
        `(score ${candidate.score.toFixed(2)})\n`,
    );
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    stdout.write("Usage: node src/cli/import.ts --file <statement> [--email <user>] [--yes]\n");
    process.exitCode = 1;
    return;
  }

  const store = createStore(config.dbPath);
  let user: UserRow | undefined;
  if (args.email) {
    user = store.findUserByEmail(args.email);
    if (!user) {
      stdout.write(`No user with email ${args.email}\n`);
      store.close();
      process.exitCode = 1;
      return;
    }
  } else {
    stdout.write("Pass --email to pick the account the statement belongs to.\n");
    store.close();
    process.exitCode = 1;
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const deps: ImportDeps = {
    generateMapping,
    extractDocument,
    confirmProfile: async (preview: ProfilePreview): Promise<boolean> => {
      printPreview(preview);
      if (!preview.integrity.ok) {
        stdout.write(`Integrity failed: ${preview.integrity.reason}\n`);
        return false;
      }
      if (args.yes) return true;
      const answer = await rl.question("Save this profile and import? [y/N] ");
      return /^y(es)?$/i.test(answer.trim());
    },
    decide: async (input: DecisionInput): Promise<DecisionOutcome> => {
      printDecision(input);
      if (args.yes) return { action: "merge", expenseId: input.ranked[0].expense.id };
      const answer = await rl.question("Merge with 1/2/3, [s]eparate, or [i]gnore? ");
      const trimmed = answer.trim().toLowerCase();
      const pick = Number(trimmed);
      if (Number.isInteger(pick) && pick >= 1 && pick <= Math.min(3, input.ranked.length)) {
        return { action: "merge", expenseId: input.ranked[pick - 1].expense.id };
      }
      if (trimmed.startsWith("i")) return { action: "ignore" };
      return { action: "separate" };
    },
  };

  try {
    const summary = await importStatement(store, user, { filePath: args.file, baseCurrency: config.baseCurrency }, deps);
    stdout.write(
      `\nImported ${summary.parsed} rows (${summary.stored} stored, ${summary.skipped} skipped). ` +
        `Linked ${summary.linked}, created ${summary.created}, ignored ${summary.ignored}, asked ${summary.asked}. ` +
        `Profile: ${summary.profile}.\n`,
    );
  } finally {
    rl.close();
    store.close();
  }
}

void main();
