import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireMembership } from "./authz";
import { campaignStatusAfter, canPerformCampaignAction, type CampaignAction } from "../lib/control-plane";

const campaignStatus = v.union(v.literal("draft"), v.literal("review"), v.literal("approved"), v.literal("running"), v.literal("paused"), v.literal("complete"));

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId);
    return ctx.db.query("campaigns").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect();
  },
});

export const get = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return null;
    await requireMembership(ctx, campaign.organizationId);
    return campaign;
  },
});

export const create = mutation({
  args: { organizationId: v.id("organizations"), startupProfileId: v.id("startupProfiles"), name: v.string(), dailyLimit: v.number() },
  handler: async (ctx, args) => {
    const { user } = await requireMembership(ctx, args.organizationId, ["owner", "member"]);
    const profile = await ctx.db.get(args.startupProfileId);
    if (!profile || profile.organizationId !== args.organizationId) throw new Error("Profile does not belong to this organization");
    const name = args.name.trim();
    if (name.length < 2 || name.length > 120 || !Number.isInteger(args.dailyLimit) || args.dailyLimit < 1 || args.dailyLimit > 25) throw new Error("Invalid campaign");
    const campaignId = await ctx.db.insert("campaigns", { organizationId: args.organizationId, startupProfileId: args.startupProfileId, name, status: "draft", dailyLimit: args.dailyLimit, createdBy: user._id, createdAt: Date.now() });
    await ctx.db.insert("auditEvents", { organizationId: args.organizationId, actorId: user._id, action: "campaign.created", entityType: "campaign", entityId: campaignId, createdAt: Date.now() });
    return { campaignId };
  },
});

export const updateDraft = mutation({
  args: { campaignId: v.id("campaigns"), name: v.optional(v.string()), dailyLimit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    const { user, membership } = await requireMembership(ctx, campaign.organizationId, ["owner", "member"]);
    if (!canPerformCampaignAction(membership.role, campaign.status, "edit")) throw new Error("Campaign cannot be edited in its current state");
    const patch: { name?: string; dailyLimit?: number } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 2 || name.length > 120) throw new Error("Invalid campaign name");
      patch.name = name;
    }
    if (args.dailyLimit !== undefined) {
      if (!Number.isInteger(args.dailyLimit) || args.dailyLimit < 1 || args.dailyLimit > 25) throw new Error("Invalid daily limit");
      patch.dailyLimit = args.dailyLimit;
    }
    if (Object.keys(patch).length === 0) throw new Error("No campaign changes supplied");
    await ctx.db.patch(campaign._id, patch);
    await ctx.db.insert("auditEvents", { organizationId: campaign.organizationId, actorId: user._id, action: "campaign.updated", entityType: "campaign", entityId: campaign._id, createdAt: Date.now() });
  },
});

async function transitionCampaign(ctx: MutationCtx, campaignId: Id<"campaigns">, action: Exclude<CampaignAction, "edit">) {
  const campaign = await ctx.db.get(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  const roles = action === "approve" ? ["owner", "reviewer"] as const : action === "request_review" ? ["owner", "member"] as const : ["owner"] as const;
  const { user, membership } = await requireMembership(ctx, campaign.organizationId, roles);
  if (!canPerformCampaignAction(membership.role, campaign.status, action)) throw new Error("Campaign transition is not allowed");
  if (action === "approve") {
    const profile = await ctx.db.get(campaign.startupProfileId);
    if (!profile || profile.organizationId !== campaign.organizationId || profile.status !== "active") throw new Error("Campaign profile must be active before approval");
  }
  const status = campaignStatusAfter(action);
  await ctx.db.patch(campaign._id, { status });
  await ctx.db.insert("auditEvents", { organizationId: campaign.organizationId, actorId: user._id, action: `campaign.${status}`, entityType: "campaign", entityId: campaign._id, createdAt: Date.now() });
}

export const transition = mutation({
  args: { campaignId: v.id("campaigns"), action: v.union(v.literal("request_review"), v.literal("approve"), v.literal("start"), v.literal("pause"), v.literal("resume"), v.literal("complete")), expectedStatus: campaignStatus },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.status !== args.expectedStatus) throw new Error("Campaign state changed; refresh before retrying");
    await transitionCampaign(ctx, args.campaignId, args.action);
  },
});

export const approveMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (!message || message.status !== "draft") throw new Error("Only draft messages can be approved");
    const campaign = await ctx.db.get(message.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    const { user } = await requireMembership(ctx, campaign.organizationId, ["owner", "reviewer"]);
    const approvedAt = Date.now();
    await ctx.db.patch(messageId, { status: "approved", approvedBy: user._id, approvedAt });
    await ctx.db.insert("auditEvents", { organizationId: campaign.organizationId, actorId: user._id, action: "message.approved", entityType: "message", entityId: messageId, createdAt: approvedAt });
  },
});
