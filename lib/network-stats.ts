import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export type NetworkStats = {
  total: number;
  byAccountType: { startup: number; institution: number; individual: number };
  byRegion: { US: number; UK: number; EU: number; APAC: number };
  last7Days: number;
  latestCreatedAt: number | null;
};

export type NetworkStatsResult =
  | { configured: true; stats: NetworkStats }
  | { configured: false; stats: null };

const publicStats = makeFunctionReference<"query", Record<string, never>, NetworkStats>(
  "signups:publicStats",
);

/**
 * Width, as a CSS percentage, of one region's bar on the homepage signal
 * section.
 *
 * This lives here rather than inline in the bar markup because the inline
 * version applied the share twice — the percentage sized the track element,
 * and a `width: inherit` pseudo-element then took that same percentage *of the
 * track* — so every bar rendered at its share squared (a 50% region drew at
 * 25%). Keeping it as one tested function makes that class of bug reproducible.
 *
 * A non-zero region is floored at `minimumVisible` so "1 signup out of 400"
 * reads as present rather than as an empty row; a genuinely zero region stays
 * at exactly 0 so the floor can never imply activity that did not happen.
 */
export function regionSharePercent(count: number, total: number, minimumVisible = 3): number {
  if (!Number.isFinite(count) || !Number.isFinite(total)) return 0;
  if (total <= 0 || count <= 0) return 0;
  const share = (count / total) * 100;
  return Math.min(100, Math.max(share, minimumVisible));
}

// Reads real, persisted signup counts from Convex. Returns configured: false
// (not zeroed stats) when Convex isn't set up, so callers never present a
// fabricated "0" as if it were a live measurement.
export async function getNetworkStats(): Promise<NetworkStatsResult> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return { configured: false, stats: null };

  try {
    const client = new ConvexHttpClient(convexUrl);
    const stats = await client.query(publicStats, {});
    return { configured: true, stats };
  } catch {
    return { configured: false, stats: null };
  }
}
