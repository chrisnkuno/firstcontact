import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";
import { createUser, grantMfa } from "./convex-helpers";
import type { Id } from "../convex/_generated/dataModel";

const modules = import.meta.glob("../convex/**/*.ts");

/**
 * Auto-issued participant invites.
 *
 * The property that carries the whole security model is the last test in the
 * first block: a code is bound to the address it was issued to, and matched
 * against the *account's own* email rather than anything the client sends. If
 * that check is ever loosened, a leaked code becomes a way into someone else's
 * intake record, and these tests are the specification that says so.
 */

const recordSignup = makeFunctionReference<
  "mutation",
  Record<string, unknown>,
  { id: Id<"interestSignups">; status: string; created: boolean; invited: boolean }
>("signups:record");

const redeem = makeFunctionReference<"mutation", { code: string }, { redeemed: true }>(
  "invites:redeem",
);
const revoke = makeFunctionReference<"mutation", { inviteId: Id<"accountInvites"> }, unknown>(
  "invites:revoke",
);
const listSignups = makeFunctionReference<"query", Record<string, unknown>, Array<{
  invite: {
    state: "live" | "redeemed" | "revoked" | "expired";
    code: string | null;
  } | null;
}>>(
  "admin:listSignups",
);
const listParticipantChoices = makeFunctionReference<"query", Record<string, never>, Array<{
  signupId: Id<"interestSignups">;
  displayName: string;
  organizationLabel: string | null;
  accountType: "startup" | "institution" | "individual";
  hasPassword: boolean;
}>>("invites:listParticipantChoices");
const preparePasswordSetup = makeFunctionReference<
  "mutation",
  { signupId: Id<"interestSignups">; code: string },
  { email: string; name: string; inviteCode: string }
>("invites:preparePasswordSetup");
const claimSignupRecord = makeFunctionReference<"mutation", Record<string, never>, { claimed: boolean }>(
  "users:claimSignupRecord",
);
const backfillParticipantInvites = makeFunctionReference<
  "mutation",
  { paginationOpts: { cursor: string | null; numItems: number } },
  { page: Array<{ signupId: Id<"interestSignups">; outcome: string }>; isDone: boolean; continueCursor: string }
>("migrations:backfillParticipantInvites");

const submission = (email: string) => ({
  accountType: "startup" as const,
  name: "Test Person",
  email,
  location: "Nairobi, Kenya",
  summary: "A summary of the company.",
  context: "Context about the raise.",
  goals: ["raise-capital" as const],
  targetRegions: ["US" as const],
  referralSource: "search" as const,
  productUpdates: false,
  source: "test",
  consentRecordedAt: Date.now(),
});

async function codeFor(t: TestConvex<typeof schema>, signupId: Id<"interestSignups">) {
  return await t.run(async (ctx) => {
    const invite = await ctx.db
      .query("accountInvites")
      .withIndex("by_signup", (q) => q.eq("signupId", signupId))
      .first();
    return invite?.code ?? null;
  });
}

describe("invite issuance", () => {
  it("auto-approves every submission into a live invite", async () => {
    const t = convexTest(schema, modules);
    const result = await t.mutation(recordSignup, submission("founder@example.com"));

    expect(result.status).toBe("invited");
    expect(result.invited).toBe(true);
    expect(await codeFor(t, result.id)).toMatch(/^FC-/);
  });

  it("does not mint a second code when the form is resubmitted", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(recordSignup, submission("founder@example.com"));
    const firstCode = await codeFor(t, first.id);

    await t.mutation(recordSignup, submission("founder@example.com"));

    const invites = await t.run(async (ctx) => ctx.db.query("accountInvites").collect());
    expect(invites).toHaveLength(1);
    expect(invites[0]!.code).toBe(firstCode);
  });

  it("does not resurrect a withdrawn invite on resubmission", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(recordSignup, submission("founder@example.com"));
    const admin = await createUser(t, { role: "admin", email: "admin@example.com" });
    await grantMfa(t, admin.userId, admin.sessionId);

    const inviteId = await t.run(async (ctx) => {
      const invite = await ctx.db.query("accountInvites").first();
      return invite!._id;
    });
    await admin.as.mutation(revoke, { inviteId });

    // Filling the form in again must not hand back a working code to someone
    // an operator has deliberately turned away.
    await t.mutation(recordSignup, submission("founder@example.com"));

    const invites = await t.run(async (ctx) => ctx.db.query("accountInvites").collect());
    const live = invites.filter((invite) => !invite.revokedAt && !invite.redeemedAt);
    expect(live).toHaveLength(0);
  });
});

