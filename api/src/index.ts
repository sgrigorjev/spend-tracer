import process from "node:process";
import { createHash } from "node:crypto";
import Fastify from "fastify";
import type { FastifyBaseLogger } from "fastify";
import fastifySecureSession from "@fastify/secure-session";
import { config } from "./config.ts";
import { logger } from "./logger.ts";
import { createStore } from "./db.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerDashboardRoutes } from "./routes/dashboard.ts";
import { registerTelegramRoutes } from "./routes/telegram.ts";
import { registerFamilyRoutes } from "./routes/family.ts";

// Log fatal errors that would otherwise crash the process with no trace, then
// exit non-zero so a process supervisor (systemd, Docker) can restart the API.
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.fatal({ err }, "Unhandled promise rejection");
  process.exit(1);
});

const app = Fastify({ loggerInstance: logger as unknown as FastifyBaseLogger });

// Derive a stable 32-byte key from the secret so sessions survive restarts.
// The cookie stays non-secure until TLS is added (out of scope for now).
const sessionKey = createHash("sha256").update(config.sessionSecret).digest();
app.register(fastifySecureSession, {
  key: sessionKey,
  // A positive lifetime also caps the session itself, which secure-session
  // otherwise limits to its 1-day default.
  ...(config.sessionMaxAge > 0 ? { expiry: config.sessionMaxAge } : {}),
  cookie: {
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    // A positive lifetime makes the cookie persistent; 0 keeps it a session
    // cookie, since @fastify/cookie treats maxAge 0 as an immediate expiry.
    ...(config.sessionMaxAge > 0 ? { maxAge: config.sessionMaxAge } : {}),
  },
});

const store = createStore(config.dbPath);
logger.info({ dbPath: store.path }, "Database ready");
registerAuthRoutes(app, store);
registerDashboardRoutes(app, store);
registerTelegramRoutes(app, store);
registerFamilyRoutes(app, store);

/** Start the server and keep the process alive until a termination signal. */
async function start(): Promise<void> {
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    logger.fatal({ err }, "Failed to start");
    process.exit(1);
  }
}

/** Gracefully stop the server and exit the process. */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down");
  store.close();
  await app.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await start();
