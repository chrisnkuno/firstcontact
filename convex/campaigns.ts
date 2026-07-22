import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({ args: { organizationId: v.id("organizations") }, handler: async (ctx, args) => ctx.db.query("campaigns").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect() });

export const requestReview = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign || campaign.status !== "draft") throw new Error("Only draft campaigns can enter review");
    await ctx.db.patch(campaignId, { status: "review" });
  },
});

export const approveMessage = mutation({
  args: { messageId: v.id("messages"), actorId: v.string() },
  handler: async (ctx, { messageId, actorId }) => {
    const message = await ctx.db.get(messageId);
    if (!message || message.status !== "draft") throw new Error("Only draft messages can be approved");
    await ctx.db.patch(messageId, { status: "approved", approvedBy: actorId, approvedAt: Date.now() });
    await ctx.db.insert("auditEvents", { organizationId: (await ctx.db.get(message.campaignId))!.organizationId, actorId, action: "message.approved", entityType: "message", entityId: messageId, createdAt: Date.now() });
  },
});
