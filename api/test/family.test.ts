import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// db.ts pulls in config.ts, which reads required env vars at import time.
// Set minimal values so the store can be exercised without a real Google setup.
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_ALLOWED_EMAILS = "a@example.com,b@example.com,c@example.com";
process.env.SESSION_SECRET = "test-secret";

const { createStore, ScopeForbiddenError } = await import("../src/db.ts");

function makeUser(store: ReturnType<typeof createStore>, email: string, subject: string): number {
  return store.resolveUser({ email, name: email, avatar: null, provider: "google", subject }).id;
}

function makeFamily(store: ReturnType<typeof createStore>, ownerEmail: string, subject: string): { ownerId: number; familyId: number } {
  const ownerId = makeUser(store, ownerEmail, subject);
  const created = store.createFamily(ownerId, "Home");
  assert.ok(created.ok);
  return { ownerId, familyId: created.familyId! };
}

test("creating a family makes the creator an active owner", () => {
  const store = createStore(":memory:");
  const { ownerId, familyId } = makeFamily(store, "a@example.com", "sub-a");
  const current = store.getFamilyForUser(ownerId);
  assert.ok(current);
  assert.equal(current.family.id, familyId);
  assert.equal(current.membership.role, "owner");
  assert.equal(current.membership.status, "active");
  store.close();
});

test("a user cannot hold two active families", () => {
  const store = createStore(":memory:");
  const { ownerId } = makeFamily(store, "a@example.com", "sub-a");
  const second = store.createFamily(ownerId, "Other");
  assert.equal(second.ok, false);
  assert.equal(second.reason, "already_in_family");
  store.close();
});

test("only the owner can invite and only a registered email", () => {
  const store = createStore(":memory:");
  const { ownerId, familyId } = makeFamily(store, "a@example.com", "sub-a");
  const memberId = makeUser(store, "b@example.com", "sub-b");
  store.inviteByEmail(familyId, ownerId, "b@example.com");
  store.acceptInvitation(memberId, familyId);

  const byMember = store.inviteByEmail(familyId, memberId, "c@example.com");
  assert.equal(byMember.ok, false);
  assert.equal(byMember.reason, "not_owner");

  const unknown = store.inviteByEmail(familyId, ownerId, "nobody@example.com");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, "unknown_email");
  store.close();
});

test("an invited membership is not visible until accepted", () => {
  const store = createStore(":memory:");
  const { ownerId, familyId } = makeFamily(store, "a@example.com", "sub-a");
  const inviteeId = makeUser(store, "b@example.com", "sub-b");
  store.inviteByEmail(familyId, ownerId, "b@example.com");

  assert.deepEqual(store.visibleUserIds(ownerId).sort(), [ownerId]);
  assert.deepEqual(store.visibleUserIds(inviteeId), [inviteeId]);

  const accepted = store.acceptInvitation(inviteeId, familyId);
  assert.ok(accepted.ok);
  assert.deepEqual(store.visibleUserIds(ownerId).sort((x, y) => x - y), [ownerId, inviteeId].sort((x, y) => x - y));
  store.close();
});

test("an active member cannot join another family", () => {
  const store = createStore(":memory:");
  const first = makeFamily(store, "a@example.com", "sub-a");
  const second = makeFamily(store, "c@example.com", "sub-c");
  const memberId = makeUser(store, "b@example.com", "sub-b");

  store.inviteByEmail(first.familyId, first.ownerId, "b@example.com");
  store.acceptInvitation(memberId, first.familyId);

  const invited = store.inviteByEmail(second.familyId, second.ownerId, "b@example.com");
  assert.equal(invited.ok, false);
  assert.equal(invited.reason, "invitee_in_family");
  store.close();
});

