import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { recordAudit, requireAdmin, requireMembership, requireRole } from "./authz";
import type { Id } from "./_generated/dataModel";

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

/* ------------------------------------------------------------------ *
 * Publication lifecycle
 * ------------------------------------------------------------------ *
 *
 * Until this existed, `catalogueListings` was a table nothing could write to:
 * `listPublished` read it, and no mutation anywhere inserted a row. The
 * catalogue was therefore structurally incapable of ever being non-empty, no
 * matter how many founders joined. This is the path that closes that.
 *
 * The lifecycle is deliberately three-state rather than a boolean:
 *
 *   private  →  review  →  listed
 *      ↑____________|__________|
 *
 * A founder controls entry and exit — they draft, they submit, and they can
 * withdraw at any point including after publication. An operator controls only
 * the middle transition, and cannot publish something the founder never
 * submitted. That split matters: publication has to be something the founder
 * *did*, not something that happened to them, because every field here is
 * theirs and some of it is sensitive.
 */

const listingFields = {
  publicContext: v.string(),
  publicStrengths: v.array(v.string()),
  publicConsiderations: v.array(v.string()),
  publicTraction: v.string(),
};

const MAX_TEXT = 2000;
const MAX_BULLETS = 8;
const MAX_BULLET = 240;

function cleanText(value: string): string {
  return value.trim().slice(0, MAX_TEXT);
}

function cleanBullets(values: readonly string[]): string[] {
  return values
    .map((entry) => entry.trim().slice(0, MAX_BULLET))
    .filter(Boolean)
    .slice(0, MAX_BULLETS);
}

/**
 * The caller's own listing, with the profile and organization it belongs to.
 *
 * Returns null rather than throwing when the founder has no organization or no
 * profile yet — those are ordinary early states, and the dashboard renders the
 * step they still need to take.
 */
export const myListing = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["participant"]);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const membership of memberships) {
      const profile = await ctx.db
        .query("startupProfiles")
        .withIndex("by_organization", (q) => q.eq("organizationId", membership.organizationId))
        .first();
      if (!profile) continue;

      const listing = await ctx.db
        .query("catalogueListings")
        .withIndex("by_organization", (q) => q.eq("organizationId", membership.organizationId))
        .first();

      return {
        organizationId: membership.organizationId,
        organizationRole: membership.role,
        startupProfileId: profile._id,
        profileName: profile.name,
        profileStatus: profile.status,
        listing: listing
          ? {
              id: listing._id,
              visibility: listing.visibility,
              publicContext: listing.publicContext,
              publicStrengths: listing.publicStrengths,
              publicConsiderations: listing.publicConsiderations,
              publicTraction: listing.publicTraction,
              approvedAt: listing.approvedAt ?? null,
              updatedAt: listing.updatedAt,
            }
          : null,
      };
    }

    return null;
  },
});

/**
 * Creates or updates the founder's draft listing.
 *
 * Saving always returns the listing to `private`. Editing the text of something
 * currently public, and having the edit go live unreviewed, would make the
 * review step decorative — so an edit to a listed profile takes it down and
 * requires resubmission. Founders are told this in the UI before they save.
 */
export const saveListing = mutation({
  args: { startupProfileId: v.id("startupProfiles"), ...listingFields },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.startupProfileId);
    if (!profile) throw new Error("That profile does not exist");
    const { user } = await requireMembership(ctx, profile.organizationId, ["owner", "reviewer"]);

    const fields = {
      publicContext: cleanText(args.publicContext),
      publicStrengths: cleanBullets(args.publicStrengths),
      publicConsiderations: cleanBullets(args.publicConsiderations),
      publicTraction: cleanText(args.publicTraction),
      updatedAt: Date.now(),
    };
    if (!fields.publicContext) throw new Error("A listing needs its operating context");

    const existing = await ctx.db
      .query("catalogueListings")
      .withIndex("by_organization", (q) => q.eq("organizationId", profile.organizationId))
      .first();

    let listingId;
    if (existing) {
      // Approval does not survive an edit — see the note above.
      await ctx.db.patch(existing._id, {
        ...fields,
        visibility: "private",
        approvedBy: undefined,
        approvedAt: undefined,
      });
      listingId = existing._id;
    } else {
      listingId = await ctx.db.insert("catalogueListings", {
        organizationId: profile.organizationId,
        startupProfileId: profile._id,
        visibility: "private",
        ...fields,
      });
    }

    await ctx.db.insert("auditEvents", {
      organizationId: profile.organizationId,
      actorId: user._id,
      action: existing ? "listing.updated" : "listing.created",
      entityType: "catalogueListing",
      entityId: listingId,
      createdAt: Date.now(),
    });
    return { listingId };
  },
});

