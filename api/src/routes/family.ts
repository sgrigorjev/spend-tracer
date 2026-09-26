import type { FastifyReply } from "fastify";
import { z } from "zod";
import type { App } from "../app.ts";
import type { FamilyResult, Store } from "../db.ts";
import { ScopeForbiddenError } from "../db.ts";
import { errorBody } from "../errors.ts";
import { errorResponses, errorSchema } from "../schemas.ts";
import { requireUser } from "../guard.ts";

/** HTTP status and message for each refusal reason returned by the family store. */
const REFUSAL: Record<string, { status: number; message: string }> = {
  not_owner: { status: 403, message: "only the family owner can do this" },
  unknown_email: { status: 404, message: "no registered user with that email" },
  already_in_family: { status: 409, message: "you are already in a family" },
  invitee_in_family: { status: 409, message: "that user is already in a family" },
  already_member: { status: 409, message: "that user is already a member" },
  already_invited: { status: 409, message: "that user is already invited" },
  no_invite: { status: 404, message: "no pending invitation" },
  not_member: { status: 404, message: "not a family member" },
  owner_has_members: { status: 409, message: "the owner cannot leave while members remain" },
  cannot_remove_owner: { status: 400, message: "the owner cannot be removed" },
};

function sendRefusal(reply: FastifyReply, result: Extract<FamilyResult, { ok: false }>) {
  const entry = REFUSAL[result.reason] ?? { status: 400, message: result.reason };
  return reply.code(entry.status).send(errorBody(result.reason, entry.message));
}

const familySchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  owner_id: z.number(),
  created_at: z.string(),
});

const membershipSchema = z.object({
  id: z.number(),
  family_id: z.number(),
  user_id: z.number(),
  role: z.enum(["owner", "member"]),
  status: z.enum(["invited", "active"]),
  invited_by: z.number().nullable(),
  created_at: z.string(),
  joined_at: z.string().nullable(),
});

const familyIdParam = z.object({ familyId: z.coerce.number().int().positive() });
const userIdParam = z.object({ userId: z.coerce.number().int().positive() });
const createBody = z.object({ name: z.string().trim().min(1).max(100).optional() });
const inviteBody = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) });
const scopeQuery = z.object({ scope: z.string().trim().optional() });
const okSchema = z.object({ ok: z.boolean() });

export function registerFamilyRoutes(app: App, store: Store): void {
  // The current family and its active members, or null when the user has none.
  app.get(
    "/api/family",
    {
      preValidation: requireUser(store),
      schema: {
        response: {
          200: z.object({
            family: familySchema.nullable(),
            membership: membershipSchema.optional(),
            members: z.array(membershipSchema),
            pendingInvitations: z.array(familySchema),
          }),
        },
      },
    },
    async (request) => {
      const user = request.user!;
      const current = store.getFamilyForUser(user.id);
      const pendingInvitations = store.listPendingInvitations(user.id).map((entry) => entry.family);
      if (!current) return { family: null, members: [], pendingInvitations };
      return {
        family: current.family,
        membership: current.membership,
        members: store.listFamilyMembers(current.family.id),
        pendingInvitations,
      };
    },
  );

  app.post(
    "/api/family",
    { preValidation: requireUser(store), schema: { body: createBody, response: { 200: z.object({ familyId: z.number() }), ...errorResponses } } },
    async (request, reply) => {
      const user = request.user!;
      const result = store.createFamily(user.id, request.body.name ?? null);
      if (!result.ok) return sendRefusal(reply, result);
      return { familyId: result.familyId! };
    },
  );

  app.post(
    "/api/family/invite",
    { preValidation: requireUser(store), schema: { body: inviteBody, response: { 200: okSchema, ...errorResponses } } },
    async (request, reply) => {
      const user = request.user!;
      const current = store.getFamilyForUser(user.id);
      if (!current) return reply.code(409).send(errorBody("no_family", "you are not in a family"));
      const result = store.inviteByEmail(current.family.id, user.id, request.body.email);
      if (!result.ok) return sendRefusal(reply, result);
      return { ok: true };
    },
  );

  app.get(
    "/api/family/invitations",
    {
      preValidation: requireUser(store),
      schema: {
        response: {
          200: z.object({
            invitations: z.array(
              z.object({
                familyId: z.number(),
                name: z.string().nullable(),
                ownerId: z.number(),
                invitedAt: z.string(),
              }),
            ),
          }),
        },
      },
    },
    async (request) => {
      const user = request.user!;
      return {
        invitations: store.listPendingInvitations(user.id).map((entry) => ({
          familyId: entry.family.id,
          name: entry.family.name,
          ownerId: entry.family.owner_id,
          invitedAt: entry.membership.created_at,
        })),
      };
    },
  );

  app.post(
    "/api/family/invitations/:familyId/accept",
    { preValidation: requireUser(store), schema: { params: familyIdParam, response: { 200: okSchema, ...errorResponses } } },
    async (request, reply) => {
      const user = request.user!;
      const result = store.acceptInvitation(user.id, request.params.familyId);
      if (!result.ok) return sendRefusal(reply, result);
      return { ok: true };
    },
  );

  app.post(
    "/api/family/invitations/:familyId/decline",
    { preValidation: requireUser(store), schema: { params: familyIdParam, response: { 200: okSchema, ...errorResponses } } },
    async (request, reply) => {
      const user = request.user!;
      const result = store.declineInvitation(user.id, request.params.familyId);
      if (!result.ok) return sendRefusal(reply, result);
      return { ok: true };
    },
  );

  app.post(
    "/api/family/leave",
    { preValidation: requireUser(store), schema: { response: { 200: okSchema, ...errorResponses } } },
    async (request, reply) => {
      const user = request.user!;
      const result = store.leaveFamily(user.id);
      if (!result.ok) return sendRefusal(reply, result);
      return { ok: true };
    },
  );

  app.delete(
    "/api/family/members/:userId",
    { preValidation: requireUser(store), schema: { params: userIdParam, response: { 200: okSchema, ...errorResponses } } },
    async (request, reply) => {
      const user = request.user!;
      const result = store.removeMember(user.id, request.params.userId);
      if (!result.ok) return sendRefusal(reply, result);
      return { ok: true };
    },
  );

  // Resolve a dashboard scope into the user ids the viewer may read. The
  // dashboard read endpoints consume this; it is exposed here so the
  // authorization boundary can be exercised on its own.
  app.get(
    "/api/family/scope",
    {
      preValidation: requireUser(store),
      schema: { querystring: scopeQuery, response: { 200: z.object({ userIds: z.array(z.number()) }), 403: errorSchema } },
    },
    async (request, reply) => {
      const user = request.user!;
      try {
        return { userIds: store.resolveScope(user.id, request.query.scope ?? "me") };
      } catch (err) {
        if (err instanceof ScopeForbiddenError) {
          return reply.code(403).send(errorBody("scope_forbidden", "scope outside family"));
        }
        throw err;
      }
    },
  );
}
