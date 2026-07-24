import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const accountType = v.union(
  v.literal("startup"),
  v.literal("institution"),
  v.literal("individual"),
);

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

const capitalRegion = v.union(
  v.literal("US"),
  v.literal("UK"),
  v.literal("EU"),
  v.literal("APAC"),
);

const referralSource = v.union(
  v.literal("search"),
  v.literal("social"),
  v.literal("community"),
  v.literal("referral"),
  v.literal("event"),
  v.literal("other"),
);

export const submit = mutation({
  args: {
    ingestSecret: v.string(),
    // Optional during the rolling migration so the already-deployed web route
    // remains compatible until it starts sending the opaque limiter keys.
    addressRateLimitKey: v.optional(v.string()),
    addressEmailRateLimitKey: v.optional(v.string()),
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
    const expectedSecret = process.env.SIGNUP_INGEST_SECRET;
    if (!expectedSecret || args.ingestSecret !== expectedSecret) {
      throw new Error("Signup ingestion is not authorized");
    }

    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const consumeRateLimit = async (key: string, limit: number) => {
      const existing = await ctx.db
        .query("signupRateLimits")
        .withIndex("by_key", (query) => query.eq("key", key))
        .unique();

      if (!existing || existing.expiresAt <= now) {
        if (existing) {
          await ctx.db.patch(existing._id, {
            count: 1,
            windowStartedAt: now,
            expiresAt: now + windowMs,
          });
        } else {
          await ctx.db.insert("signupRateLimits", {
            key,
            count: 1,
            windowStartedAt: now,
            expiresAt: now + windowMs,
          });
        }
        return;
      }

      if (existing.count >= limit) {
        throw new Error("SIGNUP_RATE_LIMITED");
      }
      await ctx.db.patch(existing._id, { count: existing.count + 1 });
    };

    // The broad address limit blocks bursts without locking out a shared
    // office/mobile network after only a handful of legitimate signups. The
    // tighter address+email limit catches repeated submissions atomically.
    if (args.addressRateLimitKey && args.addressEmailRateLimitKey) {
      await consumeRateLimit(args.addressRateLimitKey, 40);
      await consumeRateLimit(args.addressEmailRateLimitKey, 6);
    }

    const signup = {
      accountType: args.accountType,
      name: args.name,
      email: args.email,
      location: args.location,
      organizationName: args.organizationName,
      website: args.website,
      individualRole: args.individualRole,
      stage: args.stage,
      summary: args.summary,
      context: args.context,
      goals: args.goals,
      targetRegions: args.targetRegions,
      referralSource: args.referralSource,
      productUpdates: args.productUpdates,
      source: args.source,
      consentRecordedAt: args.consentRecordedAt,
    };
    const existing = await ctx.db
      .query("interestSignups")
      .withIndex("by_email", (query) => query.eq("email", signup.email))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...signup,
        updatedAt: now,
        submissionCount: existing.submissionCount + 1,
      });
      return {
        id: existing._id,
        status: existing.status,
        created: false,
      };
    }

    const id = await ctx.db.insert("interestSignups", {
      ...signup,
      status: "new",
      createdAt: now,
      updatedAt: now,
      submissionCount: 1,
    });

    return { id, status: "new" as const, created: true };
  },
});

export const removeSmokeTest = mutation({
  args: {
    ingestSecret: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.SIGNUP_INGEST_SECRET;
    if (!expectedSecret || args.ingestSecret !== expectedSecret) {
      throw new Error("Signup maintenance is not authorized");
    }
    if (!args.email.endsWith("@example.com")) {
      throw new Error("Only synthetic example.com records can be removed here");
    }

    const record = await ctx.db
      .query("interestSignups")
      .withIndex("by_email", (query) => query.eq("email", args.email))
      .unique();
    if (!record) return { deleted: false };

    await ctx.db.delete(record._id);
    return { deleted: true };
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

    return {
      total: signups.length,
      byAccountType,
      byRegion,
      last7Days,
      latestCreatedAt,
    };
  },
});
