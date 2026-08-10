import { internalMutation } from "./_generated/server";

/**
 * Scheduled cleanup of expired, non-durable rows.
 *
 * Convex Auth manages the lifetime of its own session, refresh-token and
 * verification-code tables, so this only sweeps what this application owns:
 * the public rate limiter and the MFA step-up records.
 *
 * Everything with evidentiary value — audit log, webhook events, suppressions —
 * is deliberately untouched. A suppression in particular must outlive any
 * retention sweep, since deleting one silently re-permits contacting someone
 * who asked not to be contacted.
 */
export const applyRetentionPolicy = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const expiredRateLimits = await ctx.db
      .query("rateLimits")
      .withIndex("by_expiry", (query) => query.lt("expiresAt", now))
      .take(500);
    await Promise.all(expiredRateLimits.map((record) => ctx.db.delete(record._id)));

    const expiredStepUps = await ctx.db
      .query("sessionMfaVerifications")
      .withIndex("by_expiry", (query) => query.lt("expiresAt", now))
      .take(500);
    await Promise.all(expiredStepUps.map((record) => ctx.db.delete(record._id)));

    // Intentionally conservative: implement deployment-specific deletion of
    // personal data only after the operator documents retention requirements
    // and legal holds.
    return {
      status: "policy_required",
      expiredRateLimitsDeleted: expiredRateLimits.length,
      expiredStepUpsDeleted: expiredStepUps.length,
    };
  },
});
