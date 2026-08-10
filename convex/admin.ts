import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { recordAudit, requireAdmin } from "./authz";
import { buildAdminMetrics } from "../lib/admin-metrics";

const signupStatus = v.union(
  v.literal("new"),
  v.literal("reviewing"),
  v.literal("invited"),
  v.literal("active"),
  v.literal("declined"),
);

/**
 * Platform metrics for the admin dashboard.
 *
 * Every function in this module is gated by `requireAdmin`, which means an
 * authenticated admin *whose current session has completed TOTP step-up* —
 * replacing the previous model where possession of `ADMIN_ACTION_SECRET` was
 * sufficient. The practical difference is accountability: these reads are now
 * attributable to a person, and a leaked environment variable no longer grants
 * platform-wide access.
 *
 * The arithmetic lives in lib/admin-metrics.ts so it can be unit tested against
 * fixed inputs rather than only observed through a live deployment.
 */
export const metrics = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [signups, users, messages, runs, suppressions, interests] = await Promise.all([
      ctx.db.query("interestSignups").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("messages").collect(),
      ctx.db.query("workflowRuns").collect(),
      ctx.db.query("suppressions").collect(),
      ctx.db.query("catalogueInterestSignals").collect(),
    ]);

    return buildAdminMetrics({
      now: Date.now(),
      signups: signups.map((s) => ({
        accountType: s.accountType,
        status: s.status,
        targetRegions: s.targetRegions,
        goals: s.goals,
        createdAt: s.createdAt,
      })),
      users: users.map((u) => ({
        role: u.role,
        investorType: u.investorType,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt,
        suspended: u.suspendedAt !== undefined,
      })),
      messages: messages.map((m) => ({ status: m.status, createdAt: m._creationTime })),
      workflowRuns: runs.map((r) => ({
        status: r.status,
        spentUsd: r.spentUsd,
        budgetUsd: r.budgetUsd,
        createdAt: r.createdAt,
      })),
      suppressionCount: suppressions.length,
      catalogueInterestCount: interests.length,
    });
  },
});

export const listSignups = query({
  args: { status: v.optional(signupStatus), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
      hasAccount: record.userId !== undefined,
    }));
  },
});

export const listUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").take(Math.min(args.limit ?? 100, 200));
    return users.map((user) => ({
      id: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      role: user.role,
      investorType: user.investorType ?? null,
      participantKind: user.participantKind ?? null,
      organizationName: user.organizationName ?? null,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt ?? null,
      suspended: user.suspendedAt !== undefined,
    }));
  },
});

export const updateSignupStatus = mutation({
  args: { signupId: v.id("interestSignups"), status: signupStatus },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const record = await ctx.db.get(args.signupId);
    if (!record) throw new Error("Signup not found");

    const previousStatus = record.status;
    await ctx.db.patch(args.signupId, { status: args.status, updatedAt: Date.now() });
    await recordAudit(ctx, admin._id, {
      action: "signup.status_changed",
      targetType: "interestSignups",
      targetId: args.signupId,
      metadata: { from: previousStatus, to: args.status },
    });

    return { updated: true };
  },
});

export const listAuditLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const entries = await ctx.db
      .query("adminAuditLog")
      .withIndex("by_time")
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));

    return Promise.all(
      entries.map(async (entry) => {
        const actor = await ctx.db.get(entry.actorUserId);
        return {
          id: entry._id,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          metadata: entry.metadata,
          createdAt: entry.createdAt,
          actorEmail: actor?.email ?? null,
        };
      }),
    );
  },
});
