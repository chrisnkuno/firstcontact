import { internalMutation } from "./_generated/server";

/**
 * One-off migrations, run by an operator against a specific deployment.
 *
 * Internal, so nothing here is reachable from a browser. Each migration is
 * written to be **idempotent**: re-running it after a partial failure must not
 * duplicate or lose rows, because the failure mode of a migration you are
 * afraid to re-run is far worse than the failure it was fixing.
 */

/**
 * Moves pre-Convex-Auth audit rows out of `adminAuditLog`.
 *
 * The old rows carry `adminUserId: Id<"adminUsers">`; the new schema requires
 * `actorUserId: Id<"users">`. Those cannot be reconciled — the old admin
 * identity does not exist in the new `users` table and will not until that
 * person registers again — so the history is copied verbatim into
 * `legacyAdminAuditLog`, where the actor is an opaque string, and removed from
 * the table whose shape changed.
 *
 * Deleting the rows instead would have been one line, and would have quietly
 * destroyed the only record of who changed which founder's pipeline status.
 */
export const archiveLegacyAuditLog = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Reads through the untyped escape hatch on purpose: these documents no
    // longer match the declared schema, which is the entire reason they need
    // moving.
    const rows = await ctx.db.query("adminAuditLog").collect();
    const now = Date.now();

    let archived = 0;
    for (const row of rows) {
      const legacy = row as unknown as {
        _id: typeof row._id;
        adminUserId?: string;
        actorUserId?: string;
        action: string;
        targetType: string;
        targetId: string;
        metadata?: unknown;
        createdAt: number;
      };

      // Rows already in the new shape are left alone, so a re-run after a
      // partial failure cannot archive fresh audit entries.
      if (legacy.adminUserId === undefined) continue;

      await ctx.db.insert("legacyAdminAuditLog", {
        actorRef: legacy.adminUserId,
        action: legacy.action,
        targetType: legacy.targetType,
        targetId: legacy.targetId,
        metadata: legacy.metadata,
        createdAt: legacy.createdAt,
        migratedAt: now,
      });
      await ctx.db.delete(row._id);
      archived += 1;
    }

    return { archived, remaining: rows.length - archived };
  },
});
