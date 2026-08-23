import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { recordAudit, requireAdmin, requireUser } from "./authz";
import {
  INVITE_TTL_MS,
  cryptoRandomBytes,
  generateInviteCode,
  normaliseInviteCode,
} from "../lib/invite-code";
import { isParticipantAccountSetupEligible, maskParticipantLabel } from "../lib/domain";

/**
 * Participant invites.
 *
 * Every join-form submission is auto-approved into an invite (see
 * `signups.record`), so this module is what turns "someone filled in the form"
 * into "someone can finish setting up an account". It deliberately does *not*
 * create accounts or set passwords: Convex Auth's `profile()` callback is
 * synchronous — it is invoked without `await` in the Password provider — so no
 * database lookup can happen inside the sign-up flow, and gating account
 * creation on a code is therefore not possible without forking the provider.
 *
 * What redemption actually does is bind an existing account to the intake
 * record it belongs to and advance that record to `active`. Account creation
 * itself remains open, exactly as it was before this feature.
 */

/** The distinct ways redemption can fail, as stable codes the client branches on. */
export const INVITE_ERRORS = {
  unknown: "INVITE_UNKNOWN",
  malformed: "INVITE_MALFORMED",
  expired: "INVITE_EXPIRED",
  revoked: "INVITE_REVOKED",
  alreadyRedeemed: "INVITE_ALREADY_REDEEMED",
  wrongAccount: "INVITE_WRONG_ACCOUNT",
  noEmail: "INVITE_NO_EMAIL",
  passwordAlreadySet: "PASSWORD_ALREADY_SET",
  notParticipant: "NOT_A_PARTICIPANT",
} as const;

/**
 * Issues a code for a signup, or returns the one it already has.
 *
 * A plain helper rather than an `internalMutation` on purpose: `signups.record`
 * is already a mutation, and routing this through `internal` would add an
 * action→mutation edge of exactly the kind that collapses the generated `api`
 * type to `any` across the app.
 *
 * `mode` is the difference between the two callers, and it is load-bearing:
 *
 *   - `"auto"` (the join form) must never override a human decision. If an
 *     operator withdrew the invite, resubmitting the form gets that same
 *     withdrawn record back rather than a fresh working code — otherwise
 *     anyone turned away could let themselves back in by filling the form in
 *     again. A code that merely *expired* is different: nobody decided that,
 *     so a new one is minted.
 *   - `"operator"` (`reissue`) is the human decision, so it overrides.
 */
export async function issueInviteForSignup(
  ctx: MutationCtx,
  signup: { _id: Id<"interestSignups">; email: string },
  now: number,
  mode: "auto" | "operator" = "auto",
): Promise<Doc<"accountInvites">> {
  const existing = await ctx.db
    .query("accountInvites")
    .withIndex("by_signup", (q) => q.eq("signupId", signup._id))
    .order("desc")
    .first();

  if (existing) {
    const live = !existing.redeemedAt && !existing.revokedAt && existing.expiresAt > now;
    if (live) return existing;
    // Redeemed or withdrawn is a settled outcome; only an operator reopens it.
    if (mode === "auto" && (existing.redeemedAt || existing.revokedAt)) return existing;
  }

  const id = await ctx.db.insert("accountInvites", {
    signupId: signup._id,
    email: signup.email.trim().toLowerCase(),
    code: generateInviteCode(cryptoRandomBytes),
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
  });

  const created = await ctx.db.get(id);
  if (!created) throw new Error("Invite disappeared immediately after insert");
  return created;
}

/**
 * Binds the signed-in account to the intake record its code belongs to.
 *
 * The email comparison is the whole security model. A code is matched against
 * the *account's own* address rather than anything the client supplies, so
 * holding a code for someone else's submission achieves nothing.
 */
