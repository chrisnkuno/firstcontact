import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const signupStatus = v.union(
  v.literal("new"),
  v.literal("reviewing"),
  v.literal("invited"),
  v.literal("active"),
  v.literal("declined"),
);

function requireBootstrapSecret(provided: string) {
  const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!expected || provided !== expected) {
    throw new Error("Admin bootstrap is not authorized");
  }
}

// Every function below is only ever called from a Next.js server route (see
// lib/admin-auth.ts), never directly from a browser, but Convex deployment
// URLs are effectively public — so each one is still gated by a server-only
// secret, mirroring signups:submit and catalogue:expressInterest.
function requireAdminSecret(provided: string) {
  const expected = process.env.ADMIN_ACTION_SECRET;
  if (!expected || provided !== expected) {
    throw new Error("Admin action is not authorized");
  }
}

// Creates or resets a single techadmin account. Password hashing (scrypt)
// happens in the calling Next.js route; this mutation only ever stores the
// resulting hash string. Intended to be run once, from an operator's own
// machine, never from a public form.
export const bootstrap = mutation({
  args: {
    bootstrapSecret: v.string(),
    email: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    requireBootstrapSecret(args.bootstrapSecret);

    const now = Date.now();
    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (query) => query.eq("email", email))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { passwordHash: args.passwordHash });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("adminUsers", {
      email,
      passwordHash: args.passwordHash,
      role: "techadmin",
      createdAt: now,
      mfaEnabled: false,
    });
    return { id, created: true };
  },
});

export const getCredentialsByEmail = query({
  args: { adminSecret: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    const email = args.email.trim().toLowerCase();
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (query) => query.eq("email", email))
      .unique();
    if (!admin) return null;
    return { id: admin._id, passwordHash: admin.passwordHash, mfaEnabled: admin.mfaEnabled };
  },
});

export const setMfaSecret = mutation({
  args: { adminSecret: v.string(), adminUserId: v.id("adminUsers"), mfaSecret: v.string() },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    await ctx.db.patch(args.adminUserId, { mfaSecret: args.mfaSecret });
  },
});

export const getMfaSecret = query({
  args: { adminSecret: v.string(), adminUserId: v.id("adminUsers") },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    const admin = await ctx.db.get(args.adminUserId);
    if (!admin) return null;
    return { mfaSecret: admin.mfaSecret ?? null, mfaEnabled: admin.mfaEnabled, email: admin.email };
  },
});

export const enableMfa = mutation({
  args: { adminSecret: v.string(), adminUserId: v.id("adminUsers") },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    await ctx.db.patch(args.adminUserId, { mfaEnabled: true });
  },
});

const MFA_CHALLENGE_WINDOW_MS = 5 * 60 * 1000;

export const createMfaChallenge = mutation({
  args: { adminSecret: v.string(), adminUserId: v.id("adminUsers"), tokenHash: v.string() },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    const now = Date.now();
    await ctx.db.insert("adminMfaChallenges", {
      tokenHash: args.tokenHash,
      adminUserId: args.adminUserId,
      createdAt: now,
      expiresAt: now + MFA_CHALLENGE_WINDOW_MS,
    });
  },
});

