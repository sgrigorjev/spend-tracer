import type { FastifyReply, FastifyRequest } from "fastify";
import type { App } from "./app.ts";
import type { Store, UserRow } from "./db.ts";
import { ERROR_CODES, errorBody } from "./errors.ts";

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

/**
 * Put the OpenAPI document and docs UI behind the session, so the API surface
 * is not enumerable by anyone who can reach the app without signing in.
 */
export function protectDocs(app: App, store: Store): void {
  const guard = requireUser(store);
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url.startsWith("/api/docs")) {
      await guard(request, reply);
    }
  });
}
