import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  AUTH_ERRORS,
  MFA_STEP_UP_TTL_MS,
  getCurrentUser,
  recordAudit,
  requireAdmin,
  requireAdminForEnrolment,
  requireUser,
} from "./authz";
import { buildOtpauthUri, generateTotpSecret, verifyTotp } from "../lib/totp";
import { authEmailConfigured } from "./authEmail";

const investorType = v.union(
  v.literal("angel"),
  v.literal("syndicate"),
  v.literal("venture"),
  v.literal("corporate"),
  v.literal("family-office"),
  v.literal("development-finance"),
  v.literal("limited-partner"),
  v.literal("accelerator"),
);

const participantKind = v.union(
  v.literal("startup"),
  v.literal("institution"),
  v.literal("individual"),
);

/**
 * What the account system on *this* deployment can actually do.
 *
 * The sign-in form needs this before it can honestly offer "Forgot password?":
 * a deployment with no email provider cannot send a reset code, and a dead
 * link is worse than an absent one. Public and unauthenticated by necessity —
 * it is read on the sign-in screen — and it reveals only which capabilities
 * are switched on, never any credential or provider key.
 */
export const authCapabilities = query({
  args: {},
  handler: async () => {
    const emailConfigured = authEmailConfigured();
    return {
      passwordReset: emailConfigured,
      emailVerification:
        emailConfigured &&
        process.env.REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase() !== "false",
    };
  },
});

export type ViewerMfa = {
  enrolled: boolean;
  enabled: boolean;
  sessionVerified: boolean;
};

/**
 * The signed-in user as the client is allowed to see them.
 *
 * Returns null rather than throwing when signed out, because every layout
 * calls this on first paint and a signed-out visitor is an ordinary state, not
 * an error. The MFA block reports *status only* — never the shared secret.
 */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const mfaRecord = await ctx.db
      .query("userMfa")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const sessionId = await getAuthSessionId(ctx);
    const verification = sessionId
      ? await ctx.db
          .query("sessionMfaVerifications")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .unique()
      : null;

    const mfa: ViewerMfa = {
      enrolled: mfaRecord !== null,
      enabled: mfaRecord?.enabled ?? false,
      sessionVerified: verification !== null && verification.expiresAt > Date.now(),
    };

    return {
      id: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      role: user.role,
      investorType: user.investorType ?? null,
      participantKind: user.participantKind ?? null,
      organizationName: user.organizationName ?? null,
      location: user.location ?? null,
      suspended: user.suspendedAt !== undefined,
      createdAt: user.createdAt,
      mfa,
    };
  },
});

/**
 * Links the signed-in account to the interest signup submitted with the same
 * address before the account existed, and refreshes the "last seen" stamp.
 *
 * Matching on the *account's verified own email* rather than on a client
 * supplied value is what keeps this safe: it can only ever claim a record the
 * caller already proved they control the address for.
 */
export const claimSignupRecord = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { lastSeenAt: Date.now() });
    if (!user.email) return { claimed: false as const };

    const signup = await ctx.db
      .query("interestSignups")
      .withIndex("by_email", (q) => q.eq("email", user.email!))
      .unique();
    if (!signup) return { claimed: false as const };
    if (signup.userId === user._id) return { claimed: true as const };
    if (signup.userId) return { claimed: false as const };

    await ctx.db.patch(signup._id, { userId: user._id, updatedAt: Date.now() });
    return { claimed: true as const };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    organizationName: v.optional(v.string()),
    location: v.optional(v.string()),
    investorType: v.optional(investorType),
    participantKind: v.optional(participantKind),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // The role itself is never editable here — changing what someone *is*
    // requires an admin action, not a profile save.
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name.trim().slice(0, 100) || undefined;
    if (args.organizationName !== undefined) {
      patch.organizationName = args.organizationName.trim().slice(0, 120) || undefined;
    }
    if (args.location !== undefined) patch.location = args.location.trim().slice(0, 120) || undefined;
    if (args.investorType !== undefined && user.role === "investor") {
      patch.investorType = args.investorType;
    }
    if (args.participantKind !== undefined && user.role === "participant") {
      patch.participantKind = args.participantKind;
    }

    await ctx.db.patch(user._id, patch);
    return { updated: true };
  },
});

/* ------------------------------------------------------------------ *
 * Admin provisioning
 * ------------------------------------------------------------------ */

/**
 * Promotes an existing account to admin.
 *
 * Two ways in, and no third: an existing verified admin performs it, or — when
 * the platform has no admin at all — the caller presents `ADMIN_BOOTSTRAP_SECRET`.
 * The bootstrap path self-closes the moment the first admin exists, so the
 * secret cannot be replayed later to mint a second one.
 */
export const promoteToAdmin = mutation({
  args: { email: v.string(), bootstrapSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existingAdmins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .take(1);

    let actorId;
    if (existingAdmins.length === 0) {
      const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
      if (!expected || args.bootstrapSecret !== expected) {
        throw new Error(AUTH_ERRORS.forbidden);
      }
    } else {
      const admin = await requireAdmin(ctx);
      actorId = admin._id;
    }

    const email = args.email.trim().toLowerCase();
    const target = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (!target) throw new Error("No account exists for this email yet");

    await ctx.db.patch(target._id, { role: "admin" });
    await recordAudit(ctx, actorId ?? target._id, {
      action: "user.promoted_to_admin",
      targetType: "users",
      targetId: target._id,
      metadata: { bootstrap: existingAdmins.length === 0 },
    });

    return { promoted: true };
  },
});