// Single-use by design: the challenge is deleted the moment it is read,
// whether or not the accompanying TOTP code turns out to be valid, so a
// leaked/replayed challenge cookie cannot be tried more than once.
export const consumeMfaChallenge = mutation({
  args: { adminSecret: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    const challenge = await ctx.db
      .query("adminMfaChallenges")
      .withIndex("by_token_hash", (query) => query.eq("tokenHash", args.tokenHash))
      .unique();
    if (!challenge) return null;
    await ctx.db.delete(challenge._id);
    if (challenge.expiresAt <= Date.now()) return null;

    const admin = await ctx.db.get(challenge.adminUserId);
    if (!admin) return null;
    return { adminUserId: admin._id, mfaSecret: admin.mfaSecret ?? null };
  },
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Atomic, keyed login-attempt limiter — mirrors signups:submit's
// consumeRateLimit. Called once per login attempt regardless of outcome so a
// string of failures cannot be used to keep probing indefinitely.
export const consumeLoginRateLimit = mutation({
  args: { adminSecret: v.string(), key: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    const now = Date.now();
    const existing = await ctx.db
      .query("adminLoginAttempts")
      .withIndex("by_key", (query) => query.eq("key", args.key))
      .unique();

    if (!existing || existing.expiresAt <= now) {
      if (existing) {
        await ctx.db.patch(existing._id, { count: 1, windowStartedAt: now, expiresAt: now + LOGIN_WINDOW_MS });
      } else {
        await ctx.db.insert("adminLoginAttempts", { key: args.key, count: 1, windowStartedAt: now, expiresAt: now + LOGIN_WINDOW_MS });
      }
      return { limited: false };
    }

    if (existing.count >= args.limit) {
      return { limited: true };
    }
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return { limited: false };
  },
});

export const createSession = mutation({
  args: {
    adminSecret: v.string(),
    adminUserId: v.id("adminUsers"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    const now = Date.now();
    await ctx.db.insert("adminSessions", {
      tokenHash: args.tokenHash,
      adminUserId: args.adminUserId,
      createdAt: now,
      expiresAt: args.expiresAt,
      userAgent: args.userAgent,
    });
    await ctx.db.patch(args.adminUserId, { lastLoginAt: now });
  },
});

export const getSession = query({
  args: { adminSecret: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token_hash", (query) => query.eq("tokenHash", args.tokenHash))
      .unique();
    if (!session || session.expiresAt <= Date.now()) return null;

    const admin = await ctx.db.get(session.adminUserId);
    if (!admin) return null;
    return { adminUserId: admin._id, email: admin.email, expiresAt: session.expiresAt };
  },
});

export const revokeSession = mutation({
  args: { adminSecret: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token_hash", (query) => query.eq("tokenHash", args.tokenHash))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Richer than signups:publicStats (which stays non-PII and public) — this is
// only reachable with ADMIN_ACTION_SECRET, so it may report operationally
// useful breakdowns like status and goals.
export const metrics = query({
  args: { adminSecret: v.string() },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    const signups = await ctx.db.query("interestSignups").collect();
    const now = Date.now();

    const byAccountType = { startup: 0, institution: 0, individual: 0 };
    const byStatus = { new: 0, reviewing: 0, invited: 0, active: 0, declined: 0 };
    const byRegion = { US: 0, UK: 0, EU: 0, APAC: 0 };
    const byGoal: Record<string, number> = {};
    let last7Days = 0;
    let last30Days = 0;

    for (const signup of signups) {
      byAccountType[signup.accountType] += 1;
      byStatus[signup.status] += 1;
      for (const region of signup.targetRegions) byRegion[region] += 1;
      for (const goal of signup.goals) byGoal[goal] = (byGoal[goal] ?? 0) + 1;
      if (now - signup.createdAt <= WEEK_MS) last7Days += 1;
      if (now - signup.createdAt <= MONTH_MS) last30Days += 1;
    }

    return {
      total: signups.length,
      byAccountType,
      byStatus,
      byRegion,
      byGoal,
      last7Days,
      last30Days,
    };
  },
});

export const listSignupsForAdmin = query({
  args: {
    adminSecret: v.string(),
    status: v.optional(signupStatus),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    const records = args.status
      ? await ctx.db
          .query("interestSignups")
          .withIndex("by_status_time", (query) => query.eq("status", args.status!))
          .order("desc")
          .take(limit)
      : await ctx.db.query("interestSignups").order("desc").take(limit);

    return records.map((record) => ({
      id: record._id,
      accountType: record.accountType,
      name: record.name,
      email: record.email,
      location: record.location,
      organizationName: record.organizationName,
      individualRole: record.individualRole,
      stage: record.stage,
      goals: record.goals,
      targetRegions: record.targetRegions,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      submissionCount: record.submissionCount,
    }));
  },
});

export const updateSignupStatus = mutation({
  args: {
    adminSecret: v.string(),
    adminUserId: v.id("adminUsers"),
    signupId: v.id("interestSignups"),
    status: signupStatus,
  },
  handler: async (ctx, args) => {
    requireAdminSecret(args.adminSecret);
    const record = await ctx.db.get(args.signupId);
    if (!record) throw new Error("Signup not found");

    const previousStatus = record.status;
    await ctx.db.patch(args.signupId, { status: args.status, updatedAt: Date.now() });

    await ctx.db.insert("adminAuditLog", {
      adminUserId: args.adminUserId,
      action: "signup.status_changed",
      targetType: "interestSignups",
      targetId: args.signupId,
      metadata: { from: previousStatus, to: args.status },
      createdAt: Date.now(),
    });

    return { updated: true };
  },
});
