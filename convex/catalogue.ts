import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const expressInterest = mutation({
  args: {
    ingestSecret: v.string(),
    profileId: v.string(),
    email: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.SIGNUP_INGEST_SECRET;
    if (!expectedSecret || args.ingestSecret !== expectedSecret) {
      throw new Error("Catalogue interest ingestion is not authorized");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("catalogueInterestSignals")
      .withIndex("by_profile_email", (query) =>
        query.eq("profileId", args.profileId).eq("email", args.email),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { note: args.note, updatedAt: now });
      return { created: false };
    }

    await ctx.db.insert("catalogueInterestSignals", {
      profileId: args.profileId,
      email: args.email,
      note: args.note,
      createdAt: now,
      updatedAt: now,
    });
    return { created: true };
  },
});
