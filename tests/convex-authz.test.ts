import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";
import { createUser, grantMfa } from "./convex-helpers";

const modules = import.meta.glob("../convex/**/*.ts");

const viewer = makeFunctionReference<"query", Record<string, never>, unknown>("users:viewer");
const adminMetrics = makeFunctionReference<"query", Record<string, never>, unknown>("admin:metrics");
const listSignups = makeFunctionReference<"query", { limit?: number }, unknown[]>("admin:listSignups");
const myRecord = makeFunctionReference<"query", Record<string, never>, unknown>("participants:myRecord");
const myInvestorActivity = makeFunctionReference<"query", Record<string, never>, unknown>(
  "investors:myActivity",
);
const promoteToAdmin = makeFunctionReference<
  "mutation",
  { email: string; bootstrapSecret?: string },
  { promoted: boolean }
>("users:promoteToAdmin");

describe("authorization boundary", () => {
  it("refuses every privileged read to an unauthenticated caller", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(viewer, {})).toBeNull();
    await expect(t.query(adminMetrics, {})).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.query(myRecord, {})).rejects.toThrow("UNAUTHENTICATED");
  });

  it("keeps roles apart: a participant cannot read investor or admin surfaces", async () => {
    const t = convexTest(schema, modules);
    const { as } = await createUser(t, { role: "participant", email: "founder@example.org" });

    await expect(as.query(adminMetrics, {})).rejects.toThrow("FORBIDDEN");
    await expect(as.query(myInvestorActivity, {})).rejects.toThrow("FORBIDDEN");
  });

  it("keeps roles apart: an investor cannot read the participant surface", async () => {
    const t = convexTest(schema, modules);
    const { as } = await createUser(t, {
      role: "investor",
      email: "angel@example.org",
      investorType: "angel",
    });
    await expect(as.query(myRecord, {})).rejects.toThrow("FORBIDDEN");
  });

  // The whole point of the step-up model: being an admin is not sufficient.
  it("refuses admin reads until the session completes TOTP step-up", async () => {
    const t = convexTest(schema, modules);
    const { as, userId, sessionId } = await createUser(t, {
      role: "admin",
      email: "operator@example.org",
    });

    // Not enrolled at all.
    await expect(as.query(adminMetrics, {})).rejects.toThrow("MFA_NOT_ENROLLED");

    // Enrolled and verified for this session.
    await grantMfa(t, userId, sessionId);
    await expect(as.query(adminMetrics, {})).resolves.toBeDefined();
    await expect(as.query(listSignups, { limit: 10 })).resolves.toEqual([]);
  });

  it("does not let one device's step-up privilege another session", async () => {
    const t = convexTest(schema, modules);
    const { userId, sessionId } = await createUser(t, { role: "admin", email: "ops@example.org" });
    await grantMfa(t, userId, sessionId);

    // A second session for the same user, which never proved possession.
    const otherSessionId = await t.run(async (ctx) =>
      ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 3_600_000 }),
    );
    const otherDevice = t.withIdentity({
      subject: `${userId}|${otherSessionId}`,
      issuer: "https://test.convex",
    });

    await expect(otherDevice.query(adminMetrics, {})).rejects.toThrow("MFA_REQUIRED");
  });

  it("expires step-up rather than granting it indefinitely", async () => {
    const t = convexTest(schema, modules);
    const { as, userId, sessionId } = await createUser(t, { role: "admin", email: "old@example.org" });
    await t.run(async (ctx) => {
      await ctx.db.insert("userMfa", {
        userId,
        secret: "JBSWY3DPEHPK3PXP",
        enabled: true,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("sessionMfaVerifications", {
        sessionId,
        userId,
        verifiedAt: Date.now() - 10_000,
        expiresAt: Date.now() - 1,
      });
    });

    await expect(as.query(adminMetrics, {})).rejects.toThrow("MFA_REQUIRED");
  });

  // Suspension is checked on every request, so revocation is immediate rather
  // than waiting for an existing session to expire.
  it("locks out a suspended account immediately, mid-session", async () => {
    const t = convexTest(schema, modules);
    const { as, userId } = await createUser(t, { role: "participant", email: "spam@example.org" });
    await expect(as.query(myRecord, {})).resolves.toBeNull();

    await t.run(async (ctx) => ctx.db.patch(userId, { suspendedAt: Date.now() }));
    await expect(as.query(myRecord, {})).rejects.toThrow("SUSPENDED");
  });
});

describe("admin provisioning", () => {
  it("allows a bootstrap promotion only while no admin exists", async () => {
    const t = convexTest(schema, modules);
    process.env.ADMIN_BOOTSTRAP_SECRET = "bootstrap-secret";

    await createUser(t, { role: "participant", email: "first@example.org" });
    await createUser(t, { role: "participant", email: "second@example.org" });

    await expect(
      t.mutation(promoteToAdmin, { email: "first@example.org", bootstrapSecret: "bootstrap-secret" }),
    ).resolves.toEqual({ promoted: true });

    // The bootstrap door closes the moment the first admin exists: replaying
    // the same secret must not mint a second one.
    await expect(
      t.mutation(promoteToAdmin, { email: "second@example.org", bootstrapSecret: "bootstrap-secret" }),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  it("rejects a wrong bootstrap secret", async () => {
    const t = convexTest(schema, modules);
    process.env.ADMIN_BOOTSTRAP_SECRET = "bootstrap-secret";
    await createUser(t, { role: "participant", email: "nobody@example.org" });

    await expect(
      t.mutation(promoteToAdmin, { email: "nobody@example.org", bootstrapSecret: "wrong" }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("lets a verified admin promote someone else, and records who did it", async () => {
    const t = convexTest(schema, modules);
    const { as, userId, sessionId } = await createUser(t, {
      role: "admin",
      email: "operator@example.org",
    });
    await grantMfa(t, userId, sessionId);
    await createUser(t, { role: "participant", email: "newop@example.org" });

    await expect(as.mutation(promoteToAdmin, { email: "newop@example.org" })).resolves.toEqual({
      promoted: true,
    });

    const audit = await t.run(async (ctx) => ctx.db.query("adminAuditLog").collect());
    const promotion = audit.find((entry) => entry.action === "user.promoted_to_admin");
    expect(promotion?.actorUserId).toBe(userId);
  });
});
