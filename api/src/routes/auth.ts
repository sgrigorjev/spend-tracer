import type { FastifyInstance, FastifyRequest } from "fastify";
import { isAllowedEmail, verifyGoogleIdToken } from "../auth.ts";
import { config } from "../config.ts";
import type { AuthStore, UserRow } from "../db.ts";

declare module "@fastify/secure-session" {
  interface SessionData {
    userId?: number;
  }
}

/** The signed-in user for the request, or undefined when unauthenticated. */
export function getSessionUser(request: FastifyRequest, store: AuthStore): UserRow | undefined {
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

export function registerAuthRoutes(app: FastifyInstance, store: AuthStore): void {
  app.get("/api/auth/config", async () => {
    return { googleClientId: config.googleClientId };
  });

  app.post("/api/auth/google", async (request, reply) => {
    const { idToken } = request.body as { idToken?: string };
    if (!idToken) {
      return reply.code(400).send({ error: "idToken is required" });
    }

    let identity;
    try {
      identity = await verifyGoogleIdToken(idToken);
    } catch {
      return reply.code(401).send({ error: "invalid id token" });
    }

    if (!isAllowedEmail(identity.email)) {
      return reply.code(403).send({ error: "email not allowed" });
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
  });

  app.post("/api/auth/logout", async (request) => {
    request.session.delete();
    return { ok: true };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) {
      return reply.code(401).send({ error: "not authenticated" });
    }
    return { user };
  });
}
