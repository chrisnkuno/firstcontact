import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Internal for the same reason as signups:record — the public path is the
// rate-limited, origin-checked HTTP action in convex/publicRoutes.ts.
export const recordInterest = internalMutation({
  args: { profileId: v.string(), email: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
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

// Aggregate, non-PII counts only — the investor-side mirror of
// signups:publicStats. Never return emails, notes, or profile-level detail
// from this query; it backs a public "real data" scorecard.
export const publicStats = query({
  args: {},
  handler: async (ctx) => {
    const signals = await ctx.db.query("catalogueInterestSignals").collect();
    const now = Date.now();

    const uniqueProfiles = new Set<string>();
    let last7Days = 0;
    let latestCreatedAt: number | null = null;

    for (const signal of signals) {
      uniqueProfiles.add(signal.profileId);
      if (now - signal.createdAt <= WEEK_MS) last7Days += 1;
      if (latestCreatedAt === null || signal.createdAt > latestCreatedAt) {
        latestCreatedAt = signal.createdAt;
      }
    }

    return {
      totalSignals: signals.length,
      uniqueProfiles: uniqueProfiles.size,
      last7Days,
      latestCreatedAt,
    };
  },
});

/**
 * Listings a signed-in investor may browse.
 *
 * Only `listed` visibility is ever returned, and only the fields a founder
 * explicitly approved for publication — the private intake record behind a
 * listing is never reachable from here.
 */
export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db
      .query("catalogueListings")
      .withIndex("by_visibility", (q) => q.eq("visibility", "listed"))
      .collect();

    return Promise.all(
      listings.map(async (listing) => {
        const profile = await ctx.db.get(listing.startupProfileId);
        return {
          id: listing._id,
          publicContext: listing.publicContext,
          publicStrengths: listing.publicStrengths,
          publicConsiderations: listing.publicConsiderations,
          publicTraction: listing.publicTraction,
          updatedAt: listing.updatedAt,
          name: profile?.name ?? null,
          location: profile?.location ?? null,
          region: profile?.region ?? null,
          stage: profile?.stage ?? null,
          sectors: profile?.sectors ?? [],
          oneLiner: profile?.oneLiner ?? null,
          raiseAmountUsd: profile?.raiseAmountUsd ?? null,
        };
      }),
    );
  },
});
