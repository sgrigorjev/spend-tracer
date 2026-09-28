import { z } from "zod";
import type { App } from "../app.ts";
import { config } from "../config.ts";
import type { Store } from "../db.ts";
import { requireUser } from "../guard.ts";
import { errorResponses } from "../schemas.ts";

/** How long a Telegram link token stays valid. */
const TOKEN_TTL_SECONDS = 600;

export function registerTelegramRoutes(app: App, store: Store): void {
  // Issue a single-use token and the deep link the user opens in Telegram.
  app.post(
    "/api/telegram/link",
    {
      preValidation: requireUser(store),
      schema: {
        response: {
          200: z.object({ token: z.string(), url: z.string().nullable(), expiresAt: z.string() }),
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const user = request.user!;
      const { token, expiresAt } = store.createLinkToken(user.id, TOKEN_TTL_SECONDS);
      const url = config.telegramBotUsername
        ? `https://t.me/${config.telegramBotUsername}?start=${token}`
        : null;
      return { token, url, expiresAt };
    },
  );

  // Report whether the signed-in user has a Telegram account linked.
  app.get(
    "/api/telegram/link/status",
    {
      preValidation: requireUser(store),
      schema: {
        response: {
          200: z.object({ linked: z.boolean(), telegramUserId: z.number().nullable() }),
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const user = request.user!;
      return { linked: user.telegram_user_id != null, telegramUserId: user.telegram_user_id };
    },
  );

  // Remove the signed-in user's Telegram link and any pending link token.
  app.delete(
    "/api/telegram/link",
    {
      preValidation: requireUser(store),
      schema: {
        response: {
          200: z.object({ linked: z.boolean(), telegramUserId: z.number().nullable() }),
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const user = request.user!;
      store.unlinkTelegram(user.id);
      return { linked: false, telegramUserId: null };
    },
  );
}
