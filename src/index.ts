import process from "node:process";
import { startBot } from "./bot.ts";

// Start the bot and keep the process alive until a termination signal arrives.
const bot = await startBot();

/** Gracefully stop the bot and exit the process. */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, stopping...`);
  bot.stop();
  process.exit(0);
}

// Clean up on Ctrl+C (SIGINT) and on standard termination requests (SIGTERM).
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