test("declining an invitation removes it without granting access", () => {
  const store = createStore(":memory:");
  const { ownerId, familyId } = makeFamily(store, "a@example.com", "sub-a");
  const inviteeId = makeUser(store, "b@example.com", "sub-b");
  store.inviteByEmail(familyId, ownerId, "b@example.com");

  const declined = store.declineInvitation(inviteeId, familyId);
  assert.ok(declined.ok);
  assert.equal(store.listPendingInvitations(inviteeId).length, 0);
  assert.deepEqual(store.visibleUserIds(inviteeId), [inviteeId]);
  store.close();
});

test("the owner cannot leave while members remain, a member can leave", () => {
  const store = createStore(":memory:");
  const { ownerId, familyId } = makeFamily(store, "a@example.com", "sub-a");
  const memberId = makeUser(store, "b@example.com", "sub-b");
  store.inviteByEmail(familyId, ownerId, "b@example.com");
  store.acceptInvitation(memberId, familyId);

  const ownerLeave = store.leaveFamily(ownerId);
  assert.equal(ownerLeave.ok, false);
  assert.equal(ownerLeave.reason, "owner_has_members");

  assert.ok(store.leaveFamily(memberId).ok);
  assert.ok(store.leaveFamily(ownerId).ok);
  store.close();
});

test("the owner can remove a member and visibility is revoked", () => {
  const store = createStore(":memory:");
  const { ownerId, familyId } = makeFamily(store, "a@example.com", "sub-a");
  const memberId = makeUser(store, "b@example.com", "sub-b");
  store.inviteByEmail(familyId, ownerId, "b@example.com");
  store.acceptInvitation(memberId, familyId);

  assert.ok(store.removeMember(ownerId, memberId).ok);
  assert.deepEqual(store.visibleUserIds(memberId), [memberId]);
  assert.deepEqual(store.visibleUserIds(ownerId), [ownerId]);
  store.close();
});

test("scope resolves me, family and a single member, and rejects a stranger", () => {
  const store = createStore(":memory:");
  const { ownerId, familyId } = makeFamily(store, "a@example.com", "sub-a");
  const memberId = makeUser(store, "b@example.com", "sub-b");
  const strangerId = makeUser(store, "c@example.com", "sub-c");
  store.inviteByEmail(familyId, ownerId, "b@example.com");
  store.acceptInvitation(memberId, familyId);

  assert.deepEqual(store.resolveScope(ownerId, "me"), [ownerId]);
  assert.deepEqual(store.resolveScope(ownerId, "group").sort((x, y) => x - y), [ownerId, memberId].sort((x, y) => x - y));
  assert.deepEqual(store.resolveScope(ownerId, `member:${memberId}`), [memberId]);
  assert.throws(() => store.resolveScope(ownerId, `member:${strangerId}`), ScopeForbiddenError);
  store.close();
});

test("the partial unique index rejects a second active membership", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "spend-tracer-family-"));
  const dbPath = path.join(dir, "family.db");
  try {
    const store = createStore(dbPath);
    const first = makeFamily(store, "a@example.com", "sub-a");
    const second = makeFamily(store, "b@example.com", "sub-b");
    store.close();

    const db = new DatabaseSync(dbPath);
    assert.throws(() => {
      db.prepare("INSERT INTO family_members (family_id, user_id, role, status, created_at) VALUES (?, ?, ?, ?, ?)").run(
        second.familyId,
        first.ownerId,
        "member",
        "active",
        new Date().toISOString(),
      );
    });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an owner leaving with pending invitations dissolves the family", () => {
  const store = createStore(":memory:");
  const { ownerId, familyId } = makeFamily(store, "a@example.com", "sub-a");
  const inviteeId = makeUser(store, "b@example.com", "sub-b");
  store.inviteByEmail(familyId, ownerId, "b@example.com");

  const left = store.leaveFamily(ownerId);
  assert.ok(left.ok);
  assert.equal(store.getFamilyForUser(ownerId), undefined);
  assert.equal(store.listPendingInvitations(inviteeId).length, 0);

  const accepted = store.acceptInvitation(inviteeId, familyId);
  assert.equal(accepted.ok, false);
  assert.equal(accepted.reason, "no_invite");
  store.close();
});
