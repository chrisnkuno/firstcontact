import { internalMutation } from "./_generated/server";

export const applyRetentionPolicy = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredRateLimits = await ctx.db
      .query("signupRateLimits")
      .withIndex("by_expiry", (query) => query.lt("expiresAt", now))
      .take(500);
    await Promise.all(expiredRateLimits.map((record) => ctx.db.delete(record._id)));

    const expiredAdminSessions = await ctx.db
      .query("adminSessions")
      .withIndex("by_expiry", (query) => query.lt("expiresAt", now))
      .take(500);
    await Promise.all(expiredAdminSessions.map((record) => ctx.db.delete(record._id)));

    const expiredAdminLoginAttempts = await ctx.db
      .query("adminLoginAttempts")
      .withIndex("by_expiry", (query) => query.lt("expiresAt", now))
      .take(500);
    await Promise.all(expiredAdminLoginAttempts.map((record) => ctx.db.delete(record._id)));

    const expiredAdminMfaChallenges = await ctx.db
      .query("adminMfaChallenges")
      .withIndex("by_expiry", (query) => query.lt("expiresAt", now))
      .take(500);
    await Promise.all(expiredAdminMfaChallenges.map((record) => ctx.db.delete(record._id)));

    const expiredFounderSessions = await ctx.db
      .query("founderSessions")
      .withIndex("by_expiry", (query) => query.lt("expiresAt", now))
      .take(500);
    await Promise.all(expiredFounderSessions.map((record) => ctx.db.delete(record._id)));

    const expiredFounderLoginAttempts = await ctx.db
      .query("founderLoginAttempts")
      .withIndex("by_expiry", (query) => query.lt("expiresAt", now))
      .take(500);
    await Promise.all(expiredFounderLoginAttempts.map((record) => ctx.db.delete(record._id)));

    // Intentionally conservative: implement deployment-specific deletion only after
    // the operator documents retention requirements and legal holds.
    return {
      status: "policy_required",
      expiredSignupRateLimitsDeleted: expiredRateLimits.length,
      expiredAdminSessionsDeleted: expiredAdminSessions.length,
      expiredAdminLoginAttemptsDeleted: expiredAdminLoginAttempts.length,
      expiredAdminMfaChallengesDeleted: expiredAdminMfaChallenges.length,
      expiredFounderSessionsDeleted: expiredFounderSessions.length,
      expiredFounderLoginAttemptsDeleted: expiredFounderLoginAttempts.length,
    };
  },
});