describe("invite redemption", () => {
  it("links the account and marks the record active", async () => {
    const t = convexTest(schema, modules);
    const signup = await t.mutation(recordSignup, submission("founder@example.com"));
    const code = await codeFor(t, signup.id);
    const user = await createUser(t, { role: "participant", email: "founder@example.com" });

    await user.as.mutation(redeem, { code: code! });

    const record = await t.run(async (ctx) => ctx.db.get(signup.id));
    expect(record?.status).toBe("active");
    expect(record?.userId).toBe(user.userId);
  });

  it("accepts a code typed back in any casing", async () => {
    const t = convexTest(schema, modules);
    const signup = await t.mutation(recordSignup, submission("founder@example.com"));
    const code = await codeFor(t, signup.id);
    const user = await createUser(t, { role: "participant", email: "founder@example.com" });

    await user.as.mutation(redeem, { code: code!.toLowerCase().replace(/-/g, " ") });
    expect((await t.run(async (ctx) => ctx.db.get(signup.id)))?.status).toBe("active");
  });

  it("is single-use", async () => {
    const t = convexTest(schema, modules);
    const signup = await t.mutation(recordSignup, submission("founder@example.com"));
    const code = await codeFor(t, signup.id);
    const user = await createUser(t, { role: "participant", email: "founder@example.com" });

    await user.as.mutation(redeem, { code: code! });
    await expect(user.as.mutation(redeem, { code: code! })).rejects.toThrow(
      /INVITE_ALREADY_REDEEMED/,
    );
  });

  it("refuses a code issued to a different address", async () => {
    const t = convexTest(schema, modules);
    const signup = await t.mutation(recordSignup, submission("founder@example.com"));
    const code = await codeFor(t, signup.id);
    // A different person, holding someone else's code.
    const intruder = await createUser(t, { role: "participant", email: "someone@else.com" });

    await expect(intruder.as.mutation(redeem, { code: code! })).rejects.toThrow(
      /INVITE_WRONG_ACCOUNT/,
    );

    const record = await t.run(async (ctx) => ctx.db.get(signup.id));
    expect(record?.userId).toBeUndefined();
    expect(record?.status).toBe("invited");
  });

  it("refuses a withdrawn code", async () => {
    const t = convexTest(schema, modules);
    const signup = await t.mutation(recordSignup, submission("founder@example.com"));
    const code = await codeFor(t, signup.id);
    await t.run(async (ctx) => {
      const invite = await ctx.db.query("accountInvites").first();
      await ctx.db.patch(invite!._id, { revokedAt: Date.now() });
    });

    const user = await createUser(t, { role: "participant", email: "founder@example.com" });
    await expect(user.as.mutation(redeem, { code: code! })).rejects.toThrow(/INVITE_REVOKED/);
  });

  it("refuses an expired code", async () => {
    const t = convexTest(schema, modules);
    const signup = await t.mutation(recordSignup, submission("founder@example.com"));
    const code = await codeFor(t, signup.id);
    await t.run(async (ctx) => {
      const invite = await ctx.db.query("accountInvites").first();
      await ctx.db.patch(invite!._id, { expiresAt: Date.now() - 1 });
    });

    const user = await createUser(t, { role: "participant", email: "founder@example.com" });
    await expect(user.as.mutation(redeem, { code: code! })).rejects.toThrow(/INVITE_EXPIRED/);
  });

  it("refuses an unauthenticated caller", async () => {
    const t = convexTest(schema, modules);
    const signup = await t.mutation(recordSignup, submission("founder@example.com"));
    const code = await codeFor(t, signup.id);

    await expect(t.mutation(redeem, { code: code! })).rejects.toThrow(/UNAUTHENTICATED/);
  });

  it("does not change what an account is", async () => {
    const t = convexTest(schema, modules);
    const signup = await t.mutation(recordSignup, submission("backer@example.com"));
    const code = await codeFor(t, signup.id);
    const investor = await createUser(t, { role: "investor", email: "backer@example.com" });

    await investor.as.mutation(redeem, { code: code! });

    // Redemption links records; it is not a role grant.
    const user = await t.run(async (ctx) => ctx.db.get(investor.userId));
    expect(user?.role).toBe("investor");
  });
});