export const redeem = mutation({
  args: { code: v.string() },
  returns: v.object({ redeemed: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user.email) throw new Error(INVITE_ERRORS.noEmail);

    const code = normaliseInviteCode(args.code);
    if (!code) throw new Error(INVITE_ERRORS.malformed);

    const invite = await ctx.db
      .query("accountInvites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!invite) throw new Error(INVITE_ERRORS.unknown);

    // Ordered most-specific first so the message names the real problem: an
    // already-redeemed code should say so rather than reporting "expired"
    // once its window happens to have closed as well.
    if (invite.redeemedAt) {
      throw new Error(
        invite.redeemedBy === user._id
          ? INVITE_ERRORS.alreadyRedeemed
          : INVITE_ERRORS.wrongAccount,
      );
    }
    if (invite.revokedAt) throw new Error(INVITE_ERRORS.revoked);
    if (invite.expiresAt <= Date.now()) throw new Error(INVITE_ERRORS.expired);
    if (invite.email !== user.email.trim().toLowerCase()) {
      throw new Error(INVITE_ERRORS.wrongAccount);
    }

    const now = Date.now();
    await ctx.db.patch(invite._id, { redeemedAt: now, redeemedBy: user._id });

    const signup = await ctx.db.get(invite.signupId);
    if (signup) {
      // The role is pointedly not touched. Someone who joined as an investor
      // keeps that role; changing what an account *is* stays an admin action,
      // as it is in `users.updateProfile`.
      await ctx.db.patch(signup._id, {
        userId: signup.userId ?? user._id,
        status: "active",
        updatedAt: now,
      });
    }

    return { redeemed: true as const };
  },
});

/**
 * Withdraws an auto-issued invite.
 *
 * This is the operator's half of "auto-approved": entry is granted by default,
 * and taking it back is an explicit, audited act. The row is kept so the
 * pipeline can still show that a code was issued and then withdrawn.
 */
export const revoke = mutation({
  args: { inviteId: v.id("accountInvites") },
  returns: v.object({ revoked: v.literal(true) }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error(INVITE_ERRORS.unknown);
    if (invite.redeemedAt) throw new Error(INVITE_ERRORS.alreadyRedeemed);

    await ctx.db.patch(invite._id, { revokedAt: Date.now() });
    await recordAudit(ctx, admin._id, {
      action: "invite.revoke",
      targetType: "accountInvites",
      targetId: invite._id,
      // The code itself is never written to the audit log: that log is read by
      // more people than the pipeline is, and a revoked code should not be
      // recoverable from it.
      metadata: { signupId: invite.signupId },
    });
    return { revoked: true as const };
  },
});

/**
 * Re-issues a code for a signup whose invite was revoked or has expired.
 *
 * Deliberately admin-only: auto-approval covers the first code, and anything
 * after a withdrawal is a human decision.
 */
export const reissue = mutation({
  args: { signupId: v.id("interestSignups") },
  returns: v.object({ inviteId: v.id("accountInvites") }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const signup = await ctx.db.get(args.signupId);
    if (!signup) throw new Error("No such signup");

    const invite = await issueInviteForSignup(ctx, signup, Date.now(), "operator");
    await recordAudit(ctx, admin._id, {
      action: "invite.reissue",
      targetType: "accountInvites",
      targetId: invite._id,
      metadata: { signupId: signup._id },
    });
    return { inviteId: invite._id };
  },
});

/**
 * Whether the signed-in account still has an intake record to claim.
 *
 * Deliberately says nothing about *which* code would work, and never returns a
 * code: this is a public, merely-authenticated query, and its only job is to
 * decide whether the dashboard shows the redemption panel at all.
 */
export const myStatus = query({
  args: {},
  returns: v.union(
    v.object({ linked: v.literal(true), status: v.union(v.literal("new"), v.literal("reviewing"), v.literal("invited"), v.literal("active"), v.literal("declined")) }),
    v.object({ linked: v.literal(false), status: v.null() }),
  ),
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const linked = await ctx.db
      .query("interestSignups")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (linked) return { linked: true as const, status: linked.status };

    // An account whose address matches an unclaimed submission is exactly the
    // case a code resolves, so the panel is offered. `claimSignupRecord` may
    // well link it first — that is fine, and the panel disappears when it does.
    return { linked: false as const, status: null };
  },
});

