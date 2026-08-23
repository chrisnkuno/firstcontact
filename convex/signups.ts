import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { issueInviteForSignup } from "./invites";

const accountType = v.union(v.literal("startup"), v.literal("institution"), v.literal("individual"));

const individualRole = v.union(
  v.literal("founder"),
  v.literal("investor"),
  v.literal("operator"),
  v.literal("advisor"),
  v.literal("researcher"),
  v.literal("other"),
);

const stage = v.union(
  v.literal("pre-seed"),
  v.literal("seed"),
  v.literal("series-a"),
  v.literal("series-b+"),
  v.literal("growth"),
  v.literal("institutional"),
);

const goal = v.union(
  v.literal("raise-capital"),
  v.literal("find-investors"),
  v.literal("join-catalogue"),
  v.literal("invest"),
  v.literal("mentor"),
  v.literal("partner"),
  v.literal("research"),
);

const capitalRegion = v.union(v.literal("US"), v.literal("UK"), v.literal("EU"), v.literal("APAC"));

const referralSource = v.union(
  v.literal("search"),
  v.literal("social"),
  v.literal("community"),
  v.literal("referral"),
  v.literal("event"),
  v.literal("other"),
);

/**
 * Writes an interest signup.
 *
 * Internal rather than public: validation, origin checking and rate limiting
 * all happen in the HTTP action that fronts it (convex/publicRoutes.ts), and
 * exposing a second, unguarded path to the same table would make those
 * controls optional in practice.
 */
export const record = internalMutation({
  args: {
    accountType,
    name: v.string(),
    email: v.string(),
    location: v.string(),
    organizationName: v.optional(v.string()),
    website: v.optional(v.string()),
    individualRole: v.optional(individualRole),
    stage: v.optional(stage),
    summary: v.string(),
    context: v.string(),
    goals: v.array(goal),
    targetRegions: v.array(capitalRegion),
    referralSource,
    productUpdates: v.boolean(),
    source: v.string(),
    consentRecordedAt: v.number(),
  },
  returns: v.object({
    id: v.id("interestSignups"),
    status: v.union(v.literal("new"), v.literal("reviewing"), v.literal("invited"), v.literal("active"), v.literal("declined")),
    created: v.boolean(),
    invited: v.boolean(),
    inviteCode: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("interestSignups")
      .withIndex("by_email", (query) => query.eq("email", args.email))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
        submissionCount: existing.submissionCount + 1,
      });
      // Re-submitting does not resurrect a withdrawn invite: `issueInviteForSignup`
      // returns the live one if there is one, and a revoked code stays revoked
      // until an operator reissues it. Otherwise anyone an operator had turned
      // away could let themselves back in by filling the form again.
      const reused = await issueInviteForSignup(ctx, existing, now);
      return {
        id: existing._id,
        status: existing.status,
        created: false,
        invited: !reused.redeemedAt && !reused.revokedAt,
      };
    }

    const id = await ctx.db.insert("interestSignups", {
      ...args,
      // Auto-approved: every submission is advanced past review rather than
      // waiting on an operator. The `new` and `reviewing` statuses stay in the
      // schema because an operator can still move a record back into them, and
      // because historic rows predate this behaviour.
      status: "invited",
      createdAt: now,
      updatedAt: now,
      submissionCount: 1,
    });

    // No `adminAuditLog` row is written for auto-issuance. That table requires
    // an `actorUserId`, and there is no human actor here — inventing one would
    // put a fabricated identity into the record that operators trust. The
    // invite's own `createdAt` is the evidence that it was issued; the audit
    // log stays reserved for acts a person actually performed.
    const invite = await issueInviteForSignup(ctx, { _id: id, email: args.email }, now);

    return {
      id,
      status: "invited" as const,
      created: true,
      invited: true,
      // Returned only on the first submission. A repeat request containing
      // merely the same public email address must never recover a live bearer
      // code that was issued to somebody else.
      inviteCode: invite.code,
    };
  },
});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Aggregate, non-PII counts only. Never return names, emails, locations,
// or free-text fields here — this backs a public "real data" display.
export const publicStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    byAccountType: v.object({ startup: v.number(), institution: v.number(), individual: v.number() }),
    byRegion: v.object({ US: v.number(), UK: v.number(), EU: v.number(), APAC: v.number() }),
    last7Days: v.number(),
    latestCreatedAt: v.union(v.number(), v.null()),
    complete: v.boolean(),
  }),
  handler: async (ctx) => {
    const bounded = await ctx.db.query("interestSignups").order("desc").take(10_001);
    const complete = bounded.length <= 10_000;
    const signups = bounded.slice(0, 10_000);
    const now = Date.now();

    const byAccountType = { startup: 0, institution: 0, individual: 0 };
    const byRegion = { US: 0, UK: 0, EU: 0, APAC: 0 };
    let last7Days = 0;
    let latestCreatedAt: number | null = null;

    for (const signup of signups) {
      byAccountType[signup.accountType] += 1;
      for (const region of signup.targetRegions) {
        byRegion[region] += 1;
      }
      if (now - signup.createdAt <= WEEK_MS) last7Days += 1;
      if (latestCreatedAt === null || signup.createdAt > latestCreatedAt) {
        latestCreatedAt = signup.createdAt;
      }
    }

    return { total: signups.length, byAccountType, byRegion, last7Days, latestCreatedAt, complete };
  },
});
