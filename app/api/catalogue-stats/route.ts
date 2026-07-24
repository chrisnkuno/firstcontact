import { NextResponse } from "next/server";
import { getCatalogueStats } from "@/lib/catalogue-stats";

export const dynamic = "force-dynamic";

// Public, non-PII aggregate counts of real catalogueInterestSignals records.
// Returns configured: false rather than fabricated zeros when Convex is not
// set up, matching /api/stats.
export async function GET() {
  const result = await getCatalogueStats();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
