import process from "node:process";
import { startBot } from "./bot.ts";
import { logger } from "./logger.ts";

// Log fatal errors that would otherwise crash the process with no trace, then
// exit non-zero so a process supervisor (systemd, Docker) can restart the bot.
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.fatal({ err }, "Unhandled promise rejection");
  process.exit(1);
});

// Start the bot and keep the process alive until a termination signal arrives.
const bot = await startBot();

/** Gracefully stop the bot and exit the process. */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down");
  bot.stop();
  process.exit(0);
}

// Clean up on Ctrl+C (SIGINT) and on standard termination requests (SIGTERM).
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
