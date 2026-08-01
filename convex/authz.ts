import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type OrganizationRole = "owner" | "reviewer" | "member";
type AuthzCtx = QueryCtx | MutationCtx;

export async function requireIdentity(ctx: AuthzCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Authentication required");
  return identity;
}

export async function requireMembership(
  ctx: AuthzCtx,
  organizationId: Id<"organizations">,
  allowedRoles: readonly OrganizationRole[] = ["owner", "reviewer", "member"],
) {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (query) => query.eq("organizationId", organizationId).eq("userId", identity.tokenIdentifier))
    .unique();
  if (!membership || !allowedRoles.includes(membership.role)) throw new Error("Organization access denied");
  return { identity, membership };
}
