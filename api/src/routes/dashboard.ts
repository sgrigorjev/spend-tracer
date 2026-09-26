import type { FastifyInstance } from "fastify";
import type { Store } from "../db.ts";
import { getSessionUser } from "./auth.ts";

export function registerDashboardRoutes(app: FastifyInstance, store: Store): void {
  app.get("/api/dashboard", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) {
      return reply.code(401).send({ error: "not authenticated" });
    }
    return { user, totalExpenses: null };
  });
}
