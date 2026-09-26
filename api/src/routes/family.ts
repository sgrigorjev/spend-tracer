import type { FastifyInstance, FastifyReply } from "fastify";
import type { FamilyResult, Store } from "../db.ts";
import { ScopeForbiddenError } from "../db.ts";
import { getSessionUser } from "./auth.ts";

/** HTTP status for each refusal reason returned by the family store. */
const REFUSAL_STATUS: Record<string, number> = {
  not_owner: 403,
  unknown_email: 404,
  already_in_family: 409,
  invitee_in_family: 409,
  already_member: 409,
  already_invited: 409,
  no_invite: 404,
  not_member: 404,
  owner_has_members: 409,
  cannot_remove_owner: 400,
};

function sendRefusal(reply: FastifyReply, result: Extract<FamilyResult, { ok: false }>) {
  return reply.code(REFUSAL_STATUS[result.reason] ?? 400).send({ error: result.reason });
}

export function registerFamilyRoutes(app: FastifyInstance, store: Store): void {
  // The current family and its active members, or null when the user has none.
  app.get("/api/family", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    const current = store.getFamilyForUser(user.id);
    const pendingInvitations = store.listPendingInvitations(user.id).map((entry) => entry.family);
    if (!current) return { family: null, members: [], pendingInvitations };
    return {
      family: current.family,
      membership: current.membership,
      members: store.listFamilyMembers(current.family.id),
      pendingInvitations,
    };
  });

  app.post("/api/family", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    const { name } = (request.body ?? {}) as { name?: string };
    const result = store.createFamily(user.id, name?.trim() || null);
    if (!result.ok) return sendRefusal(reply, result);
    return { familyId: result.familyId };
  });

  app.post("/api/family/invite", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    const current = store.getFamilyForUser(user.id);
    if (!current) return reply.code(409).send({ error: "no_family" });
    const body = (request.body ?? {}) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return reply.code(400).send({ error: "email is required" });
    const result = store.inviteByEmail(current.family.id, user.id, email);
    if (!result.ok) return sendRefusal(reply, result);
    return { ok: true };
  });

  app.get("/api/family/invitations", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    return {
      invitations: store.listPendingInvitations(user.id).map((entry) => ({
        familyId: entry.family.id,
        name: entry.family.name,
        ownerId: entry.family.owner_id,
        invitedAt: entry.membership.created_at,
      })),
    };
  });

  app.post("/api/family/invitations/:familyId/accept", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    const familyId = Number((request.params as { familyId: string }).familyId);
    const result = store.acceptInvitation(user.id, familyId);
    if (!result.ok) return sendRefusal(reply, result);
    return { ok: true };
  });

  app.post("/api/family/invitations/:familyId/decline", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    const familyId = Number((request.params as { familyId: string }).familyId);
    const result = store.declineInvitation(user.id, familyId);
    if (!result.ok) return sendRefusal(reply, result);
    return { ok: true };
  });

  app.post("/api/family/leave", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    const result = store.leaveFamily(user.id);
    if (!result.ok) return sendRefusal(reply, result);
    return { ok: true };
  });

  app.delete("/api/family/members/:userId", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    const targetId = Number((request.params as { userId: string }).userId);
    const result = store.removeMember(user.id, targetId);
    if (!result.ok) return sendRefusal(reply, result);
    return { ok: true };
  });

  // Resolve a dashboard scope into the user ids the viewer may read. The
  // dashboard read endpoints consume this; it is exposed here so the
  // authorization boundary can be exercised on its own.
  app.get("/api/family/scope", async (request, reply) => {
    const user = getSessionUser(request, store);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    const scope = ((request.query as { scope?: string }).scope ?? "me").trim();
    try {
      return { userIds: store.resolveScope(user.id, scope) };
    } catch (err) {
      if (err instanceof ScopeForbiddenError) {
        return reply.code(403).send({ error: "scope outside family" });
      }
      throw err;
    }
  });
}
