import { z } from "zod";

/** The single error body shape shared by every route. */
export const errorSchema = z.object({ code: z.string(), error: z.string() });

/** Common error statuses, so they appear in the OpenAPI document. */
export const errorResponses = {
  400: errorSchema,
  401: errorSchema,
  403: errorSchema,
  404: errorSchema,
  409: errorSchema,
};

/** The signed-in user as returned by the API. */
export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string().nullable(),
  avatar: z.string().nullable(),
  telegram_user_id: z.number().nullable(),
  display_currency: z.string(),
  display_timezone: z.string(),
  created_at: z.string(),
  last_login: z.string(),
});
