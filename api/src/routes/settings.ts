import { z } from "zod";
import type { App } from "../app.ts";
import type { Store } from "../db.ts";
import { errorBody } from "../errors.ts";
import { errorResponses } from "../schemas.ts";
import { requireUser } from "../guard.ts";

const settingsSchema = z.object({
  display_currency: z.string(),
  display_timezone: z.string(),
});

const updateBody = z.object({
  display_currency: z.string().trim().toUpperCase().optional(),
  display_timezone: z.string().trim().optional(),
});

/** Currencies the runtime supports, used as the ISO-4217 allowlist. */
const SUPPORTED_CURRENCIES = new Set(Intl.supportedValuesOf("currency"));

/** Offset strings like "+01:00" are accepted by Intl but are not IANA zone names. */
const OFFSET_TIME_ZONE = /^[+-]\d{2}:?\d{2}$/;

/** Whether the runtime recognises the code as a supported currency. */
function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCIES.has(code);
}

/**
 * Whether the value is an IANA timezone. Intl is used rather than the
 * supportedValuesOf list, which omits valid newer zones and aliases such as
 * Europe/Kyiv and UTC; plain offsets are rejected explicitly.
 */
function isValidTimeZone(timeZone: string): boolean {
  if (OFFSET_TIME_ZONE.test(timeZone)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function registerSettingsRoutes(app: App, store: Store): void {
  app.get(
    "/api/settings",
    { preValidation: requireUser(store), schema: { response: { 200: settingsSchema, ...errorResponses } } },
    async (request) => {
      const user = request.user!;
      return { display_currency: user.display_currency, display_timezone: user.display_timezone };
    },
  );

  app.patch(
    "/api/settings",
    {
      preValidation: requireUser(store),
      schema: { body: updateBody, response: { 200: settingsSchema, ...errorResponses } },
    },
    async (request, reply) => {
      const user = request.user!;
      const { display_currency, display_timezone } = request.body;

      if (display_currency !== undefined && !isSupportedCurrency(display_currency)) {
        return reply.code(400).send(errorBody("invalid_currency", "unsupported currency"));
      }
      if (display_timezone !== undefined && !isValidTimeZone(display_timezone)) {
        return reply.code(400).send(errorBody("invalid_timezone", "invalid timezone"));
      }

      store.updateUserSettings(user.id, { display_currency, display_timezone });
      const updated = store.findUserById(user.id)!;
      return { display_currency: updated.display_currency, display_timezone: updated.display_timezone };
    },
  );
}
