import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";
import { createUser, grantMfa } from "./convex-helpers";

const modules = import.meta.glob("../convex/**/*.ts");

/**
 * Error capture, and the retention sweep.
 *
 * Two properties are load-bearing and are asserted directly rather than
 * inferred: nothing personal survives into storage, and the sweep deletes only
 * what it is supposed to. A retention job that deletes the wrong row is worse
 * than one that never runs.
 */

const reportClientError = makeFunctionReference<
  "mutation",
  { message: string; route?: string },
  { recorded: boolean; reason?: string }
>("observability:reportClientError");

const listErrors = makeFunctionReference<
  "query",
  { includeResolved?: boolean; limit?: number },
  { id: string; message: string; count: number; route: string; resolvedAt: number | null }[]
>("observability:listErrors");

const errorSummary = makeFunctionReference<
  "query",
  Record<string, never>,
  { lastHourProblems: number; lastHourOccurrences: number; unresolved: number }
>("observability:errorSummary");

const resolveError = makeFunctionReference<
  "mutation",
  { errorId: string; resolved: boolean },
  { resolved: boolean }
>("observability:resolveError");

async function seedAdmin(t: ReturnType<typeof convexTest>) {
  const admin = await createUser(t, { role: "admin", email: "operator@example.org" });
  await grantMfa(t, admin.userId, admin.sessionId);
  return admin;
}

describe("error capture", () => {
  it("redacts personal data before it is ever stored", async () => {
    const t = convexTest(schema, modules);
    const admin = await seedAdmin(t);

    await t.mutation(reportClientError, {
      message: "Failed to load listing for founder@example.org with token Bearer abc123def456ghi",
      route: "/catalogue",
    });

    // Asserted against the database, not the query response: a redact-on-read
    // design would pass a response-level check while still holding the raw
    // value on disk.
    const stored = await t.run(async (ctx) => ctx.db.query("errorEvents").collect());
    expect(stored).toHaveLength(1);
    expect(stored[0].message).not.toContain("founder@example.org");
    expect(stored[0].message).not.toContain("abc123def456ghi");

    const listed = await admin.as.query(listErrors, {});
    expect(listed[0].message).not.toContain("founder@example.org");
  });

  it("does not store a user id, only a coarse role", async () => {
    const t = convexTest(schema, modules);
    const investor = await createUser(t, {
      role: "investor",
      email: "angel@example.org",
      investorType: "angel",
    });

    await investor.as.mutation(reportClientError, { message: "boom", route: "/catalogue" });

    const stored = await t.run(async (ctx) => ctx.db.query("errorEvents").collect());
    expect(stored[0].actorRole).toBe("investor");
    expect(Object.keys(stored[0])).not.toContain("userId");
  });

  it("aggregates repeats into one row rather than logging each", async () => {
    const t = convexTest(schema, modules);
    const admin = await seedAdmin(t);

    for (let index = 0; index < 5; index += 1) {
      await t.mutation(reportClientError, {
        message: `Cannot read property 'x' of undefined at line ${index}`,
        route: "/dashboard",
      });
    }

    const listed = await admin.as.query(listErrors, {});
    expect(listed).toHaveLength(1);
    expect(listed[0].count).toBe(5);
  });

  it("groups by normalised route, so per-record ids do not fragment a problem", async () => {
    const t = convexTest(schema, modules);
    const admin = await seedAdmin(t);

    await t.mutation(reportClientError, { message: "boom", route: "/investor/k17abcdefghijklmn" });
    await t.mutation(reportClientError, { message: "boom", route: "/investor/k99zyxwvutsrqponm" });

    const listed = await admin.as.query(listErrors, {});
    expect(listed).toHaveLength(1);
    expect(listed[0].route).toBe("/investor/:id");
  });

  it("reopens a resolved problem when it happens again", async () => {
    const t = convexTest(schema, modules);
    const admin = await seedAdmin(t);

    await t.mutation(reportClientError, { message: "boom", route: "/dashboard" });
    const [first] = await admin.as.query(listErrors, {});
    await admin.as.mutation(resolveError, { errorId: first.id, resolved: true });
    expect(await admin.as.query(listErrors, {})).toHaveLength(0);

    await t.mutation(reportClientError, { message: "boom", route: "/dashboard" });
    const reopened = await admin.as.query(listErrors, {});
    expect(reopened).toHaveLength(1);
    expect(reopened[0].resolvedAt).toBeNull();
  });

  // The endpoint is unauthenticated by necessity — errors on the sign-in screen
  // are exactly the ones worth knowing about — so the ceiling is what makes it
  // safe. Crucially it bounds *new* problems while letting known ones keep
  // counting, so a flood cannot bury a real incident's true frequency.
  it("caps new distinct problems but keeps counting known ones", async () => {
    const t = convexTest(schema, modules);
    const admin = await seedAdmin(t);

    await t.mutation(reportClientError, { message: "the real incident", route: "/" });

    for (let index = 0; index < 60; index += 1) {
      await t.mutation(reportClientError, { message: `flood variant ${index}`, route: "/" });
    }

    const listed = await admin.as.query(listErrors, { limit: 200 });
    expect(listed.length).toBeLessThanOrEqual(41);

    // The known problem still increments after the ceiling is reached.
    await t.mutation(reportClientError, { message: "the real incident", route: "/" });
    const real = (await admin.as.query(listErrors, { limit: 200 })).find((row) =>
      row.message.includes("real incident"),
    );
    expect(real?.count).toBe(2);
  });

  it("keeps the operator views behind admin step-up", async () => {
    const t = convexTest(schema, modules);
    const participant = await createUser(t, { role: "participant", email: "founder@example.org" });
    const bareAdmin = await createUser(t, { role: "admin", email: "new-operator@example.org" });

    await expect(t.query(listErrors, {})).rejects.toThrow("UNAUTHENTICATED");
    await expect(participant.as.query(listErrors, {})).rejects.toThrow("FORBIDDEN");
    await expect(participant.as.query(errorSummary, {})).rejects.toThrow("FORBIDDEN");
    // An admin who has not enrolled an authenticator is still refused.
    await expect(bareAdmin.as.query(listErrors, {})).rejects.toThrow("MFA_NOT_ENROLLED");
  });
});

