import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { AccountRole } from "../lib/domain";

export type OrganizationRole = "owner" | "reviewer" | "member";
type AuthzCtx = QueryCtx | MutationCtx;

/**
 * Error codes thrown by these helpers.
 *
 * They are stable strings rather than prose because the client branches on
 * them — `MFA_REQUIRED` sends an admin to the step-up screen instead of
 * showing a dead end, and `SUSPENDED` gets its own explanation. Convex
 * surfaces the message to the caller, so nothing here may contain detail that
 * an unauthenticated caller should not learn.
 */
export const AUTH_ERRORS = {
  unauthenticated: "UNAUTHENTICATED",
  suspended: "SUSPENDED",
  forbidden: "FORBIDDEN",
  mfaRequired: "MFA_REQUIRED",
  mfaNotEnrolled: "MFA_NOT_ENROLLED",
} as const;

/** The authenticated user, or null. Never throws — for "am I signed in" reads. */
export async function getCurrentUser(ctx: AuthzCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return ctx.db.get(userId);
}

/**
 * The authenticated, non-suspended user.
 *
 * Suspension is enforced here rather than at sign-in so that revoking access
 * takes effect on the very next request, instead of whenever the user's
 * existing session happens to expire.
 */
export async function requireUser(ctx: AuthzCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error(AUTH_ERRORS.unauthenticated);
  if (user.suspendedAt) throw new Error(AUTH_ERRORS.suspended);
  return user;
}

export async function requireRole(
  ctx: AuthzCtx,
  allowedRoles: readonly AccountRole[],
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!allowedRoles.includes(user.role)) throw new Error(AUTH_ERRORS.forbidden);
  return user;
}

/** How long one TOTP step-up keeps an admin session privileged. */
export const MFA_STEP_UP_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * An admin whose *current session* has completed TOTP step-up.
 *
 * Being an admin is not sufficient on its own. A stolen refresh token yields a
 * signed-in session but not a verified one, so every privileged read and write
 * behind this helper additionally requires possession of the authenticator.
 * MFA enrolment is mandatory for the role, so an admin who has not enrolled is
 * refused here and routed to enrolment by the `MFA_NOT_ENROLLED` code — the
 * enrolment functions themselves use `requireAdminForEnrolment` instead, which
 * is the only way to break the chicken-and-egg.
 */
export async function requireAdmin(ctx: AuthzCtx): Promise<Doc<"users">> {
  const user = await requireRole(ctx, ["admin"]);

  const mfa = await ctx.db
    .query("userMfa")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();
  if (!mfa || !mfa.enabled) throw new Error(AUTH_ERRORS.mfaNotEnrolled);

  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId) throw new Error(AUTH_ERRORS.unauthenticated);

  const verification = await ctx.db
    .query("sessionMfaVerifications")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
  if (!verification || verification.expiresAt <= Date.now()) {
    throw new Error(AUTH_ERRORS.mfaRequired);
  }

  return user;
}

/**
 * An admin who may still be mid-enrolment.
 *
 * Deliberately narrower in what it protects: only the MFA setup and confirm
 * functions may use it, and neither of those can read platform data or change
 * anyone else's account.
 */
export async function requireAdminForEnrolment(ctx: AuthzCtx): Promise<Doc<"users">> {
  return requireRole(ctx, ["admin"]);
}

export async function requireMembership(
  ctx: AuthzCtx,
  organizationId: Id<"organizations">,
  allowedRoles: readonly OrganizationRole[] = ["owner", "reviewer", "member"],
) {
  const user = await requireUser(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (query) =>
      query.eq("organizationId", organizationId).eq("userId", user._id),
    )
    .unique();
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new Error(AUTH_ERRORS.forbidden);
  }
  return { user, membership };
}

/** Records a privileged action against the acting user. */
export async function recordAudit(
  ctx: MutationCtx,
  actorUserId: Id<"users">,
  entry: { action: string; targetType: string; targetId: string; metadata?: unknown },
) {
  await ctx.db.insert("adminAuditLog", {
    actorUserId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata,
    createdAt: Date.now(),
  });
}
