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
