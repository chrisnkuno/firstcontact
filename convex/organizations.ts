import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity, requireMembership } from "./authz";

export const create = mutation({
  args: { name: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const name = args.name.trim();
    const slug = args.slug.trim().toLowerCase();
    if (name.length < 2 || name.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid organization");
    const existing = await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (existing) throw new Error("Organization slug is already in use");
    const organizationId = await ctx.db.insert("organizations", { name, slug, createdBy: identity.tokenIdentifier, createdAt: Date.now() });
    await ctx.db.insert("memberships", { organizationId, userId: identity.tokenIdentifier, role: "owner" });
    return { organizationId };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const memberships = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier)).collect();
    return Promise.all(memberships.map(async (membership) => ({ membership, organization: await ctx.db.get(membership.organizationId) })));
  },
});

export const addMember = mutation({
  args: { organizationId: v.id("organizations"), userId: v.string(), role: v.union(v.literal("owner"), v.literal("reviewer"), v.literal("member")) },
  handler: async (ctx, args) => {
    const { identity } = await requireMembership(ctx, args.organizationId, ["owner"]);
    const userId = args.userId.trim();
    if (!userId || userId.length > 500) throw new Error("Invalid member identity");
    const existing = await ctx.db.query("memberships").withIndex("by_org_user", (q) => q.eq("organizationId", args.organizationId).eq("userId", userId)).unique();
    if (existing) await ctx.db.patch(existing._id, { role: args.role });
    else await ctx.db.insert("memberships", { organizationId: args.organizationId, userId, role: args.role });
    await ctx.db.insert("auditEvents", { organizationId: args.organizationId, actorId: identity.tokenIdentifier, action: existing ? "membership.updated" : "membership.created", entityType: "membership", entityId: existing?._id ?? userId, metadata: { role: args.role }, createdAt: Date.now() });
    return { created: !existing };
  },
});