describe("participant first-password setup", () => {
  it("lists recognizable participant cards without exposing emails or intake answers", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(recordSignup, {
      ...submission("founder@example.com"),
      name: "Amina N.",
      organizationName: "Kivu Grid",
    });
    await t.mutation(recordSignup, {
      ...submission("investor@example.com"),
      accountType: "individual",
      individualRole: "investor",
      goals: ["invest"],
    });

    const choices = await t.query(listParticipantChoices, {});
    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({
      displayName: "A••• N•",
      organizationLabel: "K••• G•••",
      accountType: "startup",
      hasPassword: false,
    });
    expect(JSON.stringify(choices)).not.toContain("founder@example.com");
    expect(JSON.stringify(choices)).not.toContain("A summary of the company");
  });

  it("unlocks the selected participant only with that participant's live code", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(recordSignup, submission("first@example.com"));
    const second = await t.mutation(recordSignup, submission("second@example.com"));
    const firstCode = await codeFor(t, first.id);

    await expect(
      t.mutation(preparePasswordSetup, { signupId: second.id, code: firstCode! }),
    ).rejects.toThrow(/INVITE_UNKNOWN/);

    const setup = await t.mutation(preparePasswordSetup, {
      signupId: first.id,
      code: firstCode!,
    });
    expect(setup).toMatchObject({ email: "first@example.com", name: "Test Person" });
  });

  it("does not offer first-password setup after a password account exists", async () => {
    const t = convexTest(schema, modules);
    const signup = await t.mutation(recordSignup, submission("founder@example.com"));
    const code = await codeFor(t, signup.id);
    const user = await createUser(t, { role: "participant", email: "founder@example.com" });
    await t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", {
        userId: user.userId,
        provider: "password",
        providerAccountId: "founder@example.com",
        secret: "hashed-secret-placeholder",
      });
    });

    await expect(
      t.mutation(preparePasswordSetup, { signupId: signup.id, code: code! }),
    ).rejects.toThrow(/PASSWORD_ALREADY_SET/);
    expect((await t.query(listParticipantChoices, {}))[0]?.hasPassword).toBe(true);
  });

  it("does not let an unredeemed same-email account claim an invited intake", async () => {
    const t = convexTest(schema, modules);
    const signup = await t.mutation(recordSignup, submission("founder@example.com"));
    const user = await createUser(t, { role: "participant", email: "founder@example.com" });

    expect(await user.as.mutation(claimSignupRecord, {})).toEqual({ claimed: false });
    expect((await t.run(async (ctx) => ctx.db.get(signup.id)))?.userId).toBeUndefined();
  });

  it("backfills existing participant records without reopening declined records", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const legacy = await t.run(async (ctx) =>
      ctx.db.insert("interestSignups", {
        ...submission("legacy@example.com"),
        status: "reviewing",
        createdAt: now,
        updatedAt: now,
        submissionCount: 1,
      }),
    );
    const declined = await t.run(async (ctx) =>
      ctx.db.insert("interestSignups", {
        ...submission("declined@example.com"),
        status: "declined",
        createdAt: now,
        updatedAt: now,
        submissionCount: 1,
      }),
    );

    const result = await t.mutation(backfillParticipantInvites, {
      paginationOpts: { cursor: null, numItems: 50 },
    });
    expect(result.page).toEqual(expect.arrayContaining([
      { signupId: legacy, outcome: "issued" },
      { signupId: declined, outcome: "declined" },
    ]));
    expect((await t.run(async (ctx) => ctx.db.get(legacy)))?.status).toBe("invited");
    expect(await codeFor(t, legacy)).toMatch(/^FC-/);
    expect(await codeFor(t, declined)).toBeNull();
  });
});

describe("operator visibility", () => {
  it("shows a live code to an admin and withholds a spent one", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(recordSignup, submission("founder@example.com"));
    const admin = await createUser(t, { role: "admin", email: "admin@example.com" });
    await grantMfa(t, admin.userId, admin.sessionId);

    const [live] = await admin.as.query(listSignups, {});
    expect(live!.invite?.state).toBe("live");
    expect(live!.invite?.code).toMatch(/^FC-/);

    const user = await createUser(t, { role: "participant", email: "founder@example.com" });
    await user.as.mutation(redeem, { code: live!.invite!.code! });

    const [spent] = await admin.as.query(listSignups, {});
    expect(spent!.invite?.state).toBe("redeemed");
    // A spent code has no reason to remain readable.
    expect(spent!.invite?.code).toBeNull();
  });

  it("never exposes a code to a non-admin", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(recordSignup, submission("founder@example.com"));
    const participant = await createUser(t, { role: "participant", email: "p@example.com" });

    await expect(participant.as.query(listSignups, {})).rejects.toThrow(/FORBIDDEN|MFA/);
  });
});
