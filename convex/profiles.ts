import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireMembership } from "./authz";
import { startupProfileSchema } from "../lib/domain";

const profileFields = {
  organizationType: v.union(v.literal("startup"), v.literal("institution")),
  name: v.string(), website: v.string(), location: v.string(), region: v.string(), stage: v.string(),
  sectors: v.array(v.string()), raiseAmountUsd: v.number(), oneLiner: v.string(), traction: v.string(),
  impact: v.string(), founderContext: v.string(), targetRegions: v.array(v.string()), consentToProcess: v.boolean(),
};

export const create = mutation({
  args: { organizationId: v.id("organizations"), ...profileFields },
  handler: async (ctx, args) => {
    const { user } = await requireMembership(ctx, args.organizationId, ["owner", "member"]);
    const parsed = startupProfileSchema.parse(args);
    const { organizationId } = args;
    const profile = {
      organizationType: parsed.organizationType,
      name: parsed.name,
      website: parsed.website,
      location: parsed.location,
      region: parsed.region,
      stage: parsed.stage,
      sectors: parsed.sectors,
      raiseAmountUsd: parsed.raiseAmountUsd,
      oneLiner: parsed.oneLiner,
      traction: parsed.traction,
      impact: parsed.impact,
      founderContext: parsed.founderContext,
      targetRegions: parsed.targetRegions,
    };
    const startupProfileId = await ctx.db.insert("startupProfiles", { organizationId, ...profile, status: "draft", consentRecordedAt: Date.now(), updatedAt: Date.now() });
    await ctx.db.insert("auditEvents", { organizationId, actorId: user._id, action: "profile.created", entityType: "startupProfile", entityId: startupProfileId, createdAt: Date.now() });
    return { startupProfileId };
  },
});

export const activate = mutation({
  args: { startupProfileId: v.id("startupProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.startupProfileId);
    if (!profile || profile.status !== "draft") throw new Error("Only draft profiles can be activated");
    const { user } = await requireMembership(ctx, profile.organizationId, ["owner", "reviewer"]);
    await ctx.db.patch(profile._id, { status: "active", updatedAt: Date.now() });
    await ctx.db.insert("auditEvents", { organizationId: profile.organizationId, actorId: user._id, action: "profile.activated", entityType: "startupProfile", entityId: profile._id, createdAt: Date.now() });
  },
});

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId);
    return ctx.db.query("startupProfiles").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect();
  },
});
