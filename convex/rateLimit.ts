import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

export const DEFAULT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Atomic keyed limiter.
 *
 * Convex mutations are serializable transactions, so read-modify-write on a
 * single key is genuinely atomic here — two simultaneous submissions cannot
 * both observe the same count and both be admitted, which is exactly the race
 * that makes limiter-in-application-code unreliable on most stacks.
 *
 * Keys arrive pre-hashed (see lib/rate-limit-keys.ts) so this table never
 * holds a raw IP address.
 */
export async function consumeRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number = DEFAULT_WINDOW_MS,
): Promise<{ limited: boolean }> {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (query) => query.eq("key", key))
    .unique();

  if (!existing || existing.expiresAt <= now) {
    if (existing) {
      await ctx.db.patch(existing._id, { count: 1, windowStartedAt: now, expiresAt: now + windowMs });
    } else {
      await ctx.db.insert("rateLimits", {
        key,
        count: 1,
        windowStartedAt: now,
        expiresAt: now + windowMs,
      });
    }
    return { limited: false };
  }

  if (existing.count >= limit) return { limited: true };
  await ctx.db.patch(existing._id, { count: existing.count + 1 });
  return { limited: false };
}

export const consume = internalMutation({
  args: { key: v.string(), limit: v.number(), windowMs: v.optional(v.number()) },
  handler: async (ctx, args) => consumeRateLimit(ctx, args.key, args.limit, args.windowMs),
});
