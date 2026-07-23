import { NextResponse } from "next/server";
import { getNetworkStats } from "@/lib/network-stats";

export const dynamic = "force-dynamic";

// Public, non-PII aggregate counts of real interestSignups records. Returns
// configured: false rather than fabricated zeros when Convex is not set up.
export async function GET() {
  const result = await getNetworkStats();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
