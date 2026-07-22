import { NextResponse } from "next/server";
import { demoMatches } from "@/lib/demo-data";
import { startupProfileSchema } from "@/lib/domain";

type ExaResult = { title?: string; url?: string; author?: string; highlights?: string[] };

export async function POST(request: Request) {
  const parsed = startupProfileSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid founder profile", issues: parsed.error.flatten() }, { status: 400 });
  if (!process.env.EXA_API_KEY) return NextResponse.json({ mode: "preview", matches: demoMatches, notice: "EXA_API_KEY is not configured; returning clearly labeled sample data." });

  const profile = parsed.data;
  const query = `Venture capital firms investing at ${profile.stage} in ${profile.sectors.join(", ")} companies across ${profile.region}, with verified portfolio or investment thesis evidence`;
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.EXA_API_KEY },
    body: JSON.stringify({ query, type: "deep-lite", category: "company", numResults: 20, contents: { highlights: { maxCharacters: 1600 } }, moderation: true }),
  });
  if (!response.ok) return NextResponse.json({ error: "Investor discovery provider failed", providerStatus: response.status }, { status: 502 });
  const payload = await response.json() as { requestId?: string; results?: ExaResult[] };
  return NextResponse.json({ mode: "live", requestId: payload.requestId, results: payload.results ?? [], next: "Normalize and score these sources before creating any contact record." });
}
