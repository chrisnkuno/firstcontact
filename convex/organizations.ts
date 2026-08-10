import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, requireMembership } from "./authz";

export const create = mutation({
  args: { name: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = args.name.trim();
    const slug = args.slug.trim().toLowerCase();
    if (name.length < 2 || name.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid organization");
    const existing = await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (existing) throw new Error("Organization slug is already in use");
    const organizationId = await ctx.db.insert("organizations", { name, slug, createdBy: user._id, createdAt: Date.now() });
    await ctx.db.insert("memberships", { organizationId, userId: user._id, role: "owner" });
    return { organizationId };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    return Promise.all(memberships.map(async (membership) => ({ membership, organization: await ctx.db.get(membership.organizationId) })));
  },
});

// Members are added by email rather than by user id: an owner knows their
// colleague's address, not an opaque database identifier. The account has to
// exist first — this grants access to an existing account, it does not create
// one, so it can never be used to mint users.
export const addMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("reviewer"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireMembership(ctx, args.organizationId, ["owner"]);

    const email = args.email.trim().toLowerCase();
    const target = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (!target) throw new Error("No account exists for that email yet");

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", target._id),
      )
      .unique();

    if (existing) await ctx.db.patch(existing._id, { role: args.role });
    else await ctx.db.insert("memberships", { organizationId: args.organizationId, userId: target._id, role: args.role });

    await ctx.db.insert("auditEvents", {
      organizationId: args.organizationId,
      actorId: user._id,
      action: existing ? "membership.updated" : "membership.created",
      entityType: "membership",
      entityId: existing?._id ?? target._id,
      metadata: { role: args.role },
      createdAt: Date.now(),
    });
    return { created: !existing };
  },
});