const participantChoice = v.object({
  signupId: v.id("interestSignups"),
  displayName: v.string(),
  organizationLabel: v.union(v.string(), v.null()),
  accountType: v.union(v.literal("startup"), v.literal("institution"), v.literal("individual")),
  hasPassword: v.boolean(),
});

/**
 * Public, deliberately narrow participant chooser for the sign-in page.
 *
 * Intake emails, full names, locations and questionnaire answers stay private.
 * The card contains masked labels—only enough for a participant to recognize their own
 * entry, plus whether the next step is first-password setup or normal sign-in.
 * Only invited/active records are eligible; declined and pre-review records
 * never appear.
 */
export const listParticipantChoices = query({
  args: {},
  returns: v.array(participantChoice),
  handler: async (ctx) => {
    const [fresh, reviewing, invited, active] = await Promise.all([
      ctx.db
        .query("interestSignups")
        .withIndex("by_status_time", (q) => q.eq("status", "new"))
        .order("desc")
        .take(30),
      ctx.db
        .query("interestSignups")
        .withIndex("by_status_time", (q) => q.eq("status", "reviewing"))
        .order("desc")
        .take(30),
      ctx.db
        .query("interestSignups")
        .withIndex("by_status_time", (q) => q.eq("status", "invited"))
        .order("desc")
        .take(30),
      ctx.db
        .query("interestSignups")
        .withIndex("by_status_time", (q) => q.eq("status", "active"))
        .order("desc")
        .take(30),
    ]);

    const eligible = [...fresh, ...reviewing, ...invited, ...active]
      .filter(isParticipantAccountSetupEligible)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 60);

    return await Promise.all(
      eligible.map(async (signup) => {
        const account = await ctx.db
          .query("authAccounts")
          .withIndex("providerAndAccountId", (q) =>
            q.eq("provider", "password").eq("providerAccountId", signup.email),
          )
          .unique();
        return {
          signupId: signup._id,
          displayName: maskParticipantLabel(signup.name),
          organizationLabel: signup.organizationName ? maskParticipantLabel(signup.organizationName) : null,
          accountType: signup.accountType,
          hasPassword: Boolean(account?.secret),
        };
      }),
    );
  },
});

/**
 * Unlocks first-password setup with the bearer invite code.
 *
 * The participant email is returned only after the code and selected card
 * match. The browser needs it for Convex Auth's password sign-up call, but it
 * is never present in the public participant list itself.
 */
export const preparePasswordSetup = mutation({
  args: { signupId: v.id("interestSignups"), code: v.string() },
  returns: v.object({
    email: v.string(),
    name: v.string(),
    inviteCode: v.string(),
    participantKind: v.union(v.literal("startup"), v.literal("institution"), v.literal("individual")),
    organizationName: v.union(v.string(), v.null()),
    location: v.string(),
  }),
  handler: async (ctx, args) => {
    const signup = await ctx.db.get(args.signupId);
    if (!signup || !isParticipantAccountSetupEligible(signup)) {
      throw new Error(INVITE_ERRORS.notParticipant);
    }

    const code = normaliseInviteCode(args.code);
    if (!code) throw new Error(INVITE_ERRORS.malformed);
    const invite = await ctx.db
      .query("accountInvites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!invite || invite.signupId !== args.signupId) throw new Error(INVITE_ERRORS.unknown);

    if (invite.redeemedAt) throw new Error(INVITE_ERRORS.alreadyRedeemed);
    if (invite.revokedAt) throw new Error(INVITE_ERRORS.revoked);
    if (invite.expiresAt <= Date.now()) throw new Error(INVITE_ERRORS.expired);

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", signup.email),
      )
      .unique();
    if (account?.secret) throw new Error(INVITE_ERRORS.passwordAlreadySet);

    if (signup.status === "new" || signup.status === "reviewing") {
      await ctx.db.patch(signup._id, { status: "invited", updatedAt: Date.now() });
    }

    return {
      email: signup.email,
      name: signup.name,
      inviteCode: invite.code,
      participantKind: signup.accountType,
      organizationName: signup.organizationName ?? null,
      location: signup.location,
    };
  },
});
