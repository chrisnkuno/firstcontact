import { mutation } from "./_generated/server";
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
    const now = Date.now();

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
