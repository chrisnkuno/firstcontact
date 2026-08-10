import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { hashEmail } from "../lib/email-hash";

// Event types that create a standing obligation not to contact the address
// again. Bounces are a deliverability obligation, complaints are a legal and
// reputational one; both are permanent until an operator clears them by hand.
const SUPPRESSING_EVENTS: Record<string, "bounce" | "complaint"> = {
  "email.bounced": "bounce",
  "email.complained": "complaint",
};

export const recordResendEvent = internalMutation({
  args: {
    eventId: v.string(),
    type: v.string(),
    payload: v.any(),
    recipients: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const prior = await ctx.db
      .query("webhookEvents")
      .withIndex("by_provider_event", (q) => q.eq("provider", "resend").eq("eventId", args.eventId))
      .unique();
    if (prior) return { duplicate: true, suppressed: 0 };

    await ctx.db.insert("webhookEvents", {
      provider: "resend",
      eventId: args.eventId,
      type: args.type,
      payload: args.payload,
      receivedAt: Date.now(),
    });

    const reason = SUPPRESSING_EVENTS[args.type];
    if (!reason) return { duplicate: false, suppressed: 0 };

    let suppressed = 0;
    for (const recipient of args.recipients ?? []) {
      // Only the hash is ever stored, so the suppression list itself is not a
      // harvestable set of addresses.
      const emailHash = await hashEmail(recipient);
      const existing = await ctx.db
        .query("suppressions")
        .withIndex("by_email_hash", (q) => q.eq("emailHash", emailHash))
        .unique();
      if (existing) continue;

      await ctx.db.insert("suppressions", {
        emailHash,
        reason,
        createdAt: Date.now(),
        source: `resend:${args.type}`,
      });
      suppressed += 1;
    }

    return { duplicate: false, suppressed };
  },
});