export const setSuspended = mutation({
  args: { userId: v.id("users"), suspended: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (args.userId === admin._id) throw new Error("You cannot suspend your own account");

    await ctx.db.patch(args.userId, { suspendedAt: args.suspended ? Date.now() : undefined });
    await recordAudit(ctx, admin._id, {
      action: args.suspended ? "user.suspended" : "user.reinstated",
      targetType: "users",
      targetId: args.userId,
    });
    return { suspended: args.suspended };
  },
});

/* ------------------------------------------------------------------ *
 * TOTP multi-factor authentication
 * ------------------------------------------------------------------ */

/**
 * Starts (or restarts) enrolment and returns the provisioning URI.
 *
 * The secret is returned exactly once, here, because the authenticator app has
 * to receive it somehow. It stays `enabled: false` until `confirmMfa` proves
 * the app actually holds it — so an abandoned enrolment can never lock an
 * admin out, and a half-finished one never counts as a second factor.
 */
export const startMfaEnrolment = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdminForEnrolment(ctx);

    const existing = await ctx.db
      .query("userMfa")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (existing?.enabled) throw new Error("Multi-factor authentication is already enabled");

    const secret = generateTotpSecret();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { secret, enabled: false, updatedAt: now });
    } else {
      await ctx.db.insert("userMfa", { userId: user._id, secret, enabled: false, updatedAt: now });
    }

    return {
      secret,
      otpauthUri: buildOtpauthUri({
        secret,
        email: user.email ?? "admin",
        issuer: "FirstContact",
      }),
    };
  },
});

export const confirmMfa = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAdminForEnrolment(ctx);

    const record = await ctx.db
      .query("userMfa")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!record) throw new Error(AUTH_ERRORS.mfaNotEnrolled);

    if (!(await verifyTotp(record.secret, args.code))) {
      throw new Error("That code did not match. Check your authenticator and try again.");
    }

    const now = Date.now();
    await ctx.db.patch(record._id, { enabled: true, confirmedAt: now, updatedAt: now });

    // Confirming enrolment also satisfies step-up for the session that did it,
    // so the admin is not immediately asked for a second code they just typed.
    await writeSessionVerification(ctx, user._id, now);
    await recordAudit(ctx, user._id, {
      action: "mfa.enabled",
      targetType: "users",
      targetId: user._id,
    });

    return { enabled: true };
  },
});

/** Step-up: exchanges a valid TOTP code for a time-boxed privileged session. */
export const verifyMfa = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAdminForEnrolment(ctx);

    const record = await ctx.db
      .query("userMfa")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!record || !record.enabled) throw new Error(AUTH_ERRORS.mfaNotEnrolled);

    if (!(await verifyTotp(record.secret, args.code))) {
      throw new Error("That code did not match. Check your authenticator and try again.");
    }

    await writeSessionVerification(ctx, user._id, Date.now());
    return { verified: true };
  },
});

async function writeSessionVerification(ctx: MutationCtx, userId: Id<"users">, now: number) {
  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId) throw new Error(AUTH_ERRORS.unauthenticated);

  const existing = await ctx.db
    .query("sessionMfaVerifications")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();

  const fields = { verifiedAt: now, expiresAt: now + MFA_STEP_UP_TTL_MS };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
  } else {
    await ctx.db.insert("sessionMfaVerifications", { sessionId, userId, ...fields });
  }
}

/**
 * Drops the current session's step-up without signing out.
 *
 * Useful when stepping away from a shared machine: the admin stays signed in
 * but privileged reads require the authenticator again.
 */
export const endMfaStepUp = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error(AUTH_ERRORS.unauthenticated);
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) return { ended: false };

    const existing = await ctx.db
      .query("sessionMfaVerifications")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { ended: true };
  },
});

/**
 * The signed-in user's own interest-form submission, for prefilling the
 * workspace.
 *
 * Scoped to the caller's verified address exactly like `claimSignupRecord`, so
 * this can only ever return a record the caller proved they control. It exists
 * because a founder who already wrote a two-thousand character pitch into the
 * public form should not have to type it a second time to be listed — that
 * friction, not a missing feature, is why the catalogue stays empty while the
 * pipeline fills up.
 *
 * Returned as a *draft to review*, never as an accepted answer: prefilling a
 * form is not consent to publish. The listing still starts private and still
 * needs the founder to submit it.
 */
export const mySignupDraft = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user?.email) return null;

    const signup = await ctx.db
      .query("interestSignups")
      .withIndex("by_email", (q) => q.eq("email", user.email!))
      .unique();
    if (!signup) return null;

    return {
      organizationName: signup.organizationName ?? "",
      website: signup.website ?? "",
      location: signup.location ?? "",
      stage: signup.stage ?? "",
      targetRegions: signup.targetRegions ?? [],
      // The two long-form fields, which are the ones actually worth carrying.
      oneLiner: signup.summary ?? "",
      founderContext: signup.context ?? "",
    };
  },
});