/** Founder submits a private draft for operator review. */
export const submitForReview = mutation({
  args: { listingId: v.id("catalogueListings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("That listing does not exist");
    const { user } = await requireMembership(ctx, listing.organizationId, ["owner"]);
    if (listing.visibility === "review") return { visibility: "review" as const };
    if (listing.visibility === "listed") throw new Error("That listing is already published");

    await ctx.db.patch(listing._id, { visibility: "review", updatedAt: Date.now() });
    await ctx.db.insert("auditEvents", {
      organizationId: listing.organizationId,
      actorId: user._id,
      action: "listing.submitted",
      entityType: "catalogueListing",
      entityId: listing._id,
      createdAt: Date.now(),
    });
    return { visibility: "review" as const };
  },
});

/**
 * Founder takes a listing down, from any state.
 *
 * Unconditional and immediate. A founder who wants their company out of a
 * public catalogue should never have to wait on an operator queue to get it
 * out, so this needs no review and cannot be refused.
 */
export const withdraw = mutation({
  args: { listingId: v.id("catalogueListings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("That listing does not exist");
    const { user } = await requireMembership(ctx, listing.organizationId, ["owner"]);

    await ctx.db.patch(listing._id, {
      visibility: "private",
      approvedBy: undefined,
      approvedAt: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditEvents", {
      organizationId: listing.organizationId,
      actorId: user._id,
      action: "listing.withdrawn",
      entityType: "catalogueListing",
      entityId: listing._id,
      createdAt: Date.now(),
    });
    return { visibility: "private" as const };
  },
});

/* ---------------------------- operator review --------------------------- */

export const reviewQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const listings = await ctx.db
      .query("catalogueListings")
      .withIndex("by_visibility", (q) => q.eq("visibility", "review"))
      .collect();

    return Promise.all(
      listings.map(async (listing) => {
        const profile = await ctx.db.get(listing.startupProfileId);
        const organization = await ctx.db.get(listing.organizationId);
        return {
          id: listing._id,
          organizationName: organization?.name ?? null,
          name: profile?.name ?? null,
          website: profile?.website ?? null,
          stage: profile?.stage ?? null,
          region: profile?.region ?? null,
          sectors: profile?.sectors ?? [],
          oneLiner: profile?.oneLiner ?? null,
          publicContext: listing.publicContext,
          publicStrengths: listing.publicStrengths,
          publicConsiderations: listing.publicConsiderations,
          publicTraction: listing.publicTraction,
          updatedAt: listing.updatedAt,
        };
      }),
    );
  },
});

/**
 * Operator approves or rejects a submitted listing.
 *
 * Only `review` is a legal starting state, so an operator cannot reach into a
 * founder's private draft and publish it.
 */
export const decideListing = mutation({
  args: { listingId: v.id("catalogueListings"), approve: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("That listing does not exist");
    if (listing.visibility !== "review") throw new Error("Only a submitted listing can be decided");

    const now = Date.now();
    if (args.approve) {
      await ctx.db.patch(listing._id, {
        visibility: "listed",
        approvedBy: admin._id,
        approvedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(listing._id, { visibility: "private", updatedAt: now });
    }

    await recordAudit(ctx, admin._id, {
      action: args.approve ? "listing.approved" : "listing.rejected",
      targetType: "catalogueListings",
      targetId: listing._id,
      metadata: { reason: args.reason?.trim().slice(0, 500) },
    });
    return { visibility: args.approve ? ("listed" as const) : ("private" as const) };
  },
});

/* ------------------------- the founder's inbox -------------------------- */

/**
 * Interest an investor expressed in the founder's own listings.
 *
 * This is the half of the loop that was missing: `investorInterests` rows were
 * written and then sat there unread, so a founder never learned that anyone had
 * looked. Nothing about the investor is revealed beyond what they chose to
 * attach — their name and note — and only to the founder whose listing it is.
 */
export const myListingInterests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["participant"]);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const rows = [];
    for (const membership of memberships) {
      const listings = await ctx.db
        .query("catalogueListings")
        .withIndex("by_organization", (q) => q.eq("organizationId", membership.organizationId))
        .collect();

      for (const listing of listings) {
        const interests = await ctx.db
          .query("investorInterests")
          .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
          .collect();

        for (const interest of interests) {
          const investor = await ctx.db.get(interest.investorUserId as Id<"users">);
          rows.push({
            id: interest._id,
            status: interest.status,
            note: interest.note ?? null,
            createdAt: interest.createdAt,
            respondedAt: interest.respondedAt ?? null,
            investorName: investor?.name ?? null,
            investorType: investor?.investorType ?? null,
            investorOrganization: investor?.organizationName ?? null,
            // The address is shown only once the founder has accepted, so
            // expressing interest never hands out a contact detail on its own.
            investorEmail: interest.status === "accepted" ? (investor?.email ?? null) : null,
          });
        }
      }
    }

    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Founder accepts or declines an interest signal.
 *
 * Accepting is what releases the investor's email address to the founder, and
 * nothing else in the system does. Declining is silent and reversible only by
 * the investor expressing interest again.
 */
export const respondToInterest = mutation({
  args: { interestId: v.id("investorInterests"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const interest = await ctx.db.get(args.interestId);
    if (!interest) throw new Error("That interest signal does not exist");
    const listing = await ctx.db.get(interest.listingId);
    if (!listing) throw new Error("That listing does not exist");

    const { user } = await requireMembership(ctx, listing.organizationId, ["owner", "reviewer"]);

    await ctx.db.patch(interest._id, {
      status: args.accept ? "accepted" : "declined",
      respondedAt: Date.now(),
    });
    await ctx.db.insert("auditEvents", {
      organizationId: listing.organizationId,
      actorId: user._id,
      action: args.accept ? "interest.accepted" : "interest.declined",
      entityType: "investorInterest",
      entityId: interest._id,
      createdAt: Date.now(),
    });
    return { status: args.accept ? ("accepted" as const) : ("declined" as const) };
  },
});
