import { internalMutation } from "./_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { issueInviteForSignup } from "./invites";
import { isParticipantAccountSetupEligible } from "../lib/domain";

/**
 * One-off migrations, run by an operator against a specific deployment.
 *
 * Internal, so nothing here is reachable from a browser. Each migration is
 * written to be **idempotent**: re-running it after a partial failure must not
 * duplicate or lose rows, because the failure mode of a migration you are
 * afraid to re-run is far worse than the failure it was fixing.
 */

/**
 * Moves pre-Convex-Auth audit rows out of `adminAuditLog`.
 *
 * The old rows carry `adminUserId: Id<"adminUsers">`; the new schema requires
 * `actorUserId: Id<"users">`. Those cannot be reconciled — the old admin
 * identity does not exist in the new `users` table and will not until that
 * person registers again — so the history is copied verbatim into
 * `legacyAdminAuditLog`, where the actor is an opaque string, and removed from
 * the table whose shape changed.
 *
 * Deleting the rows instead would have been one line, and would have quietly
 * destroyed the only record of who changed which founder's pipeline status.
 */
export const archiveLegacyAuditLog = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Reads through the untyped escape hatch on purpose: these documents no
    // longer match the declared schema, which is the entire reason they need
    // moving.
    const rows = await ctx.db.query("adminAuditLog").collect();
    const now = Date.now();

    let archived = 0;
    for (const row of rows) {
      const legacy = row as unknown as {
        _id: typeof row._id;
        adminUserId?: string;
        actorUserId?: string;
        action: string;
        targetType: string;
        targetId: string;
        metadata?: unknown;
        createdAt: number;
      };

      // Rows already in the new shape are left alone, so a re-run after a
      // partial failure cannot archive fresh audit entries.
      if (legacy.adminUserId === undefined) continue;

      await ctx.db.insert("legacyAdminAuditLog", {
        actorRef: legacy.adminUserId,
        action: legacy.action,
        targetType: legacy.targetType,
        targetId: legacy.targetId,
        metadata: legacy.metadata,
        createdAt: legacy.createdAt,
        migratedAt: now,
      });
      await ctx.db.delete(row._id);
      archived += 1;
    }

    return { archived, remaining: rows.length - archived };
  },
});

/**
 * Auto-approves participant intake records created before account invites
 * existed and gives each one a first-password setup code.
 *
 * Run in bounded pages and pass the returned continueCursor into the next
 * invocation until isDone is true. The helper is idempotent: rows that already
 * have an invite reuse it, active rows remain active, and declined records are
 * never reopened.
 */
export const backfillParticipantInvites = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.object({
    signupId: v.id("interestSignups"),
    outcome: v.union(
      v.literal("issued"),
      v.literal("existing"),
      v.literal("ineligible"),
      v.literal("declined"),
    ),
  })),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("interestSignups").paginate(args.paginationOpts);
    const now = Date.now();
    const outcomes = [];

    for (const signup of page.page) {
      if (signup.status === "declined") {
        outcomes.push({ signupId: signup._id, outcome: "declined" as const });
        continue;
      }
      if (!isParticipantAccountSetupEligible(signup)) {
        outcomes.push({ signupId: signup._id, outcome: "ineligible" as const });
        continue;
      }

      const before = await ctx.db
        .query("accountInvites")
        .withIndex("by_signup", (q) => q.eq("signupId", signup._id))
        .order("desc")
        .first();
      await issueInviteForSignup(ctx, signup, now, "auto");
      if (signup.status === "new" || signup.status === "reviewing") {
        await ctx.db.patch(signup._id, { status: "invited", updatedAt: now });
      }
      outcomes.push({
        signupId: signup._id,
        outcome: before ? ("existing" as const) : ("issued" as const),
      });
    }

    return { ...page, page: outcomes };
  },
});
