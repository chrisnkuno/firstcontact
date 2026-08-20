import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getCurrentUser, recordAudit, requireAdmin } from "./authz";
import { fingerprint, normalizeRoute, redact } from "../lib/redaction";
import { describeFailures, emailProviders, sendEmail } from "./providers";

/**
 * Error capture and alerting.
 *
 * The gap this closes: a production failure was previously discovered by a user
 * reporting it. There is no server to tail on a static export, and Convex's own
 * function logs are only visible to someone already looking at the dashboard —
 * neither tells an operator that something broke five minutes ago.
 *
 * Three deliberate constraints shape what follows.
 *
 * 1. **Redaction happens before storage**, in `lib/redaction.ts`. An error
 *    report is the most likely place for personal data to leak into a system
 *    that was otherwise careful with it.
 * 2. **Reports are aggregated by fingerprint**, so this is a list of problems,
 *    not a log. A repeat increments a counter.
 * 3. **The report endpoint is unauthenticated but bounded.** It has to be:
 *    errors on the public catalogue and the sign-in screen are exactly the ones
 *    worth knowing about, and those callers have no session. The bounds below
 *    are what make that safe.
 */

/**
 * How many *distinct* problems may be created in one window.
 *
 * The abuse shape this defends against is specific: because repeats collapse
 * into an existing row, flooding the table requires a flood of *different*
 * fingerprints. Beyond this ceiling new fingerprints are dropped while existing
 * ones still increment — so a genuine incident continues to be counted
 * accurately even while someone is trying to bury it.
 */
const NEW_FINGERPRINTS_PER_WINDOW = 40;
const FINGERPRINT_WINDOW_MS = 60 * 60 * 1000;

const NEW_FINGERPRINT_COUNTER = "errors.newFingerprints";
const NEW_FINGERPRINT_WINDOW = "errors.newFingerprintWindowStartedAt";
const LAST_ALERT_AT = "errors.lastAlertAt";

/** Minimum gap between alert emails, so an incident cannot become a mail storm. */
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/** New distinct problems in the last hour that constitute "something is wrong". */
const ALERT_THRESHOLD = 3;

async function readState(ctx: QueryCtx | MutationCtx, key: string) {
  return ctx.db
    .query("operationalState")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

async function writeState(ctx: MutationCtx, key: string, numberValue: number) {
  const existing = await readState(ctx, key);
  if (existing) await ctx.db.patch(existing._id, { numberValue, updatedAt: Date.now() });
  else await ctx.db.insert("operationalState", { key, numberValue, updatedAt: Date.now() });
}

/**
 * Records a client-side error.
 *
 * Callable without a session on purpose — see the note above. The role, when
 * there is one, is read from the *authenticated identity*, never from the
 * request body, so a caller cannot attribute their report to someone else.
 */
export const reportClientError = mutation({
  args: {
    message: v.string(),
    route: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = redact(args.message);
    const route = normalizeRoute(args.route);
    const print = fingerprint("client", message, route);
    const now = Date.now();

    const existing = await ctx.db
      .query("errorEvents")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", print))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
        lastSeenAt: now,
        // A problem seen again after being marked resolved is not resolved.
        resolvedAt: undefined,
        resolvedBy: undefined,
      });
      return { recorded: true as const };
    }

    // Ceiling on *new* fingerprints only.
    const windowStart = await readState(ctx, NEW_FINGERPRINT_WINDOW);
    const counter = await readState(ctx, NEW_FINGERPRINT_COUNTER);
    const startedAt = windowStart?.numberValue ?? 0;
    const withinWindow = now - startedAt < FINGERPRINT_WINDOW_MS;
    const used = withinWindow ? (counter?.numberValue ?? 0) : 0;

    if (withinWindow && used >= NEW_FINGERPRINTS_PER_WINDOW) {
      return { recorded: false as const, reason: "rate_limited" as const };
    }

    if (!withinWindow) await writeState(ctx, NEW_FINGERPRINT_WINDOW, now);
    await writeState(ctx, NEW_FINGERPRINT_COUNTER, used + 1);

    const user = await getCurrentUser(ctx);
    await ctx.db.insert("errorEvents", {
      fingerprint: print,
      source: "client",
      message,
      route,
      actorRole: user?.role,
      count: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    });
    return { recorded: true as const };
  },
});

/** Server-side capture, for Convex actions that want to record a failure. */
export const recordServerError = internalMutation({
  args: {
    message: v.string(),
    source: v.union(v.literal("convex"), v.literal("worker")),
    route: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = redact(args.message);
    const route = normalizeRoute(args.route);
    const print = fingerprint(args.source, message, route);
    const now = Date.now();

    const existing = await ctx.db
      .query("errorEvents")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", print))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
        lastSeenAt: now,
        resolvedAt: undefined,
        resolvedBy: undefined,
      });
      return { recorded: true };
    }

    await ctx.db.insert("errorEvents", {
      fingerprint: print,
      source: args.source,
      message,
      route,
      count: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    });
    return { recorded: true };
  },
});

/* ------------------------------- operator ------------------------------- */

