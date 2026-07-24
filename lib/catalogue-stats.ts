import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export type CatalogueStats = {
  totalSignals: number;
  uniqueProfiles: number;
  last7Days: number;
  latestCreatedAt: number | null;
};

export type CatalogueStatsResult =
  | { configured: true; stats: CatalogueStats }
  | { configured: false; stats: null };

const publicStats = makeFunctionReference<"query", Record<string, never>, CatalogueStats>(
  "catalogue:publicStats",
);

// Reads real, persisted "Express interest" counts from Convex. Returns
// configured: false (not zeroed stats) when Convex isn't set up, matching
// lib/network-stats.ts so callers never present a fabricated number as live.
export async function getCatalogueStats(): Promise<CatalogueStatsResult> {
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
