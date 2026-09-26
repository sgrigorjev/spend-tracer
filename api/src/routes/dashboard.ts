import { z } from "zod";
import type { App } from "../app.ts";
import type { Store } from "../db.ts";
import { errorResponses, userSchema } from "../schemas.ts";
import { requireUser } from "../guard.ts";

export function registerDashboardRoutes(app: App, store: Store): void {
  app.get(
    "/api/dashboard",
    {
      preValidation: requireUser(store),
      schema: {
        response: { 200: z.object({ user: userSchema, totalExpenses: z.number().nullable() }), ...errorResponses },
      },
    },
    async (request) => {
      return { user: request.user!, totalExpenses: null };
    },
  );
}
