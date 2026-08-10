import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

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
      return { id: existing._id, status: existing.status, created: false };
    }

    const id = await ctx.db.insert("interestSignups", {
      ...args,
      status: "new",
      createdAt: now,
      updatedAt: now,
      submissionCount: 1,
    });

    return { id, status: "new" as const, created: true };
  },
});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Aggregate, non-PII counts only. Never return names, emails, locations,
// or free-text fields here — this backs a public "real data" display.
export const publicStats = query({
  args: {},
  handler: async (ctx) => {
    const signups = await ctx.db.query("interestSignups").collect();
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

    return { total: signups.length, byAccountType, byRegion, last7Days, latestCreatedAt };
  },
});
