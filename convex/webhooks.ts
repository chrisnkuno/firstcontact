import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const recordResendEvent = internalMutation({
  args: { eventId: v.string(), type: v.string(), payload: v.any() },
  handler: async (ctx, args) => {
    const prior = await ctx.db.query("webhookEvents").withIndex("by_provider_event", (q) => q.eq("provider", "resend").eq("eventId", args.eventId)).unique();
    if (prior) return { duplicate: true };
    await ctx.db.insert("webhookEvents", { provider: "resend", eventId: args.eventId, type: args.type, payload: args.payload, receivedAt: Date.now() });
    return { duplicate: false };
  },
});