/* ------------------------------------------------------------------ */

const applyRetentionPolicy = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { signupsDeleted: number; retentionMonths: number }
>("maintenance:applyRetentionPolicy");

const DAY = 24 * 60 * 60 * 1000;
const THIRTY_MONTHS_AGO = Date.now() - 30 * 30 * DAY;
const RECENTLY = Date.now() - 10 * DAY;

type SignupSeed = {
  email: string;
  status: "new" | "reviewing" | "invited" | "active" | "declined";
  createdAt: number;
  updatedAt: number;
  withAccount?: boolean;
};

async function seedSignup(t: ReturnType<typeof convexTest>, seed: SignupSeed) {
  const userId = seed.withAccount
    ? (await createUser(t, { role: "participant", email: seed.email })).userId
    : undefined;

  await t.run(async (ctx) =>
    ctx.db.insert("interestSignups", {
      accountType: "startup",
      name: "Test",
      email: seed.email,
      location: "Kigali",
      summary: "A summary long enough to be plausible.",
      context: "Some context.",
      goals: ["raise-capital"],
      targetRegions: ["US"],
      referralSource: "search",
      productUpdates: false,
      status: seed.status,
      source: "test",
      consentRecordedAt: seed.createdAt,
      createdAt: seed.createdAt,
      updatedAt: seed.updatedAt,
      submissionCount: 1,
      userId,
    }),
  );
}

async function remainingEmails(t: ReturnType<typeof convexTest>) {
  const rows = await t.run(async (ctx) => ctx.db.query("interestSignups").collect());
  return rows.map((row) => row.email).sort();
}