export const listErrors = query({
  args: { includeResolved: v.optional(v.boolean()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    const rows = await ctx.db
      .query("errorEvents")
      .withIndex("by_last_seen")
      .order("desc")
      .take(limit * 2);

    return rows
      .filter((row) => (args.includeResolved ? true : row.resolvedAt === undefined))
      .slice(0, limit)
      .map((row) => ({
        id: row._id,
        source: row.source,
        message: row.message,
        route: row.route,
        actorRole: row.actorRole ?? null,
        count: row.count,
        firstSeenAt: row.firstSeenAt,
        lastSeenAt: row.lastSeenAt,
        resolvedAt: row.resolvedAt ?? null,
      }));
  },
});

/** Headline numbers for the operator dashboard and for the alert cron. */
export const errorSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return summarize(ctx);
  },
});

async function summarize(ctx: QueryCtx | MutationCtx) {
  const now = Date.now();
  const rows = await ctx.db
    .query("errorEvents")
    .withIndex("by_last_seen", (q) => q.gt("lastSeenAt", now - 24 * 60 * 60 * 1000))
    .collect();

  let lastHourProblems = 0;
  let lastHourOccurrences = 0;
  let unresolved = 0;

  for (const row of rows) {
    if (row.resolvedAt === undefined) unresolved += 1;
    if (row.lastSeenAt > now - 60 * 60 * 1000) {
      lastHourProblems += 1;
      lastHourOccurrences += row.count;
    }
  }

  return {
    last24hProblems: rows.length,
    lastHourProblems,
    lastHourOccurrences,
    unresolved,
  };
}

export const resolveError = mutation({
  args: { errorId: v.id("errorEvents"), resolved: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const row = await ctx.db.get(args.errorId);
    if (!row) throw new Error("That error does not exist");

    await ctx.db.patch(args.errorId, {
      resolvedAt: args.resolved ? Date.now() : undefined,
      resolvedBy: args.resolved ? admin._id : undefined,
    });
    await recordAudit(ctx, admin._id, {
      action: args.resolved ? "error.resolved" : "error.reopened",
      targetType: "errorEvents",
      targetId: args.errorId,
    });
    return { resolved: args.resolved };
  },
});

/* -------------------------------- alerting ------------------------------- */

/** Read by the cron. Internal so the threshold logic is not a public query. */
export const alertCheck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const summary = await summarize(ctx);
    const now = Date.now();

    if (summary.lastHourProblems < ALERT_THRESHOLD) {
      return { alert: false as const, reason: "below_threshold" as const, summary };
    }

    const lastAlert = await readState(ctx, LAST_ALERT_AT);
    if (lastAlert?.numberValue && now - lastAlert.numberValue < ALERT_COOLDOWN_MS) {
      return { alert: false as const, reason: "cooling_down" as const, summary };
    }

    // Stamped before the send rather than after: a send that fails should not
    // license a retry every minute, and the failure is itself recorded.
    await writeState(ctx, LAST_ALERT_AT, now);
    return { alert: true as const, reason: "threshold_exceeded" as const, summary };
  },
});

/**
 * Hourly alert.
 *
 * Deliberately email over the ordinary provider chain rather than a dedicated
 * paging vendor: this project already has a working, multi-provider email path,
 * and an alert nobody configured is worth less than one that arrives wherever
 * the operator already reads mail. Like password reset, it is transactional and
 * is not gated by `OUTBOUND_EMAIL_ENABLED`, which governs outreach — an
 * operational alert is not marketing.
 *
 * Silent when `ALERT_EMAIL` is unset, because a deployment with no operator
 * address is not one this can usefully page.
 */
export const sendAlerts = internalAction({
  args: {},
  // The return type is annotated rather than inferred because this action
  // calls two mutations in its own module through `internal`. Without the
  // annotation TypeScript has to resolve the module's api type to infer this
  // handler, and that type depends on this handler — a cycle that silently
  // degrades the entire generated `api` to `any`, taking every component's
  // Convex types down with it.
  handler: async (ctx): Promise<{ sent: boolean; reason?: string }> => {
    const to = process.env.ALERT_EMAIL?.trim();
    if (!to) return { sent: false, reason: "no_alert_email" };

    const decision = await ctx.runMutation(internal.observability.alertCheck, {});
    if (!decision.alert) return { sent: false, reason: decision.reason };

    const providers = emailProviders();
    if (providers.length === 0) return { sent: false, reason: "no_email_provider" };

    const { summary } = decision;
    const result = await sendEmail(providers, {
      to,
      subject: `FirstContact: ${summary.lastHourProblems} distinct errors in the last hour`,
      text: [
        "An error threshold was crossed on your FirstContact deployment.",
        "",
        `Distinct problems in the last hour: ${summary.lastHourProblems}`,
        `Total occurrences in the last hour: ${summary.lastHourOccurrences}`,
        `Distinct problems in the last 24 hours: ${summary.last24hProblems}`,
        `Unresolved problems: ${summary.unresolved}`,
        "",
        "Open /admin/errors for the redacted detail.",
        "",
        "No further alert will be sent for at least an hour.",
      ].join("\n"),
      idempotencyKey: `alert:${Math.floor(Date.now() / ALERT_COOLDOWN_MS)}`,
    });

    if (!result.ok) {
      // An alert that could not be delivered is itself an incident worth a row.
      await ctx.runMutation(internal.observability.recordServerError, {
        source: "convex",
        message: `Alert delivery failed: ${describeFailures(result.failures)}`,
        route: "/cron/alerts",
      });
      return { sent: false, reason: "send_failed" };
    }

    return { sent: true };
  },
});
