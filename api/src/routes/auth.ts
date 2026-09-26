import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { App } from "../app.ts";
import { isAllowedEmail, verifyGoogleIdToken } from "../auth.ts";
import { config } from "../config.ts";
import type { Store, UserRow } from "../db.ts";
import { ERROR_CODES, errorBody } from "../errors.ts";
import { errorResponses, errorSchema, userSchema } from "../schemas.ts";

declare module "@fastify/secure-session" {
  interface SessionData {
    userId?: number;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user?: UserRow;
  }
}

/** The signed-in user for the request, or undefined when unauthenticated. */
export function getSessionUser(request: FastifyRequest, store: Store): UserRow | undefined {
  const userId = request.session.get("userId");
  if (userId === undefined) {
    return undefined;
  }
  const user = store.findUserById(userId);
  if (!user) {
    request.session.delete();
    return undefined;
  }
  return user;
}

/**
 * Hook for protected routes: answers 401 when there is no session, and puts the
 * user on the request so the handler does not resolve it itself. It runs as a
 * preValidation hook, so authentication happens before request validation.
 */
export function requireUser(store: Store) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = getSessionUser(request, store);
    if (!user) {
      await reply.code(401).send(errorBody(ERROR_CODES.unauthorized, "not authenticated"));
      return;
    }
    request.user = user;
  };
}

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
