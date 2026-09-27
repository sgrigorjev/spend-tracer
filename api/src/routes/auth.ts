import { z } from "zod";
import type { App } from "../app.ts";
import { isAllowedEmail, verifyGoogleIdToken } from "../auth.ts";
import { config } from "../config.ts";
import type { Store } from "../db.ts";
import { errorBody } from "../errors.ts";
import { requireUser } from "../guard.ts";
import { errorResponses, errorSchema, userSchema } from "../schemas.ts";

export function registerAuthRoutes(app: App, store: Store): void {
  app.get(
    "/api/auth/config",
    { schema: { response: { 200: z.object({ googleClientId: z.string() }) } } },
    async () => {
      return { googleClientId: config.googleClientId };
    },
  );

  app.post(
    "/api/auth/google",
    {
      schema: {
        body: z.object({ idToken: z.string().min(1) }),
        response: { 200: z.object({ user: userSchema }), 400: errorSchema, 401: errorSchema, 403: errorSchema },
      },
    },
    async (request, reply) => {
      let identity;
      try {
        identity = await verifyGoogleIdToken(request.body.idToken);
      } catch {
        return reply.code(401).send(errorBody("invalid_token", "invalid id token"));
      }

      if (!isAllowedEmail(identity.email)) {
        return reply.code(403).send(errorBody("email_not_allowed", "email not allowed"));
      }

      const user = store.resolveUser({
        email: identity.email,
        name: identity.name,
        avatar: identity.avatar,
        provider: "google",
        subject: identity.subject,
      });
      request.session.set("userId", user.id);
      return { user };
    },
  );

  app.post(
    "/api/auth/logout",
    { schema: { response: { 200: z.object({ ok: z.boolean() }) } } },
    async (request) => {
      request.session.delete();
      return { ok: true };
    },
  );

  app.get(
    "/api/auth/me",
    {
      preValidation: requireUser(store),
      schema: { response: { 200: z.object({ user: userSchema }), ...errorResponses } },
    },
    async (request) => {
      return { user: request.user! };
    },
  );
}
