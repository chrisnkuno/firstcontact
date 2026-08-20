import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./authz";

/**
 * Investor-side reads and writes.
 *
 * Scoped by the authenticated user throughout: an investor can see the
 * listings founders published and their own interest signals, and nothing
 * else. There is no query here that returns another investor's pipeline.
 */

export const myActivity = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["investor"]);

    // Keyed on the investor rather than on their organizations: an angel has
    // no firm, and their activity must still be their own.
    const interests = await ctx.db
      .query("investorInterests")
      .withIndex("by_investor_user", (q) => q.eq("investorUserId", user._id))
      .collect();

    const reviewedAt: number[] = [];
    const metAt: number[] = [];

    for (const interest of interests) {
      // Expressing interest is the reviewed signal; the founder accepting it
      // is the first point at which a conversation actually happened.
      reviewedAt.push(interest.createdAt);
      if (interest.status === "accepted") metAt.push(interest.respondedAt ?? interest.createdAt);
    }

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return {
      reviewedAt,
      metAt,
      // Investments are not yet recorded as first-class rows. Returning an
      // empty array is honest; inferring them from accepted introductions
      // would be a fabricated metric.
      investedAt: [] as number[],
      deployedUsd: 0,
      organizationCount: memberships.length,
    };
  },
});

export const myInterests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["investor"]);
    const interests = await ctx.db
      .query("investorInterests")
      .withIndex("by_investor_user", (q) => q.eq("investorUserId", user._id))
      .collect();

    const rows = [];
    for (const interest of interests) {
      const listing = await ctx.db.get(interest.listingId);
      const profile = listing ? await ctx.db.get(listing.startupProfileId) : null;
      rows.push({
        id: interest._id,
        listingId: interest.listingId,
        status: interest.status,
        note: interest.note ?? null,
        createdAt: interest.createdAt,
        respondedAt: interest.respondedAt ?? null,
        name: profile?.name ?? null,
        region: profile?.region ?? null,
        stage: profile?.stage ?? null,
        sectors: profile?.sectors ?? [],
        // Released by the founder accepting, and by nothing else.
        website: interest.status === "accepted" ? (profile?.website ?? null) : null,
      });
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const expressInterest = mutation({
  args: {
    listingId: v.id("catalogueListings"),
    // Optional: an angel investing personally has no organization, and
    // requiring one would have put "create an organization" in front of the
    // single action the investor side exists for. When supplied it is checked.
    organizationId: v.optional(v.id("organizations")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["investor"]);

    if (args.organizationId) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org_user", (q) =>
          q.eq("organizationId", args.organizationId!).eq("userId", user._id),
        )
        .unique();
      if (!membership) throw new Error("You are not a member of that organization");
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing || listing.visibility !== "listed") throw new Error("That listing is not available");

    const note = args.note?.trim().slice(0, 1000) || undefined;

    // Indexed on (listing, user) so re-expressing interest is a cheap point
    // lookup rather than a scan of every investor watching this listing.
    const mine = await ctx.db
      .query("investorInterests")
      .withIndex("by_listing_user", (q) =>
        q.eq("listingId", args.listingId).eq("investorUserId", user._id),
      )
      .unique();

    if (mine) {
      await ctx.db.patch(mine._id, { note });
      return { created: false };
    }

    await ctx.db.insert("investorInterests", {
      listingId: args.listingId,
      investorOrganizationId: args.organizationId,
      investorUserId: user._id,
      note,
      status: "submitted",
      createdAt: Date.now(),
    });
    return { created: true };
  },
});