describe("retention sweep", () => {
  it("deletes unsuccessful signups past the retention period", async () => {
    const t = convexTest(schema, modules);
    await seedSignup(t, {
      email: "stale-declined@example.org",
      status: "declined",
      createdAt: THIRTY_MONTHS_AGO,
      updatedAt: THIRTY_MONTHS_AGO,
    });
    await seedSignup(t, {
      email: "stale-new@example.org",
      status: "new",
      createdAt: THIRTY_MONTHS_AGO,
      updatedAt: THIRTY_MONTHS_AGO,
    });

    const result = await t.mutation(applyRetentionPolicy, {});
    expect(result.retentionMonths).toBe(24);
    expect(result.signupsDeleted).toBe(2);
    expect(await remainingEmails(t)).toEqual([]);
  });

  it("keeps a record whose last contact is recent, however old the signup", async () => {
    const t = convexTest(schema, modules);
    await seedSignup(t, {
      email: "old-but-active-conversation@example.org",
      status: "reviewing",
      createdAt: THIRTY_MONTHS_AGO,
      updatedAt: RECENTLY,
    });

    await t.mutation(applyRetentionPolicy, {});
    expect(await remainingEmails(t)).toEqual(["old-but-active-conversation@example.org"]);
  });

  // `invited` and `active` are ongoing relationships, not unsuccessful signups.
  it("never deletes an invited or active record", async () => {
    const t = convexTest(schema, modules);
    await seedSignup(t, {
      email: "invited@example.org",
      status: "invited",
      createdAt: THIRTY_MONTHS_AGO,
      updatedAt: THIRTY_MONTHS_AGO,
    });
    await seedSignup(t, {
      email: "active@example.org",
      status: "active",
      createdAt: THIRTY_MONTHS_AGO,
      updatedAt: THIRTY_MONTHS_AGO,
    });

    const result = await t.mutation(applyRetentionPolicy, {});
    expect(result.signupsDeleted).toBe(0);
    expect(await remainingEmails(t)).toEqual(["active@example.org", "invited@example.org"]);
  });

  // Otherwise a live account would be left pointing at nothing.
  it("never deletes a record claimed by an account, however stale its status", async () => {
    const t = convexTest(schema, modules);
    await seedSignup(t, {
      email: "has-account@example.org",
      status: "declined",
      createdAt: THIRTY_MONTHS_AGO,
      updatedAt: THIRTY_MONTHS_AGO,
      withAccount: true,
    });

    const result = await t.mutation(applyRetentionPolicy, {});
    expect(result.signupsDeleted).toBe(0);
    expect(await remainingEmails(t)).toEqual(["has-account@example.org"]);
  });

  // Deleting a suppression silently re-permits contacting someone who asked
  // not to be contacted. This is the sweep's most important non-action.
  it("never touches suppressions or the audit log", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("suppressions", {
        emailHash: "hash",
        reason: "unsubscribe",
        createdAt: THIRTY_MONTHS_AGO,
        source: "test",
      });
      await ctx.db.insert("legacyAdminAuditLog", {
        actorRef: "old",
        action: "test",
        targetType: "t",
        targetId: "1",
        createdAt: THIRTY_MONTHS_AGO,
        migratedAt: THIRTY_MONTHS_AGO,
      });
    });

    await t.mutation(applyRetentionPolicy, {});

    const [suppressions, audit] = await t.run(async (ctx) => [
      await ctx.db.query("suppressions").collect(),
      await ctx.db.query("legacyAdminAuditLog").collect(),
    ]);
    expect(suppressions).toHaveLength(1);
    expect(audit).toHaveLength(1);
  });

  it("records only counts, never which records were deleted", async () => {
    const t = convexTest(schema, modules);
    await seedSignup(t, {
      email: "stale@example.org",
      status: "declined",
      createdAt: THIRTY_MONTHS_AGO,
      updatedAt: THIRTY_MONTHS_AGO,
    });

    await t.mutation(applyRetentionPolicy, {});

    const state = await t.run(async (ctx) => ctx.db.query("operationalState").collect());
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("stale@example.org");
    expect(state.find((row) => row.key === "retention.lastSignupsDeleted")?.numberValue).toBe(1);
  });
});
