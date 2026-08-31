import process from "node:process";
import { startBot } from "./bot.js";

const bot = await startBot();

async function shutdown(signal) {
  console.log(`\n${signal} received, stopping...`);
  await bot.stop();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
