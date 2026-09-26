import type { FastifyInstance } from "fastify";
import { config } from "../config.ts";
import type { Store } from "../db.ts";
import { getSessionUser } from "./auth.ts";

/** How long a Telegram link token stays valid. */
const TOKEN_TTL_SECONDS = 600;

export function registerTelegramRoutes(app: FastifyInstance, store: Store): void {
  // Issue a single-use token and the deep link the user opens in Telegram.
  app.post("/api/telegram/link", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) {
      return reply.code(401).send({ error: "not authenticated" });
    }
    const { token, expiresAt } = store.createLinkToken(user.id, TOKEN_TTL_SECONDS);
    const url = config.telegramBotUsername
      ? `https://t.me/${config.telegramBotUsername}?start=${token}`
      : null;
    return { token, url, expiresAt };
  });

  // Report whether the signed-in user has a Telegram account linked.
  app.get("/api/telegram/link/status", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) {
      return reply.code(401).send({ error: "not authenticated" });
    }
    return { linked: user.telegram_user_id != null, telegramUserId: user.telegram_user_id };
  });
}
