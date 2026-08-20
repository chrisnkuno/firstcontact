import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

/**
 * Scheduled cleanup.
 *
 * Convex Auth manages the lifetime of its own session, refresh-token and
 * verification-code tables, so this sweeps what this application owns: the
 * public rate limiter, MFA step-up records, resolved error rows, and — new —
 * unsuccessful signup records that have passed their retention period.
 *
 * Everything with evidentiary value is deliberately untouched. The audit log,
 * webhook events and above all **suppressions** outlive every sweep: deleting a
 * suppression silently re-permits contacting someone who asked not to be
 * contacted, which is the single worst thing a retention job could do.
 */

/**
 * How long an unsuccessful signup is kept after last contact.
 *
 * 24 months is the operator's documented decision (see
 * `docs/DATA_PROTECTION.md`), chosen for a fundraising cycle that moves slowly
 * enough that a founder may reasonably re-engage a year later. Overridable per
 * deployment because it is a legal decision, not a technical constant, and a
 * fork operating under a different regime will reach a different answer.
 */
const DEFAULT_SIGNUP_RETENTION_MONTHS = 24;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Resolved errors are diagnostics, not records; they expire quickly. */
const RESOLVED_ERROR_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Bounded per run so one sweep cannot exceed a transaction budget. */
const BATCH = 200;

function retentionMonths(): number {
  const raw = Number(process.env.SIGNUP_RETENTION_MONTHS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_SIGNUP_RETENTION_MONTHS;
  return Math.min(raw, 120);
}

/**
 * Statuses that represent a relationship which did not proceed.
 *
 * `invited` and `active` are deliberately excluded: those are ongoing
 * relationships, and deleting one would destroy the record of a person the
 * platform is actually working with. Retention applies to the unsuccessful.
 */
const EXPIRING_STATUSES = ["new", "reviewing", "declined"] as const;

async function expireSignups(ctx: MutationCtx, now: number) {
  const cutoff = now - retentionMonths() * MONTH_MS;
  let deleted = 0;

  for (const status of EXPIRING_STATUSES) {
    // `createdAt < cutoff` is a safe superset of `updatedAt < cutoff`, since a
    // record cannot be updated before it was created — so the index does the
    // coarse work and the explicit check below decides.
    const candidates = await ctx.db
      .query("interestSignups")
      .withIndex("by_status_time", (q) => q.eq("status", status).lt("createdAt", cutoff))
      .take(BATCH);

    for (const record of candidates) {
      // Last contact, not creation: a conversation two months ago resets it.
      if (record.updatedAt >= cutoff) continue;
      // An account holder is not an unsuccessful signup. Deleting their intake
      // record would strand a live account against nothing.
      if (record.userId) continue;

      await ctx.db.delete(record._id);
      deleted += 1;
    }
  }

  return deleted;
}

async function expireResolvedErrors(ctx: MutationCtx, now: number) {
  const rows = await ctx.db
    .query("errorEvents")
    .withIndex("by_last_seen", (q) => q.lt("lastSeenAt", now - RESOLVED_ERROR_RETENTION_MS))
    .take(BATCH);

  let deleted = 0;
  for (const row of rows) {
    if (row.resolvedAt === undefined) continue;
    await ctx.db.delete(row._id);
    deleted += 1;
  }
  return deleted;
}

async function stamp(ctx: MutationCtx, key: string, numberValue: number) {
  const existing = await ctx.db
    .query("operationalState")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (existing) await ctx.db.patch(existing._id, { numberValue, updatedAt: Date.now() });
  else await ctx.db.insert("operationalState", { key, numberValue, updatedAt: Date.now() });
}

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

    const signupsDeleted = await expireSignups(ctx, now);
    const errorsDeleted = await expireResolvedErrors(ctx, now);

    // Counts only. Recording *which* records were deleted would recreate the
    // personal data the sweep just removed, in a table that is never swept.
    await stamp(ctx, "retention.lastRunAt", now);
    await stamp(ctx, "retention.lastSignupsDeleted", signupsDeleted);

    return {
      status: "applied",
      retentionMonths: retentionMonths(),
      expiredRateLimitsDeleted: expiredRateLimits.length,
      expiredStepUpsDeleted: expiredStepUps.length,
      signupsDeleted,
      resolvedErrorsDeleted: errorsDeleted,
    };
  },
});
