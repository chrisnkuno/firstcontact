import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { normalizeAccountEmail, resolveSignupEmail } from "../lib/founder-membership";

// Every function below is only ever called from a Next.js server route, but
// Convex deployment URLs are effectively public — so each one is still
// gated by a server-only secret, mirroring signups:submit and admin.ts. This
// is a deliberately separate secret from ADMIN_ACTION_SECRET: a leak here
// can only ever expose one signup's own already-largely-public record, not
// the full platform.
function requireFounderSecret(provided: string) {
  const expected = process.env.FOUNDER_ACTION_SECRET;
  if (!expected || provided !== expected) {
    throw new Error("Founder action is not authorized");
  }
}

// Creates or resets a founder login for an existing interestSignups email.
// Password hashing (scrypt) happens in the calling Next.js script/route,
// which is the only place Node crypto is available; this mutation only ever
// stores the resulting hash string. Requires a matching interestSignups
// record to already exist — this is a login for someone already in the
// pipeline, never a way to originate a new signup.
export const createAccount = mutation({
  args: {
    founderSecret: v.string(),
    email: v.string(),
    signupEmail: v.optional(v.string()),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    requireFounderSecret(args.founderSecret);
    const email = normalizeAccountEmail(args.email);
    const signupEmail = resolveSignupEmail(email, args.signupEmail);

    const signup = await ctx.db
      .query("interestSignups")
      .withIndex("by_email", (query) => query.eq("email", signupEmail))
      .unique();
    if (!signup) throw new Error("No interestSignups record exists for this email yet");

    const existing = await ctx.db
      .query("founderAccounts")
      .withIndex("by_email", (query) => query.eq("email", email))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        passwordHash: args.passwordHash,
        signupEmail: signupEmail === email ? undefined : signupEmail,
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("founderAccounts", {
      email,
      signupEmail: signupEmail === email ? undefined : signupEmail,
      passwordHash: args.passwordHash,
      createdAt: Date.now(),
    });
    return { id, created: true };
  },
});

export const getCredentialsByEmail = query({
  args: { founderSecret: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    requireFounderSecret(args.founderSecret);
    const email = args.email.trim().toLowerCase();
    const account = await ctx.db
      .query("founderAccounts")
      .withIndex("by_email", (query) => query.eq("email", email))
      .unique();
    if (!account) return null;
    return { id: account._id, passwordHash: account.passwordHash };
  },
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const consumeLoginRateLimit = mutation({
  args: { founderSecret: v.string(), key: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    requireFounderSecret(args.founderSecret);
    const now = Date.now();
    const existing = await ctx.db
      .query("founderLoginAttempts")
      .withIndex("by_key", (query) => query.eq("key", args.key))
      .unique();

    if (!existing || existing.expiresAt <= now) {
      if (existing) {
        await ctx.db.patch(existing._id, { count: 1, windowStartedAt: now, expiresAt: now + LOGIN_WINDOW_MS });
      } else {
        await ctx.db.insert("founderLoginAttempts", {
          key: args.key,
          count: 1,
          windowStartedAt: now,
          expiresAt: now + LOGIN_WINDOW_MS,
        });
      }
      return { limited: false };
    }

    if (existing.count >= args.limit) return { limited: true };
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return { limited: false };
  },
});

export const createSession = mutation({
  args: {
    founderSecret: v.string(),
    founderAccountId: v.id("founderAccounts"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireFounderSecret(args.founderSecret);
    const now = Date.now();
    await ctx.db.insert("founderSessions", {
      tokenHash: args.tokenHash,
      founderAccountId: args.founderAccountId,
      createdAt: now,
      expiresAt: args.expiresAt,
      userAgent: args.userAgent,
    });
    await ctx.db.patch(args.founderAccountId, { lastLoginAt: now });
  },
});

export const getSession = query({
  args: { founderSecret: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    requireFounderSecret(args.founderSecret);
    const session = await ctx.db
      .query("founderSessions")
      .withIndex("by_token_hash", (query) => query.eq("tokenHash", args.tokenHash))
      .unique();
    if (!session || session.expiresAt <= Date.now()) return null;

    const account = await ctx.db.get(session.founderAccountId);
    if (!account) return null;
    return { founderAccountId: account._id, email: account.email, expiresAt: session.expiresAt };
  },
});

export const revokeSession = mutation({
  args: { founderSecret: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    requireFounderSecret(args.founderSecret);
    const session = await ctx.db
      .query("founderSessions")
      .withIndex("by_token_hash", (query) => query.eq("tokenHash", args.tokenHash))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});

// Returns ONLY the caller's own interestSignups fields, matched by the
// founder account's own email — never an id or email supplied by the
// client. This is the entire point of this being a separate, narrow query
// instead of reusing admin:listSignupsForAdmin.
export const getMyStatus = query({
  args: { founderSecret: v.string(), founderAccountId: v.id("founderAccounts") },
  handler: async (ctx, args) => {
    requireFounderSecret(args.founderSecret);
    const account = await ctx.db.get(args.founderAccountId);
    if (!account) return null;

    const signup = await ctx.db
      .query("interestSignups")
      .withIndex("by_email", (query) => query.eq("email", resolveSignupEmail(account.email, account.signupEmail)))
      .unique();
    if (!signup) return null;

    return {
      accountType: signup.accountType,
      name: signup.name,
      organizationName: signup.organizationName,
      website: signup.website,
      location: signup.location,
      stage: signup.stage,
      individualRole: signup.individualRole,
      summary: signup.summary,
      context: signup.context,
      status: signup.status,
      goals: signup.goals,
      targetRegions: signup.targetRegions,
      referralSource: signup.referralSource,
      productUpdates: signup.productUpdates,
      submissionCount: signup.submissionCount,
      createdAt: signup.createdAt,
      updatedAt: signup.updatedAt,
    };
  },
});
